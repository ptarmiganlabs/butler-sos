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
});
