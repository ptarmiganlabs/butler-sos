import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV2 } from '../shared/utils.js';
import { applyInfluxTags } from './utils.js';

/**
 * Store user event queue metrics to InfluxDB v2
 *
 * @description
 * Retrieves metrics from the user event queue manager and stores them in InfluxDB v2
 * for monitoring queue health, backpressure, dropped messages, and processing performance.
 * After successful write, clears the metrics to start fresh tracking.
 *
 * Metrics include:
 * - Queue size and utilization
 * - Message counts (received, queued, processed, failed, dropped)
 * - Processing time statistics (average, p95, max)
 * - Rate limiting and backpressure status
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeUserEventQueueMetricsV2() {
    // Check if queue metrics are enabled
    if (!globals.config.get('Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.enable')) {
        return;
    }

    // Only write to InfluxDB if enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Get metrics from queue manager
    const queueManager = globals.udpQueueManagerUserActivity;
    if (!queueManager) {
        globals.logger.warn('USER EVENT QUEUE METRICS V2: Queue manager not initialized');
        return;
    }

    const metrics = await queueManager.getMetrics();

    // Get configuration
    const measurementName = globals.config.get(
        'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.measurementName'
    );
    const configTags = globals.config.get(
        'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.tags'
    );
    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    const point = new Point(measurementName)
        .tag('queue_type', 'user_events')
        .tag('host', globals.hostInfo.hostname)
        .intField('queue_size', metrics.queueSize)
        .intField('queue_max_size', metrics.queueMaxSize)
        .floatField('queue_utilization_pct', metrics.queueUtilizationPct)
        .intField('queue_pending', metrics.queuePending)
        .intField('messages_received', metrics.messagesReceived)
        .intField('messages_queued', metrics.messagesQueued)
        .intField('messages_processed', metrics.messagesProcessed)
        .intField('messages_failed', metrics.messagesFailed)
        .intField('messages_dropped_total', metrics.messagesDroppedTotal)
        .intField('messages_dropped_rate_limit', metrics.messagesDroppedRateLimit)
        .intField('messages_dropped_queue_full', metrics.messagesDroppedQueueFull)
        .intField('messages_dropped_size', metrics.messagesDroppedSize)
        .floatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
        .floatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
        .floatField('processing_time_max_ms', metrics.processingTimeMaxMs)
        .intField('rate_limit_current', metrics.rateLimitCurrent)
        .intField('backpressure_active', metrics.backpressureActive);

    // Add static tags from config file
    applyInfluxTags(point, configTags);

    // Write to InfluxDB with retry logic
    await writeBatchToInfluxV2(
        [point],
        org,
        bucketName,
        'User event queue metrics',
        'user-events-queue',
        globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
    );

    globals.logger.verbose('USER EVENT QUEUE METRICS V2: Sent queue metrics data to InfluxDB');

    // Clear metrics after successful write
    await queueManager.clearMetrics();
}

/**
 * Store log event queue metrics to InfluxDB v2
 *
 * @description
 * Retrieves metrics from the log event queue manager and stores them in InfluxDB v2
 * for monitoring queue health, backpressure, dropped messages, and processing performance.
 * After successful write, clears the metrics to start fresh tracking.
 *
 * Metrics include:
 * - Queue size and utilization
 * - Message counts (received, queued, processed, failed, dropped)
 * - Processing time statistics (average, p95, max)
 * - Rate limiting and backpressure status
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeLogEventQueueMetricsV2() {
    // Check if queue metrics are enabled
    if (!globals.config.get('Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.enable')) {
        return;
    }

    // Only write to InfluxDB if enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Get metrics from queue manager
    const queueManager = globals.udpQueueManagerLogEvents;
    if (!queueManager) {
        globals.logger.warn('LOG EVENT QUEUE METRICS V2: Queue manager not initialized');
        return;
    }

    const metrics = await queueManager.getMetrics();

    // Get configuration
    const measurementName = globals.config.get(
        'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.measurementName'
    );
    const configTags = globals.config.get(
        'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.tags'
    );
    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    const point = new Point(measurementName)
        .tag('queue_type', 'log_events')
        .tag('host', globals.hostInfo.hostname)
        .intField('queue_size', metrics.queueSize)
        .intField('queue_max_size', metrics.queueMaxSize)
        .floatField('queue_utilization_pct', metrics.queueUtilizationPct)
        .intField('queue_pending', metrics.queuePending)
        .intField('messages_received', metrics.messagesReceived)
        .intField('messages_queued', metrics.messagesQueued)
        .intField('messages_processed', metrics.messagesProcessed)
        .intField('messages_failed', metrics.messagesFailed)
        .intField('messages_dropped_total', metrics.messagesDroppedTotal)
        .intField('messages_dropped_rate_limit', metrics.messagesDroppedRateLimit)
        .intField('messages_dropped_queue_full', metrics.messagesDroppedQueueFull)
        .intField('messages_dropped_size', metrics.messagesDroppedSize)
        .floatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
        .floatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
        .floatField('processing_time_max_ms', metrics.processingTimeMaxMs)
        .intField('rate_limit_current', metrics.rateLimitCurrent)
        .intField('backpressure_active', metrics.backpressureActive);

    // Add static tags from config file
    applyInfluxTags(point, configTags);

    // Write to InfluxDB with retry logic
    await writeBatchToInfluxV2(
        [point],
        org,
        bucketName,
        'Log event queue metrics',
        'log-events-queue',
        globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
    );

    globals.logger.verbose('LOG EVENT QUEUE METRICS V2: Sent queue metrics data to InfluxDB');

    // Clear metrics after successful write
    await queueManager.clearMetrics();
}

/**
 * Store audit event queue metrics to InfluxDB v2
 *
 * @description
 * Retrieves metrics from the audit events queue manager and stores them in InfluxDB v2
 * for monitoring queue health, backpressure, dropped messages, and processing performance.
 * After successful write, clears the metrics to start fresh tracking.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeAuditEventQueueMetricsV2() {
    // Check if queue metrics are enabled
    if (!globals.config.get('Butler-SOS.auditEvents.queue.queueMetrics.influxdb.enable')) {
        return;
    }

    // Only write to InfluxDB if enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Get metrics from queue manager
    const queueManager = globals.auditEventsQueueManager;
    if (!queueManager) {
        globals.logger.warn('AUDIT EVENT QUEUE METRICS V2: Queue manager not initialized');
        return;
    }

    const metrics = await queueManager.getMetrics();

    // Get configuration
    const measurementName = globals.config.get(
        'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.measurementName'
    );
    const configTags = globals.config.get(
        'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.tags'
    );
    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    const point = new Point(measurementName)
        .tag('queue_type', 'audit_events')
        .tag('host', globals.hostInfo.hostname)
        .intField('queue_size', metrics.queueSize)
        .intField('queue_max_size', metrics.queueMaxSize)
        .floatField('queue_utilization_pct', metrics.queueUtilizationPct)
        .intField('queue_pending', metrics.queuePending)
        .intField('messages_received', metrics.messagesReceived)
        .intField('messages_queued', metrics.messagesQueued)
        .intField('messages_processed', metrics.messagesProcessed)
        .intField('messages_failed', metrics.messagesFailed)
        .intField('messages_dropped_total', metrics.messagesDroppedTotal)
        .intField('messages_dropped_rate_limit', metrics.messagesDroppedRateLimit)
        .intField('messages_dropped_queue_full', metrics.messagesDroppedQueueFull)
        .intField('messages_dropped_size', metrics.messagesDroppedSize)
        .floatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
        .floatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
        .floatField('processing_time_max_ms', metrics.processingTimeMaxMs)
        .intField('rate_limit_current', metrics.rateLimitCurrent)
        .intField('backpressure_active', metrics.backpressureActive);

    // Add static tags from config file
    applyInfluxTags(point, configTags);

    // Write to InfluxDB with retry logic
    await writeBatchToInfluxV2(
        [point],
        org,
        bucketName,
        'Audit event queue metrics',
        'audit-events-queue',
        globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
    );

    globals.logger.verbose('AUDIT EVENT QUEUE METRICS V2: Sent queue metrics data to InfluxDB');

    // Clear metrics after successful write
    await queueManager.clearMetrics();
}
