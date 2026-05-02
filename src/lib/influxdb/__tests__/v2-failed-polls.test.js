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
    writeBatchToInfluxV2: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

// Mock Point class for v2
const mockPoint = {
    tag: jest.fn().mockReturnThis(),
    intField: jest.fn().mockReturnThis(),
    floatField: jest.fn().mockReturnThis(),
    stringField: jest.fn().mockReturnThis(),
};

jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: jest.fn(() => ({ ...mockPoint })),
}));

describe('v2/failed-polls', () => {
    let postFailedPollToInfluxdbV2;
    let globals;
    let utils;
    let PointMock;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const influxClient = await import('@influxdata/influxdb-client');
        PointMock = influxClient.Point;
        const module = await import('../v2/failed-polls.js');
        postFailedPollToInfluxdbV2 = module.postFailedPollToInfluxdbV2;

        // Default: InfluxDB enabled and failed polls tracking enabled
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeBatchToInfluxV2.mockResolvedValue();

        globals.config.has.mockReturnValue(true);
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return true;
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.measurementName')
                return 'sense_failed_polls';
            if (key === 'Butler-SOS.influxdbConfig.v2Config.org') return 'myorg';
            if (key === 'Butler-SOS.influxdbConfig.v2Config.bucket') return 'mybucket';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            return undefined;
        });
    });

    test('should return early when InfluxDB is not enabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);

        await postFailedPollToInfluxdbV2({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
    });

    test('should return early when failed polls tracking is disabled', async () => {
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return false;
            return undefined;
        });

        await postFailedPollToInfluxdbV2({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
    });

    test('should return early when failed polls tracking config key is missing', async () => {
        globals.config.has.mockReturnValue(false);

        await postFailedPollToInfluxdbV2({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV2).not.toHaveBeenCalled();
    });

    test('should write a HEALTH_API failed poll event to InfluxDB v2', async () => {
        await postFailedPollToInfluxdbV2({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(PointMock).toHaveBeenCalledWith('sense_failed_polls');
        expect(utils.writeBatchToInfluxV2).toHaveBeenCalledTimes(1);

        const [points, org, bucket, , serverName] = utils.writeBatchToInfluxV2.mock.calls[0];

        expect(points).toHaveLength(1);
        expect(org).toBe('myorg');
        expect(bucket).toBe('mybucket');
        expect(serverName).toBe('Sense1');
    });

    test('should include virtual_proxy tag for PROXY_API errors', async () => {
        // Need to capture the Point instance created
        let capturedPoint;

        PointMock.mockImplementation((measurement) => {
            capturedPoint = {
                _measurement: measurement,
                _tags: {},
                _fields: {},
                tag: jest.fn(function (key, value) {
                    this._tags[key] = value;
                    return this;
                }),
                intField: jest.fn(function (key, value) {
                    this._fields[key] = value;
                    return this;
                }),
            };
            return capturedPoint;
        });

        await postFailedPollToInfluxdbV2({
            host: 'sense1.example.com:4243',
            serverName: 'Sense1',
            errorType: 'PROXY_API',
            virtualProxy: '/myproxy',
        });

        expect(capturedPoint._tags.error_type).toBe('PROXY_API');
        expect(capturedPoint._tags.virtual_proxy).toBe('/myproxy');
        expect(capturedPoint._fields.error_count).toBe(1);
    });

    test('should not include virtual_proxy tag when not provided', async () => {
        let capturedPoint;

        PointMock.mockImplementation(() => {
            capturedPoint = {
                _tags: {},
                _fields: {},
                tag: jest.fn(function (key, value) {
                    this._tags[key] = value;
                    return this;
                }),
                intField: jest.fn(function (key, value) {
                    this._fields[key] = value;
                    return this;
                }),
            };
            return capturedPoint;
        });

        await postFailedPollToInfluxdbV2({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(capturedPoint._tags.virtual_proxy).toBeUndefined();
    });

    test('should not include virtual_proxy tag when virtualProxy is null', async () => {
        let capturedPoint;

        PointMock.mockImplementation(() => {
            capturedPoint = {
                _tags: {},
                _fields: {},
                tag: jest.fn(function (key, value) {
                    this._tags[key] = value;
                    return this;
                }),
                intField: jest.fn(function (key, value) {
                    this._fields[key] = value;
                    return this;
                }),
            };
            return capturedPoint;
        });

        await postFailedPollToInfluxdbV2({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
            virtualProxy: null,
        });

        expect(capturedPoint._tags.virtual_proxy).toBeUndefined();
    });

    test('should use custom measurement name from config', async () => {
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return true;
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.measurementName')
                return 'custom_measurement';
            if (key === 'Butler-SOS.influxdbConfig.v2Config.org') return 'myorg';
            if (key === 'Butler-SOS.influxdbConfig.v2Config.bucket') return 'mybucket';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            return undefined;
        });

        await postFailedPollToInfluxdbV2({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(PointMock).toHaveBeenCalledWith('custom_measurement');
    });

    test('should log error and not throw when write fails', async () => {
        utils.writeBatchToInfluxV2.mockRejectedValue(new Error('InfluxDB connection refused'));

        await expect(
            postFailedPollToInfluxdbV2({
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
