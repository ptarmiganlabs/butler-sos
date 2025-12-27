import globals from '../../../globals.js';
import { bufferAuditInfluxEvent } from './buffer.js';

/**
 * Writes an audit event to InfluxDB using the audit-specific destination config.
 *
 * Config root:
 * - Butler-SOS.auditEvents.destination.influxdb
 *
 * @param {unknown} envelope Audit event envelope
 * @param {object} extras Optional handler-produced metadata
 * @returns {Promise<void>}
 */
export async function writeAuditEventToInfluxdb(envelope, extras = {}) {
    if (
        !globals.config.has('Butler-SOS.auditEvents.destination.influxdb') ||
        globals.config.get('Butler-SOS.auditEvents.destination.influxdb') === null
    ) {
        return;
    }

    bufferAuditInfluxEvent(envelope, extras);
}
