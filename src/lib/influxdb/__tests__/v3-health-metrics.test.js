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
    influxWriteApi: [],
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
    getFormattedTime: jest.fn(),
    processAppDocuments: jest.fn(),
    isInfluxDbEnabled: jest.fn(),
    applyTagsToPoint3: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV3: jest.fn(),
    validateUnsignedField: jest.fn((value) =>
        typeof value === 'number' && value >= 0 ? value : 0
    ),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

const mockBuilder = {
    buildHealthMetricDatapoints: jest.fn(),
};

jest.unstable_mockModule('../shared/health-metrics-builder.js', () => mockBuilder);

// Mock Point3
/**
 * Create a mock Point instance
 *
 * @returns {object} Mock Point instance
 */
const createMockPoint = () => ({
    setTag: jest.fn().mockReturnThis(),
    setStringField: jest.fn().mockReturnThis(),
    setIntegerField: jest.fn().mockReturnThis(),
    setFloatField: jest.fn().mockReturnThis(),
    setBooleanField: jest.fn().mockReturnThis(),
    toLineProtocol: jest.fn().mockReturnValue('health_metrics'),
});

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: jest.fn(() => createMockPoint()),
}));

describe('v3/health-metrics', () => {
    let postHealthMetricsToInfluxdbV3;
    let globals;
    let utils;
    let builder;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        builder = await import('../shared/health-metrics-builder.js');
        const healthMetrics = await import('../v3/health-metrics.js');
        postHealthMetricsToInfluxdbV3 = healthMetrics.postHealthMetricsToInfluxdbV3;

        // Setup default mocks
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'test-db';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            if (key === 'Butler-SOS.errorTracking.enable') return true;
            if (key === 'Butler-SOS.influxdbConfig.host') return 'test-host';
            return false;
        });
        globals.config.has.mockImplementation((key) => key === 'Butler-SOS.errorTracking.enable');

        builder.buildHealthMetricDatapoints.mockResolvedValue({
            formattedTime: '1d 2h 30m',
            appNames: {
                active: ['App1', 'App2'],
                activeSession: ['SessionApp1'],
                loaded: ['App1', 'App2'],
                loadedSession: ['SessionApp1'],
                inMemory: ['App1', 'App2'],
                inMemorySession: ['SessionApp1'],
            },
            config: {
                includeActiveDocs: true,
                includeLoadedDocs: true,
                includeInMemoryDocs: true,
                enableAppNameExtract: true,
            },
        });
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeBatchToInfluxV3.mockResolvedValue();
        utils.applyTagsToPoint3.mockImplementation(() => {});

        // Setup influxWriteApi
        globals.influxWriteApi = [
            {
                serverName: 'test-server',
                writeApi: {},
            },
        ];
    });

    /**
     * Create mock health metrics body
     *
     * @returns {object} Mock body with health metrics
     */
    const createMockBody = () => ({
        version: '14.76.3',
        started: '2024-01-01T00:00:00Z',
        mem: {
            committed: 1000000,
            allocated: 800000,
            free: 200000,
        },
        apps: {
            active_docs: ['doc1', 'doc2'],
            loaded_docs: ['doc3'],
            in_memory_docs: ['doc4', 'doc5'],
            calls: 100,
            selections: 50,
        },
        cpu: {
            total: 45,
        },
        session: {
            active: 10,
            total: 15,
        },
        users: {
            active: 5,
            total: 8,
        },
        cache: {
            hits: 1000,
            lookups: 1200,
            added: 50,
            replaced: 10,
            bytes_added: 500000,
        },
        saturated: false,
    });

    test('should return early when InfluxDB is disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

        expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
    });

    test('should warn and return when influxWriteApi is not initialized', async () => {
        globals.influxWriteApi = null;
        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Influxdb write API object not initialized')
        );
        expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
    });

    test('should warn and return when writeApi not found for server', async () => {
        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('unknown-server', 'test-host', body, {});

        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Influxdb write API object not found for host test-host')
        );
        expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
    });

    test('should process and write all health metrics successfully', async () => {
        const body = createMockBody();
        const serverTags = { env: 'production', cluster: 'main' };

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, serverTags);

        // Should call buildHealthMetricDatapoints
        expect(builder.buildHealthMetricDatapoints).toHaveBeenCalledTimes(1);
        expect(builder.buildHealthMetricDatapoints).toHaveBeenCalledWith(
            body,
            'HEALTH METRICS TO INFLUXDB V3'
        );

        // Should apply tags to all 8 points
        expect(utils.applyTagsToPoint3).toHaveBeenCalledTimes(8);

        // Should write all 8 measurements in one batch
        expect(utils.writeBatchToInfluxV3).toHaveBeenCalledTimes(1);
        expect(utils.writeBatchToInfluxV3).toHaveBeenCalledWith(
            expect.any(Array),
            'test-db',
            expect.stringContaining('Health metrics for'),
            'health-metrics',
            100
        );
    });

    test('should call buildHealthMetricDatapoints with body', async () => {
        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

        expect(builder.buildHealthMetricDatapoints).toHaveBeenCalledWith(
            body,
            'HEALTH METRICS TO INFLUXDB V3'
        );
    });

    test('should handle app name extraction being disabled', async () => {
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'test-db';
            return false;
        });
        builder.buildHealthMetricDatapoints.mockResolvedValue({
            formattedTime: '1d 2h 30m',
            appNames: {
                active: ['App1', 'App2'],
                activeSession: ['SessionApp1'],
                loaded: ['App1', 'App2'],
                loadedSession: ['SessionApp1'],
                inMemory: ['App1', 'App2'],
                inMemorySession: ['SessionApp1'],
            },
            config: {
                includeActiveDocs: false,
                includeLoadedDocs: false,
                includeInMemoryDocs: false,
                enableAppNameExtract: false,
            },
        });

        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

        // Should still call builder
        expect(builder.buildHealthMetricDatapoints).toHaveBeenCalledTimes(1);
    });

    test('should handle write errors with error tracking', async () => {
        const body = createMockBody();
        const writeError = new Error('Write failed');
        utils.writeBatchToInfluxV3.mockRejectedValue(writeError);

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

            expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
                'INFLUXDB_V3_WRITE',
                'test-server',
                expect.objectContaining({
                    operation: 'health_metrics_write',
                    destinationHost: expect.any(String),
                    error_category: expect.any(String),
                })
            );
        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error saving health data to InfluxDB v3')
        );
    });
});
