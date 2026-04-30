import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { writeBatchToInfluxV2 } from '../shared/utils.js';
import {
    QUEUE_METRIC_FIELDS,
    prepareQueueMetricData,
} from '../shared/queue-metrics-builder.js';
import { applyInfluxTags } from './utils.js';

/**
 * Build an InfluxDB v2 Point from prepared queue metric data.
 *
 * @param {object} data - Result of {@link prepareQueueMetricData}.
 * @returns {object} A v2 `Point` populated with tags, integer fields, and float fields.
 */
function buildPointV2(data) {
    const { config, metrics, measurementName, configTags } = data;

    const point = new Point(measurementName)
        .tag('queue_type', config.queueTypeTag)
        .tag('host', globals.hostInfo.hostname);

    for (const field of QUEUE_METRIC_FIELDS) {
        if (field.type === 'float') {
            point.floatField(field.name, metrics[field.source]);
        } else {
            point.intField(field.name, metrics[field.source]);
        }
    }

    // Add static tags from config file
    applyInfluxTags(point, configTags);

    return point;
}

/**
 * Shared implementation for storing queue metrics to InfluxDB v2.
 *
 * @param {string} queueType - Queue type key (see `QUEUE_TYPE_CONFIGS`).
 * @param {string} logPrefix - Log message prefix for this queue type.
 *
 * @returns {Promise<void>} Promise that resolves when the metrics have been
 *     written (or when the operation has been skipped).
 */
async function storeQueueMetricsV2(queueType, logPrefix) {
    const data = await prepareQueueMetricData(queueType, logPrefix);
    if (!data) {
        return;
    }

    const point = buildPointV2(data);

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    // Write to InfluxDB with retry logic
    await writeBatchToInfluxV2(
        [point],
        org,
        bucketName,
        data.config.description,
        data.config.bucketKey,
        globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
    );

    globals.logger.verbose(`${logPrefix}: Sent queue metrics data to InfluxDB`);

    // Clear metrics after successful write
    await data.queueManager.clearMetrics();
}

/**
 * Store user event queue metrics to InfluxDB v2.
 *
 * @description
 * Retrieves metrics from the user event queue manager and stores them in
 * InfluxDB v2 for monitoring queue health, backpressure, dropped messages,
 * and processing performance. After successful write, clears the metrics
 * to start fresh tracking.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeUserEventQueueMetricsV2() {
    return storeQueueMetricsV2('user_events', 'USER EVENT QUEUE METRICS V2');
}

/**
 * Store log event queue metrics to InfluxDB v2.
 *
 * @description
 * Retrieves metrics from the log event queue manager and stores them in
 * InfluxDB v2 for monitoring queue health, backpressure, dropped messages,
 * and processing performance. After successful write, clears the metrics
 * to start fresh tracking.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeLogEventQueueMetricsV2() {
    return storeQueueMetricsV2('log_events', 'LOG EVENT QUEUE METRICS V2');
}

/**
 * Store audit event queue metrics to InfluxDB v2.
 *
 * @description
 * Retrieves metrics from the audit events queue manager and stores them in
 * InfluxDB v2 for monitoring queue health, backpressure, dropped messages,
 * and processing performance. After successful write, clears the metrics
 * to start fresh tracking.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeAuditEventQueueMetricsV2() {
    return storeQueueMetricsV2('audit_events', 'AUDIT EVENT QUEUE METRICS V2');
}
