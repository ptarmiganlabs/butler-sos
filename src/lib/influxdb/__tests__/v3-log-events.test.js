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
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({
    default: mockGlobals,
}));

// Mock shared utils
const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV3: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

// Mock Point3
const mockPoint = {
    setTag: jest.fn().mockReturnThis(),
    setField: jest.fn().mockReturnThis(),
    setStringField: jest.fn().mockReturnThis(),
    setIntegerField: jest.fn().mockReturnThis(),
    setFloatField: jest.fn().mockReturnThis(),
    toLineProtocol: jest.fn().mockReturnValue('log_events'),
};

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

describe('v3/log-events', () => {
    let postLogEventToInfluxdbV3;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const logEvents = await import('../v3/log-events.js');
        postLogEventToInfluxdbV3 = logEvents.postLogEventToInfluxdbV3;

        // Setup default mocks
        globals.config.get.mockReturnValue('test-db');
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
    });

    describe('postLogEventToInfluxdbV3', () => {
        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);

            const msg = {
                source: 'qseow-engine',
                host: 'server1',
            };

            await postLogEventToInfluxdbV3(msg);

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should warn and return for unknown log event source', async () => {
            const msg = {
                source: 'unknown-source',
                host: 'server1',
            };

            await postLogEventToInfluxdbV3(msg);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Unknown log event source: unknown-source')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should successfully write qseow-engine log event', async () => {
            const msg = {
                source: 'qseow-engine',
                host: 'server1',
                level: 'INFO',
                message: 'Test message',
                log_row: 'Full log row',
            };

            await postLogEventToInfluxdbV3(msg);

            expect(mockPoint.setTag).toHaveBeenCalledWith('host', 'server1');
            expect(mockPoint.setTag).toHaveBeenCalledWith('source', 'qseow-engine');
            expect(mockPoint.setTag).toHaveBeenCalledWith('level', 'INFO');
            expect(mockPoint.setStringField).toHaveBeenCalledWith('message', 'Test message');
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
        });

        test('should successfully write qseow-proxy log event', async () => {
            const msg = {
                source: 'qseow-proxy',
                host: 'server1',
                level: 'WARN',
                message: 'Proxy warning',
            };

            await postLogEventToInfluxdbV3(msg);

            expect(mockPoint.setTag).toHaveBeenCalledWith('host', 'server1');
            expect(mockPoint.setTag).toHaveBeenCalledWith('source', 'qseow-proxy');
            expect(mockPoint.setTag).toHaveBeenCalledWith('level', 'WARN');
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
        });

        test('should successfully write qseow-scheduler log event', async () => {
            const msg = {
                source: 'qseow-scheduler',
                host: 'server1',
                level: 'ERROR',
                message: 'Scheduler error',
            };

            await postLogEventToInfluxdbV3(msg);

            expect(mockPoint.setTag).toHaveBeenCalledWith('source', 'qseow-scheduler');
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
        });

        test('should successfully write qseow-repository log event', async () => {
            const msg = {
                source: 'qseow-repository',
                host: 'server1',
                level: 'INFO',
                message: 'Repository info',
            };

            await postLogEventToInfluxdbV3(msg);

            expect(mockPoint.setTag).toHaveBeenCalledWith('source', 'qseow-repository');
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
        });

        test('should successfully write qseow-qix-perf log event', async () => {
            const msg = {
                source: 'qseow-qix-perf',
                host: 'server1',
                level: 'INFO',
                message: 'Performance metric',
                method: 'GetData',
                object_type: 'GenericObject',
                process_time: 123.45,
                work_time: 100.0,
                lock_time: 10.0,
                validate_time: 5.0,
                traverse_time: 8.45,
                handle: 42,
                net_ram: 1024,
                peak_ram: 2048,
            };

            await postLogEventToInfluxdbV3(msg);

            expect(mockPoint.setTag).toHaveBeenCalledWith('source', 'qseow-qix-perf');
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
        });

        test('should handle write errors', async () => {
            const msg = {
                source: 'qseow-engine',
                host: 'server1',
                level: 'INFO',
                message: 'Test message',
            };

            const writeError = new Error('Write failed');
            utils.writeBatchToInfluxV3.mockRejectedValue(writeError);

            await postLogEventToInfluxdbV3(msg);

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error saving log event to InfluxDB')
            );
        });

        test('should handle log event with all optional fields', async () => {
            const msg = {
                source: 'qseow-engine',
                host: 'server1',
                level: 'ERROR',
                message: 'Error message',
                exception_message: 'Exception details',
                command: 'OpenDoc',
                result_code: '500',
                origin: 'API',
                context: 'Session context',
                session_id: 'session-123',
                log_row: 'Complete log row',
            };

            await postLogEventToInfluxdbV3(msg);

            expect(mockPoint.setStringField).toHaveBeenCalledWith('message', 'Error message');
            expect(mockPoint.setStringField).toHaveBeenCalledWith(
                'exception_message',
                'Exception details'
            );
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
        });
    });
});
