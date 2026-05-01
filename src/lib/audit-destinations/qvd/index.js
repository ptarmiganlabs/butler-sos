import { QvdDataFrame } from 'qvdjs';
import globals from '../../../globals.js';
import { createAuditDestination } from '../shared/base.js';

/**
 * Returns the audit-specific QVD destination config subtree.
 *
 * @returns {object} Config subtree.
 */
function getAuditQvdConfig() {
    return globals.config.get('Butler-SOS.auditEvents.destination.qvd.metadata');
}

const destination = createAuditDestination({
    label: 'QVD',
    fileExtension: 'qvd',
    getConfig: getAuditQvdConfig,
    staticTagsKey: 'Butler-SOS.auditEvents.destination.qvd.metadata.staticTags',
    /**
     * Write the buffered rows to a QVD file.
     *
     * @param {Array<Record<string, unknown>>} rowsToWrite Rows to persist.
     * @param {{ filePath: string, exportDir: string }} ctx Write context produced by the shared factory.
     * @returns {Promise<void>}
     */
    writeRows: async (rowsToWrite, { filePath, exportDir }) => {
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
            'objectType',
            'selectionTxnId',
            'durationMs',
            'visible',
            'enteredAt',
            'leftAt',
            'dataStateId',
            'selectionDetails',
            'screenshotUrl',
            'screenshotSavedPaths',
            'objectData',
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
            r.objectType,
            r.selectionTxnId,
            r.durationMs !== null ? Number(r.durationMs) : null,
            r.visible === null ? null : r.visible ? -1 : 0,
            r.enteredAt,
            r.leftAt,
            r.dataStateId !== null ? Number(r.dataStateId) : null,
            r.selectionDetails,
            r.screenshotUrl,
            r.screenshotSavedPaths,
            r.objectData,
            r.tags,
        ]);

        const df = await QvdDataFrame.fromDict({ columns, data });
        await df.toQvd(filePath, { allowedDir: exportDir });
    },
});

/**
 * Buffer an audit event for QVD storage.
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata.
 * @returns {void}
 */
export function bufferAuditQvdEvent(envelope, extras = {}) {
    destination.bufferEvent(envelope, extras);
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
        !globals.config.has('Butler-SOS.auditEvents.destination.qvd.metadata') ||
        globals.config.get('Butler-SOS.auditEvents.destination.qvd.metadata') === null
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
    destination._resetState();
}
