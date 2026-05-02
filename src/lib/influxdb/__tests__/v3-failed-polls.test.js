import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock globals BEFORE importing the module under test
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
        has: jest.fn(),
    },
    influx: {},
    errorTracker: {
        incrementError: jest.fn().mockResolvedValue(),
    },
    getErrorMessage: jest.fn((err) => (err && err.message ? err.message : String(err))),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeBatchToInfluxV3: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

// Create stable mock Point3 factory
const createMockPoint3 = () => {
    const point = {
        _tags: {},
        _fields: {},
        setTag: jest.fn(function (key, value) {
            this._tags[key] = value;
            return this;
        }),
        setIntegerField: jest.fn(function (key, value) {
            this._fields[key] = value;
            return this;
        }),
        setStringField: jest.fn().mockReturnThis(),
        setFloatField: jest.fn().mockReturnThis(),
        toLineProtocol: jest.fn().mockReturnValue('sense_failed_polls host=sense1'),
    };
    return point;
};

const MockPoint3 = jest.fn(() => createMockPoint3());

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: MockPoint3,
}));

describe('v3/failed-polls', () => {
    let postFailedPollToInfluxdbV3;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const module = await import('../v3/failed-polls.js');
        postFailedPollToInfluxdbV3 = module.postFailedPollToInfluxdbV3;

        // Default: InfluxDB enabled and failed polls tracking enabled
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeBatchToInfluxV3.mockResolvedValue();

        globals.config.has.mockReturnValue(true);
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return true;
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.measurementName')
                return 'sense_failed_polls';
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'mydb';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            return undefined;
        });
    });

    test('should return early when InfluxDB is not enabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);

        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
    });

    test('should return early when failed polls tracking is disabled', async () => {
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return false;
            return undefined;
        });

        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
    });

    test('should return early when failed polls tracking config key is missing', async () => {
        globals.config.has.mockReturnValue(false);

        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
    });

    test('should write a HEALTH_API failed poll event to InfluxDB v3', async () => {
        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(MockPoint3).toHaveBeenCalledWith('sense_failed_polls');
        expect(utils.writeBatchToInfluxV3).toHaveBeenCalledTimes(1);

        const [points, database, , serverName] = utils.writeBatchToInfluxV3.mock.calls[0];

        expect(points).toHaveLength(1);
        expect(database).toBe('mydb');
        expect(serverName).toBe('Sense1');
    });

    test('should set host, server_name, and error_type tags', async () => {
        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        const [points] = utils.writeBatchToInfluxV3.mock.calls[0];
        const point = points[0];

        expect(point.setTag).toHaveBeenCalledWith('host', 'sense1.example.com:4747');
        expect(point.setTag).toHaveBeenCalledWith('server_name', 'Sense1');
        expect(point.setTag).toHaveBeenCalledWith('error_type', 'HEALTH_API');
        expect(point.setIntegerField).toHaveBeenCalledWith('error_count', 1);
    });

    test('should set virtual_proxy tag for PROXY_API errors', async () => {
        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4243',
            serverName: 'Sense1',
            errorType: 'PROXY_API',
            virtualProxy: '/myproxy',
        });

        const [points] = utils.writeBatchToInfluxV3.mock.calls[0];
        const point = points[0];

        expect(point.setTag).toHaveBeenCalledWith('error_type', 'PROXY_API');
        expect(point.setTag).toHaveBeenCalledWith('virtual_proxy', '/myproxy');
    });

    test('should not set virtual_proxy tag when not provided', async () => {
        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        const [points] = utils.writeBatchToInfluxV3.mock.calls[0];
        const point = points[0];

        const virtualProxyCallArgs = point.setTag.mock.calls.find(
            ([key]) => key === 'virtual_proxy'
        );
        expect(virtualProxyCallArgs).toBeUndefined();
    });

    test('should not set virtual_proxy tag when virtualProxy is null', async () => {
        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
            virtualProxy: null,
        });

        const [points] = utils.writeBatchToInfluxV3.mock.calls[0];
        const point = points[0];

        const virtualProxyCallArgs = point.setTag.mock.calls.find(
            ([key]) => key === 'virtual_proxy'
        );
        expect(virtualProxyCallArgs).toBeUndefined();
    });

    test('should write an APP_NAMES_EXTRACT failed poll event', async () => {
        await postFailedPollToInfluxdbV3({
            host: '10.0.0.1',
            serverName: '10.0.0.1',
            errorType: 'APP_NAMES_EXTRACT',
        });

        expect(utils.writeBatchToInfluxV3).toHaveBeenCalledTimes(1);

        const [points] = utils.writeBatchToInfluxV3.mock.calls[0];
        const point = points[0];

        expect(point.setTag).toHaveBeenCalledWith('error_type', 'APP_NAMES_EXTRACT');
    });

    test('should use custom measurement name from config', async () => {
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return true;
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.measurementName')
                return 'custom_measurement';
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'mydb';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            return undefined;
        });

        await postFailedPollToInfluxdbV3({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(MockPoint3).toHaveBeenCalledWith('custom_measurement');
    });

    test('should log error and not throw when write fails', async () => {
        utils.writeBatchToInfluxV3.mockRejectedValue(new Error('InfluxDB connection refused'));

        await expect(
            postFailedPollToInfluxdbV3({
                host: 'sense1.example.com:4747',
                serverName: 'Sense1',
                errorType: 'HEALTH_API',
            })
        ).resolves.toBeUndefined();

        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error writing failed poll event to InfluxDB')
        );
    });
});
