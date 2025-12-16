import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPoint = {
    tag: jest.fn().mockReturnThis(),
    intField: jest.fn().mockReturnThis(),
    stringField: jest.fn().mockReturnThis(),
};

const mockWriteApi = {
    writePoint: jest.fn(),
    writePoints: jest.fn(),
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
    eventCounters: {
        userEvent: { valid: 100, invalid: 5, rejected: 10 },
        logEvent: { valid: 200, invalid: 8, rejected: 15 },
    },
    rejectedEventTags: {
        userEvent: { tag1: 5, tag2: 3 },
        logEvent: { tag3: 7, tag4: 2 },
    },
    udpEvents: {
        getLogEvents: jest.fn(),
        getUserEvents: jest.fn(),
    },
    rejectedEvents: {
        getRejectedLogEvents: jest.fn(),
    },
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

const mockV2Utils = {
    applyInfluxTags: jest.fn(),
};

jest.unstable_mockModule('../v2/utils.js', () => mockV2Utils);

describe('v2/event-counts', () => {
    let storeEventCountV2, storeRejectedEventCountV2, globals, utils, Point;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const InfluxClient = await import('@influxdata/influxdb-client');
        Point = InfluxClient.Point;
        const eventCounts = await import('../v2/event-counts.js');
        storeEventCountV2 = eventCounts.storeEventCountV2;
        storeRejectedEventCountV2 = eventCounts.storeRejectedEventCountV2;

        mockPoint.tag.mockReturnThis();
        mockPoint.intField.mockReturnThis();
        mockPoint.stringField.mockReturnThis();

        globals.config.get.mockImplementation((path) => {
            if (path.includes('org')) return 'test-org';
            if (path.includes('bucket')) return 'test-bucket';
            if (path.includes('measurementName')) return 'event_count';
            if (path.includes('eventCount.influxdb.tags')) return [{ name: 'env', value: 'prod' }];
            if (path.includes('performanceMonitor.influxdb.tags'))
                return [{ name: 'monitor', value: 'perf' }];
            if (path.includes('enable')) return true;
            return undefined;
        });
        globals.config.has.mockReturnValue(true);

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockImplementation(async (fn) => await fn());

        globals.eventCounters = {
            userEvent: { valid: 100, invalid: 5, rejected: 10 },
            logEvent: { valid: 200, invalid: 8, rejected: 15 },
        };

        // Mock udpEvents and rejectedEvents methods
        globals.udpEvents.getLogEvents.mockResolvedValue([
            { source: 'qseow-engine', host: 'test-host', subsystem: 'engine', counter: 200 },
        ]);
        globals.udpEvents.getUserEvents.mockResolvedValue([
            { source: 'qseow-proxy', host: 'test-host', subsystem: 'proxy', counter: 100 },
        ]);
        globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([]);
    });

    describe('storeEventCountV2', () => {
        test('should return early when InfluxDB disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);
            await storeEventCountV2();
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should write user and log event counts', async () => {
            await storeEventCountV2();

            expect(Point).toHaveBeenCalledTimes(2); // user + log events
            expect(mockPoint.tag).toHaveBeenCalledWith('event_type', 'user');
            expect(mockPoint.tag).toHaveBeenCalledWith('event_type', 'log');
            expect(mockPoint.tag).toHaveBeenCalledWith('host', 'test-host');
            expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-engine');
            expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-proxy');
            expect(mockPoint.tag).toHaveBeenCalledWith('subsystem', 'engine');
            expect(mockPoint.tag).toHaveBeenCalledWith('subsystem', 'proxy');
            expect(mockPoint.intField).toHaveBeenCalledWith('counter', 200);
            expect(mockPoint.intField).toHaveBeenCalledWith('counter', 100);
            expect(mockV2Utils.applyInfluxTags).toHaveBeenCalledTimes(2);
            expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
            expect(mockWriteApi.writePoints).toHaveBeenCalled();
            expect(mockWriteApi.close).toHaveBeenCalled();
        });

        test('should handle zero counts', async () => {
            globals.udpEvents.getLogEvents.mockResolvedValue([]);
            globals.udpEvents.getUserEvents.mockResolvedValue([]);

            await storeEventCountV2();

            // If no events, it should return early
            expect(Point).not.toHaveBeenCalled();
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should log verbose information', async () => {
            await storeEventCountV2();

            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'EVENT COUNT V2: Sent event count data to InfluxDB'
            );
        });
    });

    describe('storeRejectedEventCountV2', () => {
        test('should return early when InfluxDB disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);
            await storeRejectedEventCountV2();
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should return early when feature disabled', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path.includes('performanceMonitor') && path.includes('enable')) return false;
                if (path.includes('enable')) return true;
                return undefined;
            });
            await storeRejectedEventCountV2();
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should write rejected event counts by tag', async () => {
            globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([
                { source: 'qseow-engine', counter: 5 },
                { source: 'qseow-proxy', counter: 3 },
            ]);

            await storeRejectedEventCountV2();

            expect(Point).toHaveBeenCalled();
            expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-engine');
            expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-proxy');
            expect(mockPoint.intField).toHaveBeenCalledWith('counter', 5);
            expect(mockPoint.intField).toHaveBeenCalledWith('counter', 3);
            expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
        });

        test('should handle empty rejection tags', async () => {
            globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([]);

            await storeRejectedEventCountV2();

            expect(Point).not.toHaveBeenCalled();
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should handle undefined rejection tags', async () => {
            globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([]);

            await storeRejectedEventCountV2();

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should log verbose information', async () => {
            globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([
                { source: 'qseow-engine', counter: 5 },
            ]);

            await storeRejectedEventCountV2();

            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'REJECTED EVENT COUNT V2: Sent rejected event count data to InfluxDB'
            );
        });
    });
});
