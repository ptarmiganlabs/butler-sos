// filepath: /Users/goran/code/butler-sos/src/lib/__tests__/proxysessionmetrics.test.js
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock dependencies
const mockHttpsAgent = jest.fn();
jest.unstable_mockModule('https', () => ({
    default: {
        Agent: jest.fn().mockImplementation(() => mockHttpsAgent),
    },
}));

jest.unstable_mockModule('fs', () => ({
    default: {
        readFileSync: jest.fn().mockImplementation(() => 'dummy-cert-content'),
    },
}));

jest.unstable_mockModule('path', () => ({
    default: {
        resolve: jest.fn().mockImplementation((...args) => args.join('/')),
    },
}));

const mockRequest = jest.fn();
jest.unstable_mockModule('axios', () => ({
    default: {
        create: jest.fn().mockReturnValue({
            get: jest.fn(),
        }),
        request: mockRequest,
    },
}));

// Mock InfluxDB client
jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: jest.fn().mockImplementation(() => ({
        tag: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        intField: jest.fn().mockReturnThis(),
        uintField: jest.fn().mockReturnThis(),
        stringField: jest.fn().mockReturnThis(),
        timestamp: jest.fn().mockReturnThis(),
    })),
}));

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: jest.fn().mockImplementation(() => ({
        setIntegerField: jest.fn().mockReturnThis(),
        setFloatField: jest.fn().mockReturnThis(),
        setStringField: jest.fn().mockReturnThis(),
        setTag: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
    })),
}));

// Mock globals
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            info: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        },
        errorTracker: {
            incrementError: jest.fn(),
        },
        config: {
            get: jest.fn().mockImplementation((path) => {
                if (path === 'Butler-SOS.cert.clientCert') return '/path/to/cert.pem';
                if (path === 'Butler-SOS.cert.clientCertKey') return '/path/to/key.pem';
                if (path === 'Butler-SOS.cert.clientCertCA') return '/path/to/ca.pem';
                if (path === 'Butler-SOS.serversToMonitor.rejectUnauthorized') return false;
                if (path === 'Butler-SOS.mqttConfig.enable') return false;
                if (path === 'Butler-SOS.influxdbConfig.enable') return true;
                if (path === 'Butler-SOS.influxdbConfig.version') return 2;
                if (path === 'Butler-SOS.newRelic.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable')
                    return true;
                if (path === 'Butler-SOS.prometheus.enable') return true;
                if (path === 'Butler-SOS.userSessions.pollingInterval') return 10000;
                if (path === 'Butler-SOS.userSessions.excludeUser') return [];
                return undefined;
            }),
            has: jest.fn().mockReturnValue(true),
        },
        getErrorMessage: jest.fn().mockImplementation((err) => err?.toString() || 'Unknown error'),
        serverList: [
            {
                serverName: 'server1',
                host: 'host1.example.com',
                userSessions: {
                    enable: true,
                    host: 'host1.example.com',
                    virtualProxies: [{ virtualProxy: 'vproxy1' }, { virtualProxy: 'vproxy2' }],
                },
            },
        ],
    },
}));

// Mock dependent modules
const mockPostProxySessionsToInfluxdb = jest.fn().mockResolvedValue();
jest.unstable_mockModule('../influxdb/index.js', () => ({
    postProxySessionsToInfluxdb: mockPostProxySessionsToInfluxdb,
}));

const mockPostProxySessionsToNewRelic = jest.fn().mockResolvedValue();
jest.unstable_mockModule('../post-to-new-relic.js', () => ({
    postProxySessionsToNewRelic: mockPostProxySessionsToNewRelic,
}));

const mockPostUserSessionsToMQTT = jest.fn().mockResolvedValue();
jest.unstable_mockModule('../post-to-mqtt.js', () => ({
    postUserSessionsToMQTT: mockPostUserSessionsToMQTT,
}));

const mockGetServerTags = jest.fn().mockReturnValue({
    server_name: 'server1',
    server_environment: 'production',
});
jest.unstable_mockModule('../servertags.js', () => ({
    getServerTags: mockGetServerTags,
}));

const mockSaveUserSessionMetricsToPrometheus = jest.fn().mockResolvedValue();
jest.unstable_mockModule('../prom-client.js', () => ({
    saveUserSessionMetricsToPrometheus: mockSaveUserSessionMetricsToPrometheus,
}));

