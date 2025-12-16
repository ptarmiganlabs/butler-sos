import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock globals
const mockGlobals = {
    logger: {
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        silly: jest.fn(),
    },
    config: {
        get: jest.fn(),
    },
    influx: {
        writePoints: jest.fn(),
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

describe('v1/butler-memory', () => {
    let storeButlerMemoryV1;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const butlerMemory = await import('../v1/butler-memory.js');
        storeButlerMemoryV1 = butlerMemory.storeButlerMemoryV1;

        // Setup default mocks
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
    });

    describe('storeButlerMemoryV1', () => {
        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);

            const memory = {
                instanceTag: 'prod-instance',
                heapUsedMByte: 100,
                heapTotalMByte: 200,
                externalMemoryMByte: 50,
                processMemoryMByte: 250,
            };

            await storeButlerMemoryV1(memory);

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('MEMORY USAGE V1')
            );
        });

        test('should successfully write memory usage metrics', async () => {
            const memory = {
                instanceTag: 'prod-instance',
                heapUsedMByte: 100.5,
                heapTotalMByte: 200.75,
                externalMemoryMByte: 50.25,
                processMemoryMByte: 250.5,
            };

            await storeButlerMemoryV1(memory);

            expect(utils.writeToInfluxWithRetry).toHaveBeenCalledWith(
                expect.any(Function),
                'Memory usage metrics',
                'v1',
                ''
            );
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'MEMORY USAGE V1: Sent Butler SOS memory usage data to InfluxDB'
            );
        });

        test('should create correct datapoint structure', async () => {
            const memory = {
                instanceTag: 'test-instance',
                heapUsedMByte: 150.5,
                heapTotalMByte: 300.75,
                externalMemoryMByte: 75.25,
                processMemoryMByte: 350.5,
            };

            utils.writeToInfluxWithRetry.mockImplementation(async (writeFn) => {
                await writeFn();
            });

            await storeButlerMemoryV1(memory);

            expect(globals.influx.writePoints).toHaveBeenCalledWith([
                {
                    measurement: 'butlersos_memory_usage',
                    tags: {
                        butler_sos_instance: 'test-instance',
                        version: '1.0.0',
                    },
                    fields: {
                        heap_used: 150.5,
                        heap_total: 300.75,
                        external: 75.25,
                        process_memory: 350.5,
                    },
                },
            ]);
        });

        test('should handle write errors and rethrow', async () => {
            const memory = {
                instanceTag: 'prod-instance',
                heapUsedMByte: 100,
                heapTotalMByte: 200,
                externalMemoryMByte: 50,
                processMemoryMByte: 250,
            };

            const writeError = new Error('Write failed');
            utils.writeToInfluxWithRetry.mockRejectedValue(writeError);

            await expect(storeButlerMemoryV1(memory)).rejects.toThrow('Write failed');

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error saving Butler SOS memory data')
            );
        });

        test('should log debug and silly messages', async () => {
            const memory = {
                instanceTag: 'debug-instance',
                heapUsedMByte: 100,
                heapTotalMByte: 200,
                externalMemoryMByte: 50,
                processMemoryMByte: 250,
            };

            await storeButlerMemoryV1(memory);

            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('MEMORY USAGE V1: Memory usage')
            );
            expect(globals.logger.silly).toHaveBeenCalledWith(
                expect.stringContaining('Influxdb datapoint for Butler SOS memory usage')
            );
        });
    });
});
