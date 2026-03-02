import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV1 } from '../shared/utils.js';

/**
 * Store user event queue metrics to InfluxDB v1
 *
 * @description
 * Retrieves metrics from the user event queue manager and stores them in InfluxDB v1
 * for monitoring queue health, backpressure, dropped messages, and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeUserEventQueueMetricsV1() {
    try {
        // Check if queue metrics are enabled
        if (
            !globals.config.get(
                'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.enable'
            )
        ) {
            return;
        }

        // Get metrics from queue manager
        const queueManager = globals.udpQueueManagerUserActivity;
        if (!queueManager) {
            globals.logger.warn('USER EVENT QUEUE METRICS V1: Queue manager not initialized');
            return;
        }

        // Only write to InfluxDB if the global influx object has been initialized
        if (!isInfluxDbEnabled()) {
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

        const point = {
            measurement: measurementName,
            tags: {
                queue_type: 'user_events',
                host: globals.hostInfo.hostname,
            },
            fields: {
                queue_size: metrics.queueSize,
                queue_max_size: metrics.queueMaxSize,
                queue_utilization_pct: metrics.queueUtilizationPct,
                queue_pending: metrics.queuePending,
                messages_received: metrics.messagesReceived,
                messages_queued: metrics.messagesQueued,
                messages_processed: metrics.messagesProcessed,
                messages_failed: metrics.messagesFailed,
                messages_dropped_total: metrics.messagesDroppedTotal,
                messages_dropped_rate_limit: metrics.messagesDroppedRateLimit,
                messages_dropped_queue_full: metrics.messagesDroppedQueueFull,
                messages_dropped_size: metrics.messagesDroppedSize,
                processing_time_avg_ms: metrics.processingTimeAvgMs,
                processing_time_p95_ms: metrics.processingTimeP95Ms,
                processing_time_max_ms: metrics.processingTimeMaxMs,
                rate_limit_current: metrics.rateLimitCurrent,
                backpressure_active: metrics.backpressureActive,
            },
        };

        // Add static tags from config file
        if (configTags && configTags.length > 0) {
            for (const item of configTags) {
                point.tags[item.name] = item.value;
            }
        }

        // Write with retry logic
        await writeBatchToInfluxV1(
            [point],
            'User event queue metrics',
            '',
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose('USER EVENT QUEUE METRICS V1: Sent queue metrics data to InfluxDB');

        // Clear metrics after writing
        await queueManager.clearMetrics();
    } catch (err) {
        globals.logger.error(
            `USER EVENT QUEUE METRICS V1: Error saving data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}

/**
 * Store log event queue metrics to InfluxDB v1
 *
 * @description
 * Retrieves metrics from the log event queue manager and stores them in InfluxDB v1
 * for monitoring queue health, backpressure, dropped messages, and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeLogEventQueueMetricsV1() {
    try {
        // Check if queue metrics are enabled
        if (
            !globals.config.get('Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.enable')
        ) {
            return;
        }

        // Get metrics from queue manager
        const queueManager = globals.udpQueueManagerLogEvents;
        if (!queueManager) {
            globals.logger.warn('LOG EVENT QUEUE METRICS V1: Queue manager not initialized');
            return;
        }

        // Only write to InfluxDB if the global influx object has been initialized
        if (!isInfluxDbEnabled()) {
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

        const point = {
            measurement: measurementName,
            tags: {
                queue_type: 'log_events',
                host: globals.hostInfo.hostname,
            },
            fields: {
                queue_size: metrics.queueSize,
                queue_max_size: metrics.queueMaxSize,
                queue_utilization_pct: metrics.queueUtilizationPct,
                queue_pending: metrics.queuePending,
                messages_received: metrics.messagesReceived,
                messages_queued: metrics.messagesQueued,
                messages_processed: metrics.messagesProcessed,
                messages_failed: metrics.messagesFailed,
                messages_dropped_total: metrics.messagesDroppedTotal,
                messages_dropped_rate_limit: metrics.messagesDroppedRateLimit,
                messages_dropped_queue_full: metrics.messagesDroppedQueueFull,
                messages_dropped_size: metrics.messagesDroppedSize,
                processing_time_avg_ms: metrics.processingTimeAvgMs,
                processing_time_p95_ms: metrics.processingTimeP95Ms,
                processing_time_max_ms: metrics.processingTimeMaxMs,
                rate_limit_current: metrics.rateLimitCurrent,
                backpressure_active: metrics.backpressureActive,
            },
        };

        // Add static tags from config file
        if (configTags && configTags.length > 0) {
            for (const item of configTags) {
                point.tags[item.name] = item.value;
            }
        }

        // Write with retry logic
        await writeBatchToInfluxV1(
            [point],
            'Log event queue metrics',
            '',
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose('LOG EVENT QUEUE METRICS V1: Sent queue metrics data to InfluxDB');

        // Clear metrics after writing
        await queueManager.clearMetrics();
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', '');
        globals.logger.error(
            `LOG EVENT QUEUE METRICS V1: Error saving data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}

/**
 * Store audit event queue metrics to InfluxDB v1
 *
 * @description
 * Retrieves metrics from the audit events queue manager and stores them in InfluxDB v1
 * for monitoring queue health, backpressure, dropped messages, and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeAuditEventQueueMetricsV1() {
    try {
        // Check if queue metrics are enabled
        if (!globals.config.get('Butler-SOS.auditEvents.queue.queueMetrics.influxdb.enable')) {
            return;
        }

        // Get metrics from queue manager
        const queueManager = globals.auditEventsQueueManager;
        if (!queueManager) {
            globals.logger.warn('AUDIT EVENT QUEUE METRICS V1: Queue manager not initialized');
            return;
        }

        // Only write to InfluxDB if the global influx object has been initialized
        if (!isInfluxDbEnabled()) {
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

        const point = {
            measurement: measurementName,
            tags: {
                queue_type: 'audit_events',
                host: globals.hostInfo.hostname,
            },
            fields: {
                queue_size: metrics.queueSize,
                queue_max_size: metrics.queueMaxSize,
                queue_utilization_pct: metrics.queueUtilizationPct,
                queue_pending: metrics.queuePending,
                messages_received: metrics.messagesReceived,
                messages_queued: metrics.messagesQueued,
                messages_processed: metrics.messagesProcessed,
                messages_failed: metrics.messagesFailed,
                messages_dropped_total: metrics.messagesDroppedTotal,
                messages_dropped_rate_limit: metrics.messagesDroppedRateLimit,
                messages_dropped_queue_full: metrics.messagesDroppedQueueFull,
                messages_dropped_size: metrics.messagesDroppedSize,
                processing_time_avg_ms: metrics.processingTimeAvgMs,
                processing_time_p95_ms: metrics.processingTimeP95Ms,
                processing_time_max_ms: metrics.processingTimeMaxMs,
                rate_limit_current: metrics.rateLimitCurrent,
                backpressure_active: metrics.backpressureActive,
            },
        };

        // Add static tags from config file
        if (configTags && configTags.length > 0) {
            for (const item of configTags) {
                point.tags[item.name] = item.value;
            }
        }

        // Write with retry logic
        await writeBatchToInfluxV1(
            [point],
            'Audit event queue metrics',
            '',
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose('AUDIT EVENT QUEUE METRICS V1: Sent queue metrics data to InfluxDB');

        // Clear metrics after writing
        await queueManager.clearMetrics();
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', '');
        globals.logger.error(
            `AUDIT EVENT QUEUE METRICS V1: Error saving data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
