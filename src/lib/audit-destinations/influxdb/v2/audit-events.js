import { Point } from '@influxdata/influxdb-client';
import globals from '../../../../globals.js';
import { writeToInfluxWithRetry } from '../../../influxdb/shared/utils.js';

import { getAuditInfluxClient } from '../shared/client.js';
import { buildAuditInfluxPointModel } from '../shared/mapping.js';

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

    const point = new Point(model.measurementName);

    // Tags
    for (const [k, v] of Object.entries(model.tags)) {
        if (v !== undefined && v !== null) {
            point.tag(k, String(v));
        }
    }

    // Fields
    for (const [k, v] of Object.entries(model.fields)) {
        if (typeof v === 'number') {
            point.floatField(k, v);
        } else if (typeof v === 'boolean') {
            point.booleanField(k, v);
        } else if (typeof v === 'string') {
            point.stringField(k, v);
        }
    }

    if (model.timestampMs) {
        point.timestamp(new Date(model.timestampMs));
    }

    await writeToInfluxWithRetry(
        async () => {
            const writeApi = client.getWriteApi(org, bucket, 'ns', {
                flushInterval: 5000,
                maxRetries: 0,
            });
            try {
                await writeApi.writePoint(point);
                await writeApi.close();
            } catch (err) {
                try {
                    await writeApi.close();
                } catch (closeErr) {
                    // ignore
                }
                throw err;
            }
        },
        `Audit event (${model.tags.eventType})`,
        'v2',
        'audit-events'
    );

    globals.logger.verbose('AUDIT INFLUX V2: Wrote audit event to InfluxDB');
}
