import fs from 'node:fs';
import path from 'node:path';
import { QvdDataFrame } from 'qvdjs';
import globals from '../../../globals.js';

let auditQvdBuffer = [];
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
 * Returns the audit-specific QVD destination config subtree.
 *
 * @returns {object} Config subtree.
 */
function getAuditQvdConfig() {
    return globals.config.get('Butler-SOS.auditEvents.destination.qvd');
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
 * @param {object} cfg QVD destination config.
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
    if (flushQueued || auditQvdBuffer.length === 0) return;

    flushQueued = true;
    try {
        await flushAuditQvdBuffer(reason);
    } finally {
        flushQueued = false;
    }
}

/**
 * Flush the audit QVD buffer to disk.
 *
 * @param {string} reason Reason for flush.
 * @returns {Promise<void>}
 */
async function flushAuditQvdBuffer(reason) {
    const rowsToWrite = [...auditQvdBuffer];
    auditQvdBuffer = [];

    if (rowsToWrite.length === 0) return;

    globals.logger.debug(
        `AUDIT QVD: Flushing ${rowsToWrite.length} events to disk (reason=${reason})`
    );

    try {
        const cfg = getAuditQvdConfig();
        const exportDir = path.resolve(cfg.exportDirectory);

        // Ensure directory exists
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        // Determine filename: YYYYMMDD_partN.qvd (UTC)
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

        let part = 1;
        let fileName;
        let filePath;
        while (true) {
            fileName = `${dateStr}_part${part}.qvd`;
            filePath = path.join(exportDir, fileName);
            if (!fs.existsSync(filePath)) {
                break;
            }
            part++;
        }

        // Convert row-based data to dictionary format for qvdjs
        const columns = [
            'timestamp',
            'date',
            'eventId',
            'correlationId',
            'eventType',
            'userId',
            'appId',
            'appName',
            'sheetId',
            'sheetName',
            'objectId',
            'selectionTxnId',
            'durationMs',
            'visible',
            'enteredAt',
            'leftAt',
            'dataStateId',
            'selectionDetails',
            'screenshotUrl',
            'screenshotSavedPaths',
            'tags',
        ];

        const data = rowsToWrite.map((r) => [
            r.timestamp !== null ? Number(r.timestamp) : null,
            r.date,
            r.eventId,
            r.correlationId,
            r.eventType,
            r.userId,
            r.appId,
            r.appName,
            r.sheetId,
            r.sheetName,
            r.objectId,
            r.selectionTxnId,
            r.durationMs !== null ? Number(r.durationMs) : null,
            r.visible === null ? null : r.visible ? -1 : 0,
            r.enteredAt,
            r.leftAt,
            r.dataStateId !== null ? Number(r.dataStateId) : null,
            r.selectionDetails,
            r.screenshotUrl,
            r.screenshotSavedPaths,
            r.tags,
        ]);

        // Write file
        const df = await QvdDataFrame.fromDict({ columns, data });
        await df.toQvd(filePath);

        globals.logger.info(`AUDIT QVD: Wrote ${rowsToWrite.length} events to ${filePath}`);
    } catch (err) {
        globals.logger.error(
            `AUDIT QVD: Error flushing audit QVD buffer: ${globals.getErrorMessage(err)}`
        );
        // Put rows back at the beginning of the buffer
        auditQvdBuffer = [...rowsToWrite, ...auditQvdBuffer];
    }
}

/**
 * Buffer an audit event for QVD storage.
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata.
 * @returns {void}
 */
export function bufferAuditQvdEvent(envelope, extras = {}) {
    const cfg = getAuditQvdConfig();
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
        globals.config.has('Butler-SOS.auditEvents.destination.qvd.staticTags') &&
        Array.isArray(globals.config.get('Butler-SOS.auditEvents.destination.qvd.staticTags'))
    ) {
        const staticTags = globals.config.get('Butler-SOS.auditEvents.destination.qvd.staticTags');
        for (const item of staticTags) {
            if (item?.name && item?.value) {
                tags[String(item.name)] = String(item.value);
            }
        }
    }
    row.tags = Object.keys(tags).length > 0 ? JSON.stringify(tags) : null;

    auditQvdBuffer.push(row);

    if (cfg.maxBatchSize > 0 && auditQvdBuffer.length >= cfg.maxBatchSize) {
        requestFlush('batchSize');
    }
}

/**
 * Writes an audit event to QVD using the audit-specific destination config.
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata.
 * @returns {Promise<void>}
 */
export async function writeAuditEventToQvd(envelope, extras = {}) {
    if (
        !globals.config.has('Butler-SOS.auditEvents.destination.qvd') ||
        globals.config.get('Butler-SOS.auditEvents.destination.qvd') === null
    ) {
        return;
    }

    bufferAuditQvdEvent(envelope, extras);
}

/**
 * Reset the internal state of the QVD destination.
 * ONLY FOR TESTING PURPOSES.
 *
 * @returns {void}
 */
export function _resetState() {
    auditQvdBuffer = [];
    stopFlushTimer();
    flushQueued = false;
}
