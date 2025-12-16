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
    options: {
        instanceTag: 'test-instance',
    },
    udpEvents: {
        getLogEvents: jest.fn(),
        getUserEvents: jest.fn(),
    },
    rejectedEvents: {
        getRejectedLogEvents: jest.fn(),
    },
    errorTracker: {
        incrementError: jest.fn().mockResolvedValue(),
    },
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({
    default: mockGlobals,
}));

// Mock shared utils
const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

// Mock Point3
const mockPoint = {
    setTag: jest.fn().mockReturnThis(),
    setIntegerField: jest.fn().mockReturnThis(),
    setFloatField: jest.fn().mockReturnThis(),
    toLineProtocol: jest.fn().mockReturnValue('event_count'),
};

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

describe('v3/event-counts', () => {
    let storeEventCountInfluxDBV3;
    let storeRejectedEventCountInfluxDBV3;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const eventCounts = await import('../v3/event-counts.js');
        storeEventCountInfluxDBV3 = eventCounts.storeEventCountInfluxDBV3;
        storeRejectedEventCountInfluxDBV3 = eventCounts.storeRejectedEventCountInfluxDBV3;

        // Setup default mocks
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'test-db';
            if (key === 'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName')
                return 'event_count';
            if (key === 'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName')
                return 'rejected_event_count';
            return null;
        });
        globals.config.has.mockReturnValue(false);
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
    });

    describe('storeEventCountInfluxDBV3', () => {
        test('should return early when no events to store', async () => {
            globals.udpEvents.getLogEvents.mockResolvedValue([]);
            globals.udpEvents.getUserEvents.mockResolvedValue([]);

            await storeEventCountInfluxDBV3();

            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('No events to store')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);
            globals.udpEvents.getLogEvents.mockResolvedValue([{ source: 'test' }]);
            globals.udpEvents.getUserEvents.mockResolvedValue([]);

            await storeEventCountInfluxDBV3();

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should store log events successfully', async () => {
            const logEvents = [
                {
                    source: 'qseow-engine',
                    host: 'server1',
                    subsystem: 'Engine',
                    counter: 10,
                },
                {
                    source: 'qseow-proxy',
                    host: 'server2',
                    subsystem: 'Proxy',
                    counter: 5,
                },
            ];
            globals.udpEvents.getLogEvents.mockResolvedValue(logEvents);
            globals.udpEvents.getUserEvents.mockResolvedValue([]);

            await storeEventCountInfluxDBV3();

            expect(utils.writeToInfluxWithRetry).toHaveBeenCalledTimes(2);
            expect(mockPoint.setTag).toHaveBeenCalledWith('event_type', 'log');
            expect(mockPoint.setTag).toHaveBeenCalledWith('source', 'qseow-engine');
            expect(mockPoint.setIntegerField).toHaveBeenCalledWith('counter', 10);
        });

        test('should store user events successfully', async () => {
            const userEvents = [
                {
                    source: 'user-activity',
                    host: 'server1',
                    subsystem: 'N/A',
                    counter: 15,
                },
            ];
            globals.udpEvents.getLogEvents.mockResolvedValue([]);
            globals.udpEvents.getUserEvents.mockResolvedValue(userEvents);

            await storeEventCountInfluxDBV3();

            expect(utils.writeToInfluxWithRetry).toHaveBeenCalledTimes(1);
            expect(mockPoint.setTag).toHaveBeenCalledWith('event_type', 'user');
            expect(mockPoint.setIntegerField).toHaveBeenCalledWith('counter', 15);
        });

        test('should store both log and user events', async () => {
            const logEvents = [
                { source: 'qseow-engine', host: 'server1', subsystem: 'Engine', counter: 10 },
            ];
            const userEvents = [
                { source: 'user-activity', host: 'server1', subsystem: 'N/A', counter: 5 },
            ];

            globals.udpEvents.getLogEvents.mockResolvedValue(logEvents);
            globals.udpEvents.getUserEvents.mockResolvedValue(userEvents);

            await storeEventCountInfluxDBV3();

            expect(utils.writeToInfluxWithRetry).toHaveBeenCalledTimes(2);
        });

        test('should apply config tags when available', async () => {
            globals.config.has.mockReturnValue(true);
            globals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'test-db';
                if (key === 'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName')
                    return 'event_count';
                if (key === 'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags')
                    return [{ name: 'env', value: 'production' }];
                return null;
            });

            const logEvents = [
                { source: 'qseow-engine', host: 'server1', subsystem: 'Engine', counter: 10 },
            ];
            globals.udpEvents.getLogEvents.mockResolvedValue(logEvents);
            globals.udpEvents.getUserEvents.mockResolvedValue([]);

            await storeEventCountInfluxDBV3();

            expect(mockPoint.setTag).toHaveBeenCalledWith('env', 'production');
        });

        test('should handle write errors', async () => {
            const logEvents = [
                { source: 'qseow-engine', host: 'server1', subsystem: 'Engine', counter: 10 },
            ];
            globals.udpEvents.getLogEvents.mockResolvedValue(logEvents);
            globals.udpEvents.getUserEvents.mockResolvedValue([]);

            const writeError = new Error('Write failed');
            utils.writeToInfluxWithRetry.mockRejectedValue(writeError);

            await storeEventCountInfluxDBV3();

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error writing data to InfluxDB')
            );
        });
    });

    describe('storeRejectedEventCountInfluxDBV3', () => {
        test('should return early when no events to store', async () => {
            globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([]);

            await storeRejectedEventCountInfluxDBV3();

            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('No events to store')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);
            globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue([{ source: 'test' }]);

            await storeRejectedEventCountInfluxDBV3();

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should store rejected log events successfully', async () => {
            const logEvents = [
                {
                    source: 'qseow-qix-perf',
                    objectType: 'Doc',
                    method: 'GetLayout',
                    counter: 3,
                    processTime: 1.5,
                    appId: 'test-app-123',
                    appName: 'Test App',
                },
            ];
            globals.config.has.mockReturnValue(false); // No custom tags
            globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue(logEvents);

            await storeRejectedEventCountInfluxDBV3();

            // Should have written the rejected event
            expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Wrote data to InfluxDB v3')
            );
        });

        test('should handle write errors for rejected events', async () => {
            const logEvents = [
                {
                    source: 'qseow-engine',
                    host: 'server1',
                    subsystem: 'Engine',
                    counter_rejected: 3,
                },
            ];
            globals.rejectedEvents.getRejectedLogEvents.mockResolvedValue(logEvents);

            const writeError = new Error('Write failed');
            utils.writeToInfluxWithRetry.mockRejectedValue(writeError);

            await storeRejectedEventCountInfluxDBV3();

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error writing data to InfluxDB')
            );
        });
    });
});
