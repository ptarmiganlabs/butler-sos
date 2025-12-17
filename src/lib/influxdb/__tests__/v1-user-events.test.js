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
    getConfigTags: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('v1/user-events', () => {
    let storeUserEventV1;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const userEvents = await import('../v1/user-events.js');
        storeUserEventV1 = userEvents.storeUserEventV1;

        // Setup default mocks
        globals.config.has.mockReturnValue(true);
        globals.config.get.mockReturnValue([{ name: 'env', value: 'prod' }]);
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
    });

    describe('storeUserEventV1', () => {
        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);

            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user123',
                origin: 'AppAccess',
            };

            await storeUserEventV1(msg);

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should successfully write user event', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user123',
                origin: 'AppAccess',
            };

            await storeUserEventV1(msg);

            expect(utils.writeToInfluxWithRetry).toHaveBeenCalledWith(
                expect.any(Function),
                'User event',
                'v1',
                'server1'
            );
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'USER EVENT V1: Sent user event data to InfluxDB'
            );
        });

        test('should validate required fields - missing host', async () => {
            const msg = {
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user123',
                origin: 'AppAccess',
            };

            await storeUserEventV1(msg);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Missing required field')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should validate required fields - missing command', async () => {
            const msg = {
                host: 'server1',
                user_directory: 'DOMAIN',
                user_id: 'user123',
                origin: 'AppAccess',
            };

            await storeUserEventV1(msg);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Missing required field')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should validate required fields - missing user_directory', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_id: 'user123',
                origin: 'AppAccess',
            };

            await storeUserEventV1(msg);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Missing required field')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should validate required fields - missing user_id', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                origin: 'AppAccess',
            };

            await storeUserEventV1(msg);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Missing required field')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should validate required fields - missing origin', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user123',
            };

            await storeUserEventV1(msg);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Missing required field')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should create correct datapoint with config tags', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user123',
                origin: 'AppAccess',
            };

            utils.writeToInfluxWithRetry.mockImplementation(async (writeFn) => {
                await writeFn();
            });

            await storeUserEventV1(msg);

            const expectedDatapoint = expect.arrayContaining([
                expect.objectContaining({
                    measurement: 'user_events',
                    tags: expect.objectContaining({
                        host: 'server1',
                        event_action: 'OpenApp',
                        userFull: 'DOMAIN\\user123',
                        userDirectory: 'DOMAIN',
                        userId: 'user123',
                        origin: 'AppAccess',
                        env: 'prod',
                    }),
                    fields: expect.objectContaining({
                        userFull: 'DOMAIN\\user123',
                        userId: 'user123',
                    }),
                }),
            ]);

            expect(globals.influx.writePoints).toHaveBeenCalledWith(expectedDatapoint);
        });

        test('should handle write errors', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user123',
                origin: 'AppAccess',
            };

            const writeError = new Error('Write failed');
            utils.writeToInfluxWithRetry.mockRejectedValue(writeError);

            await expect(storeUserEventV1(msg)).rejects.toThrow('Write failed');

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('USER EVENT V1: Error saving user event')
            );
        });

        test('should log debug messages', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user123',
                origin: 'AppAccess',
            };

            await storeUserEventV1(msg);

            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('USER EVENT V1')
            );
        });
    });
});
