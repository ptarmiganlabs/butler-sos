import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import { writeBatchToInfluxV3 } from '../shared/utils.js';
import {
    QUEUE_METRIC_FIELDS,
    prepareQueueMetricData,
} from '../shared/queue-metrics-builder.js';

/**
 * Build an InfluxDB v3 Point from prepared queue metric data.
 *
 * @param {object} data - Result of {@link prepareQueueMetricData}.
 * @returns {object} A v3 `Point` populated with tags, integer fields, and float fields.
 */
function buildPointV3(data) {
    const { config, metrics, measurementName, configTags } = data;

    const point = new Point3(measurementName)
        .setTag('queue_type', config.queueTypeTag)
        .setTag('host', globals.hostInfo.hostname);

    for (const field of QUEUE_METRIC_FIELDS) {
        if (field.type === 'float') {
            point.setFloatField(field.name, metrics[field.source]);
        } else {
            point.setIntegerField(field.name, metrics[field.source]);
        }
    }

    // Add static tags from config file
    if (configTags && configTags.length > 0) {
        for (const item of configTags) {
            point.setTag(item.name, item.value);
        }
    }

    return point;
}

/**
 * Shared implementation for posting queue metrics to InfluxDB v3.
 *
 * @param {string} queueType - Queue type key (see `QUEUE_TYPE_CONFIGS`).
 * @param {string} logPrefix - Log message prefix for this queue type.
 *
 * @returns {Promise<void>} Promise that resolves once the metrics have been
 *     written or the operation has been skipped. Errors are logged and
 *     reported to the error tracker but never re-thrown (matching the
 *     historical behaviour of the v3 functions).
 */
async function postQueueMetricsToInfluxdbV3(queueType, logPrefix) {
    try {
        const data = await prepareQueueMetricData(queueType, logPrefix);
        if (!data) {
            return;
        }

        const point = buildPointV3(data);

        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        await writeBatchToInfluxV3(
            [point],
            database,
            data.config.description,
            data.config.bucketKey,
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose(`${logPrefix}: Sent queue metrics data to InfluxDB v3`);

        // Clear metrics after writing
        await data.queueManager.clearMetrics();
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V3_WRITE', '');
        globals.logger.error(
            `${logPrefix}: Error posting queue metrics: ${globals.getErrorMessage(err)}`
        );
    }
}

/**
 * Store user event queue metrics to InfluxDB v3.
 *
 * @description
 * Retrieves metrics from the user event queue manager and stores them in
 * InfluxDB v3 for monitoring queue health, backpressure, dropped messages,
 * and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postUserEventQueueMetricsToInfluxdbV3() {
    return postQueueMetricsToInfluxdbV3(
        'user_events',
        'USER EVENT QUEUE METRICS INFLUXDB V3'
    );
}

/**
 * Store log event queue metrics to InfluxDB v3.
 *
 * @description
 * Retrieves metrics from the log event queue manager and stores them in
 * InfluxDB v3 for monitoring queue health, backpressure, dropped messages,
 * and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postLogEventQueueMetricsToInfluxdbV3() {
    return postQueueMetricsToInfluxdbV3(
        'log_events',
        'LOG EVENT QUEUE METRICS INFLUXDB V3'
    );
}

/**
 * Store audit event queue metrics to InfluxDB v3.
 *
 * @description
 * Retrieves metrics from the audit events queue manager and stores them in
 * InfluxDB v3 for monitoring queue health, backpressure, dropped messages,
 * and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postAuditEventQueueMetricsToInfluxdbV3() {
    return postQueueMetricsToInfluxdbV3(
        'audit_events',
        'AUDIT EVENT QUEUE METRICS INFLUXDB V3'
    );
}
