import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock globals – error-metrics.js now imports globals for postFailedPollToInfluxdb
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
    getErrorMessage: jest.fn((err) => (err && err.message ? err.message : String(err))),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

// Mock version-specific failed-poll implementations
const mockV1 = { postFailedPollToInfluxdbV1: jest.fn().mockResolvedValue() };
const mockV2 = { postFailedPollToInfluxdbV2: jest.fn().mockResolvedValue() };
const mockV3 = { postFailedPollToInfluxdbV3: jest.fn().mockResolvedValue() };

jest.unstable_mockModule('../v1/failed-polls.js', () => mockV1);
jest.unstable_mockModule('../v2/failed-polls.js', () => mockV2);
jest.unstable_mockModule('../v3/failed-polls.js', () => mockV3);

// Mock shared utils for getInfluxDbVersion
const mockUtils = {
    getInfluxDbVersion: jest.fn(),
    isInfluxDbEnabled: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('error-metrics', () => {
    let postErrorMetricsToInfluxdb;
    let postFailedPollToInfluxdb;
    let globals;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        const module = await import('../error-metrics.js');
        postErrorMetricsToInfluxdb = module.postErrorMetricsToInfluxdb;
        postFailedPollToInfluxdb = module.postFailedPollToInfluxdb;

        // Default: InfluxDB enabled, v2
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.enable') return true;
            return undefined;
        });
        mockUtils.getInfluxDbVersion.mockReturnValue(2);
    });

    describe('postErrorMetricsToInfluxdb', () => {
        test('should resolve successfully with valid error stats', async () => {
            const errorStats = {
                HEALTH_API: {
                    total: 5,
                    servers: {
                        sense1: 3,
                        sense2: 2,
                    },
                },
                INFLUXDB_V3_WRITE: {
                    total: 2,
                    servers: {
                        _no_server_context: 2,
                    },
                },
            };

            await expect(postErrorMetricsToInfluxdb(errorStats)).resolves.toBeUndefined();
        });

        test('should resolve successfully with empty error stats', async () => {
            await expect(postErrorMetricsToInfluxdb({})).resolves.toBeUndefined();
        });

        test('should resolve successfully with null input', async () => {
            await expect(postErrorMetricsToInfluxdb(null)).resolves.toBeUndefined();
        });

        test('should resolve successfully with undefined input', async () => {
            await expect(postErrorMetricsToInfluxdb(undefined)).resolves.toBeUndefined();
        });

        test('should resolve successfully with complex error stats', async () => {
            const errorStats = {
                API_TYPE_1: {
                    total: 100,
                    servers: {
                        server1: 25,
                        server2: 25,
                        server3: 25,
                        server4: 25,
                    },
                },
                API_TYPE_2: {
                    total: 0,
                    servers: {},
                },
            };

            await expect(postErrorMetricsToInfluxdb(errorStats)).resolves.toBeUndefined();
        });
    });

    describe('postFailedPollToInfluxdb', () => {
        const baseData = {
            host: 'sense1.example.com:4747',
            serverName: 'Sense1',
            errorType: 'HEALTH_API',
        };

        test('should return early when InfluxDB is disabled', async () => {
            globals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                return undefined;
            });

            await postFailedPollToInfluxdb(baseData);

            expect(mockV1.postFailedPollToInfluxdbV1).not.toHaveBeenCalled();
            expect(mockV2.postFailedPollToInfluxdbV2).not.toHaveBeenCalled();
            expect(mockV3.postFailedPollToInfluxdbV3).not.toHaveBeenCalled();
        });

        test('should route to v1 when InfluxDB version is 1', async () => {
            mockUtils.getInfluxDbVersion.mockReturnValue(1);

            await postFailedPollToInfluxdb(baseData);

            expect(mockV1.postFailedPollToInfluxdbV1).toHaveBeenCalledWith(baseData);
            expect(mockV2.postFailedPollToInfluxdbV2).not.toHaveBeenCalled();
            expect(mockV3.postFailedPollToInfluxdbV3).not.toHaveBeenCalled();
        });

        test('should route to v2 when InfluxDB version is 2', async () => {
            mockUtils.getInfluxDbVersion.mockReturnValue(2);

            await postFailedPollToInfluxdb(baseData);

            expect(mockV2.postFailedPollToInfluxdbV2).toHaveBeenCalledWith(baseData);
            expect(mockV1.postFailedPollToInfluxdbV1).not.toHaveBeenCalled();
            expect(mockV3.postFailedPollToInfluxdbV3).not.toHaveBeenCalled();
        });

        test('should route to v3 when InfluxDB version is 3', async () => {
            mockUtils.getInfluxDbVersion.mockReturnValue(3);

            await postFailedPollToInfluxdb(baseData);

            expect(mockV3.postFailedPollToInfluxdbV3).toHaveBeenCalledWith(baseData);
            expect(mockV1.postFailedPollToInfluxdbV1).not.toHaveBeenCalled();
            expect(mockV2.postFailedPollToInfluxdbV2).not.toHaveBeenCalled();
        });

        test('should log debug message for unknown InfluxDB version', async () => {
            mockUtils.getInfluxDbVersion.mockReturnValue(99);

            await postFailedPollToInfluxdb(baseData);

            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Unknown InfluxDB version: v99')
            );
            expect(mockV1.postFailedPollToInfluxdbV1).not.toHaveBeenCalled();
            expect(mockV2.postFailedPollToInfluxdbV2).not.toHaveBeenCalled();
            expect(mockV3.postFailedPollToInfluxdbV3).not.toHaveBeenCalled();
        });

        test('should pass virtualProxy in failedPollData when provided', async () => {
            mockUtils.getInfluxDbVersion.mockReturnValue(2);

            const dataWithProxy = {
                ...baseData,
                errorType: 'PROXY_API',
                virtualProxy: '/myproxy',
            };

            await postFailedPollToInfluxdb(dataWithProxy);

            expect(mockV2.postFailedPollToInfluxdbV2).toHaveBeenCalledWith(dataWithProxy);
        });
    });
});
