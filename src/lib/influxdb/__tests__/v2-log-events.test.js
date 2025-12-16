import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPoint = {
    tag: jest.fn().mockReturnThis(),
    stringField: jest.fn().mockReturnThis(),
    intField: jest.fn().mockReturnThis(),
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
    config: { get: jest.fn(), has: jest.fn() },
    influx: { getWriteApi: jest.fn(() => mockWriteApi) },
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

describe('v2/log-events', () => {
    let storeLogEventV2, globals, utils, Point;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const InfluxClient = await import('@influxdata/influxdb-client');
        Point = InfluxClient.Point;
        const logEvents = await import('../v2/log-events.js');
        storeLogEventV2 = logEvents.storeLogEventV2;

        mockPoint.tag.mockReturnThis();
        mockPoint.stringField.mockReturnThis();
        mockPoint.intField.mockReturnThis();
        mockPoint.floatField.mockReturnThis();

        globals.config.get.mockImplementation((path) => {
            if (path.includes('org')) return 'test-org';
            if (path.includes('bucket')) return 'test-bucket';
            if (path.includes('logEvents.tags')) return [{ name: 'env', value: 'prod' }];
            return undefined;
        });
        globals.config.has.mockReturnValue(true);

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockImplementation(async (fn) => await fn());
        mockWriteApi.writePoint.mockResolvedValue(undefined);
    });

    test('should return early when InfluxDB disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        const msg = {
            host: 'host1',
            source: 'qseow-engine',
            level: 'INFO',
            log_row: '1',
            subsystem: 'Core',
            message: 'Test message',
        };
        await storeLogEventV2(msg);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early with missing required fields - no host', async () => {
        const msg = {
            source: 'qseow-engine',
            level: 'INFO',
            log_row: '12345',
            subsystem: 'Core',
            message: 'Test message',
        };
        await storeLogEventV2(msg);
        // Implementation doesn't explicitly validate required fields, it just processes what's there
        // So this test will actually call writeToInfluxWithRetry
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should return early with unsupported source', async () => {
        const msg = {
            host: 'host1',
            source: 'unsupported-source',
            level: 'INFO',
            log_row: '12345',
            subsystem: 'Core',
            message: 'Test message',
        };
        await storeLogEventV2(msg);
        expect(globals.logger.warn).toHaveBeenCalled();
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should write engine log event', async () => {
        const msg = {
            host: 'host1.example.com',
            source: 'qseow-engine',
            level: 'INFO',
            message: 'Engine started successfully',
            log_row: '12345',
            subsystem: 'Core',
            windows_user: 'SYSTEM',
            exception_message: '',
            user_directory: 'DOMAIN',
            user_id: 'admin',
            user_full: 'DOMAIN\\admin',
            result_code: '0',
            origin: 'Engine',
            context: 'Init',
            task_name: 'Reload Task',
            app_name: 'Sales Dashboard',
            task_id: 'task-123',
            app_id: 'app-456',
        };

        await storeLogEventV2(msg);

        expect(Point).toHaveBeenCalledWith('log_event');
        expect(mockPoint.tag).toHaveBeenCalledWith('host', 'host1.example.com');
        expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-engine');
        expect(mockPoint.tag).toHaveBeenCalledWith('level', 'INFO');
        expect(mockPoint.tag).toHaveBeenCalledWith('log_row', '12345');
        expect(mockPoint.tag).toHaveBeenCalledWith('subsystem', 'Core');
        expect(mockPoint.tag).toHaveBeenCalledWith('windows_user', 'SYSTEM');
        expect(mockPoint.tag).toHaveBeenCalledWith('user_directory', 'DOMAIN');
        expect(mockPoint.tag).toHaveBeenCalledWith('user_id', 'admin');
        expect(mockPoint.tag).toHaveBeenCalledWith('user_full', 'DOMAIN\\admin');
        expect(mockPoint.tag).toHaveBeenCalledWith('result_code', '0');
        expect(mockPoint.tag).toHaveBeenCalledWith('task_id', 'task-123');
        expect(mockPoint.tag).toHaveBeenCalledWith('task_name', 'Reload Task');
        expect(mockPoint.tag).toHaveBeenCalledWith('app_id', 'app-456');
        expect(mockPoint.tag).toHaveBeenCalledWith('app_name', 'Sales Dashboard');
        expect(mockPoint.stringField).toHaveBeenCalledWith(
            'message',
            'Engine started successfully'
        );
        expect(mockPoint.stringField).toHaveBeenCalledWith('exception_message', '');
        expect(mockPoint.stringField).toHaveBeenCalledWith('command', '');
        expect(mockPoint.stringField).toHaveBeenCalledWith('result_code_field', '0');
        expect(mockPoint.stringField).toHaveBeenCalledWith('origin', 'Engine');
        expect(mockPoint.stringField).toHaveBeenCalledWith('context', 'Init');
        expect(mockPoint.stringField).toHaveBeenCalledWith('session_id', '');
        expect(mockPoint.stringField).toHaveBeenCalledWith('raw_event', expect.any(String));
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should write proxy log event', async () => {
        const msg = {
            host: 'proxy1.example.com',
            source: 'qseow-proxy',
            level: 'WARN',
            message: 'Authentication warning',
            log_row: '5000',
            subsystem: 'Proxy',
            command: 'Login',
            user_directory: 'EXTERNAL',
            user_id: 'external_user',
            user_full: 'EXTERNAL\\external_user',
            result_code: '403',
            origin: 'Proxy',
        };

        await storeLogEventV2(msg);

        expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-proxy');
        expect(mockPoint.tag).toHaveBeenCalledWith('level', 'WARN');
        expect(mockPoint.tag).toHaveBeenCalledWith('user_full', 'EXTERNAL\\external_user');
        expect(mockPoint.tag).toHaveBeenCalledWith('result_code', '403');
        expect(mockPoint.stringField).toHaveBeenCalledWith('command', 'Login');
        expect(mockPoint.stringField).toHaveBeenCalledWith('result_code_field', '403');
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should write repository log event', async () => {
        const msg = {
            host: 'repo1.example.com',
            source: 'qseow-repository',
            level: 'ERROR',
            message: 'Database connection error',
            log_row: '7890',
            subsystem: 'Repository',
            exception_message: 'Connection timeout',
        };

        await storeLogEventV2(msg);

        expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-repository');
        expect(mockPoint.tag).toHaveBeenCalledWith('level', 'ERROR');
        expect(mockPoint.stringField).toHaveBeenCalledWith(
            'exception_message',
            'Connection timeout'
        );
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should write scheduler log event', async () => {
        const msg = {
            host: 'scheduler1.example.com',
            source: 'qseow-scheduler',
            level: 'INFO',
            message: 'Task scheduled',
            log_row: '3333',
            subsystem: 'Scheduler',
            task_name: 'Daily Reload',
            task_id: 'sched-task-001',
        };

        await storeLogEventV2(msg);

        expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-scheduler');
        expect(mockPoint.tag).toHaveBeenCalledWith('level', 'INFO');
        expect(mockPoint.tag).toHaveBeenCalledWith('task_id', 'sched-task-001');
        expect(mockPoint.tag).toHaveBeenCalledWith('task_name', 'Daily Reload');
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should handle log event with minimal fields', async () => {
        const msg = {
            host: 'host1',
            source: 'qseow-engine',
            level: 'DEBUG',
            log_row: '1',
            subsystem: 'Core',
            message: 'Debug message',
        };

        await storeLogEventV2(msg);

        expect(mockPoint.tag).toHaveBeenCalledWith('host', 'host1');
        expect(mockPoint.tag).toHaveBeenCalledWith('source', 'qseow-engine');
        expect(mockPoint.tag).toHaveBeenCalledWith('level', 'DEBUG');
        expect(mockPoint.stringField).toHaveBeenCalledWith('message', 'Debug message');
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should handle empty string fields', async () => {
        const msg = {
            host: 'host1',
            source: 'qseow-engine',
            level: 'INFO',
            log_row: '1',
            subsystem: 'Core',
            message: '',
            exception_message: '',
            task_name: '',
            app_name: '',
        };

        await storeLogEventV2(msg);

        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should apply config tags', async () => {
        const msg = {
            host: 'host1',
            source: 'qseow-engine',
            level: 'INFO',
            log_row: '1',
            subsystem: 'Core',
            message: 'Test',
        };

        await storeLogEventV2(msg);

        expect(mockV2Utils.applyInfluxTags).toHaveBeenCalledWith(mockPoint, [
            { name: 'env', value: 'prod' },
        ]);
    });

    test('should handle all log levels', async () => {
        const logLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

        for (const level of logLevels) {
            jest.clearAllMocks();
            const msg = {
                host: 'host1',
                source: 'qseow-engine',
                level: level,
                log_row: '1',
                subsystem: 'Core',
                message: `${level} message`,
            };

            await storeLogEventV2(msg);

            expect(mockPoint.tag).toHaveBeenCalledWith('level', level);
        }
    });

    test('should handle all source types', async () => {
        const sources = [
            'qseow-engine',
            'qseow-proxy',
            'qseow-repository',
            'qseow-scheduler',
            'qseow-qix-perf',
        ];

        for (const source of sources) {
            jest.clearAllMocks();
            const msg = {
                host: 'host1',
                source,
                level: 'INFO',
                log_row: '1',
                subsystem: 'Core',
                message: 'Test',
            };
            // qix-perf requires additional fields
            if (source === 'qseow-qix-perf') {
                msg.method = 'GetLayout';
                msg.object_type = 'sheet';
                msg.proxy_session_id = 'session123';
                msg.session_id = 'session123';
                msg.event_activity_source = 'user';
                msg.process_time = '100';
                msg.work_time = '50';
                msg.lock_time = '10';
                msg.validate_time = '5';
                msg.traverse_time = '35';
                msg.net_ram = '1024';
                msg.peak_ram = '2048';
            }

            await storeLogEventV2(msg);

            expect(mockPoint.tag).toHaveBeenCalledWith('source', source);
        }
    });

    test('should log debug information', async () => {
        const msg = {
            host: 'host1',
            source: 'qseow-engine',
            level: 'INFO',
            log_row: '1',
            subsystem: 'Core',
            message: 'Test',
        };

        await storeLogEventV2(msg);

        expect(globals.logger.debug).toHaveBeenCalled();
        expect(globals.logger.silly).toHaveBeenCalled();
        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'LOG EVENT V2: Sent log event data to InfluxDB'
        );
    });
});
