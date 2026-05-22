import globals from '../../../../globals.js';
import { writeToInfluxWithRetry } from '../../../influxdb/shared/utils.js';

import { getAuditInfluxClient } from '../shared/client.js';
import { buildAuditInfluxPoint, buildAuditInfluxPointModel } from '../shared/mapping.js';

/**
 * Writes an audit event point to InfluxDB v3 using the audit destination config.
 *
 * @param {unknown} envelope Audit event envelope
 * @param {object} extras Optional handler-produced metadata
 * @returns {Promise<void>}
 */
export async function writeAuditEventInfluxV3(envelope, extras = {}) {
    const clientInfo = getAuditInfluxClient();
    if (!clientInfo?.client) return;

    const { client, database } = clientInfo;

    const model = buildAuditInfluxPointModel(envelope, extras);

    const point = buildAuditInfluxPoint(model, 3);

    await writeToInfluxWithRetry(
        async () => {
            const lineProtocol = point.toLineProtocol();
            await client.write(lineProtocol, database);
        },
        `Audit event (${model.tags.eventType})`,
        'v3',
        'audit-events'
    );

    globals.logger.verbose('AUDIT INFLUX V3: Wrote audit event to InfluxDB');
}
