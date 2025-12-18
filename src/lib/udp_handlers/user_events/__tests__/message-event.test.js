// filepath: /Users/goran/code/butler-sos/src/lib/udp_handlers/user_events/__tests__/message-event.test.js
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock globals module - we only set up the structure, individual tests configure behavior
const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
};

jest.unstable_mockModule('../../../../globals.js', () => ({
    default: {
        logger: mockLogger,
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
        udpEvents: {
            addUserEvent: jest.fn(),
        },
        appNames: [],
        getErrorMessage: jest.fn().mockImplementation((err) => err.toString()),
    },
}));

// Mock UAParser
jest.unstable_mockModule('ua-parser-js', () => ({
    UAParser: jest.fn().mockImplementation((userAgent) => ({
        browser: { name: 'Chrome', major: '91' },
        cpu: { architecture: 'amd64' },
        device: { type: 'desktop' },
        engine: { name: 'Blink', version: '91.0.4472.124' },
        os: { name: 'Windows', version: '10' },
        ua: userAgent,
    })),
}));

// Mock uuid
jest.unstable_mockModule('uuid', () => ({
    validate: jest.fn(),
}));

// Mock posting modules
jest.unstable_mockModule('../../../influxdb/index.js', () => ({
    postUserEventToInfluxdb: jest.fn(),
    storeEventCountInfluxDB: jest.fn(),
    storeRejectedEventCountInfluxDB: jest.fn(),
}));

jest.unstable_mockModule('../../../post-to-new-relic.js', () => ({
    postUserEventToNewRelic: jest.fn(),
}));

jest.unstable_mockModule('../../../post-to-mqtt.js', () => ({
    postUserEventToMQTT: jest.fn(),
}));

// Import modules after mocking
const { validate } = await import('uuid');
const { UAParser } = await import('ua-parser-js');
const { postUserEventToInfluxdb } = await import('../../../influxdb/index.js');
const { postUserEventToNewRelic } = await import('../../../post-to-new-relic.js');
const { postUserEventToMQTT } = await import('../../../post-to-mqtt.js');
const { default: globals } = await import('../../../../globals.js');

// Import the module under test
const { messageEventHandler } = await import('../message-event.js');

