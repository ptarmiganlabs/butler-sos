import globals from '../../../globals.js';

import { writeAuditEventInfluxV1 } from './v1/audit-events.js';
import { writeAuditEventInfluxV2 } from './v2/audit-events.js';
import { writeAuditEventInfluxV3 } from './v3/audit-events.js';

function getAuditInfluxVersion() {
    return globals.config.get('Butler-SOS.auditEvents.destination.influxdb.version');
}

/**
 * Routes audit event writes to the correct InfluxDB version implementation.
 *
 * @param {unknown} envelope Audit event envelope
 * @param {object} extras Optional handler-produced metadata
 * @returns {Promise<void>}
 */
export async function writeAuditEventToInfluxdbFactory(envelope, extras = {}) {
    const version = getAuditInfluxVersion();

    if (version === 1) {
        return writeAuditEventInfluxV1(envelope, extras);
    }

    if (version === 2) {
        return writeAuditEventInfluxV2(envelope, extras);
    }

    if (version === 3) {
        return writeAuditEventInfluxV3(envelope, extras);
    }

    globals.logger.warn(`AUDIT INFLUX FACTORY: Unsupported InfluxDB version v${version}`);
}
