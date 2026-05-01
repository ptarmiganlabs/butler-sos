import fs from 'node:fs';
import { parquetWriteBuffer } from 'hyparquet-writer';
import globals from '../../../globals.js';
import { createAuditDestination } from '../shared/base.js';

/**
 * Returns the audit-specific Parquet destination config subtree.
 *
 * @returns {object} Config subtree.
 */
function getAuditParquetConfig() {
    return globals.config.get('Butler-SOS.auditEvents.destination.parquet.metadata');
}

const destination = createAuditDestination({
    label: 'PARQUET',
    displayName: 'Parquet',
    fileExtension: 'parquet',
    getConfig: getAuditParquetConfig,
    staticTagsKey: 'Butler-SOS.auditEvents.destination.parquet.metadata.staticTags',
    /**
     * Write the buffered rows to a Parquet file.
     *
     * @param {Array<Record<string, unknown>>} rowsToWrite Rows to persist.
     * @param {{ filePath: string }} ctx Write context produced by the shared factory.
     * @returns {Promise<void>}
     */
    writeRows: async (rowsToWrite, { filePath }) => {
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
            { name: 'objectType', type: 'STRING', data: rowsToWrite.map((r) => r.objectType) },
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
            {
                name: 'objectData',
                type: 'STRING',
                data: rowsToWrite.map((r) => r.objectData),
            },
            { name: 'tags', type: 'STRING', data: rowsToWrite.map((r) => r.tags) },
        ];

        const buffer = await parquetWriteBuffer({ columnData });
        fs.writeFileSync(filePath, new Uint8Array(buffer));
    },
});

/**
 * Buffer an audit event for Parquet storage.
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata.
 * @returns {void}
 */
export function bufferAuditParquetEvent(envelope, extras = {}) {
    destination.bufferEvent(envelope, extras);
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
        !globals.config.has('Butler-SOS.auditEvents.destination.parquet.metadata') ||
        globals.config.get('Butler-SOS.auditEvents.destination.parquet.metadata') === null
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
    destination._resetState();
}
