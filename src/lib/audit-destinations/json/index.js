import fs from 'node:fs';
import path from 'node:path';
import globals from '../../../globals.js';

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
 * Sanitise a value for use as a filename component.
 * Strips everything except alphanumerics, dots, hyphens, and underscores.
 *
 * @param {unknown} value Input value.
 * @returns {string} Safe filename component.
 */
function sanitizeFilenameComponent(value) {
    if (typeof value !== 'string' || value.length === 0) return 'none';
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
}

/**
 * Formats an ISO timestamp into a filesystem-friendly UTC string.
 * Matches the screenshot naming convention: `YYYYMMDDThhmmss.mmmZ`.
 *
 * @param {string | null | undefined} timestamp ISO-8601 timestamp.
 * @returns {string} Formatted timestamp.
 */
function formatTimestampForFilename(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(date.getTime())) return 'invalid_timestamp';

    const pad = (n, width = 2) => String(n).padStart(width, '0');

    const yyyy = date.getUTCFullYear();
    const mm = pad(date.getUTCMonth() + 1);
    const dd = pad(date.getUTCDate());
    const hh = pad(date.getUTCHours());
    const mi = pad(date.getUTCMinutes());
    const ss = pad(date.getUTCSeconds());
    const ms = pad(date.getUTCMilliseconds(), 3);

    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}.${ms}Z`;
}

/**
 * Returns the JSON objectdata destination config subtree.
 *
 * @returns {object | null} Config subtree, or null when not configured.
 */
function getJsonObjectdataConfig() {
    if (
        !globals.config.has('Butler-SOS.auditEvents.destination.json.objectdata') ||
        globals.config.get('Butler-SOS.auditEvents.destination.json.objectdata') === null
    ) {
        return null;
    }
    return globals.config.get('Butler-SOS.auditEvents.destination.json.objectdata');
}

/**
 * Write an audit event's objectData to a per-event JSON file on disk.
 *
 * File naming matches the screenshot convention for easy correlation:
 *   `{timestamp}_{eventId}_{correlationId}.json`
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata.
 * @returns {Promise<void>}
 */
export async function writeAuditEventToJson(envelope, extras = {}) {
    const cfg = getJsonObjectdataConfig();
    if (!cfg || cfg.enable !== true) return;

    const env = asObject(envelope) || {};
    const payload = asObject(env.payload) || {};
    const context = asObject(payload.context) || {};
    const event = asObject(payload.event) || {};

    const objectData = asObject(event.objectData);
    if (!objectData) {
        globals.logger.debug(
            'AUDIT JSON: Event has no objectData, skipping JSON destination write.'
        );
        return;
    }

    try {
        const exportDir = path.resolve(cfg.exportDirectory || 'audit-events/json');

        // Ensure directory exists
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        // Build filename matching screenshot convention
        const ts = formatTimestampForFilename(readString(env.timestamp));
        const eventId = sanitizeFilenameComponent(env.eventId);
        const correlationId = sanitizeFilenameComponent(env.correlationId);
        const fileName = `${ts}_${eventId}_${correlationId}.json`;
        const filePath = path.join(exportDir, fileName);

        // Prevent path traversal: the resolved path must remain inside exportDir.
        // path.resolve(exportDir) is already absolute (set above), so this check
        // handles both absolute and relative exportDirectory config values.
        const resolvedFilePath = path.resolve(filePath);
        if (!resolvedFilePath.startsWith(exportDir + path.sep)) {
            throw new Error(
                `AUDIT JSON: Resolved output path "${resolvedFilePath}" is outside the allowed directory "${exportDir}". Aborting write.`
            );
        }

        // Build the JSON document
        const doc = {
            eventId: readString(env.eventId) ?? null,
            correlationId: readString(env.correlationId) ?? null,
            timestamp: readString(env.timestamp) ?? null,
            eventType: readString(env.type) || 'unknown',
            userId: readString(context.user) ?? null,
            appId: readString(context.appId) ?? null,
            appName: readString(context.appName) ?? null,
            sheetId: readString(context.sheetId) ?? null,
            sheetName: readString(context.sheetName) ?? null,
            objectId: readString(event.objectId) ?? null,
            objectType: readString(objectData.objectType) ?? null,
            selectionTxnId: readString(event.selectionTxnId) ?? null,
            durationMs: readNumber(event.duration) ?? null,
            visible: readBoolean(event.visible) ?? null,
            enteredAt: readString(event.enteredAt) ?? null,
            leftAt: readString(event.leftAt) ?? null,
            dataStateId: readNumber(event.dataStateId) ?? readNumber(extras.dataStateId) ?? null,
            screenshotUrl: readString(event.screenshotUrl) ?? null,
        };

        // Screenshot saved paths
        const savedPaths = extras?.screenshot?.savedPaths;
        if (Array.isArray(savedPaths) && savedPaths.length > 0) {
            doc.screenshotSavedPaths = savedPaths;
        } else {
            doc.screenshotSavedPaths = null;
        }

        // Selection details
        const selectionDetails = extras.selectionDetails;
        if (Array.isArray(selectionDetails) && selectionDetails.length > 0) {
            doc.selectionDetails = selectionDetails;
        } else {
            doc.selectionDetails = null;
        }

        // The full objectData payload (the primary purpose of this destination)
        doc.objectData = objectData;

        // Static tags from config
        const tags = {};
        if (
            globals.config.has('Butler-SOS.auditEvents.destination.json.objectdata.staticTags') &&
            Array.isArray(
                globals.config.get('Butler-SOS.auditEvents.destination.json.objectdata.staticTags')
            )
        ) {
            const staticTags = globals.config.get(
                'Butler-SOS.auditEvents.destination.json.objectdata.staticTags'
            );
            for (const item of staticTags) {
                if (item?.name && item?.value) {
                    tags[String(item.name)] = String(item.value);
                }
            }
        }
        doc.tags = Object.keys(tags).length > 0 ? tags : null;

        fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8');

        globals.logger.info(`AUDIT JSON: Wrote objectData to ${filePath}`);
    } catch (err) {
        globals.logger.error(
            `AUDIT JSON: Error writing objectData to JSON file: ${globals.getErrorMessage(err)}`
        );
    }
}
