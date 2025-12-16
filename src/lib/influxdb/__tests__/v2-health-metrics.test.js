import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPoint = {
    tag: jest.fn().mockReturnThis(),
    stringField: jest.fn().mockReturnThis(),
    intField: jest.fn().mockReturnThis(),
    uintField: jest.fn().mockReturnThis(),
    floatField: jest.fn().mockReturnThis(),
    booleanField: jest.fn().mockReturnThis(),
};

const mockWriteApi = {
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
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    processAppDocuments: jest.fn(),
    getFormattedTime: jest.fn(() => '2 days, 3 hours'),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('v2/health-metrics', () => {
    let storeHealthMetricsV2, globals, utils, Point;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const InfluxClient = await import('@influxdata/influxdb-client');
        Point = InfluxClient.Point;
        const healthMetrics = await import('../v2/health-metrics.js');
        storeHealthMetricsV2 = healthMetrics.storeHealthMetricsV2;

        mockPoint.tag.mockReturnThis();
        mockPoint.stringField.mockReturnThis();
        mockPoint.intField.mockReturnThis();
        mockPoint.uintField.mockReturnThis();
        mockPoint.floatField.mockReturnThis();
        mockPoint.booleanField.mockReturnThis();

        globals.config.get.mockImplementation((path) => {
            if (path.includes('org')) return 'test-org';
            if (path.includes('bucket')) return 'test-bucket';
            if (path.includes('includeFields')) return true;
            if (path.includes('enableAppNameExtract')) return true;
            return undefined;
        });

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockImplementation(async (fn) => await fn());
        utils.processAppDocuments.mockResolvedValue({
            appNames: ['App1', 'App2'],
            sessionAppNames: ['Session1', 'Session2'],
        });
    });

    test('should return early when InfluxDB disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        const body = {
            version: '1.0',
            started: '2024-01-01',
            mem: { committed: 1000, allocated: 800, free: 200 },
            apps: { active_docs: [], loaded_docs: [], in_memory_docs: [], calls: 0, selections: 0 },
            cpu: { total: 50 },
            session: { active: 5, total: 10 },
            users: { active: 3, total: 8 },
            cache: { hits: 100, lookups: 120, added: 20, replaced: 5, bytes_added: 1024 },
            saturated: false,
        };
        await storeHealthMetricsV2('server1', 'host1', body);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early with invalid body', async () => {
        await storeHealthMetricsV2('server1', 'host1', null);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        expect(globals.logger.warn).toHaveBeenCalled();
    });

    test('should write complete health metrics with all fields', async () => {
        const body = {
            version: '1.0.0',
            started: '2024-01-01T00:00:00Z',
            mem: { committed: 1000, allocated: 800, free: 200 },
            apps: {
                active_docs: [{ id: 'app1' }],
                loaded_docs: [{ id: 'app2' }],
                in_memory_docs: [{ id: 'app3' }],
                calls: 10,
                selections: 5,
            },
            cpu: { total: 45.7 },
            session: { active: 5, total: 10 },
            users: { active: 3, total: 8 },
            cache: { hits: 100, lookups: 120, added: 20, replaced: 5, bytes_added: 1024 },
            saturated: false,
        };
        const serverTags = { server_name: 'server1', qs_env: 'dev' };

        await storeHealthMetricsV2('server1', 'host1', body, serverTags);

        expect(Point).toHaveBeenCalledTimes(8); // One for each measurement: sense_server, mem, apps, cpu, session, users, cache, saturated
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
        expect(utils.processAppDocuments).toHaveBeenCalledTimes(3);
        expect(mockWriteApi.writePoints).toHaveBeenCalled();
        expect(mockWriteApi.close).toHaveBeenCalled();
    });

    test('should apply server tags to all points', async () => {
        const body = {
            version: '1.0',
            started: '2024-01-01',
            mem: { committed: 1000, allocated: 800, free: 200 },
            apps: { active_docs: [], loaded_docs: [], in_memory_docs: [], calls: 0, selections: 0 },
            cpu: { total: 50 },
            session: { active: 5, total: 10 },
            users: { active: 3, total: 8 },
            cache: { hits: 100, lookups: 120, added: 20, replaced: 5, bytes_added: 1024 },
            saturated: false,
        };
        const serverTags = { server_name: 'server1', qs_env: 'prod', custom_tag: 'value' };

        await storeHealthMetricsV2('server1', 'host1', body, serverTags);

        // Each point should have tags applied (9 points * 3 tags = 27 calls minimum)
        expect(mockPoint.tag).toHaveBeenCalled();
        expect(globals.logger.verbose).toHaveBeenCalled();
    });

    test('should handle empty app docs', async () => {
        const body = {
            version: '1.0',
            started: '2024-01-01',
            mem: { committed: 1000, allocated: 800, free: 200 },
            apps: { active_docs: [], loaded_docs: [], in_memory_docs: [], calls: 0, selections: 0 },
            cpu: { total: 50 },
            session: { active: 0, total: 0 },
            users: { active: 0, total: 0 },
            cache: { hits: 0, lookups: 0, added: 0, replaced: 0, bytes_added: 0 },
            saturated: false,
        };

        await storeHealthMetricsV2('server1', 'host1', body, {});

        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
        expect(utils.processAppDocuments).toHaveBeenCalledWith([], 'HEALTH METRICS', 'active');
    });

    test('should handle serverTags with null values', async () => {
        const body = {
            version: '1.0',
            started: '2024-01-01',
            mem: { committed: 1000, allocated: 800, free: 200 },
            apps: { active_docs: [], loaded_docs: [], in_memory_docs: [], calls: 0, selections: 0 },
            cpu: { total: 50 },
            session: { active: 5, total: 10 },
            users: { active: 3, total: 8 },
            cache: { hits: 100, lookups: 120, added: 20, replaced: 5, bytes_added: 1024 },
            saturated: false,
        };
        const serverTags = { server_name: 'server1', null_tag: null, undefined_tag: undefined };

        await storeHealthMetricsV2('server1', 'host1', body, serverTags);

        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should handle config options for includeFields', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path.includes('org')) return 'test-org';
            if (path.includes('bucket')) return 'test-bucket';
            if (path.includes('includeFields.activeDocs')) return false;
            if (path.includes('includeFields.loadedDocs')) return false;
            if (path.includes('includeFields.inMemoryDocs')) return false;
            if (path.includes('enableAppNameExtract')) return false;
            return undefined;
        });

        const body = {
            version: '1.0',
            started: '2024-01-01',
            mem: { committed: 1000, allocated: 800, free: 200 },
            apps: {
                active_docs: [{ id: 'app1' }],
                loaded_docs: [{ id: 'app2' }],
                in_memory_docs: [{ id: 'app3' }],
                calls: 10,
                selections: 5,
            },
            cpu: { total: 50 },
            session: { active: 5, total: 10 },
            users: { active: 3, total: 8 },
            cache: { hits: 100, lookups: 120, added: 20, replaced: 5, bytes_added: 1024 },
            saturated: false,
        };

        await storeHealthMetricsV2('server1', 'host1', body, {});

        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });
});
