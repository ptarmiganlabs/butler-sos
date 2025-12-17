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
    setStringField: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    toLineProtocol: jest.fn().mockReturnValue('user_events'),
};

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

describe('v3/user-events', () => {
    let postUserEventToInfluxdbV3;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const userEvents = await import('../v3/user-events.js');
        postUserEventToInfluxdbV3 = userEvents.postUserEventToInfluxdbV3;

        // Setup default mocks
        globals.config.get.mockReturnValue('test-db');
        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockResolvedValue();
        utils.writeBatchToInfluxV3.mockResolvedValue();
    });

    describe('postUserEventToInfluxdbV3', () => {
        test('should return early when InfluxDB is disabled', async () => {
            utils.isInfluxDbEnabled.mockReturnValue(false);

            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user1',
                origin: 'QlikSense',
            };

            await postUserEventToInfluxdbV3(msg);

            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should warn and return early when required fields are missing', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                // Missing user_directory, user_id, origin
            };

            await postUserEventToInfluxdbV3(msg);

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Missing required fields')
            );
            expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        });

        test('should successfully write user event with all fields', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user1',
                origin: 'QlikSense',
                appId: 'app-123',
                appName: 'Test App',
                ua: {
                    os: 'Windows',
                    browser: 'Chrome',
                    device: 'Desktop',
                },
            };

            await postUserEventToInfluxdbV3(msg);

            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
            expect(mockPoint.setTag).toHaveBeenCalledWith('host', 'server1');
            expect(mockPoint.setTag).toHaveBeenCalledWith('event_action', 'OpenApp');
            expect(mockPoint.setTag).toHaveBeenCalledWith('userDirectory', 'DOMAIN');
            expect(mockPoint.setTag).toHaveBeenCalledWith('userId', 'user1');
            expect(mockPoint.setTag).toHaveBeenCalledWith('origin', 'QlikSense');
        });

        test('should handle user event without optional fields', async () => {
            const msg = {
                host: 'server1',
                command: 'CreateApp',
                user_directory: 'DOMAIN',
                user_id: 'user1',
                origin: 'QlikSense',
            };

            await postUserEventToInfluxdbV3(msg);

            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
            expect(mockPoint.setTag).toHaveBeenCalledWith('host', 'server1');
            expect(mockPoint.setTag).toHaveBeenCalledWith('event_action', 'CreateApp');
        });

        test('should sanitize tag values with special characters', async () => {
            const msg = {
                host: 'server<1>',
                command: 'OpenApp',
                user_directory: 'DOMAIN\\SUB',
                user_id: 'user 1',
                origin: 'Qlik Sense',
            };

            await postUserEventToInfluxdbV3(msg);

            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
        });

        test('should handle write errors', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user1',
                origin: 'QlikSense',
            };

            const writeError = new Error('Write failed');
            utils.writeBatchToInfluxV3.mockRejectedValue(writeError);

            await postUserEventToInfluxdbV3(msg);

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error saving user event to InfluxDB v3')
            );
            expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
                'INFLUXDB_V3_WRITE',
                ''
            );
        });

        test('should handle events with user agent information', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user1',
                origin: 'QlikSense',
                ua: {
                    browser: {
                        name: 'Chrome',
                        major: '96',
                    },
                    os: {
                        name: 'Windows',
                        version: '10',
                    },
                },
            };

            await postUserEventToInfluxdbV3(msg);

            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
            expect(mockPoint.setTag).toHaveBeenCalledWith('uaBrowserName', 'Chrome');
            expect(mockPoint.setTag).toHaveBeenCalledWith('uaBrowserMajorVersion', '96');
            expect(mockPoint.setTag).toHaveBeenCalledWith('uaOsName', 'Windows');
            expect(mockPoint.setTag).toHaveBeenCalledWith('uaOsVersion', '10');
        });

        test('should handle events with app information', async () => {
            const msg = {
                host: 'server1',
                command: 'OpenApp',
                user_directory: 'DOMAIN',
                user_id: 'user1',
                origin: 'QlikSense',
                appId: 'abc-123-def',
                appName: 'Sales Dashboard',
            };

            await postUserEventToInfluxdbV3(msg);

            expect(utils.writeBatchToInfluxV3).toHaveBeenCalled();
            expect(mockPoint.setTag).toHaveBeenCalledWith('appId', 'abc-123-def');
            expect(mockPoint.setStringField).toHaveBeenCalledWith('appId_field', 'abc-123-def');
            expect(mockPoint.setTag).toHaveBeenCalledWith('appName', 'Sales Dashboard');
            expect(mockPoint.setStringField).toHaveBeenCalledWith(
                'appName_field',
                'Sales Dashboard'
            );
        });
    });
});
