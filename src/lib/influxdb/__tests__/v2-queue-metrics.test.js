import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPoint = {
    tag: jest.fn().mockReturnThis(),
    intField: jest.fn().mockReturnThis(),
    floatField: jest.fn().mockReturnThis(),
};

const mockWriteApi = {
    writePoint: jest.fn(),
    close: jest.fn().mockResolvedValue(),
};

const mockGlobals = {
    logger: {
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        silly: jest.fn(),
    },
    config: { get: jest.fn(), has: jest.fn() },
    influx: { getWriteApi: jest.fn(() => mockWriteApi) },
    hostInfo: { hostname: 'test-host' },
    getErrorMessage: jest.fn((err) => err.message),
    udpQueueManagerUserActivity: null,
    udpQueueManagerLogEvents: null,
};

const mockQueueManager = {
    getMetrics: jest.fn(),
    clearMetrics: jest.fn().mockResolvedValue(),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV2: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

const mockV2Utils = {
    applyInfluxTags: jest.fn(),
};

jest.unstable_mockModule('../v2/utils.js', () => mockV2Utils);

describe('v2/queue-metrics', () => {
    let storeUserEventQueueMetricsV2, storeLogEventQueueMetricsV2, globals, utils, Point;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const InfluxClient = await import('@influxdata/influxdb-client');
        Point = InfluxClient.Point;
        const queueMetrics = await import('../v2/queue-metrics.js');
        storeUserEventQueueMetricsV2 = queueMetrics.storeUserEventQueueMetricsV2;
        storeLogEventQueueMetricsV2 = queueMetrics.storeLogEventQueueMetricsV2;

        mockPoint.tag.mockReturnThis();
        mockPoint.intField.mockReturnThis();
        mockPoint.floatField.mockReturnThis();

        globals.config.get.mockImplementation((path) => {
            if (path.includes('org')) return 'test-org';
            if (path.includes('bucket')) return 'test-bucket';
            if (path.includes('measurementName')) return 'event_queue_metrics';
            if (path.includes('queueMetrics.influxdb.tags'))
                return [{ name: 'env', value: 'prod' }];
            if (path.includes('enable')) return true;
            if (path === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            return undefined;
        });
        globals.config.has.mockReturnValue(true);

        globals.udpQueueManagerUserActivity = mockQueueManager;
        globals.udpQueueManagerLogEvents = mockQueueManager;

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeBatchToInfluxV2.mockResolvedValue();

        mockWriteApi.writePoint.mockResolvedValue(undefined);
        mockWriteApi.close.mockResolvedValue(undefined);

        mockQueueManager.getMetrics.mockReturnValue({
            queueSize: 100,
            queueMaxSize: 1000,
            queueUtilizationPct: 10.0,
            queuePending: 5,
            messagesReceived: 500,
            messagesQueued: 450,
            messagesProcessed: 400,
            messagesFailed: 10,
            messagesDroppedTotal: 40,
            messagesDroppedRateLimit: 20,
            messagesDroppedQueueFull: 15,
            messagesDroppedSize: 5,
            processingTimeAvgMs: 25.5,
            processingTimeP95Ms: 50.2,
            processingTimeMaxMs: 100.8,
            rateLimitCurrent: 100,
            backpressureActive: 0,
        });
    });

    describe('storeUserEventQueueMetricsV2', () => {
        test('should return early when InfluxDB disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);
            await storeUserEventQueueMetricsV2();
            expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
        });

        test('should return early when feature disabled', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path.includes('enable')) return false;
                return undefined;
            });
            await storeUserEventQueueMetricsV2();
            expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
        });

        test('should return early when queue manager not initialized', async () => {
            globals.udpQueueManagerUserActivity = null;
            await storeUserEventQueueMetricsV2();
            expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
            expect(globals.logger.warn).toHaveBeenCalledWith(
                'USER EVENT QUEUE METRICS V2: Queue manager not initialized'
            );
        });

        test('should write complete user event queue metrics', async () => {
            await storeUserEventQueueMetricsV2();

            expect(Point).toHaveBeenCalledWith('event_queue_metrics');
            expect(mockPoint.tag).toHaveBeenCalledWith('queue_type', 'user_events');
            expect(mockPoint.tag).toHaveBeenCalledWith('host', 'test-host');
            expect(mockPoint.intField).toHaveBeenCalledWith('queue_size', 100);
            expect(mockPoint.intField).toHaveBeenCalledWith('queue_max_size', 1000);
            expect(mockPoint.floatField).toHaveBeenCalledWith('queue_utilization_pct', 10.0);
            expect(mockPoint.intField).toHaveBeenCalledWith('queue_pending', 5);
            expect(mockPoint.intField).toHaveBeenCalledWith('messages_received', 500);
            expect(mockPoint.intField).toHaveBeenCalledWith('messages_queued', 450);
            expect(mockPoint.intField).toHaveBeenCalledWith('messages_processed', 400);
            expect(mockPoint.intField).toHaveBeenCalledWith('messages_failed', 10);
            expect(mockPoint.intField).toHaveBeenCalledWith('messages_dropped_total', 40);
            expect(mockPoint.intField).toHaveBeenCalledWith('messages_dropped_rate_limit', 20);
            expect(mockPoint.intField).toHaveBeenCalledWith('messages_dropped_queue_full', 15);
            expect(mockPoint.intField).toHaveBeenCalledWith('messages_dropped_size', 5);
            expect(mockPoint.floatField).toHaveBeenCalledWith('processing_time_avg_ms', 25.5);
            expect(mockPoint.floatField).toHaveBeenCalledWith('processing_time_p95_ms', 50.2);
            expect(mockPoint.floatField).toHaveBeenCalledWith('processing_time_max_ms', 100.8);
            expect(mockPoint.intField).toHaveBeenCalledWith('rate_limit_current', 100);
            expect(mockPoint.intField).toHaveBeenCalledWith('backpressure_active', 0);
            expect(mockV2Utils.applyInfluxTags).toHaveBeenCalledWith(mockPoint, [
                { name: 'env', value: 'prod' },
            ]);
            expect(utils.writeBatchToInfluxV2).toHaveBeenCalledWith(
                [mockPoint],
                'test-org',
                'test-bucket',
                'User event queue metrics',
                'user-events-queue',
                100
            );
            expect(mockQueueManager.clearMetrics).toHaveBeenCalled();
        });

        test('should handle zero metrics', async () => {
            mockQueueManager.getMetrics.mockReturnValue({
                queueSize: 0,
                queueMaxSize: 1000,
                queueUtilizationPct: 0,
                queuePending: 0,
                messagesReceived: 0,
                messagesQueued: 0,
                messagesProcessed: 0,
                messagesFailed: 0,
                messagesDroppedTotal: 0,
                messagesDroppedRateLimit: 0,
                messagesDroppedQueueFull: 0,
                messagesDroppedSize: 0,
                processingTimeAvgMs: 0,
                processingTimeP95Ms: 0,
                processingTimeMaxMs: 0,
                rateLimitCurrent: 0,
                backpressureActive: 0,
            });

            await storeUserEventQueueMetricsV2();

            expect(mockPoint.intField).toHaveBeenCalledWith('queue_size', 0);
            expect(utils.writeBatchToInfluxV2).toHaveBeenCalledWith(
                [mockPoint],
                'test-org',
                'test-bucket',
                'User event queue metrics',
                'user-events-queue',
                100
            );
        });

        test('should log verbose information', async () => {
            await storeUserEventQueueMetricsV2();

            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'USER EVENT QUEUE METRICS V2: Sent queue metrics data to InfluxDB'
            );
        });
    });

    describe('storeLogEventQueueMetricsV2', () => {
        test('should return early when InfluxDB disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);
            await storeLogEventQueueMetricsV2();
            expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
        });

        test('should return early when feature disabled', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path.includes('enable')) return false;
                return undefined;
            });
            await storeLogEventQueueMetricsV2();
            expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
        });

        test('should return early when queue manager not initialized', async () => {
            globals.udpQueueManagerLogEvents = null;
            await storeLogEventQueueMetricsV2();
            expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
            expect(globals.logger.warn).toHaveBeenCalledWith(
                'LOG EVENT QUEUE METRICS V2: Queue manager not initialized'
            );
        });

        test('should write complete log event queue metrics', async () => {
            await storeLogEventQueueMetricsV2();

            expect(Point).toHaveBeenCalledWith('event_queue_metrics');
            expect(mockPoint.tag).toHaveBeenCalledWith('queue_type', 'log_events');
            expect(mockPoint.tag).toHaveBeenCalledWith('host', 'test-host');
            expect(mockPoint.intField).toHaveBeenCalledWith('queue_size', 100);
            expect(utils.writeBatchToInfluxV2).toHaveBeenCalledWith(
                [mockPoint],
                'test-org',
                'test-bucket',
                'Log event queue metrics',
                'log-events-queue',
                100
            );
            expect(mockQueueManager.clearMetrics).toHaveBeenCalled();
        });

        test('should handle high utilization', async () => {
            mockQueueManager.getMetrics.mockReturnValue({
                queueSize: 950,
                queueMaxSize: 1000,
                queueUtilizationPct: 95.0,
                queuePending: 50,
                messagesReceived: 10000,
                messagesQueued: 9500,
                messagesProcessed: 9000,
                messagesFailed: 100,
                messagesDroppedTotal: 400,
                messagesDroppedRateLimit: 200,
                messagesDroppedQueueFull: 150,
                messagesDroppedSize: 50,
                processingTimeAvgMs: 125.5,
                processingTimeP95Ms: 250.2,
                processingTimeMaxMs: 500.8,
                rateLimitCurrent: 50,
                backpressureActive: 1,
            });

            await storeLogEventQueueMetricsV2();

            expect(mockPoint.floatField).toHaveBeenCalledWith('queue_utilization_pct', 95.0);
            expect(mockPoint.intField).toHaveBeenCalledWith('backpressure_active', 1);
            expect(utils.writeBatchToInfluxV2).toHaveBeenCalledWith(
                [mockPoint],
                'test-org',
                'test-bucket',
                'Log event queue metrics',
                'log-events-queue',
                100
            );
        });

        test('should log verbose information', async () => {
            await storeLogEventQueueMetricsV2();

            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'LOG EVENT QUEUE METRICS V2: Sent queue metrics data to InfluxDB'
            );
        });
    });
});
