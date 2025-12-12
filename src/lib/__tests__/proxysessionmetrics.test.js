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

// Mock globals
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            info: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
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
        getErrorMessage: jest.fn().mockImplementation((err) => err.toString()),
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

// Import the module under test
const { setupUserSessionsTimer, getProxySessionStatsFromSense } =
    await import('../proxysessionmetrics.js');

describe('proxysessionmetrics', () => {
    let proxysessionmetrics;
    let axios;
    let globals;
    let influxdb;
    let newRelic;
    let mqtt;
    let servertags;
    let promClient;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Get mocked modules
        axios = (await import('axios')).default;
        globals = (await import('../../globals.js')).default;
        influxdb = await import('../post-to-influxdb.js');
        newRelic = await import('../post-to-new-relic.js');
        mqtt = await import('../post-to-mqtt.js');
        servertags = await import('../servertags.js');
        promClient = await import('../prom-client.js');

        // Reset mockRequest for each test
        mockRequest.mockReset();
    });

    describe('getProxySessionStatsFromSense', () => {
        test('should get session stats from Sense and post to backends', async () => {
            // Setup
            const serverName = 'server1';
            const host = 'host1.example.com';
            const virtualProxy = 'vproxy1';
            const tags = { server_name: serverName, server_environment: 'production' };

            // Set up mock response with data that will actually make the backend calls
            const mockResponse = {
                data: [
                    {
                        UserDirectory: 'DOMAIN',
                        UserId: 'user1',
                        Attributes: [],
                        SessionId: 'session1',
                    },
                    {
                        UserDirectory: 'DOMAIN',
                        UserId: 'user2',
                        Attributes: [],
                        SessionId: 'session2',
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

            // Verify
            expect(mockRequest).toHaveBeenCalled();
            expect(mockPostProxySessionsToInfluxdb).toHaveBeenCalled();
            expect(mockPostProxySessionsToNewRelic).toHaveBeenCalled();
            expect(mockSaveUserSessionMetricsToPrometheus).toHaveBeenCalled();
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
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    "PROXY SESSIONS: Error when calling proxy session API for server 'server1' (host1.example.com), virtual proxy 'vproxy1':"
                )
            );
            expect(mockPostProxySessionsToInfluxdb).not.toHaveBeenCalled();
        });
    });

    describe('setupUserSessionsTimer', () => {
        test('should set up timer for polling user sessions', () => {
            // Mock setInterval
            jest.useFakeTimers();
            const originalSetInterval = global.setInterval;
            global.setInterval = jest.fn().mockImplementation((callback, interval) => {
                return originalSetInterval(callback, interval);
            });

            // Execute
            setupUserSessionsTimer();

            // Verify
            expect(global.setInterval).toHaveBeenCalled();
            expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 10000);

            // Restore setInterval
            global.setInterval = originalSetInterval;
            jest.useRealTimers();
        });
    });
});
