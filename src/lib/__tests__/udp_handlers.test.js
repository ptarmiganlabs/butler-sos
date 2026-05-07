import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalsPath = path.resolve(__dirname, '../../globals.js');
const logErrorPath = path.resolve(__dirname, '../log-error.js');
const logEventsPath = path.resolve(__dirname, '../udp_handlers/log_events/index.js');
const userEventsPath = path.resolve(__dirname, '../udp_handlers/user_events/index.js');
const udpIpValidatorPath = path.resolve(__dirname, '../udp-ip-validator.js');

// Hoist mocks outside factories for stable references (Jest ESM pattern)
const parseAllowedSourcesMock = jest.fn();
const isIpAllowedMock = jest.fn();

// Mock dependencies
jest.unstable_mockModule(globalsPath, () => ({
    default: {
        logger: {
            info: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        },
        config: {
            get: jest.fn().mockImplementation((path) => {
                if (path === 'Butler-SOS.logdb.excludeUser') return ['excluded_user'];
                if (path === 'Butler-SOS.logdb.includeUser') return ['included_user'];
                if (path === 'Butler-SOS.logdb.excludeQlikSenseEvent')
                    return {
                        method: ['excluded_method'],
                        source: ['excluded_source'],
                    };
                if (path === 'Butler-SOS.qlikSenseEvents.udp.enable') return true;
                if (path === 'Butler-SOS.qlikSenseEvents.udp.listenPort') return 9876;
                return undefined;
            }),
            has: jest.fn().mockReturnValue(true),
        },
        udpEvents: {
            addLogEvent: jest.fn(),
            addUserEvent: jest.fn(),
        },
        rejectedEvents: {
            addRejectedLogEvent: jest.fn(),
        },
        udpServerLogEvents: {
            socket: {
                on: jest.fn(),
                bind: jest.fn(),
                address: jest.fn().mockReturnValue({ address: '0.0.0.0', port: 9876 }),
            },
            enableSourceValidation: false,
            allowedSourcesConfig: [],
            allowedIPs: [],
        },
        udpQueueManagerLogEvents: {
            validateMessageSize: jest.fn().mockReturnValue(true),
            checkRateLimit: jest.fn().mockReturnValue(true),
            addToQueue: jest.fn().mockImplementation(async (fn) => {
                await fn();
                return true;
            }),
            handleSizeDrop: jest.fn(),
            handleRateLimitDrop: jest.fn(),
        },
        udpServerUserActivity: {
            socket: {
                on: jest.fn(),
                bind: jest.fn(),
                address: jest.fn().mockReturnValue({ address: '0.0.0.0', port: 9876 }),
            },
            enableSourceValidation: false,
            allowedSourcesConfig: [],
            allowedIPs: [],
        },
        udpQueueManagerUserActivity: {
            validateMessageSize: jest.fn().mockReturnValue(true),
            checkRateLimit: jest.fn().mockReturnValue(true),
            addToQueue: jest.fn().mockImplementation(async (fn) => {
                await fn();
                return true;
            }),
            handleSizeDrop: jest.fn(),
            handleRateLimitDrop: jest.fn(),
        },
        getErrorMessage: jest.fn().mockImplementation((err) => err.toString()),
    },
}));

jest.unstable_mockModule(logErrorPath, () => ({
    logError: jest.fn(),
}));

jest.unstable_mockModule(logEventsPath, () => ({
    listeningEventHandler: jest.fn(),
    messageEventHandler: jest.fn(),
}));

jest.unstable_mockModule(userEventsPath, () => ({
    listeningEventHandler: jest.fn(),
    messageEventHandler: jest.fn(),
}));

jest.unstable_mockModule(udpIpValidatorPath, () => ({
    parseAllowedSources: parseAllowedSourcesMock,
    isIpAllowed: isIpAllowedMock,
}));

const globals = (await import(globalsPath)).default;
const { logError } = await import(logErrorPath);
const { listeningEventHandler, messageEventHandler } = await import(logEventsPath);
const {
    listeningEventHandler: listeningEventHandlerUser,
    messageEventHandler: messageEventHandlerUser,
} = await import(userEventsPath);

