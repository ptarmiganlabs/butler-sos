/**
 * Factory for building file-based audit-event destinations.
 *
 * Both the Parquet and QVD destinations share a common pattern: events are
 * appended to an in-memory buffer that is flushed to a rotated `YYYYMMDD_partN.<ext>`
 * file either when a maximum batch size is reached or when a write-frequency
 * timer fires. This factory owns the buffer, timer, file-rotation and
 * error-recovery behaviour so each destination only has to provide the format-
 * specific row writer.
 */

import fs from 'node:fs';
import path from 'node:path';
import globals from '../../../globals.js';
import { extractAuditEventFields } from './extract-fields.js';
import { getAuditDestinationEnabled } from './helpers.js';

/**
 * @typedef {object} CreateAuditDestinationOptions
 * @property {string} label Short uppercase label used as a log-line prefix (e.g. `PARQUET`, `QVD`).
 * @property {string} [displayName] Mixed-case form used in human-readable log text. Defaults to `label`.
 * @property {string} fileExtension File extension (without leading dot) for the output files.
 * @property {() => object} getConfig Returns the destination's config subtree.
 * @property {string} staticTagsKey Config key for the destination's static tags array.
 * @property {(rows: Array<Record<string, unknown>>, ctx: { filePath: string, exportDir: string, cfg: object }) => Promise<void>} writeRows
 *           Format-specific writer that persists the rows to `filePath`.
 */

/**
 * Build a file-based audit-event destination with shared buffer/flush logic.
 *
 * @param {CreateAuditDestinationOptions} options Factory options.
 * @returns {{
 *   bufferEvent: (envelope: unknown, extras?: object) => void,
 *   _resetState: () => void,
 * }} Destination API.
 */
export function createAuditDestination({
    label,
    displayName,
    fileExtension,
    getConfig,
    staticTagsKey,
    writeRows,
}) {
    const name = displayName ?? label;
    let buffer = [];
    let flushTimer = null;
    let flushQueued = false;

    /**
     * Stop the interval-based flush timer.
     *
     * @returns {void}
     */
    function stopFlushTimer() {
        if (flushTimer) {
            clearInterval(flushTimer);
            flushTimer = null;
        }
    }

    /**
     * Ensure the interval-based flush timer exists when buffering is enabled.
     *
     * @param {object} cfg Destination config.
     * @returns {void}
     */
    function ensureFlushTimer(cfg) {
        const writeFrequency = cfg?.writeFrequency ?? 0;

        if (!getAuditDestinationEnabled() || writeFrequency <= 0) {
            stopFlushTimer();
            return;
        }

        if (flushTimer) return;

        flushTimer = setInterval(() => {
            requestFlush('interval');
        }, writeFrequency);
    }

    /**
     * Request a buffer flush, coalescing concurrent requests.
     *
     * @param {string} reason Reason for flush.
     * @returns {Promise<void>}
     */
    async function requestFlush(reason) {
        if (flushQueued || buffer.length === 0) return;

        flushQueued = true;
        try {
            await flushBuffer(reason);
        } finally {
            flushQueued = false;
        }
    }

    /**
     * Flush the audit buffer to disk via the format-specific writer.
     *
     * @param {string} reason Reason for flush.
     * @returns {Promise<void>}
     */
    async function flushBuffer(reason) {
        const rowsToWrite = [...buffer];
        buffer = [];

        if (rowsToWrite.length === 0) return;

        globals.logger.debug(
            `AUDIT ${label}: Flushing ${rowsToWrite.length} events to disk (reason=${reason})`
        );

        try {
            const cfg = getConfig();
            const exportDir = path.resolve(cfg.exportDirectory);

            // Ensure directory exists
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            // Determine filename: YYYYMMDD_partN.<ext> (UTC)
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

            let part = 1;
            let fileName;
            let filePath;
            while (true) {
                fileName = `${dateStr}_part${part}.${fileExtension}`;
                filePath = path.join(exportDir, fileName);
                if (!fs.existsSync(filePath)) {
                    break;
                }
                part++;
            }

            // Delegate format-specific persistence
            await writeRows(rowsToWrite, { filePath, exportDir, cfg });

            globals.logger.info(
                `AUDIT ${label}: Wrote ${rowsToWrite.length} events to ${filePath}`
            );
        } catch (err) {
            globals.logger.error(
                `AUDIT ${label}: Error flushing audit ${name} buffer: ${globals.getErrorMessage(err)}`
            );
            // Put rows back at the beginning of the buffer
            buffer = [...rowsToWrite, ...buffer];
        }
    }

    /**
     * Buffer an audit event for later persistence.
     *
     * @param {unknown} envelope Audit event envelope.
     * @param {object} [extras] Optional handler-produced metadata.
     * @returns {void}
     */
    function bufferEvent(envelope, extras = {}) {
        const cfg = getConfig();

        if (!cfg || typeof cfg !== 'object') {
            globals.logger.warn(
                `AUDIT ${label}: ${name} destination config subtree is missing or invalid`
            );
            return;
        }

        if (typeof cfg.exportDirectory !== 'string' || cfg.exportDirectory.length === 0) {
            globals.logger.warn(
                `AUDIT ${label}: ${name} destination config is missing a valid exportDirectory`
            );
            return;
        }

        ensureFlushTimer(cfg);

        const row = extractAuditEventFields(envelope, extras, staticTagsKey);
        buffer.push(row);

        if (cfg.maxBatchSize > 0 && buffer.length >= cfg.maxBatchSize) {
            requestFlush('batchSize');
        }
    }

    /**
     * Reset the destination's internal state.
     * ONLY FOR TESTING PURPOSES.
     *
     * @returns {void}
     */
    function _resetState() {
        buffer = [];
        stopFlushTimer();
        flushQueued = false;
    }

    return { bufferEvent, _resetState };
}
