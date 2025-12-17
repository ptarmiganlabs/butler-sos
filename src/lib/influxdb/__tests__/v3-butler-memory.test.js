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
    },
    influx: {
        write: jest.fn(),
    },
    errorTracker: {
        incrementError: jest.fn().mockResolvedValue(),
    },
    appVersion: '1.0.0',
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
    setFloatField: jest.fn().mockReturnThis(),
    toLineProtocol: jest.fn().mockReturnValue('butlersos_memory_usage'),
};

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

describe('v3/butler-memory', () => {
    let postButlerSOSMemoryUsageToInfluxdbV3;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const butlerMemory = await import('../v3/butler-memory.js');
        postButlerSOSMemoryUsageToInfluxdbV3 = butlerMemory.postButlerSOSMemoryUsageToInfluxdbV3;

        // Setup default mocks
        globals.config.get.mockReturnValue('test-db');
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
    });

    describe('postButlerSOSMemoryUsageToInfluxdbV3', () => {
        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);

            const memory = {
                instanceTag: 'prod-instance',
                heapUsedMByte: 100,
                heapTotalMByte: 200,
                externalMemoryMByte: 50,
                processMemoryMByte: 250,
            };

            await postButlerSOSMemoryUsageToInfluxdbV3(memory);

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should successfully write memory usage metrics', async () => {
            const memory = {
                instanceTag: 'prod-instance',
                heapUsedMByte: 100.5,
                heapTotalMByte: 200.75,
                externalMemoryMByte: 50.25,
                processMemoryMByte: 250.5,
            };

            await postButlerSOSMemoryUsageToInfluxdbV3(memory);

            expect(mockPoint.setTag).toHaveBeenCalledWith('butler_sos_instance', 'prod-instance');
            expect(mockPoint.setTag).toHaveBeenCalledWith('version', '1.0.0');
            expect(mockPoint.setFloatField).toHaveBeenCalledWith('heap_used', 100.5);
            expect(mockPoint.setFloatField).toHaveBeenCalledWith('heap_total', 200.75);
            expect(mockPoint.setFloatField).toHaveBeenCalledWith('external', 50.25);
            expect(mockPoint.setFloatField).toHaveBeenCalledWith('process_memory', 250.5);
            expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
        });

        test('should handle write errors', async () => {
            const memory = {
                instanceTag: 'prod-instance',
                heapUsedMByte: 100,
                heapTotalMByte: 200,
                externalMemoryMByte: 50,
                processMemoryMByte: 250,
            };

            const writeError = new Error('Write failed');
            utils.writeToInfluxWithRetry.mockRejectedValue(writeError);

            await postButlerSOSMemoryUsageToInfluxdbV3(memory);

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error saving memory usage data')
            );
        });

        test('should log debug messages', async () => {
            const memory = {
                instanceTag: 'test-instance',
                heapUsedMByte: 50,
                heapTotalMByte: 100,
                externalMemoryMByte: 25,
                processMemoryMByte: 125,
            };

            await postButlerSOSMemoryUsageToInfluxdbV3(memory);

            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('MEMORY USAGE V3: Memory usage')
            );
            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Wrote data to InfluxDB v3')
            );
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('Sent Butler SOS memory usage data')
            );
        });
    });
});
