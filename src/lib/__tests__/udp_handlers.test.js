import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalsPath = path.resolve(__dirname, '../../globals.js');
const logErrorPath = path.resolve(__dirname, '../log-error.js');
const logEventsPath = path.resolve(__dirname, '../udp_handlers/log_events/index.js');
const userEventsPath = path.resolve(__dirname, '../udp_handlers/user_events/index.js');

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
                udpHandlersLogEvents.udpInitLogEventServer();

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

                udpHandlersLogEvents.udpInitLogEventServer();

                globals.udpQueueManagerLogEvents.addToQueue.mockRejectedValueOnce(
                    new Error('Queue error')
                );
                await handlers['message'](Buffer.from('msg'), {});

                expect(logError).toHaveBeenCalledWith(
                    '[UDP Queue] Error handling log event message',
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
                udpHandlersUserActivity.udpInitUserActivityServer();

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

                udpHandlersUserActivity.udpInitUserActivityServer();

                globals.udpQueueManagerUserActivity.addToQueue.mockRejectedValueOnce(
                    new Error('Queue error')
                );
                await handlers['message'](Buffer.from('msg'), {});

                expect(logError).toHaveBeenCalledWith(
                    '[UDP Queue] Error handling user activity message',
                    expect.any(Error)
                );
            });
        });
    });
});
