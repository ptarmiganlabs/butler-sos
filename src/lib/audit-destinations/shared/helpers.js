/**
 * Shared helper utilities for audit-event destinations.
 *
 * These small coercion helpers and the destination-enabled probe are used by
 * every audit destination that needs to translate raw envelope values into
 * defensible row data, so they live here to avoid duplication.
 */

import globals from '../../../globals.js';

/**
 * Convert unknown input into a non-empty string.
 *
 * @param {unknown} value Input value.
 * @returns {string | undefined} Non-empty string value.
 */
export function readString(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Convert unknown input into a finite number.
 *
 * @param {unknown} value Input value.
 * @returns {number | undefined} Finite number value.
 */
export function readNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Convert unknown input into a boolean.
 *
 * @param {unknown} value Input value.
 * @returns {boolean | undefined} Boolean value.
 */
export function readBoolean(value) {
    return typeof value === 'boolean' ? value : undefined;
}

/**
 * Convert unknown input into a plain object reference.
 *
 * @param {unknown} value Input value.
 * @returns {Record<string, unknown> | undefined} Object value.
 */
export function asObject(value) {
    return value && typeof value === 'object' ? value : undefined;
}

/**
 * Returns true if audit destinations are enabled.
 *
 * @returns {boolean} True when audit destinations are enabled.
 */
export function getAuditDestinationEnabled() {
    return (
        globals.config.has('Butler-SOS.auditEvents.destination.enable') &&
        globals.config.get('Butler-SOS.auditEvents.destination.enable') === true
    );
}
