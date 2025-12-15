import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { logError } from '../../log-error.js';

/**
 * Store user event queue metrics to InfluxDB v2
 *
 * @returns {Promise<void>}
 */
export async function storeUserEventQueueMetricsV2() {
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

        // Create write API with options
        const writeOptions = {
            flushInterval: 5000,
            maxRetries: 2,
        };

        const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

        const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

        if (!writeApi) {
            globals.logger.warn('USER EVENT QUEUE METRICS V2: Influxdb write API object not found');
            return;
        }

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
        if (configTags && configTags.length > 0) {
            for (const item of configTags) {
                point.tag(item.name, item.value);
            }
        }

        writeApi.writePoint(point);
        await writeApi.close();

        globals.logger.verbose('USER EVENT QUEUE METRICS V2: Sent queue metrics data to InfluxDB');
    } catch (err) {
        logError('USER EVENT QUEUE METRICS V2: Error saving data', err);
        throw err;
    }
}

/**
 * Store log event queue metrics to InfluxDB v2
 *
 * @returns {Promise<void>}
 */
export async function storeLogEventQueueMetricsV2() {
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

        // Create write API with options
        const writeOptions = {
            flushInterval: 5000,
            maxRetries: 2,
        };

        const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

        const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

        if (!writeApi) {
            globals.logger.warn('LOG EVENT QUEUE METRICS V2: Influxdb write API object not found');
            return;
        }

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
        if (configTags && configTags.length > 0) {
            for (const item of configTags) {
                point.tag(item.name, item.value);
            }
        }

        writeApi.writePoint(point);
        await writeApi.close();

        globals.logger.verbose('LOG EVENT QUEUE METRICS V2: Sent queue metrics data to InfluxDB');
    } catch (err) {
        logError('LOG EVENT QUEUE METRICS V2: Error saving data', err);
        throw err;
    }
}
