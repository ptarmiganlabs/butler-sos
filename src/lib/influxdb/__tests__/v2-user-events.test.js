import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPoint = {
    tag: jest.fn().mockReturnThis(),
    stringField: jest.fn().mockReturnThis(),
};

const mockWriteApi = {
    writePoint: jest.fn(),
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
    config: { get: jest.fn(), has: jest.fn() },
    influx: { getWriteApi: jest.fn(() => mockWriteApi) },
    getErrorMessage: jest.fn((err) => err.message),
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: jest.fn(() => mockPoint),
}));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

const mockV2Utils = {
    applyInfluxTags: jest.fn(),
};

jest.unstable_mockModule('../v2/utils.js', () => mockV2Utils);

describe('v2/user-events', () => {
    let storeUserEventV2, globals, utils, Point;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const InfluxClient = await import('@influxdata/influxdb-client');
        Point = InfluxClient.Point;
        const userEvents = await import('../v2/user-events.js');
        storeUserEventV2 = userEvents.storeUserEventV2;

        mockPoint.tag.mockReturnThis();
        mockPoint.stringField.mockReturnThis();

        globals.config.get.mockImplementation((path) => {
            if (path.includes('org')) return 'test-org';
            if (path.includes('bucket')) return 'test-bucket';
            if (path.includes('userEvents.tags')) return [{ name: 'env', value: 'prod' }];
            return undefined;
        });
        globals.config.has.mockReturnValue(true);

        utils.isInfluxDbEnabled.mockReturnValue(true);
        utils.writeToInfluxWithRetry.mockImplementation(async (fn) => await fn());
        mockWriteApi.writePoint.mockResolvedValue(undefined);
    });

    test('should return early when InfluxDB disabled', async () => {
        utils.isInfluxDbEnabled.mockReturnValue(false);
        const msg = {
            host: 'host1',
            command: 'OpenApp',
            user_directory: 'DOMAIN',
            user_id: 'user1',
            origin: 'QlikSense',
        };
        await storeUserEventV2(msg);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
    });

    test('should return early with missing required fields', async () => {
        const msg = {
            host: 'host1',
            command: 'OpenApp',
            // missing user_directory, user_id, origin
        };
        await storeUserEventV2(msg);
        expect(utils.writeToInfluxWithRetry).not.toHaveBeenCalled();
        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Missing required fields')
        );
    });

    test('should write complete user event with all fields', async () => {
        const msg = {
            host: 'host1.example.com',
            command: 'OpenApp',
            user_directory: 'DOMAIN',
            user_id: 'john.doe',
            origin: 'QlikSense',
            appId: 'app-123',
            appName: 'Sales Dashboard',
            ua: {
                browser: { name: 'Chrome', major: '120' },
                os: { name: 'Windows', version: '10' },
            },
        };

        await storeUserEventV2(msg);

        expect(Point).toHaveBeenCalledWith('user_events');
        expect(mockPoint.tag).toHaveBeenCalledWith('host', 'host1.example.com');
        expect(mockPoint.tag).toHaveBeenCalledWith('event_action', 'OpenApp');
        expect(mockPoint.tag).toHaveBeenCalledWith('userFull', 'DOMAIN\\john.doe');
        expect(mockPoint.tag).toHaveBeenCalledWith('userDirectory', 'DOMAIN');
        expect(mockPoint.tag).toHaveBeenCalledWith('userId', 'john.doe');
        expect(mockPoint.tag).toHaveBeenCalledWith('origin', 'QlikSense');
        expect(mockPoint.tag).toHaveBeenCalledWith('appId', 'app-123');
        expect(mockPoint.tag).toHaveBeenCalledWith('appName', 'Sales Dashboard');
        expect(mockPoint.tag).toHaveBeenCalledWith('uaBrowserName', 'Chrome');
        expect(mockPoint.tag).toHaveBeenCalledWith('uaBrowserMajorVersion', '120');
        expect(mockPoint.tag).toHaveBeenCalledWith('uaOsName', 'Windows');
        expect(mockPoint.tag).toHaveBeenCalledWith('uaOsVersion', '10');
        expect(mockPoint.stringField).toHaveBeenCalledWith('userFull', 'DOMAIN\\john.doe');
        expect(mockPoint.stringField).toHaveBeenCalledWith('userId', 'john.doe');
        expect(mockPoint.stringField).toHaveBeenCalledWith('appId_field', 'app-123');
        expect(mockPoint.stringField).toHaveBeenCalledWith('appName_field', 'Sales Dashboard');
        expect(mockV2Utils.applyInfluxTags).toHaveBeenCalledWith(mockPoint, [
            { name: 'env', value: 'prod' },
        ]);
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
        expect(mockWriteApi.writePoint).toHaveBeenCalled();
        expect(mockWriteApi.close).toHaveBeenCalled();
    });

    test('should handle event without app info', async () => {
        const msg = {
            host: 'host1',
            command: 'Login',
            user_directory: 'DOMAIN',
            user_id: 'user1',
            origin: 'QlikSense',
        };

        await storeUserEventV2(msg);

        expect(mockPoint.tag).not.toHaveBeenCalledWith('appId', expect.anything());
        expect(mockPoint.tag).not.toHaveBeenCalledWith('appName', expect.anything());
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should handle event without user agent', async () => {
        const msg = {
            host: 'host1',
            command: 'OpenApp',
            user_directory: 'DOMAIN',
            user_id: 'user1',
            origin: 'QlikSense',
        };

        await storeUserEventV2(msg);

        expect(mockPoint.tag).not.toHaveBeenCalledWith('uaBrowserName', expect.anything());
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should handle partial user agent info', async () => {
        const msg = {
            host: 'host1',
            command: 'OpenApp',
            user_directory: 'DOMAIN',
            user_id: 'user1',
            origin: 'QlikSense',
            ua: {
                browser: { name: 'Firefox' }, // no major version
                // no os info
            },
        };

        await storeUserEventV2(msg);

        expect(mockPoint.tag).toHaveBeenCalledWith('uaBrowserName', 'Firefox');
        expect(mockPoint.tag).not.toHaveBeenCalledWith('uaBrowserMajorVersion', expect.anything());
        expect(utils.writeToInfluxWithRetry).toHaveBeenCalled();
    });

    test('should log debug information', async () => {
        const msg = {
            host: 'host1',
            command: 'OpenApp',
            user_directory: 'DOMAIN',
            user_id: 'user1',
            origin: 'QlikSense',
        };

        await storeUserEventV2(msg);

        expect(globals.logger.debug).toHaveBeenCalled();
        expect(globals.logger.silly).toHaveBeenCalled();
        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'USER EVENT V2: Sent user event data to InfluxDB'
        );
    });

    test('should handle different event commands', async () => {
        const commands = ['OpenApp', 'CreateApp', 'DeleteApp', 'ReloadApp'];

        for (const command of commands) {
            jest.clearAllMocks();
            const msg = {
                host: 'host1',
                command,
                user_directory: 'DOMAIN',
                user_id: 'user1',
                origin: 'QlikSense',
            };

            await storeUserEventV2(msg);

            expect(mockPoint.tag).toHaveBeenCalledWith('event_action', command);
        }
    });
});
