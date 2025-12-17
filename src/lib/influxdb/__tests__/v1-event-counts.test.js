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
    errorTracker: {
        incrementError: jest.fn().mockResolvedValue(),
    },
    udpEvents: { getLogEvents: jest.fn(), getUserEvents: jest.fn() },
    rejectedEvents: { getRejectedLogEvents: jest.fn() },
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV1: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('v1/event-counts', () => {
    let storeEventCountV1, storeRejectedEventCountV1, globals, utils;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const eventCounts = await import('../v1/event-counts.js');
        storeEventCountV1 = eventCounts.storeEventCountV1;
        storeRejectedEventCountV1 = eventCounts.storeRejectedEventCountV1;

        globals.config.has.mockReturnValue(true);
        globals.config.get.mockImplementation((path) => {
            if (path.includes('measurementName')) return 'event_counts';
            if (path.includes('tags')) return [{ name: 'env', value: 'prod' }];
            if (path.includes('maxBatchSize')) return 100;
            return undefined;
        });

        globals.udpEvents.getLogEvents.mockResolvedValue([
            { eventType: 'log', eventAction: 'action' },
        ]);
        globals.udpEvents.getUserEvents.mockResolvedValue([
            { eventType: 'user', eventAction: 'action' },
        ]);
        globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([
            { eventType: 'rejected', reason: 'validation' },
        ]);

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
        utils.writeBatchToInfluxV1.mockResolvedValue();
    });

    test('should return early when no events', async () => {
        globals.udpEvents.getLogEvents.mockResolvedValue([]);
        globals.udpEvents.getUserEvents.mockResolvedValue([]);
        await storeEventCountV1();
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early when InfluxDB disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        await storeEventCountV1();
        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should write event counts', async () => {
        await storeEventCountV1();
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalledWith(
            expect.any(Array),
            'Event counts',
            '',
            100
        );
    });

    test('should apply config tags to log events', async () => {
        globals.udpEvents.getLogEvents.mockResolvedValue([
            { source: 'qseow-engine', host: 'host1', subsystem: 'System', counter: 5 },
            { source: 'qseow-proxy', host: 'host2', subsystem: 'Proxy', counter: 10 },
        ]);
        globals.udpEvents.getUserEvents.mockResolvedValue([]);
        await storeEventCountV1();
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should apply config tags to user events', async () => {
        globals.udpEvents.getLogEvents.mockResolvedValue([]);
        globals.udpEvents.getUserEvents.mockResolvedValue([
            { source: 'qseow-engine', host: 'host1', subsystem: 'User', counter: 3 },
            { source: 'qseow-proxy', host: 'host2', subsystem: 'Session', counter: 7 },
        ]);
        await storeEventCountV1();
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle mixed log and user events', async () => {
        globals.udpEvents.getLogEvents.mockResolvedValue([
            { source: 'qseow-engine', host: 'host1', subsystem: 'System', counter: 5 },
        ]);
        globals.udpEvents.getUserEvents.mockResolvedValue([
            { source: 'qseow-proxy', host: 'host2', subsystem: 'User', counter: 3 },
        ]);
        await storeEventCountV1();
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalledWith(
            expect.any(Array),
            'Event counts',
            '',
            100
        );
    });

    test('should handle write errors', async () => {
        utils.writeBatchToInfluxV1.mockRejectedValue(new Error('Write failed'));
        await expect(storeEventCountV1()).rejects.toThrow();
        expect(globals.logger.error).toHaveBeenCalled();
    });

    test('should write rejected event counts', async () => {
        await storeRejectedEventCountV1();
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should return early when no rejected events', async () => {
        globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([]);
        await storeRejectedEventCountV1();
        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should return early when InfluxDB disabled for rejected events', async () => {
        globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([
            { source: 'test', counter: 1 },
        ]);
        utils.isInfluxDbEnabled.mockReturnValue(false);
        await storeRejectedEventCountV1();
        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should handle rejected qix-perf events with appName', async () => {
        globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([
            {
                source: 'qseow-qix-perf',
                appId: 'app123',
                appName: 'MyApp',
                method: 'GetLayout',
                objectType: 'sheet',
                counter: 5,
                processTime: 150,
            },
        ]);
        globals.config.get.mockImplementation((path) => {
            if (path.includes('measurementName')) return 'rejected_events';
            if (path.includes('trackRejectedEvents.tags')) return [{ name: 'env', value: 'test' }];
            return null;
        });
        await storeRejectedEventCountV1();
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle rejected qix-perf events without appName', async () => {
        globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([
            {
                source: 'qseow-qix-perf',
                appId: 'app123',
                appName: '',
                method: 'GetLayout',
                objectType: 'sheet',
                counter: 5,
                processTime: 150,
            },
        ]);
        globals.config.has.mockReturnValue(false);
        await storeRejectedEventCountV1();
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle rejected non-qix-perf events', async () => {
        globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([
            {
                source: 'other-source',
                eventType: 'rejected',
                reason: 'validation',
                counter: 3,
            },
        ]);
        await storeRejectedEventCountV1();
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle rejected events write errors', async () => {
        globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([
            { source: 'test', counter: 1 },
        ]);
        utils.writeBatchToInfluxV1.mockRejectedValue(new Error('Write failed'));
        await expect(storeRejectedEventCountV1()).rejects.toThrow();
        expect(globals.logger.error).toHaveBeenCalled();
    });
});