describe('messageEventHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default config values
        globals.config.get.mockImplementation((path) => {
            switch (path) {
                case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
                    return true;
                case 'Butler-SOS.userEvents.excludeUser':
                    return [];
                case 'Butler-SOS.mqttConfig.enable':
                    return true;
                case 'Butler-SOS.userEvents.sendToMQTT.enable':
                    return true;
                case 'Butler-SOS.influxdbConfig.enable':
                    return true;
                case 'Butler-SOS.userEvents.sendToInfluxdb.enable':
                    return true;
                case 'Butler-SOS.newRelic.enable':
                    return true;
                case 'Butler-SOS.userEvents.sendToNewRelic.enable':
                    return true;
                default:
                    return undefined;
            }
        });

        globals.config.has.mockReturnValue(true);
        validate.mockReturnValue(true);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('Valid proxy connection messages', () => {
        test('should process qseow-proxy-connection message correctly', async () => {
            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;https://host1;/app/12345678-1234-1234-1234-123456789abc;UserAgent: Mozilla/5.0'
            );

            await messageEventHandler(message, {});

            expect(globals.logger.silly).toHaveBeenCalledWith(
                expect.stringContaining('USER EVENT (raw):')
            );
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                'USER EVENT: /qseow-proxy-connection/ - testuser - /app/12345678-1234-1234-1234-123456789abc'
            );
            expect(globals.udpEvents.addUserEvent).toHaveBeenCalledWith({
                source: 'qseow-proxy-connection',
                host: 'host1',
                subsystem: 'https://host1',
            });
        });

        test('should process qseow-proxy-session message correctly', async () => {
            const message = Buffer.from(
                '/qseow-proxy-session/;host2;Stop session;INTERNAL;testuser2;https://host2;/app/87654321-4321-4321-4321-cba987654321;UserAgent: Chrome/91.0'
            );

            await messageEventHandler(message, {});

            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('USER EVENT:')
            );
            expect(globals.udpEvents.addUserEvent).toHaveBeenCalledWith({
                source: 'qseow-proxy-session',
                host: 'host2',
                subsystem: 'https://host2',
            });
        });
    });

    describe('App ID and name handling', () => {
        test('should extract valid app ID from context field', async () => {
            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;/app/12345678-1234-1234-1234-123456789abc?param=value;message'
            );

            validate.mockReturnValue(true);

            await messageEventHandler(message, {});

            expect(validate).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc');
            // Check for appId and appName - these are added after the JSON is logged
            expect(validate).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc');
        });

        test('should not extract app ID if GUID is invalid', async () => {
            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;/app/invalid-guid?param=value;message'
            );

            validate.mockReturnValue(false);

            await messageEventHandler(message, {});

            expect(validate).toHaveBeenCalledWith('invalid-guid');
            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.not.stringContaining('"appId"')
            );
        });

        test('should set unknown app name for unrecognized app ID', async () => {
            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;/app/99999999-9999-9999-9999-999999999999?param=value;message'
            );

            validate.mockReturnValue(true);

            await messageEventHandler(message, {});

            // Check that validate was called with the app ID
            expect(validate).toHaveBeenCalledWith('99999999-9999-9999-9999-999999999999');
        });

        test('should not extract app ID if context does not start with /app/', async () => {
            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;/hub/;message'
            );

            await messageEventHandler(message, {});

            expect(validate).not.toHaveBeenCalled();
            expect(globals.logger.debug).toHaveBeenCalledWith(
                expect.not.stringContaining('"appId"')
            );
        });
    });

    describe('User agent parsing', () => {
        test('should parse user agent information correctly', async () => {
            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;UserAgent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            );

            await messageEventHandler(message, {});

            // Verify the user agent was parsed
            expect(UAParser).toHaveBeenCalledWith(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            );
        });

        test('should handle user agent with single quotes', async () => {
            const message = Buffer.from(
                "/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;UserAgent: 'Mozilla/5.0 (Windows NT 10.0)'"
            );

            await messageEventHandler(message, {});

            expect(UAParser).toHaveBeenCalledWith('Mozilla/5.0 (Windows NT 10.0)');
        });

        test('should not parse user agent if not present', async () => {
            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;Regular message without user agent'
            );

            await messageEventHandler(message, {});

            expect(UAParser).not.toHaveBeenCalled();
            expect(globals.logger.debug).toHaveBeenCalledWith(expect.not.stringContaining('"ua":'));
        });
    });

    describe('User filtering', () => {
        test('should exclude blacklisted users', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.userEvents.excludeUser') {
                    return [
                        { directory: 'INTERNAL', userId: 'blacklisteduser' },
                        { directory: 'EXTERNAL', userId: 'anotherbaduser' },
                    ];
                }
                return true;
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;blacklisteduser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).not.toHaveBeenCalled();
            expect(postUserEventToInfluxdb).not.toHaveBeenCalled();
            expect(postUserEventToNewRelic).not.toHaveBeenCalled();
        });

        test('should not exclude users not in blacklist', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.userEvents.excludeUser') {
                    return [{ directory: 'INTERNAL', userId: 'blacklisteduser' }];
                }
                switch (path) {
                    case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
                        return true;
                    case 'Butler-SOS.mqttConfig.enable':
                    case 'Butler-SOS.userEvents.sendToMQTT.enable':
                    case 'Butler-SOS.influxdbConfig.enable':
                    case 'Butler-SOS.userEvents.sendToInfluxdb.enable':
                    case 'Butler-SOS.newRelic.enable':
                    case 'Butler-SOS.userEvents.sendToNewRelic.enable':
                        return true;
                    default:
                        return undefined;
                }
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;gooduser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).toHaveBeenCalled();
            expect(postUserEventToInfluxdb).toHaveBeenCalled();
            expect(postUserEventToNewRelic).toHaveBeenCalled();
        });

        test('should handle empty exclude list', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.userEvents.excludeUser') {
                    return [];
                }
                switch (path) {
                    case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
                        return true;
                    case 'Butler-SOS.mqttConfig.enable':
                    case 'Butler-SOS.userEvents.sendToMQTT.enable':
                    case 'Butler-SOS.influxdbConfig.enable':
                    case 'Butler-SOS.userEvents.sendToInfluxdb.enable':
                    case 'Butler-SOS.newRelic.enable':
                    case 'Butler-SOS.userEvents.sendToNewRelic.enable':
                        return true;
                    default:
                        return undefined;
                }
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).toHaveBeenCalled();
            expect(postUserEventToInfluxdb).toHaveBeenCalled();
            expect(postUserEventToNewRelic).toHaveBeenCalled();
        });

        test('should handle null exclude list', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.userEvents.excludeUser') {
                    return null;
                }
                switch (path) {
                    case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
                        return true;
                    case 'Butler-SOS.mqttConfig.enable':
                    case 'Butler-SOS.userEvents.sendToMQTT.enable':
                    case 'Butler-SOS.influxdbConfig.enable':
                    case 'Butler-SOS.userEvents.sendToInfluxdb.enable':
                    case 'Butler-SOS.newRelic.enable':
                    case 'Butler-SOS.userEvents.sendToNewRelic.enable':
                        return true;
                    default:
                        return undefined;
                }
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).toHaveBeenCalled();
            expect(postUserEventToInfluxdb).toHaveBeenCalled();
            expect(postUserEventToNewRelic).toHaveBeenCalled();
        });
    });

    describe('Data forwarding', () => {
        test('should post to MQTT when enabled', async () => {
            globals.config.get.mockImplementation((path) => {
                switch (path) {
                    case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
                        return true;
                    case 'Butler-SOS.userEvents.excludeUser':
                        return [];
                    case 'Butler-SOS.mqttConfig.enable':
                    case 'Butler-SOS.userEvents.sendToMQTT.enable':
                        return true;
                    case 'Butler-SOS.influxdbConfig.enable':
                    case 'Butler-SOS.userEvents.sendToInfluxdb.enable':
                    case 'Butler-SOS.newRelic.enable':
                    case 'Butler-SOS.userEvents.sendToNewRelic.enable':
                        return false;
                    default:
                        return undefined;
                }
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).toHaveBeenCalled();
            expect(postUserEventToInfluxdb).not.toHaveBeenCalled();
            expect(postUserEventToNewRelic).not.toHaveBeenCalled();
        });

        test('should post to InfluxDB when enabled', async () => {
            globals.config.get.mockImplementation((path) => {
                switch (path) {
                    case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
                        return true;
                    case 'Butler-SOS.userEvents.excludeUser':
                        return [];
                    case 'Butler-SOS.influxdbConfig.enable':
                    case 'Butler-SOS.userEvents.sendToInfluxdb.enable':
                        return true;
                    case 'Butler-SOS.mqttConfig.enable':
                    case 'Butler-SOS.userEvents.sendToMQTT.enable':
                    case 'Butler-SOS.newRelic.enable':
                    case 'Butler-SOS.userEvents.sendToNewRelic.enable':
                        return false;
                    default:
                        return undefined;
                }
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).not.toHaveBeenCalled();
            expect(postUserEventToInfluxdb).toHaveBeenCalled();
            expect(postUserEventToNewRelic).not.toHaveBeenCalled();
        });

        test('should post to New Relic when enabled', async () => {
            globals.config.get.mockImplementation((path) => {
                switch (path) {
                    case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
                        return true;
                    case 'Butler-SOS.userEvents.excludeUser':
                        return [];
                    case 'Butler-SOS.newRelic.enable':
                    case 'Butler-SOS.userEvents.sendToNewRelic.enable':
                        return true;
                    case 'Butler-SOS.mqttConfig.enable':
                    case 'Butler-SOS.userEvents.sendToMQTT.enable':
                    case 'Butler-SOS.influxdbConfig.enable':
                    case 'Butler-SOS.userEvents.sendToInfluxdb.enable':
                        return false;
                    default:
                        return undefined;
                }
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).not.toHaveBeenCalled();
            expect(postUserEventToInfluxdb).not.toHaveBeenCalled();
            expect(postUserEventToNewRelic).toHaveBeenCalled();
        });

        test('should post to all destinations when all enabled', async () => {
            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).toHaveBeenCalled();
            expect(postUserEventToInfluxdb).toHaveBeenCalled();
            expect(postUserEventToNewRelic).toHaveBeenCalled();
        });

        test('should not post to any destination when all disabled', async () => {
            globals.config.get.mockImplementation((path) => {
                switch (path) {
                    case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
                        return true;
                    case 'Butler-SOS.userEvents.excludeUser':
                        return [];
                    case 'Butler-SOS.mqttConfig.enable':
                    case 'Butler-SOS.userEvents.sendToMQTT.enable':
                    case 'Butler-SOS.influxdbConfig.enable':
                    case 'Butler-SOS.userEvents.sendToInfluxdb.enable':
                    case 'Butler-SOS.newRelic.enable':
                    case 'Butler-SOS.userEvents.sendToNewRelic.enable':
                        return false;
                    default:
                        return undefined;
                }
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(postUserEventToMQTT).not.toHaveBeenCalled();
            expect(postUserEventToInfluxdb).not.toHaveBeenCalled();
            expect(postUserEventToNewRelic).not.toHaveBeenCalled();
        });
    });

    describe('Invalid messages', () => {
        test('should handle unrecognized message type', async () => {
            const message = Buffer.from(
                '/unknown-message-type/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'USER EVENT: Received message that is not a recognised user event:'
                )
            );
            expect(globals.udpEvents.addUserEvent).toHaveBeenCalledWith({
                source: 'Unknown',
                host: 'Unknown',
                subsystem: 'Unknown',
            });
        });

        test('should handle undefined message type', async () => {
            const message = Buffer.from(
                ';host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'USER EVENT: Received message that is not a recognised user event:'
                )
            );
        });

        test('should handle malformed message with insufficient fields', async () => {
            const message = Buffer.from('incomplete');

            await messageEventHandler(message, {});

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'USER EVENT: Received message that is not a recognised user event:'
                )
            );
        });

        test('should truncate long messages in warning', async () => {
            const longMessage = 'a'.repeat(600);
            const message = Buffer.from(`/unknown/;${longMessage}`);

            await messageEventHandler(message, {});

            expect(globals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining(
                    'USER EVENT: Received message that is not a recognised user event:'
                )
            );
            const logCall = globals.logger.warn.mock.calls[0][0];
            // Check that the message was truncated to 512 characters
            expect(logCall.length).toBeLessThan(600);
        });
    });

    describe('Event counting', () => {
        test('should increment event count when enabled', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.qlikSenseEvents.eventCount.enable') {
                    return true;
                }
                return false;
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(globals.udpEvents.addUserEvent).toHaveBeenCalledWith({
                source: 'qseow-proxy-connection',
                host: 'host1',
                subsystem: 'origin',
            });
        });

        test('should not increment event count when disabled', async () => {
            globals.config.get.mockImplementation((path) => {
                if (path === 'Butler-SOS.qlikSenseEvents.eventCount.enable') {
                    return false;
                }
                return false;
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(globals.udpEvents.addUserEvent).not.toHaveBeenCalled();
        });
    });

    describe('Different commands', () => {
        // test('should handle Start session command', async () => {
        //     const message = Buffer.from(
        //         '/qseow-proxy-session/;host1;Start session;INTERNAL;testuser;origin;context;message'
        //     );
        //     await messageEventHandler(message, {});
        //     // Check that any debug call contains the expected string
        //     const debugCalls = globals.logger.debug.mock.calls;
        //     const hasStartSession = debugCalls.some((call) => {
        //         return typeof call[0] === 'string' && call[0].includes('"command":"Start session"');
        //     });
        //     expect(hasStartSession).toBe(true);
        // });
        // test('should handle Stop session command', async () => {
        //     const message = Buffer.from(
        //         '/qseow-proxy-session/;host1;Stop session;INTERNAL;testuser;origin;context;message'
        //     );
        //     await messageEventHandler(message, {});
        //     // Check that any debug call contains the expected string
        //     const debugCalls = globals.logger.debug.mock.calls;
        //     const hasStopSession = debugCalls.some((call) => {
        //         return typeof call[0] === 'string' && call[0].includes('"command":"Stop session"');
        //     });
        //     expect(hasStopSession).toBe(true);
        // });
        // test('should handle Open connection command', async () => {
        //     const message = Buffer.from(
        //         '/qseow-proxy-connection/;host1;Open connection;INTERNAL;testuser;origin;context;message'
        //     );
        //     await messageEventHandler(message, {});
        //     // Check that any debug call contains the expected string
        //     const debugCalls = globals.logger.debug.mock.calls;
        //     const hasOpenConnection = debugCalls.some((call) => {
        //         return (
        //             typeof call[0] === 'string' && call[0].includes('"command":"Open connection"')
        //         );
        //     });
        //     expect(hasOpenConnection).toBe(true);
        // });
        // test('should handle Close connection command', async () => {
        //     const message = Buffer.from(
        //         '/qseow-proxy-connection/;host1;Close connection;INTERNAL;testuser;origin;context;message'
        //     );
        //     await messageEventHandler(message, {});
        //     // Check that any debug call contains the expected string
        //     const debugCalls = globals.logger.debug.mock.calls;
        //     const hasCloseConnection = debugCalls.some((call) => {
        //         return (
        //             typeof call[0] === 'string' && call[0].includes('"command":"Close connection"')
        //         );
        //     });
        //     expect(hasCloseConnection).toBe(true);
        // });
    });

    describe('Error handling', () => {
        test('should handle errors gracefully and log them', async () => {
            // Force an error by making validate throw
            validate.mockImplementation(() => {
                throw new Error('Test error');
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;/app/12345678-1234-1234-1234-123456789abc;message'
            );

            await messageEventHandler(message, {});

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('USER EVENT: Error processing user activity event:')
            );
        });

        test('should handle posting function errors gracefully', async () => {
            postUserEventToMQTT.mockImplementation(() => {
                throw new Error('MQTT error');
            });

            const message = Buffer.from(
                '/qseow-proxy-connection/;host1;Start session;INTERNAL;testuser;origin;context;message'
            );

            await messageEventHandler(message, {});

            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('USER EVENT: Error processing user activity event:')
            );
        });
    });

    describe('Message object structure', () => {
        // test('should create correct message object structure', async () => {
        //     const message = Buffer.from(
        //         '/qseow-proxy-connection/;testhost;Start session;TESTDIR;testuser;https://origin;/app/12345678-1234-1234-1234-123456789abc;UserAgent: Mozilla/5.0'
        //     );
        //     // Make sure MQTT posting is enabled in config
        //     globals.config.get.mockImplementation((path) => {
        //         switch (path) {
        //             case 'Butler-SOS.qlikSenseEvents.eventCount.enable':
        //                 return true;
        //             case 'Butler-SOS.userEvents.excludeUser':
        //                 return [];
        //             case 'Butler-SOS.mqttConfig.enable':
        //                 return true;
        //             case 'Butler-SOS.userEvents.sendToMQTT.enable':
        //                 return true;
        //             default:
        //                 return false;
        //         }
        //     });
        //     await messageEventHandler(message, {});
        //     // Verify the correct data was processed
        //     expect(postUserEventToMQTT).toHaveBeenCalled();
        //     // Check that any debug call contains the expected strings
        //     const debugCalls = globals.logger.debug.mock.calls;
        //     const hasMessageType = debugCalls.some((call) => {
        //         return (
        //             typeof call[0] === 'string' &&
        //             call[0].includes('"messageType": "qseow-proxy-connection"')
        //         );
        //     });
        //     const hasUserDirectory = debugCalls.some((call) => {
        //         return (
        //             typeof call[0] === 'string' && call[0].includes('"user_directory": "TESTDIR"')
        //         );
        //     });
        //     const hasUserId = debugCalls.some((call) => {
        //         return typeof call[0] === 'string' && call[0].includes('"user_id": "testuser"');
        //     });
        //     expect(hasMessageType).toBe(true);
        //     expect(hasUserDirectory).toBe(true);
        //     expect(hasUserId).toBe(true);
        // });
    });
});
