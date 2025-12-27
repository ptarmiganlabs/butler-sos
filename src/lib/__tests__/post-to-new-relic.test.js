import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('https', () => ({
    default: {
        request: jest.fn().mockImplementation((options, callback) => {
            const mockResponse = {
                on: jest.fn().mockImplementation((event, handler) => {
                    if (event === 'end') {
                        handler();
                    }
                    return mockResponse;
                }),
                statusCode: 200,
            };
            callback(mockResponse);
            return {
                on: jest.fn(),
                write: jest.fn(),
                end: jest.fn(),
            };
        }),
    },
}));

jest.unstable_mockModule('axios', () => ({
    default: {
        post: jest.fn(),
    },
}));
const axios = (await import('axios')).default;

// Mock globals
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            info: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
        },
        errorTracker: {
            incrementError: jest.fn(),
        },
        config: {
            get: jest.fn().mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.enable') return true;
                if (path === 'Butler-SOS.newRelic.insertEvery') return 10;
                if (path === 'Butler-SOS.newRelic.protocol') return 'https';
                if (path === 'Butler-SOS.newRelic.host') return 'insights-collector.newrelic.com';
                if (path === 'Butler-SOS.newRelic.port') return 443;
                if (path === 'Butler-SOS.newRelic.path') return '/v1/accounts/12345/events';
                if (path === 'Butler-SOS.newRelic.apiKey') return 'test-api-key';
                if (path === 'Butler-SOS.newRelic.includeTags') return true;
                if (path === 'Butler-SOS.serversToMonitor.pollingInterval') return 7500; // Added required setting
                if (path === 'Butler-SOS.userSessions.pollingInterval') return 5000;

                // New Relic Metric Features
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.memory.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.cpu.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.calls.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.selections.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.sessions.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.users.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.saturated.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.apps.docCount.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.cache.cache.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable')
                    return true;

                if (path === 'Butler-SOS.newRelic.metric.url')
                    return 'https://metric-api.newrelic.com/metric/v1';
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            }),
            has: jest.fn().mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.attribute.static') return false;
                if (path === 'Butler-SOS.newRelic.metric.attribute.dynamic.butlerSosVersion.enable')
                    return false;
                if (path === 'Butler-SOS.newRelic.metric.header') return false;
                return false;
            }),
        },
        appVersion: '1.0.0',
    },
}));

