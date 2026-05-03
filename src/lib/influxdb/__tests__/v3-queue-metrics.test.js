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
    auditEventsQueueManager: null,
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
const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV3: jest.fn(),
};
jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

// Mock the builder module
const mockBuilder = {
    prepareQueueMetricData: jest.fn(),
    QUEUE_METRIC_FIELDS: [],
};
jest.unstable_mockModule('../shared/queue-metrics-builder.js', () => mockBuilder);

describe('InfluxDB v3 Queue Metrics', () => {
    let queueMetrics;
    let globals;
    let Point3;
    let utils;
    let builder;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        const influxdbV3 = await import('@influxdata/influxdb3-client');
        Point3 = influxdbV3.Point;
        utils = await import('../shared/utils.js');
        builder = await import('../shared/queue-metrics-builder.js');

        queueMetrics = await import('../v3/queue-metrics.js');

        // Setup default mocks
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeBatchToInfluxV3.mockResolvedValue();
        builder.prepareQueueMetricData.mockResolvedValue({
            config: {
                queueTypeTag: 'user_events',
                description: 'User event queue metrics',
                bucketKey: 'user-events-queue',
            },
            queueManager: {
                getMetrics: jest.fn().mockResolvedValue({}),
                clearMetrics: jest.fn().mockResolvedValue(),
            },
        });
    });

    describe('postUserEventQueueMetricsToInfluxdbV3', () => {
        test('should return early when queue metrics are disabled', async () => {
            builder.prepareQueueMetricData.mockResolvedValue(null);
            globals.config.get.mockReturnValue(false);

            await queueMetrics.postUserEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should warn when queue manager is not initialized', async () => {
            builder.prepareQueueMetricData.mockResolvedValue(null);
            globals.config.get.mockReturnValue(true);

            await queueMetrics.postUserEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should return early when InfluxDB is not enabled', async () => {
            builder.prepareQueueMetricData.mockResolvedValue(null);
            globals.config.get.mockReturnValue(true);
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

            builder.prepareQueueMetricData.mockResolvedValue({
                config: { queueTypeTag: 'user_events', description: 'User event queue metrics', bucketKey: 'user-events-queue' },
                queueManager: globals.udpQueueManagerUserActivity,
                metrics: mockMetrics,
                measurementName: 'user_events_queue',
                configTags: [{ name: 'env', value: 'test' }],
            });

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
            expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
                'INFLUXDB_V3_WRITE',
                '',
                { module: 'QUEUE_METRICS' },
                expect.any(Error)
            );
        });
    });

    describe('postLogEventQueueMetricsToInfluxdbV3', () => {
        test('should return early when queue metrics are disabled', async () => {
            builder.prepareQueueMetricData.mockResolvedValue(null);
            globals.config.get.mockReturnValue(false);

            await queueMetrics.postLogEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should warn when queue manager is not initialized', async () => {
            builder.prepareQueueMetricData.mockResolvedValue(null);
            globals.config.get.mockReturnValue(true);

            await queueMetrics.postLogEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
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

            builder.prepareQueueMetricData.mockResolvedValue({
                config: { queueTypeTag: 'log_events', description: 'Log event queue metrics', bucketKey: 'log-events-queue' },
                queueManager: globals.udpQueueManagerLogEvents,
                metrics: mockMetrics,
                measurementName: 'log_events_queue',
                configTags: [],
            });

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
            expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
                'INFLUXDB_V3_WRITE',
                '',
                { module: 'QUEUE_METRICS' },
                expect.any(Error)
            );
        });
    });

    describe('postAuditEventQueueMetricsToInfluxdbV3', () => {
        test('should return early when queue metrics are disabled', async () => {
            builder.prepareQueueMetricData.mockResolvedValue(null);
            globals.config.get.mockReturnValue(false);

            await queueMetrics.postAuditEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should warn when queue manager is not initialized', async () => {
            builder.prepareQueueMetricData.mockResolvedValue(null);
            globals.config.has.mockReturnValue(true);
            globals.config.get.mockReturnValue(true);

            await queueMetrics.postAuditEventQueueMetricsToInfluxdbV3();

            expect(Point3).not.toHaveBeenCalled();
            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should successfully write queue metrics', async () => {
            const mockMetrics = {
                queueSize: 1,
                queueMaxSize: 10,
                queueUtilizationPct: 10.0,
                queuePending: 0,
                messagesReceived: 10,
                messagesQueued: 9,
                messagesProcessed: 9,
                messagesFailed: 0,
                messagesDroppedTotal: 1,
                messagesDroppedRateLimit: 1,
                messagesDroppedQueueFull: 0,
                messagesDroppedSize: 0,
                processingTimeAvgMs: 1.0,
                processingTimeP95Ms: 2.0,
                processingTimeMaxMs: 3.0,
                rateLimitCurrent: 10,
                backpressureActive: 0,
            };

            globals.config.has.mockReturnValue(true);
            globals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.enable') {
                    return true;
                }
                if (key === 'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.measurementName') {
                    return 'audit_events_queue';
                }
                if (key === 'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.tags') {
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

            globals.auditEventsQueueManager = {
                getMetrics: jest.fn().mockResolvedValue(mockMetrics),
                clearMetrics: jest.fn().mockResolvedValue(),
            };

            builder.prepareQueueMetricData.mockResolvedValue({
                config: { queueTypeTag: 'audit_events', description: 'Audit event queue metrics', bucketKey: 'audit-events-queue' },
                queueManager: globals.auditEventsQueueManager,
                metrics: mockMetrics,
                measurementName: 'audit_events_queue',
                configTags: [],
            });

            await queueMetrics.postAuditEventQueueMetricsToInfluxdbV3();

            expect(Point3).toHaveBeenCalledWith('audit_events_queue');
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalledWith(
                expect.any(Array),
                'test-db',
                'Audit event queue metrics',
                'audit-events-queue',
                100
            );
            expect(globals.auditEventsQueueManager.clearMetrics).toHaveBeenCalled();
        });

        test('should handle write errors with error tracking', async () => {
            globals.config.has.mockReturnValue(true);
            globals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.enable') {
                    return true;
                }
                if (key === 'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.measurementName') {
                    return 'audit_events_queue';
                }
                if (key === 'Butler-SOS.auditEvents.queue.queueMetrics.influxdb.tags') {
                    return [];
                }
                if (key === 'Butler-SOS.influxdbConfig.v3Config.database') {
                    return 'test-db';
                }
                return null;
            });

            globals.auditEventsQueueManager = {
                getMetrics: jest.fn().mockResolvedValue({
                    queueSize: 1,
                    queueMaxSize: 10,
                    queueUtilizationPct: 10.0,
                    queuePending: 0,
                    messagesReceived: 10,
                    messagesQueued: 9,
                    messagesProcessed: 9,
                    messagesFailed: 0,
                    messagesDroppedTotal: 1,
                    messagesDroppedRateLimit: 1,
                    messagesDroppedQueueFull: 0,
                    messagesDroppedSize: 0,
                    processingTimeAvgMs: 1.0,
                    processingTimeP95Ms: 2.0,
                    processingTimeMaxMs: 3.0,
                    rateLimitCurrent: 10,
                    backpressureActive: 0,
                }),
                clearMetrics: jest.fn(),
            };

            utils.writeBatchToInfluxV3.mockRejectedValue(new Error('Write failed'));

            await queueMetrics.postAuditEventQueueMetricsToInfluxdbV3();

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('AUDIT EVENT QUEUE METRICS INFLUXDB V3: Error posting queue metrics')
            );
            expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
                'INFLUXDB_V3_WRITE',
                '',
                { module: 'QUEUE_METRICS' },
                expect.any(Error)
            );
        });
    });
});;
