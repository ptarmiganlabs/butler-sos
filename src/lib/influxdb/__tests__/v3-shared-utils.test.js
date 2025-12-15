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
    influxDefaultDb: 'test-db',
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

describe('InfluxDB v3 Shared Utils', () => {
    let utils;
    let globals;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
    });

    describe('getInfluxDbVersion', () => {
        test('should return version from config', () => {
            globals.config.get.mockReturnValue(3);

            const result = utils.getInfluxDbVersion();

            expect(result).toBe(3);
            expect(globals.config.get).toHaveBeenCalledWith('Butler-SOS.influxdbConfig.version');
        });
    });

    describe('useRefactoredInfluxDb', () => {
        test('should return true when feature flag is enabled', () => {
            globals.config.get.mockReturnValue(true);

            const result = utils.useRefactoredInfluxDb();

            expect(result).toBe(true);
            expect(globals.config.get).toHaveBeenCalledWith(
                'Butler-SOS.influxdbConfig.useRefactoredCode'
            );
        });

        test('should return false when feature flag is disabled', () => {
            globals.config.get.mockReturnValue(false);

            const result = utils.useRefactoredInfluxDb();

            expect(result).toBe(false);
        });

        test('should return false when feature flag is undefined', () => {
            globals.config.get.mockReturnValue(undefined);

            const result = utils.useRefactoredInfluxDb();

            expect(result).toBe(false);
        });
    });

    describe('isInfluxDbEnabled', () => {
        test('should return true when client exists', () => {
            globals.influx = { write: jest.fn() };

            const result = utils.isInfluxDbEnabled();

            expect(result).toBe(true);
        });

        test('should return false and log warning when client does not exist', () => {
            globals.influx = null;

            const result = utils.isInfluxDbEnabled();

            expect(result).toBe(false);
            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Influxdb object not initialized')
            );
        });
    });

    describe('writeToInfluxV3WithRetry', () => {
        test('should successfully write on first attempt', async () => {
            const writeFn = jest.fn().mockResolvedValue();

            await utils.writeToInfluxV3WithRetry(writeFn, 'Test context');

            expect(writeFn).toHaveBeenCalledTimes(1);
            expect(globals.logger.error).not.toHaveBeenCalled();
        });

        test('should retry on timeout error and succeed', async () => {
            const timeoutError = new Error('Request timed out');
            timeoutError.name = 'RequestTimedOutError';

            const writeFn = jest.fn().mockRejectedValueOnce(timeoutError).mockResolvedValueOnce();

            await utils.writeToInfluxV3WithRetry(writeFn, 'Test context', {
                maxRetries: 3,
                initialDelayMs: 10,
            });

            expect(writeFn).toHaveBeenCalledTimes(2);
            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('INFLUXDB V3 RETRY: Test context - Timeout')
            );
        });

        test('should retry multiple times before succeeding', async () => {
            const timeoutError = new Error('Request timed out');
            timeoutError.name = 'RequestTimedOutError';

            const writeFn = jest
                .fn()
                .mockRejectedValueOnce(timeoutError)
                .mockRejectedValueOnce(timeoutError)
                .mockResolvedValueOnce();

            await utils.writeToInfluxV3WithRetry(writeFn, 'Test context', {
                maxRetries: 3,
                initialDelayMs: 10,
            });

            expect(writeFn).toHaveBeenCalledTimes(3);
            expect(globals.logger.warn).toHaveBeenCalledTimes(2);
        });

        test('should throw error after max retries on timeout', async () => {
            const timeoutError = new Error('Request timed out');
            timeoutError.name = 'RequestTimedOutError';

            const writeFn = jest.fn().mockRejectedValue(timeoutError);
            globals.errorTracker = { incrementError: jest.fn().mockResolvedValue() };

            await expect(
                utils.writeToInfluxV3WithRetry(writeFn, 'Test context', {
                    maxRetries: 2,
                    initialDelayMs: 10,
                })
            ).rejects.toThrow('Request timed out');

            expect(writeFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('INFLUXDB V3 RETRY: Test context - All')
            );
            expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
                'INFLUXDB_V3_WRITE',
                ''
            );
        });

        test('should throw non-timeout error immediately without retry', async () => {
            const nonTimeoutError = new Error('Connection refused');
            const writeFn = jest.fn().mockRejectedValue(nonTimeoutError);

            await expect(
                utils.writeToInfluxV3WithRetry(writeFn, 'Test context', {
                    maxRetries: 3,
                    initialDelayMs: 10,
                })
            ).rejects.toThrow('Connection refused');

            expect(writeFn).toHaveBeenCalledTimes(1);
            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('INFLUXDB V3 WRITE: Test context - Non-timeout error')
            );
        });

        test('should detect timeout from error message', async () => {
            const timeoutError = new Error('Request timed out after 10s');

            const writeFn = jest.fn().mockRejectedValueOnce(timeoutError).mockResolvedValueOnce();

            await utils.writeToInfluxV3WithRetry(writeFn, 'Test context', {
                maxRetries: 3,
                initialDelayMs: 10,
            });

            expect(writeFn).toHaveBeenCalledTimes(2);
        });

        test('should detect timeout from constructor name', async () => {
            const timeoutError = new Error('Timeout');
            Object.defineProperty(timeoutError, 'constructor', {
                value: { name: 'RequestTimedOutError' },
            });

            const writeFn = jest.fn().mockRejectedValueOnce(timeoutError).mockResolvedValueOnce();

            await utils.writeToInfluxV3WithRetry(writeFn, 'Test context', {
                maxRetries: 3,
                initialDelayMs: 10,
            });

            expect(writeFn).toHaveBeenCalledTimes(2);
        });
    });

    describe('applyTagsToPoint3', () => {
        test('should apply tags to point', () => {
            const mockPoint = {
                setTag: jest.fn().mockReturnThis(),
            };

            const tags = {
                env: 'production',
                host: 'server1',
            };

            utils.applyTagsToPoint3(mockPoint, tags);

            expect(mockPoint.setTag).toHaveBeenCalledWith('env', 'production');
            expect(mockPoint.setTag).toHaveBeenCalledWith('host', 'server1');
        });

        test('should handle empty tags object', () => {
            const mockPoint = {
                setTag: jest.fn().mockReturnThis(),
            };

            utils.applyTagsToPoint3(mockPoint, {});

            expect(mockPoint.setTag).not.toHaveBeenCalled();
        });

        test('should handle null tags', () => {
            const mockPoint = {
                setTag: jest.fn().mockReturnThis(),
            };

            utils.applyTagsToPoint3(mockPoint, null);

            expect(mockPoint.setTag).not.toHaveBeenCalled();
        });
    });
});
