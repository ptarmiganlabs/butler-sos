import globals from '../../../../globals.js';
import { writeToInfluxWithRetry } from '../../../influxdb/shared/utils.js';

import { getAuditInfluxClient } from '../shared/client.js';
import { buildAuditInfluxPointModel } from '../shared/mapping.js';

/**
 * Writes an audit event point to InfluxDB v1 using the audit destination config.
 *
 * @param {unknown} envelope Audit event envelope
 * @param {object} extras Optional handler-produced metadata
 * @returns {Promise<void>}
 */
export async function writeAuditEventInfluxV1(envelope, extras = {}) {
    const { client } = getAuditInfluxClient();
    if (!client) return;

    const model = buildAuditInfluxPointModel(envelope, extras);

    const datapoints = [
        {
            measurement: model.measurementName,
            tags: model.tags,
            fields: model.fields,
            ...(model.timestampMs ? { timestamp: new Date(model.timestampMs) } : {}),
        },
    ];

    await writeToInfluxWithRetry(
        async () => await client.writePoints(datapoints),
        `Audit event (${model.tags.eventType})`,
        'v1',
        'audit-events'
    );

    globals.logger.verbose('AUDIT INFLUX V1: Wrote audit event to InfluxDB');
}
