import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalsPath = path.resolve(__dirname, '../../../../globals.js');

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
        writePoints: jest.fn(),
        getWriteApi: jest.fn(),
        write: jest.fn(),
    },
    appNames: [],
    getErrorMessage: jest.fn().mockImplementation((err) => err.message || err.toString()),
};

jest.unstable_mockModule(globalsPath, () => ({
    default: mockGlobals,
}));

const utils = await import('../utils.js');

describe('InfluxDB Shared Utils Comprehensive', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getFormattedTime', () => {
        test('should format valid timestamp', () => {
            // Mock Date.now to have a fixed reference
            const now = new Date(2021, 10, 10, 15, 37, 26).getTime();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            const serverStarted = '20211109T153726.028+0200';
            const result = utils.getFormattedTime(serverStarted);
            // The result might vary by 1 hour due to timezone, so we check for both
            expect(result).toMatch(/1 days, [01]h 00m 00s/);

            Date.now.mockRestore();
        });

        test('should return empty string for invalid input', () => {
            expect(utils.getFormattedTime(null)).toBe('');
            expect(utils.getFormattedTime('')).toBe('');
            expect(utils.getFormattedTime('short')).toBe('');
            expect(utils.getFormattedTime('invalid-timestamp-format')).toBe('');
        });
    });

    describe('processAppDocuments', () => {
        test('should categorize session and regular apps', async () => {
            mockGlobals.appNames = [{ id: 'RegularApp_456', name: 'App 456' }];
            const docIDs = ['SessionApp_123', 'RegularApp_456'];
            const result = await utils.processAppDocuments(docIDs, 'PREFIX', 'state');

            expect(result.appNames).toContain('App 456');
            expect(result.sessionAppNames).toContain('SessionApp_123');
        });
    });

    describe('chunkArray', () => {
        test('should chunk array correctly', () => {
            const arr = [1, 2, 3, 4, 5];
            expect(utils.chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
            expect(utils.chunkArray(arr, 10)).toEqual([[1, 2, 3, 4, 5]]);
            expect(utils.chunkArray([], 2)).toEqual([]);
            expect(utils.chunkArray(null, 2)).toEqual([]);
            expect(utils.chunkArray(arr, 0)).toEqual([[1, 2, 3, 4, 5]]);
        });
    });

    describe('validateUnsignedField', () => {
        test('should clamp negative values to 0 and warn once', () => {
            const result1 = utils.validateUnsignedField(-10, 'm1', 'f1', 's1');
            expect(result1).toBe(0);
            expect(mockGlobals.logger.warn).toHaveBeenCalledTimes(1);

            const result2 = utils.validateUnsignedField(-20, 'm1', 'f2', 's1');
            expect(result2).toBe(0);
            expect(mockGlobals.logger.warn).toHaveBeenCalledTimes(1); // Still 1 due to warn once per measurement
        });

        test('should handle valid values', () => {
            expect(utils.validateUnsignedField(10, 'm2', 'f1', 's1')).toBe(10);
            expect(utils.validateUnsignedField('15.5', 'm2', 'f1', 's1')).toBe(15.5);
            expect(utils.validateUnsignedField(null, 'm2', 'f1', 's1')).toBe(0);
            expect(utils.validateUnsignedField(NaN, 'm2', 'f1', 's1')).toBe(0);
        });
    });

    describe('writeBatchToInfluxV1', () => {
        test('should write in batches', async () => {
            mockGlobals.influx.writePoints.mockResolvedValue();
            const points = [1, 2, 3];
            await utils.writeBatchToInfluxV1(points, 'ctx', 'cat', 2);
            expect(mockGlobals.influx.writePoints).toHaveBeenCalledTimes(2);
        });

        test('should retry with smaller batches on failure', async () => {
            mockGlobals.influx.writePoints
                .mockRejectedValueOnce(new Error('Too big'))
                .mockResolvedValue();

            const points = [1, 2];
            await utils.writeBatchToInfluxV1(points, 'ctx', 'cat', 2);

            // First attempt with size 2 fails.
            // Next size is 1 (since 500, 250, 100, 10 are filtered out).
            // It should try size 1.
            expect(mockGlobals.influx.writePoints).toHaveBeenCalledTimes(3); // 1 (size 2) + 2 (size 1)
        });
    });

    describe('writeBatchToInfluxV2', () => {
        test('should write in batches', async () => {
            const mockWriteApi = {
                writePoints: jest.fn().mockResolvedValue(),
                close: jest.fn().mockResolvedValue(),
            };
            mockGlobals.influx.getWriteApi.mockReturnValue(mockWriteApi);

            const points = [1, 2, 3];
            await utils.writeBatchToInfluxV2(points, 'org', 'bucket', 'ctx', 'cat', 2);
            expect(mockWriteApi.writePoints).toHaveBeenCalledTimes(2);
        });

        test('should retry with smaller batches on failure', async () => {
            const mockWriteApi = {
                writePoints: jest
                    .fn()
                    .mockRejectedValueOnce(new Error('Too big'))
                    .mockResolvedValue(),
                close: jest.fn().mockResolvedValue(),
            };
            mockGlobals.influx.getWriteApi.mockReturnValue(mockWriteApi);

            const points = [1, 2, 3];
            await utils.writeBatchToInfluxV2(points, 'org', 'bucket', 'ctx', 'cat', 2);
            expect(mockWriteApi.writePoints).toHaveBeenCalledTimes(5);
        });
    });

    describe('writeBatchToInfluxV3', () => {
        test('should write in batches', async () => {
            mockGlobals.influx.write.mockResolvedValue();
            const points = [
                { toLineProtocol: () => 'p1' },
                { toLineProtocol: () => 'p2' },
                { toLineProtocol: () => 'p3' },
            ];
            await utils.writeBatchToInfluxV3(points, 'db', 'ctx', 'cat', 2);
            expect(mockGlobals.influx.write).toHaveBeenCalledTimes(2);
        });

        test('should retry with smaller batches on failure', async () => {
            mockGlobals.influx.write
                .mockRejectedValueOnce(new Error('Too big'))
                .mockResolvedValue();

            const points = [
                { toLineProtocol: () => 'p1' },
                { toLineProtocol: () => 'p2' },
                { toLineProtocol: () => 'p3' },
            ];
            await utils.writeBatchToInfluxV3(points, 'db', 'ctx', 'cat', 2);
            expect(mockGlobals.influx.write).toHaveBeenCalledTimes(5);
        });
    });

    describe('applyTagsToPoint3', () => {
        test('should apply tags to v3 point', () => {
            const mockPoint = {
                setTag: jest.fn().mockReturnThis(),
            };
            const tags = { t1: 'v1', t2: 'v2', t3: null, t4: undefined };
            utils.applyTagsToPoint3(mockPoint, tags);
            expect(mockPoint.setTag).toHaveBeenCalledWith('t1', 'v1');
            expect(mockPoint.setTag).toHaveBeenCalledWith('t2', 'v2');
            expect(mockPoint.setTag).not.toHaveBeenCalledWith('t3', expect.anything());
        });

        test('should return point if tags are invalid', () => {
            const mockPoint = {};
            expect(utils.applyTagsToPoint3(mockPoint, null)).toBe(mockPoint);
            expect(utils.applyTagsToPoint3(mockPoint, 'not-an-object')).toBe(mockPoint);
        });
    });
});
