import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPoint = {
    tag: jest.fn().mockReturnThis(),
    stringField: jest.fn().mockReturnThis(),
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
    config: { get: jest.fn() },
    influx: { getWriteApi: jest.fn(() => mockWriteApi) },
    influxWriteApi: [{ serverName: 'server1' }],
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
    writeBatchToInfluxV2: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('v2/sessions', () => {
    let storeSessionsV2, globals, utils;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const sessions = await import('../v2/sessions.js');
        storeSessionsV2 = sessions.storeSessionsV2;

        // Set up influxWriteApi array with matching server
        globals.influxWriteApi = [{ serverName: 'server1' }];

        globals.config.get.mockImplementation((path) => {
            if (path.includes('org')) return 'test-org';
            if (path.includes('bucket')) return 'test-bucket';
            return undefined;
        });

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockImplementation(async (cb) => await cb());
        mockWriteApi.writePoints.mockResolvedValue(undefined);
        mockWriteApi.close.mockResolvedValue(undefined);
    });

    test('should return early when InfluxDB disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        const userSessions = {
            serverName: 'server1',
            host: 'host1',
            virtualProxy: 'vp1',
            sessionCount: 5,
            uniqueUserList: 'user1,user2',
            datapointInfluxdb: [mockPoint],
        };
        await storeSessionsV2(userSessions);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early with invalid datapointInfluxdb (not array)', async () => {
        const userSessions = {
            serverName: 'server1',
            host: 'host1',
            virtualProxy: 'vp1',
            sessionCount: 5,
            uniqueUserList: 'user1,user2',
            datapointInfluxdb: 'not-an-array',
        };
        await storeSessionsV2(userSessions);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Invalid data format')
        );
    });

    test('should return early when writeApi not found', async () => {
        globals.influxWriteApi = [{ serverName: 'different-server' }];
        const userSessions = {
            serverName: 'server1',
            host: 'host1',
            virtualProxy: 'vp1',
            sessionCount: 5,
            uniqueUserList: 'user1,user2',
            datapointInfluxdb: [mockPoint],
        };
        await storeSessionsV2(userSessions);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Influxdb write API object not found')
        );
    });

    test('should write session data successfully', async () => {
        const userSessions = {
            serverName: 'server1',
            host: 'host1.example.com',
            virtualProxy: '/virtual-proxy',
            sessionCount: 10,
            uniqueUserList: 'user1,user2,user3',
            datapointInfluxdb: [mockPoint, mockPoint, mockPoint],
        };

        await storeSessionsV2(userSessions);

        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
        expect(mockWriteApi.writePoints).toHaveBeenCalledWith(userSessions.datapointInfluxdb);
        expect(mockWriteApi.close).toHaveBeenCalled();
        expect(globals.logger.verbose).toHaveBeenCalledWith(
            expect.stringContaining('Sent user session data to InfluxDB')
        );
    });

    test('should write empty session array', async () => {
        const userSessions = {
            serverName: 'server1',
            host: 'host1',
            virtualProxy: 'vp1',
            sessionCount: 0,
            uniqueUserList: '',
            datapointInfluxdb: [],
        };

        await storeSessionsV2(userSessions);

        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
        expect(mockWriteApi.writePoints).toHaveBeenCalledWith([]);
    });

    test('should log silly debug information', async () => {
        const userSessions = {
            serverName: 'server1',
            host: 'host1',
            virtualProxy: 'vp1',
            sessionCount: 5,
            uniqueUserList: 'user1,user2',
            datapointInfluxdb: [mockPoint],
        };

        await storeSessionsV2(userSessions);

        expect(globals.logger.debug).toHaveBeenCalled();
        expect(globals.logger.silly).toHaveBeenCalled();
    });

    test('should handle multiple datapoints', async () => {
        const datapoints = Array(20).fill(mockPoint);
        const userSessions = {
            serverName: 'server1',
            host: 'host1',
            virtualProxy: 'vp1',
            sessionCount: 20,
            uniqueUserList: 'user1,user2,user3,user4,user5',
            datapointInfluxdb: datapoints,
        };

        await storeSessionsV2(userSessions);

        expect(mockWriteApi.writePoints).toHaveBeenCalledWith(datapoints);
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });
});
