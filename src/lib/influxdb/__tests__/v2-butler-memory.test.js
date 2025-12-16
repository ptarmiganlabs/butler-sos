import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPoint = {
    tag: jest.fn().mockReturnThis(),
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
    config: { get: jest.fn() },
    influx: { getWriteApi: jest.fn(() => mockWriteApi) },
    appVersion: '1.2.3',
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

describe('v2/butler-memory', () => {
    let storeButlerMemoryV2, globals, utils, Point;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const InfluxClient = await import('@influxdata/influxdb-client');
        Point = InfluxClient.Point;
        const butlerMemory = await import('../v2/butler-memory.js');
        storeButlerMemoryV2 = butlerMemory.storeButlerMemoryV2;

        mockPoint.tag.mockReturnThis();
        mockPoint.floatField.mockReturnThis();

        globals.config.get.mockImplementation((path) => {
            if (path.includes('org')) return 'test-org';
            if (path.includes('bucket')) return 'test-bucket';
            return undefined;
        });

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockImplementation(async (fn) => await fn());
        mockWriteApi.writePoint.mockResolvedValue(undefined);
    });

    test('should return early when InfluxDB disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        const memory = {
            instanceTag: 'test-instance',
            heapUsedMByte: 100,
            heapTotalMByte: 200,
            externalMemoryMByte: 50,
            processMemoryMByte: 250,
        };
        await storeButlerMemoryV2(memory);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early with invalid memory data', async () => {
        await storeButlerMemoryV2(null);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        expect(globals.logger.warn).toHaveBeenCalledWith(
            'MEMORY USAGE V2: Invalid memory data provided'
        );
    });

    test('should return early with non-object memory data', async () => {
        await storeButlerMemoryV2('not an object');
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        expect(globals.logger.warn).toHaveBeenCalled();
    });

    test('should write complete memory metrics', async () => {
        const memory = {
            instanceTag: 'prod-instance',
            heapUsedMByte: 150.5,
            heapTotalMByte: 300.2,
            externalMemoryMByte: 75.8,
            processMemoryMByte: 400.1,
        };

        await storeButlerMemoryV2(memory);

        expect(Point).toHaveBeenCalledWith('butlersos_memory_usage');
        expect(mockPoint.tag).toHaveBeenCalledWith('butler_sos_instance', 'prod-instance');
        expect(mockPoint.tag).toHaveBeenCalledWith('version', '1.2.3');
        expect(mockPoint.floatField).toHaveBeenCalledWith('heap_used', 150.5);
        expect(mockPoint.floatField).toHaveBeenCalledWith('heap_total', 300.2);
        expect(mockPoint.floatField).toHaveBeenCalledWith('external', 75.8);
        expect(mockPoint.floatField).toHaveBeenCalledWith('process_memory', 400.1);
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
        expect(mockWriteApi.writePoint).toHaveBeenCalled();
        expect(mockWriteApi.close).toHaveBeenCalled();
        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'MEMORY USAGE V2: Sent Butler SOS memory usage data to InfluxDB'
        );
    });

    test('should handle zero memory values', async () => {
        const memory = {
            instanceTag: 'test-instance',
            heapUsedMByte: 0,
            heapTotalMByte: 0,
            externalMemoryMByte: 0,
            processMemoryMByte: 0,
        };

        await storeButlerMemoryV2(memory);

        expect(mockPoint.floatField).toHaveBeenCalledWith('heap_used', 0);
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should log silly level debug info', async () => {
        const memory = {
            instanceTag: 'test-instance',
            heapUsedMByte: 100,
            heapTotalMByte: 200,
            externalMemoryMByte: 50,
            processMemoryMByte: 250,
        };

        await storeButlerMemoryV2(memory);

        expect(globals.logger.debug).toHaveBeenCalled();
        expect(globals.logger.silly).toHaveBeenCalled();
    });
});
