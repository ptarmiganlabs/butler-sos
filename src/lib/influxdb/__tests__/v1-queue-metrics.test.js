import { jest, describe, test, expect, beforeEach } from '@jest/globals';

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
    influx: { writePoints: jest.fn() },
    hostInfo: { hostname: 'test-host' },
    errorTracker: {
        incrementError: jest.fn().mockResolvedValue(),
    },
    udpQueueManagerUserActivity: {
        getMetrics: jest.fn(() => ({
            queueSize: 10,
            queueMaxSize: 100,
            messagesProcessed: 50,
            messagesDropped: 2,
            processingRate: 5.5,
        })),
        clearMetrics: jest.fn(),
    },
    udpQueueManagerLogEvents: {
        getMetrics: jest.fn(() => ({
            queueSize: 20,
            queueMaxSize: 200,
            messagesProcessed: 100,
            messagesDropped: 5,
            processingRate: 10.5,
        })),
        clearMetrics: jest.fn(),
    },
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('v1/queue-metrics', () => {
    let storeUserEventQueueMetricsV1, storeLogEventQueueMetricsV1, globals, utils;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const queueMetrics = await import('../v1/queue-metrics.js');
        storeUserEventQueueMetricsV1 = queueMetrics.storeUserEventQueueMetricsV1;
        storeLogEventQueueMetricsV1 = queueMetrics.storeLogEventQueueMetricsV1;

        // Mock queue managers
        globals.udpQueueManagerUserActivity = {
            getMetrics: jest.fn().mockResolvedValue({
                queueSize: 10,
                queueMaxSize: 1000,
                queueUtilizationPct: 1.0,
                queuePending: 5,
                messagesReceived: 100,
                messagesQueued: 95,
                messagesProcessed: 90,
                messagesFailed: 2,
                messagesDroppedTotal: 3,
                messagesDroppedRateLimit: 1,
                messagesDroppedQueueFull: 1,
                messagesDroppedSize: 1,
                processingTimeAvgMs: 50,
                processingTimeP95Ms: 100,
                processingTimeMaxMs: 200,
                rateLimitCurrent: 50,
                backpressureActive: false,
            }),
            clearMetrics: jest.fn(),
        };
        globals.udpQueueManagerLogEvents = {
            getMetrics: jest.fn().mockResolvedValue({
                queueSize: 20,
                queueMaxSize: 2000,
                queueUtilizationPct: 1.0,
                queuePending: 10,
                messagesReceived: 200,
                messagesQueued: 190,
                messagesProcessed: 180,
                messagesFailed: 5,
                messagesDroppedTotal: 5,
                messagesDroppedRateLimit: 2,
                messagesDroppedQueueFull: 2,
                messagesDroppedSize: 1,
                processingTimeAvgMs: 60,
                processingTimeP95Ms: 120,
                processingTimeMaxMs: 250,
                rateLimitCurrent: 100,
                backpressureActive: false,
            }),
            clearMetrics: jest.fn(),
        };

        globals.config.has.mockReturnValue(true);
        globals.config.get.mockImplementation((path) => {
            if (path.includes('queueMetrics.influxdb.enable')) return true;
            if (path.includes('measurementName')) return 'queue_metrics';
            if (path.includes('queueMetrics.influxdb.tags'))
                return [{ name: 'env', value: 'prod' }];
            return undefined;
        });
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
    });

    test('should return early when InfluxDB disabled for user events', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        await storeUserEventQueueMetricsV1();
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early when config disabled', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path.includes('queueMetrics.influxdb.enable')) return false;
            return undefined;
        });
        await storeUserEventQueueMetricsV1();
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early when queue manager not initialized', async () => {
        globals.udpQueueManagerUserActivity = undefined;
        await storeUserEventQueueMetricsV1();
        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('not initialized')
        );
    });

    test('should write user event queue metrics', async () => {
        await storeUserEventQueueMetricsV1();
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalledWith(
            expect.any(Function),
            expect.stringContaining('User event queue metrics'),
            'v1',
            ''
        );
        expect(globals.udpQueueManagerUserActivity.clearMetrics).toHaveBeenCalled();
    });

    test('should handle user event write errors', async () => {
        utils.writeToInfluxWithRetry.mockRejectedValue(new Error('Write failed'));
        await expect(storeUserEventQueueMetricsV1()).rejects.toThrow();
        expect(globals.logger.error).toHaveBeenCalled();
    });

    test('should return early when InfluxDB disabled for log events', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        await storeLogEventQueueMetricsV1();
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early when config disabled for log events', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path.includes('queueMetrics.influxdb.enable')) return false;
            return undefined;
        });
        await storeLogEventQueueMetricsV1();
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early when log queue manager not initialized', async () => {
        globals.udpQueueManagerLogEvents = undefined;
        await storeLogEventQueueMetricsV1();
        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('not initialized')
        );
    });

    test('should write log event queue metrics', async () => {
        await storeLogEventQueueMetricsV1();
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalledWith(
            expect.any(Function),
            expect.stringContaining('Log event queue metrics'),
            'v1',
            ''
        );
        expect(globals.udpQueueManagerLogEvents.clearMetrics).toHaveBeenCalled();
    });

    test('should handle log event write errors', async () => {
        utils.writeToInfluxWithRetry.mockRejectedValue(new Error('Write failed'));
        await expect(storeLogEventQueueMetricsV1()).rejects.toThrow();
        expect(globals.logger.error).toHaveBeenCalled();
    });
});
