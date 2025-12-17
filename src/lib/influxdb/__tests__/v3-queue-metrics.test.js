import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock globals
const mockGlobals = {
    logger: {
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    config: {
        get: jest.fn(),
        has: jest.fn(),
    },
    influx: {
        write: jest.fn(),
    },
    errorTracker: {
        incrementError: jest.fn().mockResolvedValue(),
    },
    influxDefaultDb: 'test-db',
    udpQueueManagerUserActivity: null,
    udpQueueManagerLogEvents: null,
    hostInfo: {
        hostname: 'test-host',
    },
    getErrorMessage: jest.fn().mockImplementation((err) => err.message || err.toString()),
};

jest.unstable_mockModule('../../../globals.js', () => ({
    default: mockGlobals,
}));

// Mock InfluxDB v3 client
jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: jest.fn().mockImplementation(() => ({
        setTag: jest.fn().mockReturnThis(),
        setFloatField: jest.fn().mockReturnThis(),
        setIntegerField: jest.fn().mockReturnThis(),
        setStringField: jest.fn().mockReturnThis(),
        setBooleanField: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        toLineProtocol: jest.fn().mockReturnValue('mock-line-protocol'),
    })),
}));

// Mock shared utils
jest.unstable_mockModule('../shared/utils.js', () => ({
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV3: jest.fn(),
}));

