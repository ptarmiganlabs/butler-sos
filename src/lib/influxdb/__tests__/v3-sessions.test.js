import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock globals
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
    },
    influx: {
        write: jest.fn(),
    },
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
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV3: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

// Mock Point3
const mockPoint = {
    setTag: jest.fn().mockReturnThis(),
    setField: jest.fn().mockReturnThis(),
    toLineProtocol: jest.fn().mockReturnValue('proxy_sessions'),
};

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

describe('v3/sessions', () => {
    let postProxySessionsToInfluxdbV3;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const sessions = await import('../v3/sessions.js');
        postProxySessionsToInfluxdbV3 = sessions.postProxySessionsToInfluxdbV3;

        // Setup default mocks
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'test-db';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 100;
            return undefined;
        });
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeBatchToInfluxV3.mockResolvedValue();
    });

    describe('postProxySessionsToInfluxdbV3', () => {
        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);

            const userSessions = {
                host: 'server1',
                virtualProxy: '/vp1',
                serverName: 'QSE1',
                sessionCount: 5,
                uniqueUserList: 'user1,user2',
                datapointInfluxdb: [],
            };

            await postProxySessionsToInfluxdbV3(userSessions);

            expect(utils.writeBatchToInfluxV3).not.toHaveBeenCalled();
        });

        test('should warn when no datapoints to write', async () => {
            const userSessions = {
                host: 'server1',
                virtualProxy: '/vp1',
                serverName: 'QSE1',
                sessionCount: 0,
                uniqueUserList: '',
                datapointInfluxdb: [],
            };

            await postProxySessionsToInfluxdbV3(userSessions);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No datapoints to write')
            );
        });

        test('should successfully write session datapoints', async () => {
            const datapoint1 = { toLineProtocol: jest.fn().mockReturnValue('session1') };
            const datapoint2 = { toLineProtocol: jest.fn().mockReturnValue('session2') };

            const userSessions = {
                host: 'server1',
                virtualProxy: '/vp1',
                serverName: 'QSE1',
                sessionCount: 2,
                uniqueUserList: 'user1,user2',
                datapointInfluxdb: [datapoint1, datapoint2],
            };

            await postProxySessionsToInfluxdbV3(userSessions);

            expect(utils.writeBatchToInfluxV3).toHaveBeenCalledTimes(1);
            expect(utils.writeBatchToInfluxV3).toHaveBeenCalledWith(
                [datapoint1, datapoint2],
                'test-db',
                'Proxy sessions for server1//vp1',
                'server1',
                100
            );
            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Wrote 2 datapoints')
            );
        });

        test('should handle write errors and track them', async () => {
            const datapoint = { toLineProtocol: jest.fn().mockReturnValue('session1') };
            const userSessions = {
                host: 'server1',
                virtualProxy: '/vp1',
                serverName: 'QSE1',
                sessionCount: 1,
                uniqueUserList: 'user1',
                datapointInfluxdb: [datapoint],
            };

            const writeError = new Error('Write failed');
            utils.writeBatchToInfluxV3.mockRejectedValue(writeError);

            await postProxySessionsToInfluxdbV3(userSessions);

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error saving user session data')
            );
            expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
                'INFLUXDB_V3_WRITE',
                'QSE1'
            );
        });

        test('should log session details', async () => {
            const datapoint = { toLineProtocol: jest.fn().mockReturnValue('session1') };
            const userSessions = {
                host: 'server1',
                virtualProxy: '/vp1',
                serverName: 'QSE1',
                sessionCount: 5,
                uniqueUserList: 'user1,user2,user3',
                datapointInfluxdb: [datapoint],
            };

            await postProxySessionsToInfluxdbV3(userSessions);

            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining(
                    'Session count for server "server1", virtual proxy "/vp1": 5'
                )
            );
            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining(
                    'User list for server "server1", virtual proxy "/vp1": user1,user2,user3'
                )
            );
        });

        test('should handle null or undefined datapointInfluxdb', async () => {
            const userSessions = {
                host: 'server1',
                virtualProxy: '/vp1',
                serverName: 'QSE1',
                sessionCount: 0,
                uniqueUserList: '',
                datapointInfluxdb: null,
            };

            await postProxySessionsToInfluxdbV3(userSessions);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No datapoints to write')
            );
            expect(globals.influx.write).not.toHaveBeenCalled();
        });
    });
});