describe('UDP Handlers', () => {
    let udpHandlersLogEvents;
    let udpHandlersUserActivity;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Reset source validation state to defaults
        globals.udpServerLogEvents.enableSourceValidation = false;
        globals.udpServerLogEvents.allowedSourcesConfig = [];
        globals.udpServerLogEvents.allowedIPs = [];
        globals.udpServerUserActivity.enableSourceValidation = false;
        globals.udpServerUserActivity.allowedSourcesConfig = [];
        globals.udpServerUserActivity.allowedIPs = [];

        // Default: isIpAllowed returns true (allow all)
        isIpAllowedMock.mockReturnValue(true);
        parseAllowedSourcesMock.mockResolvedValue({ allowedIPs: [], errors: [] });

        // Import the modules under test
        udpHandlersLogEvents = await import('../udp_handlers_log_events.js');
        udpHandlersUserActivity = await import('../udp_handlers_user_activity.js');
    });

    describe('udp_handlers_log_events', () => {
        describe('udpInitLogEventServer', () => {
            test('should set up UDP event server and handle events', async () => {
                const handlers = {};
                globals.udpServerLogEvents.socket.on.mockImplementation((event, handler) => {
                    handlers[event] = handler;
                });

                // Execute
                await udpHandlersLogEvents.udpInitLogEventServer();

                // Verify setup
                expect(globals.udpServerLogEvents.socket.on).toHaveBeenCalledWith(
                    'listening',
                    expect.any(Function)
                );
                expect(globals.udpServerLogEvents.socket.on).toHaveBeenCalledWith(
                    'message',
                    expect.any(Function)
                );
                expect(globals.udpServerLogEvents.socket.on).toHaveBeenCalledWith(
                    'error',
                    expect.any(Function)
                );
                expect(globals.udpServerLogEvents.socket.on).toHaveBeenCalledWith(
                    'close',
                    expect.any(Function)
                );

                // Trigger listening
                handlers['listening']();
                expect(listeningEventHandler).toHaveBeenCalled();

                // Trigger message
                const mockMsg = Buffer.from('test message');
                const mockRemote = { address: '127.0.0.1', port: 1234 };
                await handlers['message'](mockMsg, mockRemote);
                expect(messageEventHandler).toHaveBeenCalledWith(mockMsg, mockRemote);

                // Trigger message with size violation
                globals.udpQueueManagerLogEvents.validateMessageSize.mockReturnValueOnce(false);
                await handlers['message'](mockMsg, mockRemote);
                expect(globals.udpQueueManagerLogEvents.handleSizeDrop).toHaveBeenCalled();

                // Trigger message with rate limit violation
                globals.udpQueueManagerLogEvents.checkRateLimit.mockReturnValueOnce(false);
                await handlers['message'](mockMsg, mockRemote);
                expect(globals.udpQueueManagerLogEvents.handleRateLimitDrop).toHaveBeenCalled();

                // Trigger message with queue full
                globals.udpQueueManagerLogEvents.addToQueue.mockResolvedValueOnce(false);
                await handlers['message'](mockMsg, mockRemote);
                expect(globals.logger.debug).toHaveBeenCalledWith(
                    expect.stringContaining('dropped due to full queue')
                );

                // Trigger error
                const mockError = new Error('UDP error');
                handlers['error'](mockError);
                expect(logError).toHaveBeenCalledWith('[UDP] Log events server error', mockError);

                // Trigger close
                handlers['close']();
                expect(globals.logger.warn).toHaveBeenCalledWith(
                    '[UDP] Log events server socket closed'
                );
            });

            test('should handle errors in message handler', async () => {
                const handlers = {};
                globals.udpServerLogEvents.socket.on.mockImplementation((event, handler) => {
                    handlers[event] = handler;
                });

                await udpHandlersLogEvents.udpInitLogEventServer();

                globals.udpQueueManagerLogEvents.addToQueue.mockRejectedValueOnce(
                    new Error('Queue error')
                );
                await handlers['message'](Buffer.from('msg'), {});

                expect(logError).toHaveBeenCalledWith(
                    '[UDP Queue] Error handling log event message',
                    expect.any(Error)
                );
            });

            test('should resolve allowed sources when source validation is enabled', async () => {
                globals.udpServerLogEvents.enableSourceValidation = true;
                globals.udpServerLogEvents.allowedSourcesConfig = ['192.168.1.1'];
                parseAllowedSourcesMock.mockResolvedValueOnce({
                    allowedIPs: ['192.168.1.1'],
                    errors: [],
                });

                await udpHandlersLogEvents.udpInitLogEventServer();

                expect(parseAllowedSourcesMock).toHaveBeenCalledWith(['192.168.1.1']);
                expect(globals.udpServerLogEvents.allowedIPs).toEqual(['192.168.1.1']);
                expect(globals.logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('SOURCE VALIDATION: Enabled')
                );
            });

            test('should disable source validation when allowed sources cannot be resolved', async () => {
                globals.udpServerLogEvents.enableSourceValidation = true;
                globals.udpServerLogEvents.allowedSourcesConfig = ['bad.host'];
                parseAllowedSourcesMock.mockResolvedValueOnce({
                    allowedIPs: [],
                    errors: ['Cannot resolve hostname or invalid IPv4: "bad.host"'],
                });

                await udpHandlersLogEvents.udpInitLogEventServer();

                expect(globals.udpServerLogEvents.enableSourceValidation).toBe(false);
                expect(globals.logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('Disabling source validation')
                );
            });

            test('should warn when source validation is enabled but no sources configured', async () => {
                globals.udpServerLogEvents.enableSourceValidation = true;
                globals.udpServerLogEvents.allowedSourcesConfig = [];

                await udpHandlersLogEvents.udpInitLogEventServer();

                expect(globals.logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('no allowed sources configured')
                );
                expect(parseAllowedSourcesMock).not.toHaveBeenCalled();
            });

            test('should reject messages from unauthorized source IPs when validation is enabled', async () => {
                globals.udpServerLogEvents.enableSourceValidation = true;
                globals.udpServerLogEvents.allowedIPs = ['192.168.1.1'];
                isIpAllowedMock.mockReturnValue(false);

                const handlers = {};
                globals.udpServerLogEvents.socket.on.mockImplementation((event, handler) => {
                    handlers[event] = handler;
                });

                await udpHandlersLogEvents.udpInitLogEventServer();

                const mockMsg = Buffer.from('test message');
                const mockRemote = { address: '10.0.0.99', port: 1234 };
                await handlers['message'](mockMsg, mockRemote);

                expect(globals.logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('Rejected message from unauthorized source')
                );
                expect(messageEventHandler).not.toHaveBeenCalled();
            });

            test('should allow messages from authorized source IPs when validation is enabled', async () => {
                globals.udpServerLogEvents.enableSourceValidation = true;
                globals.udpServerLogEvents.allowedIPs = ['192.168.1.1'];
                isIpAllowedMock.mockReturnValue(true);

                const handlers = {};
                globals.udpServerLogEvents.socket.on.mockImplementation((event, handler) => {
                    handlers[event] = handler;
                });

                await udpHandlersLogEvents.udpInitLogEventServer();

                const mockMsg = Buffer.from('test message');
                const mockRemote = { address: '192.168.1.1', port: 1234 };
                await handlers['message'](mockMsg, mockRemote);

                expect(isIpAllowedMock).toHaveBeenCalledWith(
                    '192.168.1.1',
                    globals.udpServerLogEvents.allowedIPs
                );
                expect(messageEventHandler).toHaveBeenCalledWith(mockMsg, mockRemote);
            });
            test('should disable source validation when parseAllowedSources throws', async () => {
                globals.udpServerLogEvents.enableSourceValidation = true;
                globals.udpServerLogEvents.allowedSourcesConfig = ['192.168.1.1'];
                parseAllowedSourcesMock.mockRejectedValueOnce(new Error('DNS failure'));

                await udpHandlersLogEvents.udpInitLogEventServer();

                expect(globals.udpServerLogEvents.enableSourceValidation).toBe(false);
                expect(logError).toHaveBeenCalledWith(
                    '[UDP Log Events] SOURCE VALIDATION: Error parsing allowed sources',
                    expect.any(Error)
                );
            });
        });
    });

    describe('udp_handlers_user_activity', () => {
        describe('udpInitUserActivityServer', () => {
            test('should set up UDP user activity server and handle events', async () => {
                const handlers = {};
                globals.udpServerUserActivity.socket.on.mockImplementation((event, handler) => {
                    handlers[event] = handler;
                });

                // Execute
                await udpHandlersUserActivity.udpInitUserActivityServer();

                // Verify setup
                expect(globals.udpServerUserActivity.socket.on).toHaveBeenCalledWith(
                    'listening',
                    expect.any(Function)
                );
                expect(globals.udpServerUserActivity.socket.on).toHaveBeenCalledWith(
                    'message',
                    expect.any(Function)
                );
                expect(globals.udpServerUserActivity.socket.on).toHaveBeenCalledWith(
                    'error',
                    expect.any(Function)
                );
                expect(globals.udpServerUserActivity.socket.on).toHaveBeenCalledWith(
                    'close',
                    expect.any(Function)
                );

                // Trigger listening
                handlers['listening']();
                expect(listeningEventHandlerUser).toHaveBeenCalled();

                // Trigger message
                const mockMsg = Buffer.from('test message');
                const mockRemote = { address: '127.0.0.1', port: 1234 };
                await handlers['message'](mockMsg, mockRemote);
                expect(messageEventHandlerUser).toHaveBeenCalledWith(mockMsg, mockRemote);

                // Trigger message with size violation
                globals.udpQueueManagerUserActivity.validateMessageSize.mockReturnValueOnce(false);
                await handlers['message'](mockMsg, mockRemote);
                expect(globals.udpQueueManagerUserActivity.handleSizeDrop).toHaveBeenCalled();

                // Trigger message with rate limit violation
                globals.udpQueueManagerUserActivity.checkRateLimit.mockReturnValueOnce(false);
                await handlers['message'](mockMsg, mockRemote);
                expect(globals.udpQueueManagerUserActivity.handleRateLimitDrop).toHaveBeenCalled();

                // Trigger message with queue full
                globals.udpQueueManagerUserActivity.addToQueue.mockResolvedValueOnce(false);
                await handlers['message'](mockMsg, mockRemote);
                expect(globals.logger.debug).toHaveBeenCalledWith(
                    expect.stringContaining('dropped due to full queue')
                );

                // Trigger error
                const mockError = new Error('UDP error');
                handlers['error'](mockError);
                expect(logError).toHaveBeenCalledWith(
                    '[UDP] User activity server error',
                    mockError
                );

                // Trigger close
                handlers['close']();
                expect(globals.logger.warn).toHaveBeenCalledWith(
                    '[UDP] User activity server socket closed'
                );
            });

            test('should handle errors in message handler', async () => {
                const handlers = {};
                globals.udpServerUserActivity.socket.on.mockImplementation((event, handler) => {
                    handlers[event] = handler;
                });

                await udpHandlersUserActivity.udpInitUserActivityServer();

                globals.udpQueueManagerUserActivity.addToQueue.mockRejectedValueOnce(
                    new Error('Queue error')
                );
                await handlers['message'](Buffer.from('msg'), {});

                expect(logError).toHaveBeenCalledWith(
                    '[UDP Queue] Error handling user activity message',
                    expect.any(Error)
                );
            });

            test('should resolve allowed sources when source validation is enabled', async () => {
                globals.udpServerUserActivity.enableSourceValidation = true;
                globals.udpServerUserActivity.allowedSourcesConfig = ['10.0.0.1'];
                parseAllowedSourcesMock.mockResolvedValueOnce({
                    allowedIPs: ['10.0.0.1'],
                    errors: [],
                });

                await udpHandlersUserActivity.udpInitUserActivityServer();

                expect(parseAllowedSourcesMock).toHaveBeenCalledWith(['10.0.0.1']);
                expect(globals.udpServerUserActivity.allowedIPs).toEqual(['10.0.0.1']);
                expect(globals.logger.info).toHaveBeenCalledWith(
                    expect.stringContaining('SOURCE VALIDATION: Enabled')
                );
            });

            test('should disable source validation when allowed sources cannot be resolved', async () => {
                globals.udpServerUserActivity.enableSourceValidation = true;
                globals.udpServerUserActivity.allowedSourcesConfig = ['bad.host'];
                parseAllowedSourcesMock.mockResolvedValueOnce({
                    allowedIPs: [],
                    errors: ['Cannot resolve hostname or invalid IPv4: "bad.host"'],
                });

                await udpHandlersUserActivity.udpInitUserActivityServer();

                expect(globals.udpServerUserActivity.enableSourceValidation).toBe(false);
                expect(globals.logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('Disabling source validation')
                );
            });

            test('should warn when source validation is enabled but no sources configured', async () => {
                globals.udpServerUserActivity.enableSourceValidation = true;
                globals.udpServerUserActivity.allowedSourcesConfig = [];

                await udpHandlersUserActivity.udpInitUserActivityServer();

                expect(globals.logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('no allowed sources configured')
                );
                expect(parseAllowedSourcesMock).not.toHaveBeenCalled();
            });

            test('should reject messages from unauthorized source IPs when validation is enabled', async () => {
                globals.udpServerUserActivity.enableSourceValidation = true;
                globals.udpServerUserActivity.allowedIPs = ['192.168.1.1'];
                isIpAllowedMock.mockReturnValue(false);

                const handlers = {};
                globals.udpServerUserActivity.socket.on.mockImplementation((event, handler) => {
                    handlers[event] = handler;
                });

                await udpHandlersUserActivity.udpInitUserActivityServer();

                const mockMsg = Buffer.from('test message');
                const mockRemote = { address: '10.0.0.99', port: 1234 };
                await handlers['message'](mockMsg, mockRemote);

                expect(globals.logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('Rejected message from unauthorized source')
                );
                expect(messageEventHandlerUser).not.toHaveBeenCalled();
            });

            test('should allow messages from authorized source IPs when validation is enabled', async () => {
                globals.udpServerUserActivity.enableSourceValidation = true;
                globals.udpServerUserActivity.allowedIPs = ['192.168.1.1'];
                isIpAllowedMock.mockReturnValue(true);

                const handlers = {};
                globals.udpServerUserActivity.socket.on.mockImplementation((event, handler) => {
                    handlers[event] = handler;
                });

                await udpHandlersUserActivity.udpInitUserActivityServer();

                const mockMsg = Buffer.from('test message');
                const mockRemote = { address: '192.168.1.1', port: 1234 };
                await handlers['message'](mockMsg, mockRemote);

                expect(isIpAllowedMock).toHaveBeenCalledWith(
                    '192.168.1.1',
                    globals.udpServerUserActivity.allowedIPs
                );
                expect(messageEventHandlerUser).toHaveBeenCalledWith(mockMsg, mockRemote);
            });

            test('should disable source validation when parseAllowedSources throws', async () => {
                globals.udpServerUserActivity.enableSourceValidation = true;
                globals.udpServerUserActivity.allowedSourcesConfig = ['192.168.1.1'];
                parseAllowedSourcesMock.mockRejectedValueOnce(new Error('DNS failure'));

                await udpHandlersUserActivity.udpInitUserActivityServer();

                expect(globals.udpServerUserActivity.enableSourceValidation).toBe(false);
                expect(logError).toHaveBeenCalledWith(
                    '[UDP User Activity] SOURCE VALIDATION: Error parsing allowed sources',
                    expect.any(Error)
                );
            });
        });
    });
});

