import globals from '../../globals.js';
import { writeAuditEventToInfluxdb } from './influxdb/index.js';
import { writeAuditEventToParquet } from './parquet/index.js';

/**
 * Write an audit event to all configured audit destinations.
 *
 * This is intentionally separate from Butler SOS' existing destinations/influxdbConfig,
 * as audit data can be stored in a separate InfluxDB instance/version/bucket/db.
 *
 * @param {unknown} envelope Audit event envelope.
 * @param {object} [extras] Optional handler-produced metadata (e.g. screenshot saved paths).
 * @returns {Promise<void>}
 */
export async function writeAuditEventToDestinations(envelope, extras = {}) {
    try {
        const destinationEnabled =
            globals.config.has('Butler-SOS.auditEvents.destination.enable') &&
            globals.config.get('Butler-SOS.auditEvents.destination.enable') === true;

        if (!destinationEnabled) return;

        const destinationType = globals.config.get('Butler-SOS.auditEvents.destination.type');
        const destinations = destinationType.split(',').map((d) => d.trim().toLowerCase());

        for (const destination of destinations) {
            if (destination === 'influxdb') {
                await writeAuditEventToInfluxdb(envelope, extras);
            } else if (destination === 'parquet') {
                await writeAuditEventToParquet(envelope, extras);
            } else {
                globals.logger.warn(
                    `AUDIT DESTINATION: Unknown destination type='${destination}'. Event not stored.`
                );
            }
        }
    } catch (err) {
        globals.logger.error(
            `AUDIT DESTINATION: Error writing audit event to destination(s): ${globals.getErrorMessage(
                err
            )}`
        );
    }
}
