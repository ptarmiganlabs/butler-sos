import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalsPath = path.resolve(__dirname, '../../../../globals.js');

const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
};

const mockConfigGet = jest.fn();

jest.unstable_mockModule(globalsPath, () => ({
    default: {
        logger: mockLogger,
        config: {
            get: mockConfigGet,
        },
    },
}));

const { publishToDestinations } = await import('../event-publisher.js');
const globals = (await import(globalsPath)).default;

describe('publishToDestinations', () => {
    let mockMqtt;
    let mockInfluxdb;
    let mockNewRelic;
    let testEventData;

    beforeEach(() => {
        jest.clearAllMocks();

        mockMqtt = jest.fn();
        mockInfluxdb = jest.fn();
        mockNewRelic = jest.fn();
        testEventData = { source: 'test', message: 'test message' };
    });

    describe('All destinations enabled', () => {
        test('should call all publishers when all destinations are enabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return true;
                if (key === 'Butler-SOS.newRelic.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToNewRelic.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockMqtt).toHaveBeenCalledWith(testEventData);
            expect(mockInfluxdb).toHaveBeenCalledWith(testEventData);
            expect(mockNewRelic).toHaveBeenCalledWith(testEventData);
        });
    });

    describe('All destinations disabled', () => {
        test('should not call any publishers when all destinations are disabled', () => {
            mockConfigGet.mockImplementation(() => false);

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockMqtt).not.toHaveBeenCalled();
            expect(mockInfluxdb).not.toHaveBeenCalled();
            expect(mockNewRelic).not.toHaveBeenCalled();
        });
    });

    describe('Individual destination enabled', () => {
        test('should call only MQTT when only MQTT is enabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockMqtt).toHaveBeenCalledWith(testEventData);
            expect(mockInfluxdb).not.toHaveBeenCalled();
            expect(mockNewRelic).not.toHaveBeenCalled();
        });

        test('should call only InfluxDB when only InfluxDB is enabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockMqtt).not.toHaveBeenCalled();
            expect(mockInfluxdb).toHaveBeenCalledWith(testEventData);
            expect(mockNewRelic).not.toHaveBeenCalled();
        });

        test('should call only New Relic when only New Relic is enabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.newRelic.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToNewRelic.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockMqtt).not.toHaveBeenCalled();
            expect(mockInfluxdb).not.toHaveBeenCalled();
            expect(mockNewRelic).toHaveBeenCalledWith(testEventData);
        });
    });

    describe('Global enable vs per-event enable', () => {
        test('should NOT call MQTT when global is disabled but per-event is enabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return false;
                if (key === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockMqtt).not.toHaveBeenCalled();
        });

        test('should NOT call MQTT when global is enabled but per-event is disabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToMQTT.enable') return false;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockMqtt).not.toHaveBeenCalled();
        });

        test('should NOT call InfluxDB when global is disabled but per-event is enabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockInfluxdb).not.toHaveBeenCalled();
        });

        test('should NOT call InfluxDB when global is enabled but per-event is disabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return false;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockInfluxdb).not.toHaveBeenCalled();
        });

        test('should NOT call New Relic when global is disabled but per-event is enabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.newRelic.enable') return false;
                if (key === 'Butler-SOS.logEvents.sendToNewRelic.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockNewRelic).not.toHaveBeenCalled();
        });

        test('should NOT call New Relic when global is enabled but per-event is disabled', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.newRelic.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToNewRelic.enable') return false;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(mockNewRelic).not.toHaveBeenCalled();
        });
    });

    describe('Missing publisher functions', () => {
        test('should not error when MQTT publisher is not provided', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
                return false;
            });

            expect(() => {
                publishToDestinations(testEventData, 'logEvents', {
                    influxdb: mockInfluxdb,
                    newRelic: mockNewRelic,
                });
            }).not.toThrow();
        });

        test('should not error when InfluxDB publisher is not provided', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return true;
                return false;
            });

            expect(() => {
                publishToDestinations(testEventData, 'logEvents', {
                    mqtt: mockMqtt,
                    newRelic: mockNewRelic,
                });
            }).not.toThrow();
        });

        test('should not error when New Relic publisher is not provided', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.newRelic.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToNewRelic.enable') return true;
                return false;
            });

            expect(() => {
                publishToDestinations(testEventData, 'logEvents', {
                    mqtt: mockMqtt,
                    influxdb: mockInfluxdb,
                });
            }).not.toThrow();
        });

        test('should not error when no publishers are provided', () => {
            mockConfigGet.mockImplementation(() => true);

            expect(() => {
                publishToDestinations(testEventData, 'logEvents', {});
            }).not.toThrow();
        });
    });

    describe('Event type config key usage', () => {
        test('should use logEvents config keys when eventType is logEvents', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
            });

            expect(mockConfigGet).toHaveBeenCalledWith('Butler-SOS.logEvents.sendToMQTT.enable');
            expect(mockMqtt).toHaveBeenCalledWith(testEventData);
        });

        test('should use userEvents config keys when eventType is userEvents', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.userEvents.sendToMQTT.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'userEvents', {
                mqtt: mockMqtt,
            });

            expect(mockConfigGet).toHaveBeenCalledWith('Butler-SOS.userEvents.sendToMQTT.enable');
            expect(mockMqtt).toHaveBeenCalledWith(testEventData);
        });

        test('should not call publisher when logEvents is enabled but userEvents is not (and vice versa)', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
                if (key === 'Butler-SOS.userEvents.sendToMQTT.enable') return false;
                return false;
            });

            publishToDestinations(testEventData, 'userEvents', {
                mqtt: mockMqtt,
            });

            expect(mockMqtt).not.toHaveBeenCalled();
        });
    });

    describe('Debug logging', () => {
        test('should log debug message when publishing to MQTT', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
            });

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'LOG EVENT: Calling log event MQTT posting method'
            );
        });

        test('should log debug message when publishing to InfluxDB', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                influxdb: mockInfluxdb,
            });

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'LOG EVENT: Calling log event InfluxDB posting method'
            );
        });

        test('should log debug message when publishing to New Relic', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.newRelic.enable') return true;
                if (key === 'Butler-SOS.logEvents.sendToNewRelic.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'logEvents', {
                newRelic: mockNewRelic,
            });

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'LOG EVENT: Calling log event New Relic posting method'
            );
        });

        test('should use formatted eventType in debug messages', () => {
            mockConfigGet.mockImplementation((key) => {
                if (key === 'Butler-SOS.mqttConfig.enable') return true;
                if (key === 'Butler-SOS.userEvents.sendToMQTT.enable') return true;
                return false;
            });

            publishToDestinations(testEventData, 'userEvents', {
                mqtt: mockMqtt,
            });

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'USER EVENT: Calling user event MQTT posting method'
            );
        });
    });

    describe('Fire-and-forget semantics', () => {
        test('should call publishers synchronously (no await)', () => {
            mockConfigGet.mockImplementation(() => true);

            const callOrder = [];
            mockMqtt.mockImplementation(() => callOrder.push('mqtt'));
            mockInfluxdb.mockImplementation(() => callOrder.push('influxdb'));
            mockNewRelic.mockImplementation(() => callOrder.push('newRelic'));

            publishToDestinations(testEventData, 'logEvents', {
                mqtt: mockMqtt,
                influxdb: mockInfluxdb,
                newRelic: mockNewRelic,
            });

            expect(callOrder).toEqual(['mqtt', 'influxdb', 'newRelic']);
        });
    });
});
