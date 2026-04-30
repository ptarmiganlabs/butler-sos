/**
 * Shared field extraction logic for audit-event destinations.
 *
 * Both the Parquet and QVD destinations need to translate the same audit-event
 * envelope shape into the same flat row schema. This module owns that
 * translation so the two destinations cannot drift.
 */

import globals from '../../../globals.js';
import { readString, readNumber, readBoolean, asObject } from './helpers.js';

/**
 * Extract a flat row representation of an audit event from a raw envelope.
 *
 * The returned row matches the Parquet/QVD schema used by all audit
 * destinations: timestamp, identifiers, context, event-specific fields,
 * extras-derived fields and a serialized tags map.
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata.
 * @param {string} staticTagsKey Config key for the destination's static tags array.
 * @returns {Record<string, unknown>} Flat row object.
 */
export function extractAuditEventFields(envelope, extras = {}, staticTagsKey) {
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

    // Object data and object type (always included in metadata rows)
    const dimData = asObject(event.objectData);
    if (dimData) {
        row.objectType = readString(dimData.objectType) ?? null;
        row.objectData = JSON.stringify(dimData);
    } else {
        row.objectType = null;
        row.objectData = null;
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

    // Static tags from config
    const tags = {};
    if (
        globals.config.has(staticTagsKey) &&
        Array.isArray(globals.config.get(staticTagsKey))
    ) {
        const staticTags = globals.config.get(staticTagsKey);
        for (const item of staticTags) {
            if (item?.name && item?.value) {
                tags[String(item.name)] = String(item.value);
            }
        }
    }
    row.tags = Object.keys(tags).length > 0 ? JSON.stringify(tags) : null;

    return row;
}
