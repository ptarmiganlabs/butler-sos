import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../../globals.js';
import { writeToInfluxWithRetry } from '../../../influxdb/shared/utils.js';

import { getAuditInfluxClient } from '../shared/client.js';
import { buildAuditInfluxPointModel } from '../shared/mapping.js';

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

    const point = new Point3(model.measurementName);

    // Tags
    for (const [k, v] of Object.entries(model.tags)) {
        if (v !== undefined && v !== null) {
            point.setTag(k, String(v));
        }
    }

    // Fields
    for (const [k, v] of Object.entries(model.fields)) {
        if (typeof v === 'number') {
            point.setFloatField(k, v);
        } else if (typeof v === 'boolean') {
            point.setBooleanField(k, v);
        } else if (typeof v === 'string') {
            point.setStringField(k, v);
        }
    }

    if (model.timestampMs) {
        point.setTimestamp(new Date(model.timestampMs));
    }

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