describe('post-to-new-relic', () => {
    let newRelic;
    let https;
    let globals;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Reset axios mock
        if (axios && axios.post) {
            axios.post.mockReset();
        }

        // Get mocked modules
        https = (await import('https')).default;
        globals = (await import('../../globals.js')).default;

        // Import the module under test
        newRelic = await import('../post-to-new-relic.js');
    });

    describe('postProxySessionsToNewRelic', () => {
        test('should post proxy sessions to New Relic', async () => {
            // Setup
            const userSessions = {
                host: 'host1.example.com',
                virtualProxy: 'default',
                sessionCount: 25,
                datapointNewRelic: {
                    butlersos_user_session_summary_total: {
                        value: 25,
                        attributes: {
                            host: 'host1.example.com',
                            virtual_proxy: 'default',
                        },
                    },
                },
            };

            // Make sure the needed config returns valid values with matching account names
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.url')
                    return 'https://metric-api.newrelic.com/metric/v1';
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['account1']; // Must match accountName below
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1', // Must match account above
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                if (path === 'Butler-SOS.userSessions.pollingInterval') return 5000;
                return undefined;
            });

            // Reset and setup axios mock for this test
            axios.post.mockReset();
            axios.post.mockResolvedValue({
                status: 200,
                statusText: 'OK',
            });

            // Execute
            await newRelic.postProxySessionsToNewRelic(userSessions);

            // Verify
            expect(axios.post).toHaveBeenCalledWith(
                'https://metric-api.newrelic.com/metric/v1',
                expect.arrayContaining([
                    expect.objectContaining({
                        common: expect.objectContaining({
                            'interval.ms': 5000,
                            attributes: expect.objectContaining({
                                host: 'host1.example.com',
                                virtual_proxy: 'default',
                            }),
                        }),
                        metrics: expect.arrayContaining([
                            expect.objectContaining({
                                name: 'qs_proxySessions',
                                type: 'gauge',
                                value: 25,
                            }),
                        ]),
                    }),
                ]),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Api-Key': 'test-insert-key',
                    }),
                    timeout: 5000,
                })
            );
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('PROXY SESSIONS NEW RELIC: Sent Qlik Sense proxy sessions')
            );
        });

        test('should not post proxy sessions to New Relic if config is disabled', async () => {
            // Setup
            const userSessions = {
                host: 'host1.example.com',
                virtualProxy: 'default',
                sessionCount: 25,
                datapointNewRelic: {
                    butlersos_user_session_summary_total: {
                        value: 25,
                        attributes: {
                            host: 'host1.example.com',
                            virtual_proxy: 'default',
                        },
                    },
                },
            };

            // Completely reset mock implementation first
            globals.config.get.mockReset();

            // Modify the mock to disable New Relic
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable')
                    return false; // This is the key setting that should disable posting
                return undefined; // Return undefined for all other config values
            });

            // Reset axios mock
            axios.post.mockReset();

            // Execute
            await newRelic.postProxySessionsToNewRelic(userSessions);

            // Verify
            expect(axios.post).not.toHaveBeenCalled();
        });

        test('should handle API response errors', async () => {
            // Setup
            const userSessions = {
                host: 'host1.example.com',
                virtualProxy: 'default',
                sessionCount: 25,
                datapointNewRelic: {
                    butlersos_user_session_summary_total: {
                        value: 25,
                        attributes: {
                            host: 'host1.example.com',
                            virtual_proxy: 'default',
                        },
                    },
                },
            };

            // Make sure the needed config returns valid values with matching account names
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.url')
                    return 'https://metric-api.newrelic.com/metric/v1';
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['account1']; // Must match accountName below
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1', // Must match account above
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                if (path === 'Butler-SOS.userSessions.pollingInterval') return 5000;
                return undefined;
            });

            // Reset and mock axios with error response
            axios.post.mockReset();
            axios.post.mockResolvedValue({
                status: 403,
                statusText: 'Forbidden',
            });

            // Execute
            await newRelic.postProxySessionsToNewRelic(userSessions);

            // Verify
            expect(axios.post).toHaveBeenCalled();
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('PROXY SESSIONS NEW RELIC: Error code from posting')
            );
        });

        test('should handle HTTP request errors gracefully', async () => {
            // Setup
            const userSessions = {
                host: 'host1.example.com',
                virtualProxy: 'default',
                sessionCount: 25,
                datapointNewRelic: {
                    butlersos_user_session_summary_total: {
                        value: 25,
                        attributes: {
                            host: 'host1.example.com',
                            virtual_proxy: 'default',
                        },
                    },
                },
            };

            // Make sure the needed config returns valid values with matching account names
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.url')
                    return 'https://metric-api.newrelic.com/metric/v1';
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['account1']; // Must match accountName below
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1', // Must match account above
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                if (path === 'Butler-SOS.userSessions.pollingInterval') return 5000;
                return undefined;
            });

            // Define error object separately
            const networkError = new Error('Test network error');

            // Reset and mock axios to throw the error
            axios.post.mockReset();
            axios.post.mockRejectedValue(networkError);

            // Execute
            await newRelic.postProxySessionsToNewRelic(userSessions);

            // Verify
            expect(axios.post).toHaveBeenCalled();
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('PROXY SESSIONS NEW RELIC: Error sending proxy sessions')
            );
        });

        test('should handle missing New Relic account configuration', async () => {
            // Setup
            const userSessions = {
                host: 'host1.example.com',
                virtualProxy: 'default',
                sessionCount: 25,
                datapointNewRelic: {
                    butlersos_user_session_summary_total: {
                        value: 25,
                        attributes: {
                            host: 'host1.example.com',
                            virtual_proxy: 'default',
                        },
                    },
                },
            };

            // Modify the mock to return non-existent account
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.url')
                    return 'https://metric-api.newrelic.com/metric/v1';
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['non-existent-account'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            // Reset axios mock
            axios.post.mockReset();

            // Execute
            await newRelic.postProxySessionsToNewRelic(userSessions);

            // Verify
            expect(axios.post).not.toHaveBeenCalled();
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    'PROXY SESSIONS NEW RELIC: New Relic config "non-existent-account" does not exist'
                )
            );
        });
    });

    describe('postHealthMetricsToNewRelic', () => {
        test('should post health metrics to New Relic successfully', async () => {
            // Setup
            const host = 'server1.example.com';
            const body = {
                started: '20240101T120000',
                mem: {
                    committed: 1024,
                    allocated: 512,
                    free: 256,
                },
                cpu: {
                    total: 45.5,
                },
                apps: {
                    calls: 100,
                    selections: 50,
                    active_docs: ['app1', 'app2'],
                    loaded_docs: ['app1', 'app2', 'app3'],
                    in_memory_docs: ['app1'],
                },
                session: {
                    active: 5,
                    total: 10,
                },
                users: {
                    active: 3,
                    total: 8,
                },
                saturated: false,
                cache: {
                    hits: 100,
                    lookups: 120,
                    added: 5,
                    replaced: 2,
                    bytes_added: 1024,
                },
            };
            const tags = {
                host: 'server1.example.com',
                server_name: 'Qlik1',
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.url')
                    return 'https://metric-api.newrelic.com/metric/v1';
                if (path === 'Butler-SOS.newRelic.metric.attribute.static')
                    return [{ name: 'environment', value: 'test' }];
                if (path === 'Butler-SOS.newRelic.metric.attribute.dynamic.butlerSosVersion.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.memory.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.cpu.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.calls.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.selections.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.sessions.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.users.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.engine.saturated.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.apps.docCount.enable') return true;
                if (path === 'Butler-SOS.newRelic.metric.dynamic.cache.cache.enable') return true;
                if (path === 'Butler-SOS.serversToMonitor.pollingInterval') return 5000;
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.attribute.static') return true;
                if (path === 'Butler-SOS.newRelic.metric.attribute.dynamic.butlerSosVersion.enable')
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.header') return false;
                return false;
            });

            // Mock successful axios response
            axios.post.mockResolvedValue({
                status: 200,
                statusText: 'OK',
            });

            // Execute
            await newRelic.postHealthMetricsToNewRelic(host, body, tags);

            // Verify
            expect(axios.post).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'HEALTH METRICS NEW RELIC: Sent Qlik Sense health metrics to New Relic'
                )
            );
        });

        test('should post health metrics with custom headers', async () => {
            const host = 'server1.example.com';
            const body = {
                started: '20240101T120000',
                apps: { active_docs: [], loaded_docs: [], in_memory_docs: [] },
            };
            const tags = { host: 'server1.example.com' };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.url') return 'https://metric-api.newrelic.com/metric/v1';
                if (path === 'Butler-SOS.newRelic.metric.header') return [{ name: 'X-Custom', value: 'val' }];
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount') return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [{ accountName: 'account1', accountId: '12345', insertApiKey: 'key' }];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.metric.header') return true;
                return false;
            });

            axios.post.mockResolvedValue({ status: 200 });

            await newRelic.postHealthMetricsToNewRelic(host, body, tags);

            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Array),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'X-Custom': 'val' })
                })
            );
        });

        test('should handle errors gracefully', async () => {
            const host = 'server1.example.com';
            const body = {
                started: '20240101T120000',
                mem: {},
                cpu: {},
                apps: {
                    active_docs: ['app1'],
                    loaded_docs: ['app1', 'app2'],
                    in_memory_docs: ['app1'],
                },
                session: {},
                users: {},
                cache: {},
            };
            const tags = { host: 'server1.example.com' };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            // Mock axios to throw error
            const networkError = new Error('Network error');
            axios.post.mockRejectedValue(networkError);

            // Execute
            await newRelic.postHealthMetricsToNewRelic(host, body, tags);

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('HEALTH METRICS NEW RELIC: Error sending proxy sessions')
            );
        });
    });

    describe('postButlerSOSUptimeToNewRelic', () => {
        test('should post Butler SOS uptime metrics to New Relic', async () => {
            // Setup
            const fields = {
                intervalMillisec: 30000,
                heapUsed: 50000000,
                heapTotal: 100000000,
                externalMemory: 5000000,
                processMemory: 120000000,
                uptimeMillisec: 86400000,
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.uptimeMonitor.storeNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.uptimeMonitor.storeNewRelic.attribute.static')
                    return [{ name: 'service', value: 'butler-sos' }];
                if (
                    path ===
                    'Butler-SOS.uptimeMonitor.storeNewRelic.attribute.dynamic.butlerVersion.enable'
                )
                    return true;
                if (
                    path ===
                    'Butler-SOS.uptimeMonitor.storeNewRelic.metric.dynamic.butlerMemoryUsage.enable'
                )
                    return true;
                if (
                    path ===
                    'Butler-SOS.uptimeMonitor.storeNewRelic.metric.dynamic.butlerUptime.enable'
                )
                    return true;
                if (path === 'Butler-SOS.newRelic.metric.url')
                    return 'https://metric-api.newrelic.com/metric/v1';
                if (path === 'Butler-SOS.newRelic.metric.header')
                    return [{ name: 'User-Agent', value: 'Butler-SOS' }];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.uptimeMonitor.storeNewRelic.attribute.static') return true;
                if (path === 'Butler-SOS.newRelic.metric.header') return true;
                return false;
            });

            // Mock successful axios response
            axios.post.mockResolvedValue({
                status: 200,
                statusText: 'OK',
            });

            // Execute
            await newRelic.postButlerSOSUptimeToNewRelic(fields);

            // Verify
            expect(axios.post).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining(
                    'UPTIME NEW RELIC: Sent Butler SOS memory usage data to New Relic'
                )
            );
        });

        test('should handle uptime posting errors', async () => {
            const fields = {
                intervalMillisec: 30000,
                heapUsed: 50000000,
                heapTotal: 100000000,
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.uptimeMonitor.storeNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            // Mock axios to throw error
            const networkError = new Error('Uptime posting failed');
            axios.post.mockRejectedValue(networkError);

            // Execute
            await newRelic.postButlerSOSUptimeToNewRelic(fields);

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('UPTIME NEW RELIC: Error sending uptime')
            );
        });
    });

    describe('postUserEventToNewRelic', () => {
        test('should post user event to New Relic successfully', async () => {
            // Setup
            const userEvent = {
                userId: 'testuser',
                userDirectory: 'DOMAIN',
                session: {
                    sessionId: 'session123',
                    virtualProxy: 'header',
                },
                source: {
                    engine: true,
                    proxy: false,
                    repository: false,
                    scheduler: false,
                },
                ts_iso: '2024-01-01T12:00:00.000Z',
                ts_start: '2024-01-01T12:00:00.000Z',
                ts_end: '2024-01-01T12:00:30.000Z',
                session_duration_sec: 30,
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.url')
                    return 'https://insights-collector.newrelic.com/';
                if (path === 'Butler-SOS.newRelic.event.attribute.static')
                    return [{ name: 'environment', value: 'test' }];
                if (path === 'Butler-SOS.newRelic.event.attribute.dynamic.butlerSosVersion.enable')
                    return true;
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.attribute.static') return true;
                if (path === 'Butler-SOS.newRelic.event.header') return false;
                return false;
            });

            // Mock successful axios response
            axios.post.mockResolvedValue({
                status: 200,
                statusText: 'OK',
            });

            // Execute
            await newRelic.postUserEventToNewRelic(userEvent);

            // Verify
            expect(axios.post).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('USER EVENT NEW RELIC: Sent user event to New Relic')
            );
        });

        test('should handle user event posting errors', async () => {
            const userEvent = {
                userId: 'testuser',
                userDirectory: 'DOMAIN',
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.url')
                    return 'https://insights-collector.newrelic.com/';
                if (path === 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            // Mock axios to throw error
            const networkError = new Error('User event posting failed');
            axios.post.mockRejectedValue(networkError);

            // Execute
            await newRelic.postUserEventToNewRelic(userEvent);

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(
                    'USER EVENT NEW RELIC: Error saving user event to New Relic!'
                )
            );
        });
    });

    describe('postLogEventToNewRelic', () => {
        test('should post log event successfully', async () => {
            const logEvent = {
                source: 'qseow-engine',
                level: 'ERROR',
                host: 'server1.example.com',
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.url')
                    return 'https://insights-collector.newrelic.com';
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.enable')
                    return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error')
                    return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error')
                    return true;
                return false;
            });

            axios.post.mockResolvedValue({ status: 200, statusText: 'OK' });

            await newRelic.postLogEventToNewRelic(logEvent);

            expect(axios.post).toHaveBeenCalled();
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('Sent log event to New Relic account 12345')
            );
        });

        test('should post log event with custom headers', async () => {
            const logEvent = {
                source: 'qseow-engine',
                level: 'ERROR',
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.url') return 'https://nr.com';
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.enable') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.destinationAccount') return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [{ accountName: 'account1', accountId: '12345', insertApiKey: 'key' }];
                if (path === 'Butler-SOS.newRelic.event.header') return [{ name: 'X-Log-Header', value: 'log-val' }];
                if (path === 'Butler-SOS.logEvents.tags') return [];
                if (path === 'Butler-SOS.newRelic.event.attribute.static') return [];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.header') return true;
                if (path === 'Butler-SOS.logEvents.tags') return true;
                if (path === 'Butler-SOS.newRelic.event.attribute.static') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error') return true;
                return false;
            });

            axios.post.mockResolvedValue({ status: 200 });

            await newRelic.postLogEventToNewRelic(logEvent);

            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'X-Log-Header': 'log-val' })
                })
            );
        });

        test('should post log event with static attributes', async () => {
            const logEvent = {
                source: 'qseow-engine',
                level: 'ERROR',
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.url') return 'https://nr.com';
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.enable') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.destinationAccount') return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [{ accountName: 'account1', accountId: '12345', insertApiKey: 'key' }];
                if (path === 'Butler-SOS.newRelic.event.attribute.static') return [{ name: 'env', value: 'prod' }];
                if (path === 'Butler-SOS.logEvents.tags') return [{ name: 'tag1', value: 'val1' }];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.attribute.static') return true;
                if (path === 'Butler-SOS.logEvents.tags') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error') return true;
                return false;
            });

            axios.post.mockResolvedValue({ status: 200 });

            await newRelic.postLogEventToNewRelic(logEvent);

            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    env: 'prod',
                    tag1: 'val1'
                }),
                expect.any(Object)
            );
        });

        test('should handle missing account config', async () => {
            const logEvent = {
                source: 'qseow-engine',
                level: 'ERROR',
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.url') return 'https://nr.com';
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.enable') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.destinationAccount') return ['missing_account'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic') return [];
                if (path === 'Butler-SOS.logEvents.tags') return [];
                if (path === 'Butler-SOS.newRelic.event.attribute.static') return [];
                if (path === 'Butler-SOS.newRelic.event.header') return [];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.logEvents.tags') return true;
                if (path === 'Butler-SOS.newRelic.event.attribute.static') return true;
                if (path === 'Butler-SOS.newRelic.event.header') return true;
                return true;
            });

            await newRelic.postLogEventToNewRelic(logEvent);

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('New Relic config "missing_account" does not exist')
            );
        });

        test('should handle log event posting errors', async () => {
            const logEvent = {
                source: 'qseow-engine',
                level: 'ERROR',
                host: 'server1.example.com',
            };

            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.newRelic.event.url')
                    return 'https://insights-collector.newrelic.com/';
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.enable')
                    return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error')
                    return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.destinationAccount')
                    return ['account1'];
                if (path === 'Butler-SOS.thirdPartyToolsCredentials.newRelic')
                    return [
                        {
                            accountName: 'account1',
                            accountId: '12345',
                            insertApiKey: 'test-insert-key',
                        },
                    ];
                return undefined;
            });

            globals.config.has.mockImplementation((path) => {
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error')
                    return true;
                return false;
            });

            // Mock axios to throw error
            const networkError = new Error('Log event posting failed');
            axios.post.mockRejectedValue(networkError);

            // Execute
            await newRelic.postLogEventToNewRelic(logEvent);

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('LOG EVENT NEW RELIC: Error saving event to New Relic!')
            );
        });
    });
});
