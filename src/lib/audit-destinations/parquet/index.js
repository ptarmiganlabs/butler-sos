import fs from 'node:fs';
import path from 'node:path';
import { parquetWriteBuffer } from 'hyparquet-writer';
import globals from '../../../globals.js';

let auditParquetBuffer = [];
let flushTimer = null;
let flushQueued = false;

/**
 * Convert unknown input into a non-empty string.
 *
 * @param {unknown} value Input value.
 * @returns {string | undefined} Non-empty string value.
 */
function readString(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Convert unknown input into a finite number.
 *
 * @param {unknown} value Input value.
 * @returns {number | undefined} Finite number value.
 */
function readNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Convert unknown input into a boolean.
 *
 * @param {unknown} value Input value.
 * @returns {boolean | undefined} Boolean value.
 */
function readBoolean(value) {
    return typeof value === 'boolean' ? value : undefined;
}

/**
 * Convert unknown input into a plain object reference.
 *
 * @param {unknown} value Input value.
 * @returns {Record<string, unknown> | undefined} Object value.
 */
function asObject(value) {
    return value && typeof value === 'object' ? value : undefined;
}

/**
 * Returns true if audit destinations are enabled.
 *
 * @returns {boolean} True when audit destinations are enabled.
 */
function getAuditDestinationEnabled() {
    return (
        globals.config.has('Butler-SOS.auditEvents.destination.enable') &&
        globals.config.get('Butler-SOS.auditEvents.destination.enable') === true
    );
}

/**
 * Returns the audit-specific Parquet destination config subtree.
 *
 * @returns {object} Config subtree.
 */
function getAuditParquetConfig() {
    return globals.config.get('Butler-SOS.auditEvents.destination.parquet');
}

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
 * @param {object} cfg Parquet destination config.
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
 * Request a buffer flush.
 *
 * @param {string} reason Reason for flush.
 * @returns {Promise<void>}
 */
async function requestFlush(reason) {
    if (flushQueued || auditParquetBuffer.length === 0) return;

    flushQueued = true;
    try {
        await flushAuditParquetBuffer(reason);
    } finally {
        flushQueued = false;
    }
}

/**
 * Flush the audit Parquet buffer to disk.
 *
 * @param {string} reason Reason for flush.
 * @returns {Promise<void>}
 */
async function flushAuditParquetBuffer(reason) {
    const rowsToWrite = [...auditParquetBuffer];
    auditParquetBuffer = [];

    if (rowsToWrite.length === 0) return;

    globals.logger.debug(
        `AUDIT PARQUET: Flushing ${rowsToWrite.length} events to disk (reason=${reason})`
    );

    try {
        const cfg = getAuditParquetConfig();
        const exportDir = path.resolve(cfg.exportDirectory);

        // Ensure directory exists
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        // Determine filename: YYYYMMDD_partN.parquet (UTC)
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

        let part = 1;
        let fileName;
        let filePath;
        while (true) {
            fileName = `${dateStr}_part${part}.parquet`;
            filePath = path.join(exportDir, fileName);
            if (!fs.existsSync(filePath)) {
                break;
            }
            part++;
        }

        // Convert row-based data to columnar format for hyparquet-writer
        const columnData = [
            { name: 'timestamp', type: 'INT64', data: rowsToWrite.map((r) => r.timestamp) },
            { name: 'date', type: 'STRING', data: rowsToWrite.map((r) => r.date) },
            { name: 'eventId', type: 'STRING', data: rowsToWrite.map((r) => r.eventId) },
            {
                name: 'correlationId',
                type: 'STRING',
                data: rowsToWrite.map((r) => r.correlationId),
            },
            { name: 'eventType', type: 'STRING', data: rowsToWrite.map((r) => r.eventType) },
            { name: 'userId', type: 'STRING', data: rowsToWrite.map((r) => r.userId) },
            { name: 'appId', type: 'STRING', data: rowsToWrite.map((r) => r.appId) },
            { name: 'appName', type: 'STRING', data: rowsToWrite.map((r) => r.appName) },
            { name: 'sheetId', type: 'STRING', data: rowsToWrite.map((r) => r.sheetId) },
            { name: 'sheetName', type: 'STRING', data: rowsToWrite.map((r) => r.sheetName) },
            { name: 'objectId', type: 'STRING', data: rowsToWrite.map((r) => r.objectId) },
            {
                name: 'selectionTxnId',
                type: 'STRING',
                data: rowsToWrite.map((r) => r.selectionTxnId),
            },
            { name: 'durationMs', type: 'INT64', data: rowsToWrite.map((r) => r.durationMs) },
            { name: 'visible', type: 'BOOLEAN', data: rowsToWrite.map((r) => r.visible) },
            { name: 'enteredAt', type: 'STRING', data: rowsToWrite.map((r) => r.enteredAt) },
            { name: 'leftAt', type: 'STRING', data: rowsToWrite.map((r) => r.leftAt) },
            { name: 'dataStateId', type: 'INT64', data: rowsToWrite.map((r) => r.dataStateId) },
            {
                name: 'selectionDetails',
                type: 'STRING',
                data: rowsToWrite.map((r) => r.selectionDetails),
            },
            {
                name: 'screenshotUrl',
                type: 'STRING',
                data: rowsToWrite.map((r) => r.screenshotUrl),
            },
            {
                name: 'screenshotSavedPaths',
                type: 'STRING',
                data: rowsToWrite.map((r) => r.screenshotSavedPaths),
            },
            { name: 'tags', type: 'STRING', data: rowsToWrite.map((r) => r.tags) },
        ];

        // Write file
        const buffer = await parquetWriteBuffer({ columnData });
        fs.writeFileSync(filePath, new Uint8Array(buffer));

        globals.logger.info(`AUDIT PARQUET: Wrote ${rowsToWrite.length} events to ${filePath}`);
    } catch (err) {
        globals.logger.error(
            `AUDIT PARQUET: Error flushing audit Parquet buffer: ${globals.getErrorMessage(err)}`
        );
        // Put rows back at the beginning of the buffer
        auditParquetBuffer = [...rowsToWrite, ...auditParquetBuffer];
    }
}

/**
 * Buffer an audit event for Parquet storage.
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata.
 * @returns {void}
 */
export function bufferAuditParquetEvent(envelope, extras = {}) {
    const cfg = getAuditParquetConfig();
    ensureFlushTimer(cfg);

    const env = asObject(envelope) || {};
    const payload = asObject(env.payload) || {};
    const context = asObject(payload.context) || {};
    const event = asObject(payload.event) || {};

    // Map to schema
    const row = {
        eventId: readString(env.eventId) ?? null,
        correlationId: readString(env.correlationId) ?? null,
        eventType: readString(env.type) || 'unknown',
        userId: readString(context.user) ?? null,
        appId: readString(context.appId) ?? null,
        appName: readString(context.appName) ?? null,
        sheetId: readString(context.sheetId) ?? null,
        sheetName: readString(context.sheetName) ?? null,
        objectId: readString(event.objectId) ?? null,
        selectionTxnId: readString(event.selectionTxnId) ?? null,
        durationMs:
            readNumber(event.duration) !== undefined ? BigInt(readNumber(event.duration)) : null,
        visible: readBoolean(event.visible) ?? null,
        enteredAt: readString(event.enteredAt) ?? null,
        leftAt: readString(event.leftAt) ?? null,
        dataStateId:
            readNumber(event.dataStateId) !== undefined
                ? BigInt(readNumber(event.dataStateId))
                : readNumber(extras.dataStateId) !== undefined
                  ? BigInt(readNumber(extras.dataStateId))
                  : null,
        screenshotUrl: readString(event.screenshotUrl) ?? null,
    };

    // Selection details
    const selectionDetails = extras.selectionDetails;
    if (Array.isArray(selectionDetails) && selectionDetails.length > 0) {
        row.selectionDetails = JSON.stringify(selectionDetails);
    } else {
        row.selectionDetails = null;
    }

    // Screenshot saved paths
    const savedPaths = extras?.screenshot?.savedPaths;
    if (Array.isArray(savedPaths) && savedPaths.length > 0) {
        row.screenshotSavedPaths = JSON.stringify(savedPaths);
    } else {
        row.screenshotSavedPaths = null;
    }

    // Timestamp and Date
    row.timestamp = null;
    row.date = null;
    const ts = readString(env.timestamp);
    if (ts) {
        const parsed = Date.parse(ts);
        if (!Number.isNaN(parsed)) {
            row.timestamp = BigInt(parsed);
            const d = new Date(parsed);
            row.date = d.toISOString().split('T')[0].replace(/-/g, '');
        }
    }

    // Tags (static + dynamic)
    const tags = {};
    if (
        globals.config.has('Butler-SOS.auditEvents.destination.parquet.staticTags') &&
        Array.isArray(globals.config.get('Butler-SOS.auditEvents.destination.parquet.staticTags'))
    ) {
        const staticTags = globals.config.get(
            'Butler-SOS.auditEvents.destination.parquet.staticTags'
        );
        for (const item of staticTags) {
            if (item?.name && item?.value) {
                tags[String(item.name)] = String(item.value);
            }
        }
    }
    row.tags = Object.keys(tags).length > 0 ? JSON.stringify(tags) : null;

    auditParquetBuffer.push(row);

    if (cfg.maxBatchSize > 0 && auditParquetBuffer.length >= cfg.maxBatchSize) {
        requestFlush('batchSize');
    }
}

/**
 * Writes an audit event to Parquet using the audit-specific destination config.
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata.
 * @returns {Promise<void>}
 */
export async function writeAuditEventToParquet(envelope, extras = {}) {
    if (
        !globals.config.has('Butler-SOS.auditEvents.destination.parquet') ||
        globals.config.get('Butler-SOS.auditEvents.destination.parquet') === null
    ) {
        return;
    }

    bufferAuditParquetEvent(envelope, extras);
}

/**
 * Reset the internal state of the Parquet destination.
 * ONLY FOR TESTING PURPOSES.
 *
 * @returns {void}
 */
export function _resetState() {
    auditParquetBuffer = [];
    stopFlushTimer();
    flushQueued = false;
}
