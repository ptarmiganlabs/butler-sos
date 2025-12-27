import globals from '../../../../globals.js';

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
 * Builds a version-agnostic representation of the audit point.
 *
 * @param {unknown} envelope Audit event envelope
 * @param {object} extras Optional handler-produced metadata
 * @returns {{ measurementName: string, timestampMs?: number, tags: Record<string,string>, fields: Record<string, string|number|boolean> }} Point model.
 */
export function buildAuditInfluxPointModel(envelope, extras = {}) {
    const env = asObject(envelope) || {};
    const payload = asObject(env.payload) || {};
    const context = asObject(payload.context) || {};
    const event = asObject(payload.event) || {};

    const measurementName = globals.config.get(
        'Butler-SOS.auditEvents.destination.influxdb.measurementName'
    );

    const auditEventSchemaVersion = globals.config.get(
        'Butler-SOS.auditEvents.destination.influxdb.auditEventSchemaVersion'
    );

    /** @type {Record<string, string>} */
    const tags = {
        eventType: readString(env.type) || 'unknown',
        auditEventSchemaVersion: String(auditEventSchemaVersion ?? '1'),
    };

    const eventId = readString(env.eventId);
    if (eventId) tags.eventId = eventId;

    const correlationId = readString(env.correlationId);
    if (correlationId) tags.correlationId = correlationId;

    const selectionTxnId = readString(event.selectionTxnId);
    if (selectionTxnId) tags.selectionTxnId = selectionTxnId;

    const userId = readString(context.user);
    if (userId) tags.userId = userId;

    const appId = readString(context.appId);
    if (appId) tags.appId = appId;

    const appName = readString(context.appName);
    if (appName) tags.appName = appName;

    // Optional static tags from config
    if (
        globals.config.has('Butler-SOS.auditEvents.destination.influxdb.staticTags') &&
        Array.isArray(globals.config.get('Butler-SOS.auditEvents.destination.influxdb.staticTags'))
    ) {
        const staticTags = globals.config.get(
            'Butler-SOS.auditEvents.destination.influxdb.staticTags'
        );
        for (const item of staticTags) {
            if (item?.name && item?.value) {
                tags[String(item.name)] = String(item.value);
            }
        }
    }

    /** @type {Record<string, string|number|boolean>} */
    const fields = {};

    const sheetId = readString(context.sheetId);
    if (sheetId) fields.sheetId = sheetId;

    const sheetName = readString(context.sheetName);
    if (sheetName) fields.sheetName = sheetName;

    const objectId = readString(event.objectId);
    if (objectId) fields.objectId = objectId;

    // Visibility duration
    const duration = readNumber(event.duration);
    if (duration !== undefined) fields.durationMs = duration;

    const visible = readBoolean(event.visible);
    if (visible !== undefined) fields.visible = visible;

    // Object view duration (ISO timestamps + txn id snapshots)
    const enteredAt = readString(event.enteredAt);
    if (enteredAt) fields.enteredAt = enteredAt;

    const leftAt = readString(event.leftAt);
    if (leftAt) fields.leftAt = leftAt;

    const enterSelectionTxnId = readString(event.enterSelectionTxnId);
    if (enterSelectionTxnId) fields.enterSelectionTxnId = enterSelectionTxnId;

    const leaveSelectionTxnId = readString(event.leaveSelectionTxnId);
    if (leaveSelectionTxnId) fields.leaveSelectionTxnId = leaveSelectionTxnId;

    // Screenshot URL
    const screenshotUrl = readString(event.screenshotUrl);
    if (screenshotUrl) fields.screenshotUrl = screenshotUrl;

    // Extras from handlers (e.g. screenshot saved paths)
    const savedPaths = extras?.screenshot?.savedPaths;
    if (Array.isArray(savedPaths) && savedPaths.length > 0) {
        fields.screenshotSavedPaths = JSON.stringify(savedPaths);
    }

    let timestampMs;
    const ts = readString(env.timestamp);
    if (ts) {
        const parsed = Date.parse(ts);
        if (!Number.isNaN(parsed)) timestampMs = parsed;
    }

    return {
        measurementName:
            typeof measurementName === 'string' && measurementName.length > 0
                ? measurementName
                : 'audit_event',
        timestampMs,
        tags,
        fields,
    };
}
