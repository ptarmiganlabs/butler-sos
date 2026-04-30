import globals from '../../../globals.js';
import { isInfluxDbEnabled } from './utils.js';

/**
 * Canonical list of queue metric fields that are written to InfluxDB.
 *
 * @description
 * Each entry describes one field on a queue metrics point:
 * - `name`   – the InfluxDB field name (snake_case).
 * - `source` – the property name on the metrics object returned by
 *              `queueManager.getMetrics()`.
 * - `type`   – `'int'` or `'float'`. Used by version-specific writers
 *              that need to distinguish integer fields from floats
 *              (InfluxDB v2 and v3 clients).
 *
 * Adding/removing a field here automatically propagates to all
 * InfluxDB versions (v1, v2, v3).
 */
export const QUEUE_METRIC_FIELDS = [
    { name: 'queue_size', source: 'queueSize', type: 'int' },
    { name: 'queue_max_size', source: 'queueMaxSize', type: 'int' },
    { name: 'queue_utilization_pct', source: 'queueUtilizationPct', type: 'float' },
    { name: 'queue_running', source: 'queuePending', type: 'int' },
    { name: 'messages_received', source: 'messagesReceived', type: 'int' },
    { name: 'messages_queued', source: 'messagesQueued', type: 'int' },
    { name: 'messages_processed', source: 'messagesProcessed', type: 'int' },
    { name: 'messages_failed', source: 'messagesFailed', type: 'int' },
    { name: 'messages_dropped_total', source: 'messagesDroppedTotal', type: 'int' },
    { name: 'messages_dropped_rate_limit', source: 'messagesDroppedRateLimit', type: 'int' },
    { name: 'messages_dropped_queue_full', source: 'messagesDroppedQueueFull', type: 'int' },
    { name: 'messages_dropped_size', source: 'messagesDroppedSize', type: 'int' },
    { name: 'processing_time_avg_ms', source: 'processingTimeAvgMs', type: 'float' },
    { name: 'processing_time_p95_ms', source: 'processingTimeP95Ms', type: 'float' },
    { name: 'processing_time_max_ms', source: 'processingTimeMaxMs', type: 'float' },
    { name: 'rate_limit_current', source: 'rateLimitCurrent', type: 'int' },
    { name: 'backpressure_active', source: 'backpressureActive', type: 'int' },
];

/**
 * Per-queue-type configuration shared by all InfluxDB versions.
 *
 * @description
 * The keys of this object identify the three event queues whose
 * metrics are forwarded to InfluxDB. Each entry contains the
 * configuration paths, queue manager attribute name on the global
 * object, and labels used in log messages and the v2/v3 `bucket`
 * argument passed to the write helpers.
 *
 * `useConfigHas` switches the enable check from a plain `config.get(...)`
 * to a `config.has(...) && config.get(...)` pair, which is required
 * for queue types whose configuration node is optional.
 */
export const QUEUE_TYPE_CONFIGS = {
    user_events: {
        enableConfigPath: 'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.enable',
        measurementConfigPath:
            'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.measurementName',
        tagsConfigPath: 'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.tags',
        queueManagerKey: 'udpQueueManagerUserActivity',
        queueTypeTag: 'user_events',
        description: 'User event queue metrics',
        bucketKey: 'user-events-queue',
        useConfigHas: false,
    },
    log_events: {
        enableConfigPath: 'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.enable',
        measurementConfigPath:
            'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.measurementName',
        tagsConfigPath: 'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.tags',
        queueManagerKey: 'udpQueueManagerLogEvents',
        queueTypeTag: 'log_events',
        description: 'Log event queue metrics',
        bucketKey: 'log-events-queue',
        useConfigHas: false,
    },
    audit_events: {
        enableConfigPath: 'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.enable',
        measurementConfigPath:
            'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.measurementName',
        tagsConfigPath: 'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.tags',
        queueManagerKey: 'auditEventsQueueManager',
        queueTypeTag: 'audit_events',
        description: 'Audit event queue metrics',
        bucketKey: 'audit-events-queue',
        useConfigHas: true,
    },
};

/**
 * Prepare the data needed to write a queue metrics point to InfluxDB.
 *
 * @description
 * Performs the shared work that is identical across InfluxDB v1, v2,
 * and v3:
 * 1. Reads the per-queue-type "enable" flag from configuration.
 * 2. Resolves the queue manager from `globals` and warns if it is
 *    not initialised.
 * 3. Verifies that InfluxDB itself is enabled.
 * 4. Reads metrics from the queue manager and looks up the
 *    measurement name and configured tags.
 *
 * Returns `null` when the caller should skip writing (feature
 * disabled, queue manager missing, or InfluxDB disabled).
 *
 * @param {string} queueType - One of the keys of {@link QUEUE_TYPE_CONFIGS}
 *     (`'user_events'`, `'log_events'`, `'audit_events'`).
 * @param {string} logPrefix - Prefix used in log messages emitted by
 *     this helper (e.g. `'USER EVENT QUEUE METRICS V1'`).
 *
 * @returns {Promise<object|null>} An object with `{ config, queueManager,
 *     metrics, measurementName, configTags }` when writing should
 *     proceed, otherwise `null`.
 * @throws {Error} If `queueType` is not a recognised queue type.
 */
export async function prepareQueueMetricData(queueType, logPrefix) {
    const config = QUEUE_TYPE_CONFIGS[queueType];
    if (!config) {
        throw new Error(`Unknown queue type: ${queueType}`);
    }

    // Check if queue metrics are enabled for this queue type
    if (config.useConfigHas) {
        if (
            !globals.config.has(config.enableConfigPath) ||
            !globals.config.get(config.enableConfigPath)
        ) {
            return null;
        }
    } else if (!globals.config.get(config.enableConfigPath)) {
        return null;
    }

    // Get metrics from queue manager
    const queueManager = globals[config.queueManagerKey];
    if (!queueManager) {
        globals.logger.warn(`${logPrefix}: Queue manager not initialized`);
        return null;
    }

    // Only write to InfluxDB if it is enabled
    if (!isInfluxDbEnabled()) {
        return null;
    }

    const metrics = await queueManager.getMetrics();
    const measurementName = globals.config.get(config.measurementConfigPath);
    const configTags = globals.config.get(config.tagsConfigPath);

    return {
        config,
        queueManager,
        metrics,
        measurementName,
        configTags,
    };
}
