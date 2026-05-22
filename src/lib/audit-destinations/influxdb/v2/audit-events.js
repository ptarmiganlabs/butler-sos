import globals from '../../../../globals.js';
import { writeToInfluxWithRetry, writePointsToInfluxV2 } from '../../../influxdb/shared/utils.js';

import { getAuditInfluxClient } from '../shared/client.js';
import { buildAuditInfluxPoint, buildAuditInfluxPointModel } from '../shared/mapping.js';

/**
 * Writes an audit event point to InfluxDB v2 using the audit destination config.
 *
 * @param {unknown} envelope Audit event envelope
 * @param {object} extras Optional handler-produced metadata
 * @returns {Promise<void>}
 */
export async function writeAuditEventInfluxV2(envelope, extras = {}) {
    const clientInfo = getAuditInfluxClient();
    if (!clientInfo?.client) return;

    const { client, org, bucket } = clientInfo;

    const model = buildAuditInfluxPointModel(envelope, extras);

    const point = buildAuditInfluxPoint(model, 2);

    await writeToInfluxWithRetry(
        () => writePointsToInfluxV2(client, org, bucket, point),
        `Audit event (${model.tags.eventType})`,
        'v2',
        'audit-events'
    );

    globals.logger.verbose('AUDIT INFLUX V2: Wrote audit event to InfluxDB');
}
