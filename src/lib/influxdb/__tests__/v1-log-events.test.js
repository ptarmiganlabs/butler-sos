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
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV1: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('v1/log-events', () => {
    let storeLogEventV1, globals, utils;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const logEvents = await import('../v1/log-events.js');
        storeLogEventV1 = logEvents.storeLogEventV1;
        globals.config.has.mockReturnValue(true);
        globals.config.get.mockImplementation((path) => {
            if (path.includes('maxBatchSize')) return 100;
            return [{ name: 'env', value: 'prod' }];
        });
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
        utils.writeBatchToInfluxV1.mockResolvedValue();
    });

    test('should return early when InfluxDB disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        await storeLogEventV1({ source: 'qseow-engine', host: 'server1' });
        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should warn for unsupported source', async () => {
        await storeLogEventV1({ source: 'unknown', host: 'server1' });
        expect(globals.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unsupported'));
        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should write qseow-engine event', async () => {
        await storeLogEventV1({
            source: 'qseow-engine',
            host: 'server1',
            level: 'INFO',
            log_row: '1',
            subsystem: 'System',
            message: 'test',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalledWith(
            expect.any(Array),
            'Log event from qseow-engine',
            'server1',
            100
        );
    });

    test('should write qseow-proxy event', async () => {
        await storeLogEventV1({
            source: 'qseow-proxy',
            host: 'server2',
            level: 'WARN',
            log_row: '2',
            subsystem: 'Proxy',
            message: 'test',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should write qseow-scheduler event', async () => {
        await storeLogEventV1({
            source: 'qseow-scheduler',
            host: 'server3',
            level: 'ERROR',
            log_row: '3',
            subsystem: 'Scheduler',
            message: 'test',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should write qseow-repository event', async () => {
        await storeLogEventV1({
            source: 'qseow-repository',
            host: 'server4',
            level: 'INFO',
            log_row: '4',
            subsystem: 'Repository',
            message: 'test',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should write qseow-qix-perf event', async () => {
        await storeLogEventV1({
            source: 'qseow-qix-perf',
            host: 'server5',
            level: 'INFO',
            log_row: '5',
            subsystem: 'Perf',
            message: 'test',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle write errors', async () => {
        utils.writeBatchToInfluxV1.mockRejectedValue(new Error('Write failed'));
        await expect(
            storeLogEventV1({
                source: 'qseow-engine',
                host: 'server1',
                level: 'INFO',
                log_row: '1',
                subsystem: 'System',
                message: 'test',
            })
        ).rejects.toThrow();
        expect(globals.logger.error).toHaveBeenCalled();
    });

    test('should apply event categories to tags', async () => {
        await storeLogEventV1({
            source: 'qseow-engine',
            host: 'server1',
            level: 'INFO',
            log_row: '1',
            subsystem: 'System',
            message: 'test',
            category: [
                { name: 'severity', value: 'high' },
                { name: 'component', value: 'engine' },
            ],
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should apply config tags when available', async () => {
        globals.config.has.mockReturnValue(true);
        globals.config.get.mockImplementation((path) => {
            if (path.includes('logEvents.tags')) return [{ name: 'datacenter', value: 'us-east' }];
            return null;
        });
        await storeLogEventV1({
            source: 'qseow-proxy',
            host: 'server2',
            level: 'WARN',
            log_row: '2',
            subsystem: 'Proxy',
            message: 'test',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle events without categories', async () => {
        await storeLogEventV1({
            source: 'qseow-scheduler',
            host: 'server3',
            level: 'INFO',
            log_row: '3',
            subsystem: 'Scheduler',
            message: 'test',
            category: [],
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle engine event with all optional fields', async () => {
        await storeLogEventV1({
            source: 'qseow-engine',
            host: 'server1',
            level: 'INFO',
            log_row: '1',
            subsystem: 'System',
            message: 'test',
            user_full: 'DOMAIN\\user',
            user_directory: 'DOMAIN',
            user_id: 'user123',
            result_code: '200',
            windows_user: 'SYSTEM',
            task_id: 'task-001',
            task_name: 'Reload Task',
            app_id: 'app-123',
            app_name: 'Sales Dashboard',
            engine_exe_version: '14.65.2',
            exception_message: '',
            command: 'OpenDoc',
            origin: 'Engine',
            context: 'DocSession',
            session_id: 'sess-001',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle engine event without optional fields', async () => {
        await storeLogEventV1({
            source: 'qseow-engine',
            host: 'server1',
            level: 'INFO',
            log_row: '1',
            subsystem: 'System',
            message: 'test',
            user_full: '',
            user_directory: '',
            user_id: '',
            result_code: '',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle proxy event with optional fields', async () => {
        await storeLogEventV1({
            source: 'qseow-proxy',
            host: 'server2',
            level: 'WARN',
            log_row: '2',
            subsystem: 'Proxy',
            message: 'test',
            user_full: 'DOMAIN\\proxyuser',
            user_directory: 'DOMAIN',
            user_id: 'proxy123',
            result_code: '401',
            command: 'Authenticate',
            origin: 'Proxy',
            context: 'AuthSession',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle scheduler event with task fields', async () => {
        await storeLogEventV1({
            source: 'qseow-scheduler',
            host: 'server3',
            level: 'INFO',
            log_row: '3',
            subsystem: 'Scheduler',
            message: 'Task completed',
            user_full: 'SYSTEM',
            user_directory: 'INTERNAL',
            user_id: 'sa_scheduler',
            task_id: 'abc-123',
            task_name: 'Daily Reload',
            app_name: 'Finance App',
            app_id: 'finance-001',
            execution_id: 'exec-999',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle repository event with optional fields', async () => {
        await storeLogEventV1({
            source: 'qseow-repository',
            host: 'server4',
            level: 'ERROR',
            log_row: '4',
            subsystem: 'Repository',
            message: 'Access denied',
            user_full: 'DOMAIN\\repouser',
            user_directory: 'DOMAIN',
            user_id: 'repo456',
            result_code: '403',
            command: 'GetObject',
            origin: 'Repository',
            context: 'API',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle qix-perf event with all fields', async () => {
        await storeLogEventV1({
            source: 'qseow-qix-perf',
            host: 'server5',
            level: 'INFO',
            log_row: '5',
            subsystem: 'QixPerf',
            message: 'Performance metric',
            method: 'GetLayout',
            object_type: 'sheet',
            proxy_session_id: 'proxy-sess-001',
            session_id: 'sess-002',
            event_activity_source: 'User',
            user_full: 'DOMAIN\\perfuser',
            user_directory: 'DOMAIN',
            user_id: 'perf789',
            app_id: 'perf-app-001',
            app_name: 'Performance App',
            object_id: 'obj-123',
            process_time: 150,
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle qix-perf event with missing optional fields', async () => {
        await storeLogEventV1({
            source: 'qseow-qix-perf',
            host: '',
            level: '',
            log_row: '',
            subsystem: '',
            message: 'test',
            method: '',
            object_type: '',
            proxy_session_id: '',
            session_id: '',
            event_activity_source: '',
            user_full: '',
            user_directory: '',
            user_id: '',
            app_id: '',
            app_name: '',
            object_id: '',
        });
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });
});
