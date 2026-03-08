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
    hostInfo: { hostname: 'test-host' },
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV1: jest.fn(),
    processAppDocuments: jest.fn(),
    getFormattedTime: jest.fn(() => '2024-01-01T00:00:00Z'),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

const mockBuilder = {
    buildHealthMetricDatapoints: jest.fn(),
};

jest.unstable_mockModule('../shared/health-metrics-builder.js', () => mockBuilder);

describe('v1/health-metrics', () => {
    let storeHealthMetricsV1, postHealthMetricsToInfluxdbV1, globals, utils, builder;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        builder = await import('../shared/health-metrics-builder.js');
        const healthMetrics = await import('../v1/health-metrics.js');
        storeHealthMetricsV1 = healthMetrics.storeHealthMetricsV1;
        postHealthMetricsToInfluxdbV1 = healthMetrics.postHealthMetricsToInfluxdbV1;

        globals.config.has.mockReturnValue(true);
        globals.config.get.mockImplementation((path) => {
            if (path.includes('measurementName')) return 'health_metrics';
            if (path.includes('tags')) return [{ name: 'env', value: 'prod' }];
            if (path.includes('maxBatchSize')) return 100;
            return undefined;
        });

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
        utils.writeBatchToInfluxV1.mockResolvedValue();
        builder.buildHealthMetricDatapoints.mockResolvedValue({
            formattedTime: '2024-01-01T00:00:00Z',
            appNames: {
                active: [],
                activeSession: [],
                loaded: [],
                loadedSession: [],
                inMemory: [],
                inMemorySession: [],
            },
            config: {
                includeActiveDocs: false,
                includeLoadedDocs: false,
                includeInMemoryDocs: false,
                enableAppNameExtract: false,
            },
        });
    });

    test('should return early when InfluxDB disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        const body = { mem: {}, apps: {}, cpu: {}, session: {}, users: {}, cache: {} };
        await storeHealthMetricsV1({ server: 'server1' }, body);
        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should write complete health metrics', async () => {
        const body = {
            mem: { committed: 1000, allocated: 800, free: 200 },
            apps: {
                active_docs: [{ id: 'app1', name: 'App 1' }],
                loaded_docs: [{ id: 'app2', name: 'App 2' }],
                in_memory_docs: [{ id: 'app3', name: 'App 3' }],
                calls: 10,
                selections: 5,
            },
            cpu: { total: 50 },
            session: { active: 5, total: 10 },
            users: { active: 3, total: 8 },
            cache: { hits: 100, lookups: 120, added: 20, replaced: 5, bytes_added: 1024 },
            saturated: false,
            version: '1.0.0',
            started: '2024-01-01T00:00:00Z',
        };
        const serverTags = { server_name: 'server1', server_description: 'Test server' };

        await storeHealthMetricsV1(serverTags, body);

        expect(utils.writeBatchToInfluxV1).toHaveBeenCalledWith(
            expect.any(Array),
            'Health metrics for server1',
            'server1',
            100
        );
        expect(builder.buildHealthMetricDatapoints).toHaveBeenCalledTimes(1);
    });

    test('should handle write errors', async () => {
        utils.writeBatchToInfluxV1.mockRejectedValue(new Error('Write failed'));
        const body = {
            mem: {},
            apps: { active_docs: [], loaded_docs: [], in_memory_docs: [] },
            cpu: {},
            session: {},
            users: {},
            cache: {},
        };
        await expect(storeHealthMetricsV1({ server_name: 'server1' }, body)).rejects.toThrow();
        expect(globals.logger.error).toHaveBeenCalled();
    });

    test('should call buildHealthMetricDatapoints for app documents', async () => {
        const body = {
            mem: {},
            apps: {
                active_docs: [{ id: 'doc1', name: 'Doc 1' }],
                loaded_docs: [{ id: 'doc2', name: 'Doc 2' }],
                in_memory_docs: [{ id: 'doc3', name: 'Doc 3' }],
            },
            cpu: {},
            session: {},
            users: {},
            cache: {},
            version: '1.0.0',
            started: '2024-01-01T00:00:00Z',
        };
        await storeHealthMetricsV1({ server_name: 'server1' }, body);
        expect(builder.buildHealthMetricDatapoints).toHaveBeenCalledWith(
            body,
            'HEALTH METRICS V1'
        );
    });

    test('should handle config with activeDocs enabled', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path.includes('measurementName')) return 'health_metrics';
            if (path.includes('tags')) return [{ name: 'env', value: 'prod' }];
            if (path.includes('maxBatchSize')) return 100;
            return undefined;
        });
        builder.buildHealthMetricDatapoints.mockResolvedValue({
            formattedTime: '2024-01-01T00:00:00Z',
            appNames: {
                active: ['App1', 'App2'],
                activeSession: ['Session1'],
                loaded: [],
                loadedSession: [],
                inMemory: [],
                inMemorySession: [],
            },
            config: {
                includeActiveDocs: true,
                includeLoadedDocs: false,
                includeInMemoryDocs: false,
                enableAppNameExtract: true,
            },
        });
        const body = {
            mem: { committed: 1000 },
            apps: { active_docs: [{ id: 'app1' }], loaded_docs: [], in_memory_docs: [] },
            cpu: { total: 50 },
            session: { active: 5 },
            users: { active: 3 },
            cache: { hits: 100 },
            version: '1.0.0',
            started: '2024-01-01T00:00:00Z',
        };
        await storeHealthMetricsV1({ server_name: 'server1' }, body);
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle config with loadedDocs enabled', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path.includes('measurementName')) return 'health_metrics';
            if (path.includes('tags')) return [{ name: 'env', value: 'prod' }];
            if (path.includes('maxBatchSize')) return 100;
            return undefined;
        });
        builder.buildHealthMetricDatapoints.mockResolvedValue({
            formattedTime: '2024-01-01T00:00:00Z',
            appNames: {
                active: [],
                activeSession: [],
                loaded: ['LoadedApp'],
                loadedSession: ['LoadedSession'],
                inMemory: [],
                inMemorySession: [],
            },
            config: {
                includeActiveDocs: false,
                includeLoadedDocs: true,
                includeInMemoryDocs: false,
                enableAppNameExtract: true,
            },
        });
        const body = {
            mem: { committed: 1000 },
            apps: { active_docs: [], loaded_docs: [{ id: 'app2' }], in_memory_docs: [] },
            cpu: { total: 50 },
            session: { active: 5 },
            users: { active: 3 },
            cache: { hits: 100 },
            version: '1.0.0',
            started: '2024-01-01T00:00:00Z',
        };
        await storeHealthMetricsV1({ server_name: 'server1' }, body);
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle config with inMemoryDocs enabled', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path.includes('measurementName')) return 'health_metrics';
            if (path.includes('tags')) return [{ name: 'env', value: 'prod' }];
            if (path.includes('maxBatchSize')) return 100;
            return undefined;
        });
        builder.buildHealthMetricDatapoints.mockResolvedValue({
            formattedTime: '2024-01-01T00:00:00Z',
            appNames: {
                active: [],
                activeSession: [],
                loaded: [],
                loadedSession: [],
                inMemory: ['MemoryApp'],
                inMemorySession: ['MemorySession'],
            },
            config: {
                includeActiveDocs: false,
                includeLoadedDocs: false,
                includeInMemoryDocs: true,
                enableAppNameExtract: true,
            },
        });
        const body = {
            mem: { committed: 1000 },
            apps: { active_docs: [], loaded_docs: [], in_memory_docs: [{ id: 'app3' }] },
            cpu: { total: 50 },
            session: { active: 5 },
            users: { active: 3 },
            cache: { hits: 100 },
            version: '1.0.0',
            started: '2024-01-01T00:00:00Z',
        };
        await storeHealthMetricsV1({ server_name: 'server1' }, body);
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });

    test('should handle config with all doc types disabled', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path.includes('measurementName')) return 'health_metrics';
            if (path.includes('tags')) return [];
            if (path.includes('includeFields')) return false;
            if (path.includes('enableAppNameExtract')) return false;
            if (path.includes('maxBatchSize')) return 100;
            return undefined;
        });
        const body = {
            mem: { committed: 1000 },
            apps: { active_docs: [], loaded_docs: [], in_memory_docs: [] },
            cpu: { total: 50 },
            session: { active: 5 },
            users: { active: 3 },
            cache: { hits: 100 },
            version: '1.0.0',
            started: '2024-01-01T00:00:00Z',
        };
        await storeHealthMetricsV1({ server_name: 'server1' }, body);
        expect(utils.writeBatchToInfluxV1).toHaveBeenCalled();
    });
});