describe('InfluxDB v3 Queue Metrics', () => {
    let queueMetrics;
    let globals;
    let Point3;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        const influxdbV3 = await import('@influxdata/influxdb3-client');
        Point3 = influxdbV3.Point;
        utils = await import('../shared/utils.js');

        queueMetrics = await import('../v3/queue-metrics.js');

        // Setup default mocks
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeBatchToInfluxV3.mockResolvedValue();
    });

    describe('postUserEventQueueMetricsToInfluxdbV3', () => {
        test('should return early when queue metrics are disabled', async () => {
            globals.config.get.mockReturnValue(false);

            await queueMetrics.postUserEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should warn when queue manager is not initialized', async () => {
            globals.config.get.mockReturnValue(true);
            globals.udpQueueManagerUserActivity = null;

            await queueMetrics.postUserEventQueueMetricsToInfluxdbV3();

            expect(globals.logger.warn).toHaveBeenCalledWith(
                'USER EVENT QUEUE METRICS INFLUXDB V3: Queue manager not initialized'
            );
            expect(Point3).not.toHaveBeenCalled();
        });

        test('should return early when InfluxDB is not enabled', async () => {
            globals.config.get.mockReturnValue(true);
            globals.udpQueueManagerUserActivity = { getMetrics: jest.fn() };
            utils.isInfluxDbEnabled.mockReturnValue(false);

            await queueMetrics.postUserEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should successfully write queue metrics', async () => {
            const mockMetrics = {
                queueSize: 10,
                queueMaxSize: 100,
                queueUtilizationPct: 10.5,
                queuePending: 2,
                messagesReceived: 1000,
                messagesQueued: 950,
                messagesProcessed: 940,
                messagesFailed: 5,
                messagesDroppedTotal: 50,
                messagesDroppedRateLimit: 10,
                messagesDroppedQueueFull: 30,
                messagesDroppedSize: 10,
                processingTimeAvgMs: 15.5,
                processingTimeP95Ms: 45.2,
                processingTimeMaxMs: 120.0,
                rateLimitCurrent: 500,
                backpressureActive: 0,
            };

            globals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.enable') {
                    return true;
                }
                if (
                    key ===
                    'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.measurementName'
                ) {
                    return 'user_events_queue';
                }
                if (key === 'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.tags') {
                    return [{ name: 'env', value: 'test' }];
                }
                if (key === 'Butler-SOS.influxdbConfig.v3Config.database') {
                    return 'test-db';
                }
                if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') {
                    return 100;
                }
                return null;
            });

            globals.udpQueueManagerUserActivity = {
                getMetrics: jest.fn().mockResolvedValue(mockMetrics),
                clearMetrics: jest.fn().mockResolvedValue(),
            };

            await queueMetrics.postUserEventQueueMetricsToInfluxdbV3();

            expect(Point3).toHaveBeenCalledWith('user_events_queue');
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalledWith(
                expect.any(Array),
                'test-db',
                'User event queue metrics',
                'user-events-queue',
                100
            );
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'USER EVENT QUEUE METRICS INFLUXDB V3: Sent queue metrics data to InfluxDB v3'
            );
            expect(globals.udpQueueManagerUserActivity.clearMetrics).toHaveBeenCalled();
        });

        test('should handle errors gracefully', async () => {
            globals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.enable') {
                    return true;
                }
                throw new Error('Config error');
            });

            globals.udpQueueManagerUserActivity = {
                getMetrics: jest.fn(),
            };

            await queueMetrics.postUserEventQueueMetricsToInfluxdbV3();

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    'USER EVENT QUEUE METRICS INFLUXDB V3: Error posting queue metrics'
                )
            );
        });
    });

    describe('postLogEventQueueMetricsToInfluxdbV3', () => {
        test('should return early when queue metrics are disabled', async () => {
            globals.config.get.mockReturnValue(false);

            await queueMetrics.postLogEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should warn when queue manager is not initialized', async () => {
            globals.config.get.mockReturnValue(true);
            globals.udpQueueManagerLogEvents = null;

            await queueMetrics.postLogEventQueueMetricsToInfluxdbV3();

            expect(globals.logger.warn).toHaveBeenCalledWith(
                'LOG EVENT QUEUE METRICS INFLUXDB V3: Queue manager not initialized'
            );
            expect(Point3).not.toHaveBeenCalled();
        });

        test('should successfully write queue metrics', async () => {
            const mockMetrics = {
                queueSize: 5,
                queueMaxSize: 100,
                queueUtilizationPct: 5.0,
                queuePending: 1,
                messagesReceived: 500,
                messagesQueued: 490,
                messagesProcessed: 485,
                messagesFailed: 2,
                messagesDroppedTotal: 10,
                messagesDroppedRateLimit: 5,
                messagesDroppedQueueFull: 3,
                messagesDroppedSize: 2,
                processingTimeAvgMs: 12.3,
                processingTimeP95Ms: 38.9,
                processingTimeMaxMs: 95.0,
                rateLimitCurrent: 400,
                backpressureActive: 0,
            };

            globals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.enable') {
                    return true;
                }
                if (
                    key ===
                    'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.measurementName'
                ) {
                    return 'log_events_queue';
                }
                if (key === 'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.tags') {
                    return [];
                }
                if (key === 'Butler-SOS.influxdbConfig.v3Config.database') {
                    return 'test-db';
                }
                if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') {
                    return 100;
                }
                return null;
            });

            globals.udpQueueManagerLogEvents = {
                getMetrics: jest.fn().mockResolvedValue(mockMetrics),
                clearMetrics: jest.fn().mockResolvedValue(),
            };

            await queueMetrics.postLogEventQueueMetricsToInfluxdbV3();

            expect(Point3).toHaveBeenCalledWith('log_events_queue');
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalledWith(
                expect.any(Array),
                'test-db',
                'Log event queue metrics',
                'log-events-queue',
                100
            );
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'LOG EVENT QUEUE METRICS INFLUXDB V3: Sent queue metrics data to InfluxDB v3'
            );
            expect(globals.udpQueueManagerLogEvents.clearMetrics).toHaveBeenCalled();
        });

        test('should handle write errors', async () => {
            globals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.enable') {
                    return true;
                }
                if (
                    key ===
                    'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.measurementName'
                ) {
                    return 'log_events_queue';
                }
                if (key === 'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.tags') {
                    return [];
                }
                if (key === 'Butler-SOS.influxdbConfig.v3Config.database') {
                    return 'test-db';
                }
                return null;
            });

            globals.udpQueueManagerLogEvents = {
                getMetrics: jest.fn().mockResolvedValue({
                    queueSize: 5,
                    queueMaxSize: 100,
                    queueUtilizationPct: 5.0,
                    queuePending: 1,
                    messagesReceived: 500,
                    messagesQueued: 490,
                    messagesProcessed: 485,
                    messagesFailed: 2,
                    messagesDroppedTotal: 10,
                    messagesDroppedRateLimit: 5,
                    messagesDroppedQueueFull: 3,
                    messagesDroppedSize: 2,
                    processingTimeAvgMs: 12.3,
                    processingTimeP95Ms: 38.9,
                    processingTimeMaxMs: 95.0,
                    rateLimitCurrent: 400,
                    backpressureActive: 0,
                }),
                clearMetrics: jest.fn(),
            };

            utils.writeBatchToInfluxV3.mockRejectedValue(new Error('Write failed'));

            await queueMetrics.postLogEventQueueMetricsToInfluxdbV3();

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    'LOG EVENT QUEUE METRICS INFLUXDB V3: Error posting queue metrics'
                )
            );
        });
    });
});
