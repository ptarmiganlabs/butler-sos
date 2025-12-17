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
        has: jest.fn(),
    },
    influx: {
        writePoints: jest.fn(),
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
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('v1/sessions', () => {
    let storeSessionsV1;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const sessions = await import('../v1/sessions.js');
        storeSessionsV1 = sessions.storeSessionsV1;

        // Setup default mocks
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
    });

    describe('storeSessionsV1', () => {
        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);

            const userSessions = {
                host: 'server1',
                virtualProxy: 'vp1',
                serverName: 'central',
                sessionCount: 5,
                uniqueUserList: 'user1,user2',
                datapointInfluxdb: [{ measurement: 'user_session_summary', tags: {}, fields: {} }],
            };

            await storeSessionsV1(userSessions);

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should return early when no datapoints', async () => {
            const userSessions = {
                host: 'server1',
                virtualProxy: 'vp1',
                serverName: 'central',
                sessionCount: 0,
                uniqueUserList: '',
                datapointInfluxdb: [],
            };

            await storeSessionsV1(userSessions);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                'PROXY SESSIONS V1: No datapoints to write to InfluxDB'
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should successfully write session data', async () => {
            const userSessions = {
                host: 'server1',
                virtualProxy: 'vp1',
                serverName: 'central',
                sessionCount: 5,
                uniqueUserList: 'user1,user2,user3',
                datapointInfluxdb: [
                    {
                        measurement: 'user_session_summary',
                        tags: { host: 'server1', virtualProxy: 'vp1' },
                        fields: { session_count: 5 },
                    },
                    {
                        measurement: 'user_session_details',
                        tags: { host: 'server1', user: 'user1' },
                        fields: { session_id: 'session1' },
                    },
                ],
            };

            await storeSessionsV1(userSessions);

            expect(utils.writeToInfluxWithRetry).toHaveBeenCalledWith(
                expect.any(Function),
                'Proxy sessions for server1/vp1',
                'v1',
                'central'
            );
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('Sent user session data to InfluxDB')
            );
        });

        test('should write all datapoints', async () => {
            const datapoints = [
                {
                    measurement: 'user_session_summary',
                    tags: { host: 'server1' },
                    fields: { count: 3 },
                },
                {
                    measurement: 'user_session_list',
                    tags: { host: 'server1' },
                    fields: { users: 'user1,user2' },
                },
            ];

            const userSessions = {
                host: 'server1',
                virtualProxy: 'vp1',
                serverName: 'central',
                sessionCount: 3,
                uniqueUserList: 'user1,user2',
                datapointInfluxdb: datapoints,
            };

            utils.writeToInfluxWithRetry.mockImplementation(async (writeFn) => {
                await writeFn();
            });

            await storeSessionsV1(userSessions);

            expect(globals.influx.writePoints).toHaveBeenCalledWith(datapoints);
        });

        test('should handle write errors', async () => {
            const userSessions = {
                host: 'server1',
                virtualProxy: 'vp1',
                serverName: 'central',
                sessionCount: 5,
                uniqueUserList: 'user1,user2',
                datapointInfluxdb: [{ measurement: 'user_session_summary', tags: {}, fields: {} }],
            };

            const writeError = new Error('Write failed');
            utils.writeToInfluxWithRetry.mockRejectedValue(writeError);

            await expect(storeSessionsV1(userSessions)).rejects.toThrow('Write failed');

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error saving user session data')
            );
        });

        test('should log debug messages with session details', async () => {
            const userSessions = {
                host: 'server1',
                virtualProxy: 'vp1',
                serverName: 'central',
                sessionCount: 5,
                uniqueUserList: 'user1,user2,user3',
                datapointInfluxdb: [{ measurement: 'user_session_summary', tags: {}, fields: {} }],
            };

            await storeSessionsV1(userSessions);

            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Session count')
            );
            expect(globals.logger.debug).toHaveBeenCalledWith(expect.stringContaining('User list'));
            expect(globals.logger.silly).toHaveBeenCalled();
        });

        test('should handle null datapointInfluxdb', async () => {
            const userSessions = {
                host: 'server1',
                virtualProxy: 'vp1',
                serverName: 'central',
                sessionCount: 0,
                uniqueUserList: '',
                datapointInfluxdb: null,
            };

            await storeSessionsV1(userSessions);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                'PROXY SESSIONS V1: No datapoints to write to InfluxDB'
            );
        });
    });
});
