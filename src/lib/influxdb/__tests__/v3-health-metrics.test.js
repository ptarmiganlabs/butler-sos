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
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

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

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const healthMetrics = await import('../v3/health-metrics.js');
        postHealthMetricsToInfluxdbV3 = healthMetrics.postHealthMetricsToInfluxdbV3;

        // Setup default mocks
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'test-db';
            if (key === 'Butler-SOS.influxdbConfig.includeFields.activeDocs') return true;
            if (key === 'Butler-SOS.influxdbConfig.includeFields.loadedDocs') return true;
            if (key === 'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs') return true;
            if (key === 'Butler-SOS.appNames.enableAppNameExtract') return true;
            return false;
        });

        utils.getFormattedTime.mockReturnValue('1d 2h 30m');
        utils.processAppDocuments.mockResolvedValue({
            appNames: ['App1', 'App2'],
            sessionAppNames: ['SessionApp1'],
        });
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
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

        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should warn and return when influxWriteApi is not initialized', async () => {
        globals.influxWriteApi = null;
        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Influxdb write API object not initialized')
        );
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should warn and return when writeApi not found for server', async () => {
        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('unknown-server', 'test-host', body, {});

        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Influxdb write API object not found for host test-host')
        );
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should process and write all health metrics successfully', async () => {
        const body = createMockBody();
        const serverTags = { env: 'production', cluster: 'main' };

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, serverTags);

        // Should process all three app doc types
        expect(utils.processAppDocuments).toHaveBeenCalledTimes(3);
        expect(utils.processAppDocuments).toHaveBeenCalledWith(
            body.apps.active_docs,
            'HEALTH METRICS TO INFLUXDB V3',
            'active'
        );
        expect(utils.processAppDocuments).toHaveBeenCalledWith(
            body.apps.loaded_docs,
            'HEALTH METRICS TO INFLUXDB V3',
            'loaded'
        );
        expect(utils.processAppDocuments).toHaveBeenCalledWith(
            body.apps.in_memory_docs,
            'HEALTH METRICS TO INFLUXDB V3',
            'in memory'
        );

        // Should apply tags to all 8 points
        expect(utils.applyTagsToPoint3).toHaveBeenCalledTimes(8);

        // Should write all 8 measurements
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalledTimes(8);
    });

    test('should call getFormattedTime with started timestamp', async () => {
        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

        expect(utils.getFormattedTime).toHaveBeenCalledWith(body.started);
    });

    test('should handle app name extraction being disabled', async () => {
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'test-db';
            if (key === 'Butler-SOS.appNames.enableAppNameExtract') return false;
            return false;
        });

        const body = createMockBody();

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

        // Should still process but set empty strings for app names
        expect(utils.processAppDocuments).toHaveBeenCalledTimes(3);
    });

    test('should handle write errors with error tracking', async () => {
        const body = createMockBody();
        const writeError = new Error('Write failed');
        utils.writeToInfluxWithRetry.mockRejectedValue(writeError);

        await postHealthMetricsToInfluxdbV3('test-server', 'test-host', body, {});

        expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
            'INFLUXDB_V3_WRITE',
            'test-server'
        );
        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error saving health data to InfluxDB v3')
        );
    });
});
