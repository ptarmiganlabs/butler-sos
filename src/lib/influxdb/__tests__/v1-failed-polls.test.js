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
    influx: { writePoints: jest.fn() },
    errorTracker: {
        incrementError: jest.fn().mockResolvedValue(),
    },
    getErrorMessage: jest.fn((err) => (err && err.message ? err.message : String(err))),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeBatchToInfluxV1: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('v1/failed-polls', () => {
    let postFailedPollToInfluxdbV1;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const module = await import('../v1/failed-polls.js');
        postFailedPollToInfluxdbV1 = module.postFailedPollToInfluxdbV1;

        // Default: InfluxDB enabled and failed polls tracking enabled
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeBatchToInfluxV1.mockResolvedValue();

        globals.config.has.mockReturnValue(true);
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return true;
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.measurementName')
                return 'sense_failed_polls';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            return undefined;
        });
    });

    test('should return early when InfluxDB is not enabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);

        await postFailedPollToInfluxdbV1({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should return early when failed polls tracking is disabled', async () => {
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return false;
            return undefined;
        });

        await postFailedPollToInfluxdbV1({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should return early when failed polls tracking config key is missing', async () => {
        globals.config.has.mockReturnValue(false);

        await postFailedPollToInfluxdbV1({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('should write a HEALTH_API failed poll event to InfluxDB v1', async () => {
        await postFailedPollToInfluxdbV1({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        expect(utils.writeBatchToInfluxV1).toHaveBeenCalledTimes(1);

        const [datapoints, context, serverName] = utils.writeBatchToInfluxV1.mock.calls[0];

        expect(datapoints).toHaveLength(1);
        expect(datapoints[0].measurement).toBe('sense_failed_polls');
        expect(datapoints[0].tags.host).toBe('sense1.example.com:4747');
        expect(datapoints[0].tags.server_name).toBe('Sense1');
        expect(datapoints[0].tags.error_type).toBe('HEALTH_API');
        expect(datapoints[0].tags.virtual_proxy).toBeUndefined();
        expect(datapoints[0].fields.error_count).toBe(1);
        expect(serverName).toBe('Sense1');
        expect(context).toContain('Sense1');
    });

    test('should write a PROXY_API failed poll event with virtual proxy tag', async () => {
        await postFailedPollToInfluxdbV1({
            host: 'sense1.example.com:4243',
            serverName: 'Sense1',
            errorType: 'PROXY_API',
            virtualProxy: '/myproxy',
        });

        expect(utils.writeBatchToInfluxV1).toHaveBeenCalledTimes(1);

        const [datapoints] = utils.writeBatchToInfluxV1.mock.calls[0];

        expect(datapoints[0].tags.error_type).toBe('PROXY_API');
        expect(datapoints[0].tags.virtual_proxy).toBe('/myproxy');
    });

    test('should write an APP_NAMES_EXTRACT failed poll event', async () => {
        await postFailedPollToInfluxdbV1({
            host: '10.0.0.1',
            serverName: '10.0.0.1',
            errorType: 'APP_NAMES_EXTRACT',
        });

        expect(utils.writeBatchToInfluxV1).toHaveBeenCalledTimes(1);

        const [datapoints] = utils.writeBatchToInfluxV1.mock.calls[0];

        expect(datapoints[0].tags.error_type).toBe('APP_NAMES_EXTRACT');
        expect(datapoints[0].tags.virtual_proxy).toBeUndefined();
    });

    test('should omit virtual_proxy tag when virtualProxy is null', async () => {
        await postFailedPollToInfluxdbV1({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
            virtualProxy: null,
        });

        const [datapoints] = utils.writeBatchToInfluxV1.mock.calls[0];

        expect(datapoints[0].tags.virtual_proxy).toBeUndefined();
    });

    test('should use custom measurement name from config', async () => {
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.enable') return true;
            if (key === 'Butler-SOS.influxdbConfig.failedPollsTracking.measurementName')
                return 'my_custom_measurement';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            return undefined;
        });

        await postFailedPollToInfluxdbV1({
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        });

        const [datapoints] = utils.writeBatchToInfluxV1.mock.calls[0];

        expect(datapoints[0].measurement).toBe('my_custom_measurement');
    });

    test('should log error and not throw when write fails', async () => {
        utils.writeBatchToInfluxV1.mockRejectedValue(new Error('InfluxDB connection refused'));

        await expect(
            postFailedPollToInfluxdbV1({
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
