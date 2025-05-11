import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock the globals module
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        },
        mqttClient: {
            publish: jest.fn(),
        },
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
    },
}));
const globals = (await import('../../globals.js')).default;

// Import the module under test
const { postHealthToMQTT, postUserSessionsToMQTT, postUserEventToMQTT } = await import(
    '../post-to-mqtt.js'
);

describe('post-to-mqtt', () => {
    beforeEach(() => {
        // Setup default config values
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.mqttConfig.baseTopic') {
                return 'butler-sos/';
            } else if (path === 'Butler-SOS.userEvents.sendToMQTT.postTo.everythingTopic.enable') {
                return true;
            } else if (path === 'Butler-SOS.userEvents.sendToMQTT.postTo.everythingTopic.topic') {
                return 'butler-sos/userevents/everything';
            } else if (
                path === 'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStartTopic.enable'
            ) {
                return true;
            } else if (path === 'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStartTopic.topic') {
                return 'butler-sos/userevents/session/start';
            } else if (path === 'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStopTopic.enable') {
                return true;
            } else if (path === 'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStopTopic.topic') {
                return 'butler-sos/userevents/session/stop';
            } else if (
                path === 'Butler-SOS.userEvents.sendToMQTT.postTo.connectionOpenTopic.enable'
            ) {
                return true;
            } else if (
                path === 'Butler-SOS.userEvents.sendToMQTT.postTo.connectionOpenTopic.topic'
            ) {
                return 'butler-sos/userevents/connection/open';
            } else if (
                path === 'Butler-SOS.userEvents.sendToMQTT.postTo.connectionCloseTopic.enable'
            ) {
                return true;
            } else if (
                path === 'Butler-SOS.userEvents.sendToMQTT.postTo.connectionCloseTopic.topic'
            ) {
                return 'butler-sos/userevents/connection/close';
            } else if (path === 'Butler-SOS.userEvents.tags') {
                return [
                    { name: 'environment', value: 'production' },
                    { name: 'region', value: 'eu-west' },
                ];
            }
            return undefined;
        });

        globals.config.has.mockReturnValue(true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('postHealthToMQTT', () => {
        test('should publish health metrics to MQTT topics', () => {
            // Setup test data
            const host = 'qlikserver.example.com';
            const serverName = 'qlik1';
            const healthData = {
                version: '13.95.4',
                started: '2023-01-01T10:00:00.000Z',
                mem: {
                    committed: 5000,
                    allocated: 8000,
                    free: 3000,
                },
                cpu: {
                    total: 25.5,
                },
                session: {
                    active: 10,
                    total: 50,
                },
                apps: {
                    active_docs: 5,
                    loaded_docs: 15,
                    in_memory_docs: 8,
                    calls: 100,
                    selections: 200,
                },
                users: {
                    active: 20,
                    total: 100,
                },
                cache: {
                    hits: 150,
                    lookups: 200,
                    added: 50,
                    replaced: 25,
                    bytes_added: 1024,
                },
                saturated: 0,
            };

            // Call the function being tested
            postHealthToMQTT(host, serverName, healthData);

            // Verify MQTT messages were published with the correct topics and payloads
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/version',
                '13.95.4'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/started',
                '2023-01-01T10:00:00.000Z'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/mem/comitted',
                '5000'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/mem/allocated',
                '8000'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/mem/free',
                '3000'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/cpu/total',
                '25.5'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/session/active',
                '10'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/session/total',
                '50'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/apps/active_docs',
                '5'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/apps/loaded_docs',
                '15'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/apps/in_memory_docs',
                '8'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/apps/calls',
                '100'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/apps/selections',
                '200'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/users/active',
                '20'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/users/total',
                '100'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/cache/hits',
                '150'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/cache/lookups',
                '200'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/cache/added',
                '50'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/cache/replaced',
                '25'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/cache/bytes_added',
                '1024'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/cache/hit_ratio',
                '75'
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlik1/saturated',
                '0'
            );
        });

        test('should handle cache hit ratio calculation when lookups is 0', () => {
            // Setup test data with 0 lookups
            const host = 'qlikserver.example.com';
            const serverName = 'qlik1';
            const healthData = {
                version: '13.95.4',
                started: '2023-01-01T10:00:00.000Z',
                mem: {
                    committed: 5000,
                    allocated: 8000,
                    free: 3000,
                },
                cpu: {
                    total: 25.5,
                },
                session: {
                    active: 10,
                    total: 50,
                },
                apps: {
                    active_docs: 5,
                    loaded_docs: 15,
                    in_memory_docs: 8,
                    calls: 100,
                    selections: 200,
                },
                users: {
                    active: 20,
                    total: 100,
                },
                cache: {
                    hits: 0,
                    lookups: 0,
                    added: 0,
                    replaced: 0,
                    bytes_added: 0,
                },
                saturated: 0,
            };

            // Call the function being tested
            postHealthToMQTT(host, serverName, healthData);

            // Verify hit_ratio was not published (lookups is 0)
            const publishCalls = globals.mqttClient.publish.mock.calls.map((call) => call[0]);
            expect(publishCalls).not.toContain('butler-sos/qlik1/cache/hit_ratio');
        });
    });

    describe('postUserSessionsToMQTT', () => {
        test('should publish user session data to MQTT topic', () => {
            // Setup test data
            const host = 'qlikserver.example.com';
            const virtualProxy = '/vptest';
            const sessionData = JSON.stringify({
                active: 15,
                total: 30,
            });

            // Call the function being tested
            postUserSessionsToMQTT(host, virtualProxy, sessionData);

            // Verify MQTT message was published with the correct topic and payload
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/qlikserver.example.com/usersession/vptest',
                sessionData
            );
        });
    });

    describe('postUserEventToMQTT', () => {
        test('should publish user event to the everything topic', () => {
            // Setup test data
            const userEvent = {
                messageType: 'user-event',
                host: 'qlikserver.example.com',
                command: 'Generic command',
                user_directory: 'INTERNAL',
                user_id: 'sa_admin',
                origin: 'qlik',
                context: 'session',
                message: 'User action performed',
            };

            // Call the function being tested
            postUserEventToMQTT(userEvent);

            // Verify MQTT message was published to the everything topic
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/everything',
                expect.stringContaining('"messageType":"user-event"')
            );

            // Verify custom tags were added to the payload
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"environment":"production"')
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"region":"eu-west"')
            );
        });

        test('should publish session start event to the session start topic', () => {
            // Setup test data
            const userEvent = {
                messageType: 'user-event',
                host: 'qlikserver.example.com',
                command: 'Start session',
                user_directory: 'INTERNAL',
                user_id: 'sa_admin',
                origin: 'qlik',
                context: 'session',
                message: 'Session started',
            };

            // Call the function being tested
            postUserEventToMQTT(userEvent);

            // Verify MQTT message was published to both the everything topic and session start topic
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/everything',
                expect.any(String)
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/session/start',
                expect.any(String)
            );
        });

        test('should publish session stop event to the session stop topic', () => {
            // Setup test data
            const userEvent = {
                messageType: 'user-event',
                host: 'qlikserver.example.com',
                command: 'Stop session',
                user_directory: 'INTERNAL',
                user_id: 'sa_admin',
                origin: 'qlik',
                context: 'session',
                message: 'Session stopped',
            };

            // Call the function being tested
            postUserEventToMQTT(userEvent);

            // Verify MQTT message was published to both the everything topic and session stop topic
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/everything',
                expect.any(String)
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/session/stop',
                expect.any(String)
            );
        });

        test('should publish connection open event to the connection open topic', () => {
            // Setup test data
            const userEvent = {
                messageType: 'user-event',
                host: 'qlikserver.example.com',
                command: 'Open connection',
                user_directory: 'INTERNAL',
                user_id: 'sa_admin',
                origin: 'qlik',
                context: 'connection',
                message: 'Connection opened',
            };

            // Call the function being tested
            postUserEventToMQTT(userEvent);

            // Verify MQTT message was published to both the everything topic and connection open topic
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/everything',
                expect.any(String)
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/connection/open',
                expect.any(String)
            );
        });

        test('should publish connection close event to the connection close topic', () => {
            // Setup test data
            const userEvent = {
                messageType: 'user-event',
                host: 'qlikserver.example.com',
                command: 'Close connection',
                user_directory: 'INTERNAL',
                user_id: 'sa_admin',
                origin: 'qlik',
                context: 'connection',
                message: 'Connection closed',
            };

            // Call the function being tested
            postUserEventToMQTT(userEvent);

            // Verify MQTT message was published to both the everything topic and connection close topic
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/everything',
                expect.any(String)
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                'butler-sos/userevents/connection/close',
                expect.any(String)
            );
        });

        test('should handle app ID and name when present', () => {
            // Setup test data with app info
            const userEvent = {
                messageType: 'user-event',
                host: 'qlikserver.example.com',
                command: 'Open connection',
                user_directory: 'INTERNAL',
                user_id: 'sa_admin',
                origin: 'qlik',
                context: 'connection',
                message: 'Connection opened',
                appId: '12345-67890',
                appName: 'Sales Dashboard',
            };

            // Call the function being tested
            postUserEventToMQTT(userEvent);

            // Verify app info was included in the payload
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"appId":"12345-67890"')
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"appName":"Sales Dashboard"')
            );
        });

        test('should handle user agent info when present', () => {
            // Setup test data with user agent info
            const userEvent = {
                messageType: 'user-event',
                host: 'qlikserver.example.com',
                command: 'Open connection',
                user_directory: 'INTERNAL',
                user_id: 'sa_admin',
                origin: 'qlik',
                context: 'connection',
                message: 'Connection opened',
                ua: {
                    browser: {
                        name: 'Chrome',
                        major: '90',
                    },
                    os: {
                        name: 'Windows',
                        version: '10',
                    },
                },
            };

            // Call the function being tested
            postUserEventToMQTT(userEvent);

            // Verify user agent info was included in the payload
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"uaBrowserName":"Chrome"')
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"uaBrowserMajorVersion":"90"')
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"uaOsName":"Windows"')
            );
            expect(globals.mqttClient.publish).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('"uaOsVersion":"10"')
            );
        });

        test('should handle errors during publishing', () => {
            // Force an error by making the MQTT client throw
            globals.mqttClient.publish.mockImplementation(() => {
                throw new Error('MQTT publish error');
            });

            // Setup test data
            const userEvent = {
                messageType: 'user-event',
                host: 'qlikserver.example.com',
                command: 'Generic command',
                user_directory: 'INTERNAL',
                user_id: 'sa_admin',
                origin: 'qlik',
                context: 'session',
                message: 'User action performed',
            };

            // Call the function being tested
            postUserEventToMQTT(userEvent);

            // Verify error was logged
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('USER EVENT MQTT: Failed posting message to MQTT')
            );
        });
    });
});
