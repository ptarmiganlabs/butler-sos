import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Store user event queue metrics to InfluxDB v3
 *
 * @description
 * Retrieves metrics from the user event queue manager and stores them in InfluxDB v3
 * for monitoring queue health, backpressure, dropped messages, and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function postUserEventQueueMetricsToInfluxdbV3() {
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
            globals.logger.warn(
                'USER EVENT QUEUE METRICS INFLUXDB V3: Queue manager not initialized'
            );
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

        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        const point = new Point3(measurementName)
            .setTag('queue_type', 'user_events')
            .setTag('host', globals.hostInfo.hostname)
            .setIntegerField('queue_size', metrics.queueSize)
            .setIntegerField('queue_max_size', metrics.queueMaxSize)
            .setFloatField('queue_utilization_pct', metrics.queueUtilizationPct)
            .setIntegerField('queue_pending', metrics.queuePending)
            .setIntegerField('messages_received', metrics.messagesReceived)
            .setIntegerField('messages_queued', metrics.messagesQueued)
            .setIntegerField('messages_processed', metrics.messagesProcessed)
            .setIntegerField('messages_failed', metrics.messagesFailed)
            .setIntegerField('messages_dropped_total', metrics.messagesDroppedTotal)
            .setIntegerField('messages_dropped_rate_limit', metrics.messagesDroppedRateLimit)
            .setIntegerField('messages_dropped_queue_full', metrics.messagesDroppedQueueFull)
            .setIntegerField('messages_dropped_size', metrics.messagesDroppedSize)
            .setFloatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
            .setFloatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
            .setFloatField('processing_time_max_ms', metrics.processingTimeMaxMs)
            .setIntegerField('rate_limit_current', metrics.rateLimitCurrent)
            .setIntegerField('backpressure_active', metrics.backpressureActive);

        // Add static tags from config file
        if (configTags && configTags.length > 0) {
            for (const item of configTags) {
                point.setTag(item.name, item.value);
            }
        }

        await writeToInfluxWithRetry(
            async () => await globals.influx.write(point.toLineProtocol(), database),
            'User event queue metrics',
            'v3',
            'user-events-queue'
        );

        globals.logger.verbose(
            'USER EVENT QUEUE METRICS INFLUXDB V3: Sent queue metrics data to InfluxDB v3'
        );

        // Clear metrics after writing
        await queueManager.clearMetrics();
    } catch (err) {
        globals.logger.error(
            `USER EVENT QUEUE METRICS INFLUXDB V3: Error posting queue metrics: ${globals.getErrorMessage(err)}`
        );
    }
}

/**
 * Store log event queue metrics to InfluxDB v3
 *
 * @description
 * Retrieves metrics from the log event queue manager and stores them in InfluxDB v3
 * for monitoring queue health, backpressure, dropped messages, and processing performance.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function postLogEventQueueMetricsToInfluxdbV3() {
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
            globals.logger.warn(
                'LOG EVENT QUEUE METRICS INFLUXDB V3: Queue manager not initialized'
            );
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

        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        const point = new Point3(measurementName)
            .setTag('queue_type', 'log_events')
            .setTag('host', globals.hostInfo.hostname)
            .setIntegerField('queue_size', metrics.queueSize)
            .setIntegerField('queue_max_size', metrics.queueMaxSize)
            .setFloatField('queue_utilization_pct', metrics.queueUtilizationPct)
            .setIntegerField('queue_pending', metrics.queuePending)
            .setIntegerField('messages_received', metrics.messagesReceived)
            .setIntegerField('messages_queued', metrics.messagesQueued)
            .setIntegerField('messages_processed', metrics.messagesProcessed)
            .setIntegerField('messages_failed', metrics.messagesFailed)
            .setIntegerField('messages_dropped_total', metrics.messagesDroppedTotal)
            .setIntegerField('messages_dropped_rate_limit', metrics.messagesDroppedRateLimit)
            .setIntegerField('messages_dropped_queue_full', metrics.messagesDroppedQueueFull)
            .setIntegerField('messages_dropped_size', metrics.messagesDroppedSize)
            .setFloatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
            .setFloatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
            .setFloatField('processing_time_max_ms', metrics.processingTimeMaxMs)
            .setIntegerField('rate_limit_current', metrics.rateLimitCurrent)
            .setIntegerField('backpressure_active', metrics.backpressureActive);

        // Add static tags from config file
        if (configTags && configTags.length > 0) {
            for (const item of configTags) {
                point.setTag(item.name, item.value);
            }
        }

        await writeToInfluxWithRetry(
            async () => await globals.influx.write(point.toLineProtocol(), database),
            'Log event queue metrics',
            'v3',
            'log-events-queue'
        );

        globals.logger.verbose(
            'LOG EVENT QUEUE METRICS INFLUXDB V3: Sent queue metrics data to InfluxDB v3'
        );

        // Clear metrics after writing
        await queueManager.clearMetrics();
    } catch (err) {
        globals.logger.error(
            `LOG EVENT QUEUE METRICS INFLUXDB V3: Error posting queue metrics: ${globals.getErrorMessage(err)}`
        );
    }
}
