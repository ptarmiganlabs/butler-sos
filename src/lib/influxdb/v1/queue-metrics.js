import globals from '../../../globals.js';
import { writeBatchToInfluxV1 } from '../shared/utils.js';
import {
    QUEUE_METRIC_FIELDS,
    prepareQueueMetricData,
} from '../shared/queue-metrics-builder.js';

/**
 * Build an InfluxDB v1 point object from prepared queue metric data.
 *
 * @param {object} data - Result of {@link prepareQueueMetricData}.
 * @returns {object} Point shaped for the InfluxDB v1 client.
 */
function buildPointV1(data) {
    const { config, metrics, measurementName, configTags } = data;

    const fields = {};
    for (const field of QUEUE_METRIC_FIELDS) {
        fields[field.name] = metrics[field.source];
    }

    const point = {
        measurement: measurementName,
        tags: {
            queue_type: config.queueTypeTag,
            host: globals.hostInfo.hostname,
        },
        fields,
    };

    // Add static tags from config file
    if (configTags && configTags.length > 0) {
        for (const item of configTags) {
            point.tags[item.name] = item.value;
        }
    }

    return point;
}

/**
 * Shared implementation for storing queue metrics to InfluxDB v1.
 *
 * @param {string} queueType - Queue type key (see `QUEUE_TYPE_CONFIGS`).
 * @param {string} logPrefix - Log message prefix for this queue type.
 * @param {string|null} errorTrackerCode - Optional error tracker code to
 *     increment when a write fails. When `null`, the error tracker is not
 *     touched (preserves the historical behaviour of
 *     `storeUserEventQueueMetricsV1`).
 *
 * @returns {Promise<void>} Promise that resolves when the metrics have been
 *     written (or when the operation has been skipped).
 * @throws {Error} Re-throws any error raised while writing to InfluxDB.
 */
async function storeQueueMetricsV1(queueType, logPrefix, errorTrackerCode) {
    try {
        const data = await prepareQueueMetricData(queueType, logPrefix);
        if (!data) {
            return;
        }

        const point = buildPointV1(data);

        // Write with retry logic
        await writeBatchToInfluxV1(
            [point],
            data.config.description,
            '',
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose(`${logPrefix}: Sent queue metrics data to InfluxDB`);

        // Clear metrics after writing
        await data.queueManager.clearMetrics();
    } catch (err) {
        if (errorTrackerCode) {
            await globals.errorTracker.incrementError(
                errorTrackerCode,
                '',
                { module: 'QUEUE_METRICS' },
                err
            );
        }
        globals.logger.error(
            `${logPrefix}: Error saving data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}

/**
 * Store user event queue metrics to InfluxDB v1.
 *
 * @description
 * Retrieves metrics from the user event queue manager and stores them in
 * InfluxDB v1 for monitoring queue health, backpressure, dropped messages,
 * and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeUserEventQueueMetricsV1() {
    return storeQueueMetricsV1('user_events', 'USER EVENT QUEUE METRICS V1', null);
}

/**
 * Store log event queue metrics to InfluxDB v1.
 *
 * @description
 * Retrieves metrics from the log event queue manager and stores them in
 * InfluxDB v1 for monitoring queue health, backpressure, dropped messages,
 * and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeLogEventQueueMetricsV1() {
    return storeQueueMetricsV1('log_events', 'LOG EVENT QUEUE METRICS V1', 'INFLUXDB_V1_WRITE');
}

/**
 * Store audit event queue metrics to InfluxDB v1.
 *
 * @description
 * Retrieves metrics from the audit events queue manager and stores them in
 * InfluxDB v1 for monitoring queue health, backpressure, dropped messages,
 * and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeAuditEventQueueMetricsV1() {
    return storeQueueMetricsV1(
        'audit_events',
        'AUDIT EVENT QUEUE METRICS V1',
        'INFLUXDB_V1_WRITE'
    );
}