jest.unstable_mockModule('../cert-utils.js', () => ({
    getCertificates: jest.fn().mockReturnValue({
        cert: 'cert',
        key: 'key',
        ca: 'ca',
    }),
    createCertificateOptions: jest.fn().mockReturnValue({}),
}));

jest.unstable_mockModule('../log-error.js', () => ({
    logError: jest.fn(),
}));

jest.unstable_mockModule('../influxdb/shared/utils.js', () => ({
    applyTagsToPoint3: jest.fn(),
    validateUnsignedField: jest.fn().mockImplementation((val) => val),
}));

// Import the module under test
const { setupUserSessionsTimer, getProxySessionStatsFromSense } =
    await import('../proxysessionmetrics.js');

describe('proxysessionmetrics', () => {
    let axios;
    let globals;
    let influxdb;
    let newRelic;
    let mqtt;
    let servertags;
    let promClient;
    let certUtils;
    let logError;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Get mocked modules
        axios = (await import('axios')).default;
        globals = (await import('../../globals.js')).default;
        influxdb = await import('../influxdb/index.js');
        newRelic = await import('../post-to-new-relic.js');
        mqtt = await import('../post-to-mqtt.js');
        servertags = await import('../servertags.js');
        promClient = await import('../prom-client.js');
        certUtils = await import('../cert-utils.js');
        logError = await import('../log-error.js');

        // Reset mockRequest for each test
        mockRequest.mockReset();

        // Default config mocks
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.cert.clientCert') return '/path/to/cert.pem';
            if (path === 'Butler-SOS.cert.clientCertKey') return '/path/to/key.pem';
            if (path === 'Butler-SOS.cert.clientCertCA') return '/path/to/ca.pem';
            if (path === 'Butler-SOS.serversToMonitor.rejectUnauthorized') return false;
            if (path === 'Butler-SOS.mqttConfig.enable') return false;
            if (path === 'Butler-SOS.influxdbConfig.enable') return true;
            if (path === 'Butler-SOS.influxdbConfig.version') return 2;
            if (path === 'Butler-SOS.newRelic.enable') return false;
            if (path === 'Butler-SOS.prometheus.enable') return false;
            if (path === 'Butler-SOS.userSessions.pollingInterval') return 10000;
            if (path === 'Butler-SOS.userSessions.excludeUser') return [];
            return undefined;
        });
        globals.config.has.mockReturnValue(true);
    });

    describe('getProxySessionStatsFromSense', () => {
        test('should get session stats from Sense and post to backends (InfluxDB v2)', async () => {
            // Setup
            const serverName = 'server1';
            const host = 'host1.example.com';
            const virtualProxy = 'vproxy1';
            const tags = { server_name: serverName, server_environment: 'production' };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.influxdbConfig.version') return 2;
                if (path === 'Butler-SOS.influxdbConfig.enable') return true;
                if (path === 'Butler-SOS.newRelic.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable') return true;
                if (path === 'Butler-SOS.prometheus.enable') return true;
                if (path === 'Butler-SOS.mqttConfig.enable') return true;
                if (path === 'Butler-SOS.userSessions.excludeUser') return [];
                return undefined;
            });

            const mockResponse = {
                data: [
                    {
                        UserDirectory: 'DOMAIN',
                        UserId: 'user1',
                        Attributes: [],
                        SessionId: 'session1',
                    },
                ],
                status: 200,
                config: {
                    url: `https://${host}/qps${virtualProxy}/session?Xrfkey=abcdefghij987654`,
                },
            };

            mockRequest.mockResolvedValueOnce(mockResponse);

            // Execute
            await getProxySessionStatsFromSense(serverName, host, virtualProxy, tags);

            if (mockPostProxySessionsToInfluxdb.mock.calls.length === 0) {
                console.log('Logger errors:', JSON.stringify(globals.logger.error.mock.calls, null, 2));
            }

            // Verify
            expect(mockRequest).toHaveBeenCalled();
            expect(mockPostProxySessionsToInfluxdb).toHaveBeenCalled();
            expect(mockPostProxySessionsToNewRelic).toHaveBeenCalled();
            expect(mockSaveUserSessionMetricsToPrometheus).toHaveBeenCalled();
            expect(mockPostUserSessionsToMQTT).toHaveBeenCalled();
        });

        test('should handle InfluxDB v1', async () => {
            const serverName = 'server1';
            const host = 'host1.example.com';
            const virtualProxy = 'vproxy1';
            const tags = { server_name: serverName, server_environment: 'production' };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.influxdbConfig.version') return 1;
                if (path === 'Butler-SOS.influxdbConfig.enable') return true;
                if (path === 'Butler-SOS.userSessions.excludeUser') return [];
                return undefined;
            });

            const mockResponse = {
                data: [{ UserDirectory: 'DOMAIN', UserId: 'user1', SessionId: 'session1' }],
                status: 200,
                config: { url: 'url' },
            };
            mockRequest.mockResolvedValueOnce(mockResponse);

            await getProxySessionStatsFromSense(serverName, host, virtualProxy, tags);
            expect(mockPostProxySessionsToInfluxdb).toHaveBeenCalled();
        });

        test('should handle InfluxDB v3', async () => {
            const serverName = 'server1';
            const host = 'host1.example.com';
            const virtualProxy = 'vproxy1';
            const tags = { server_name: serverName, server_environment: 'production' };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.influxdbConfig.version') return 3;
                if (path === 'Butler-SOS.influxdbConfig.enable') return true;
                if (path === 'Butler-SOS.userSessions.excludeUser') return [];
                return undefined;
            });

            const mockResponse = {
                data: [{ UserDirectory: 'DOMAIN', UserId: 'user1', SessionId: 'session1' }],
                status: 200,
                config: { url: 'url' },
            };
            mockRequest.mockResolvedValueOnce(mockResponse);

            await getProxySessionStatsFromSense(serverName, host, virtualProxy, tags);
            expect(mockPostProxySessionsToInfluxdb).toHaveBeenCalled();
        });

        test('should handle user blacklist', async () => {
            const serverName = 'server1';
            const host = 'host1.example.com';
            const virtualProxy = 'vproxy1';
            const tags = { server_name: serverName, server_environment: 'production' };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.userSessions.excludeUser')
                    return [{ directory: 'DOMAIN', userId: 'user1' }];
                if (path === 'Butler-SOS.influxdbConfig.version') return 2;
                return undefined;
            });

            const mockResponse = {
                data: [{ UserDirectory: 'DOMAIN', UserId: 'user1', SessionId: 'session1' }],
                status: 200,
                config: { url: 'url' },
            };
            mockRequest.mockResolvedValueOnce(mockResponse);

            await getProxySessionStatsFromSense(serverName, host, virtualProxy, tags);
            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('in blacklist, not reporting session')
            );
        });

        test('should handle missing certificates', async () => {
            certUtils.getCertificates.mockReturnValueOnce({ cert: undefined });

            await getProxySessionStatsFromSense('s1', 'h1', 'v1', {});

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Client certificate or key was not found')
            );
        });

        test('should handle error from Sense API', async () => {
            // Setup
            const serverName = 'server1';
            const host = 'host1.example.com';
            const virtualProxy = 'vproxy1';
            const tags = { server_name: serverName, server_environment: 'production' };

            mockRequest.mockRejectedValueOnce(new Error('API error'));

            // Execute
            await getProxySessionStatsFromSense(serverName, host, virtualProxy, tags);

            // Verify
            expect(mockRequest).toHaveBeenCalled();
            expect(logError.logError).toHaveBeenCalled();
            expect(globals.errorTracker.incrementError).toHaveBeenCalledWith(
                'PROXY_API',
                serverName
            );
        });
    });

    describe('setupUserSessionsTimer', () => {
        test('should set up timer for polling user sessions', async () => {
            jest.useFakeTimers();
            
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.userSessions.pollingInterval') return 10000;
                return undefined;
            });

            setupUserSessionsTimer();

            // Advance timers
            await jest.advanceTimersByTimeAsync(10000);

            expect(mockRequest).toHaveBeenCalled();
            
            jest.useRealTimers();
        });

        test('should prevent overlapping executions', async () => {
            jest.useFakeTimers();
            
            // Make getProxySessionStatsFromSense hang
            mockRequest.mockImplementation(() => new Promise(() => {}));

            setupUserSessionsTimer();

            // First execution
            await jest.advanceTimersByTimeAsync(10000);
            expect(mockRequest).toHaveBeenCalledTimes(1);

            // Second execution should be skipped
            await jest.advanceTimersByTimeAsync(10000);
            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Previous session polling still in progress')
            );

            jest.useRealTimers();
        });
    });
});
