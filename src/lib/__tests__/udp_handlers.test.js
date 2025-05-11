import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock dgram module
jest.unstable_mockModule('dgram', () => ({
    createSocket: jest.fn().mockReturnValue({
        on: jest.fn(),
        bind: jest.fn(),
    }),
}));

// Mock dependencies
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
        udpServerUserActivity: {
            socket: {
                on: jest.fn(),
                bind: jest.fn(),
                address: jest.fn().mockReturnValue({ address: '0.0.0.0', port: 9876 }),
            },
        },
    },
}));

describe('UDP Handlers', () => {
    let udpHandlersLogEvents;
    let udpHandlersUserActivity;
    let globals;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Get mocked modules
        globals = (await import('../../globals.js')).default;

        // Import the modules under test
        udpHandlersLogEvents = await import('../udp_handlers_log_events.js');
        udpHandlersUserActivity = await import('../udp_handlers_user_activity.js');
    });

    describe('udp_handlers_log_events', () => {
        describe('udpInitLogEventServer', () => {
            test('should set up UDP event server', async () => {
                // Execute
                udpHandlersLogEvents.udpInitLogEventServer();

                // Verify
                expect(globals.udpServerLogEvents.socket.on).toHaveBeenCalledWith(
                    'listening',
                    expect.any(Function)
                );
                expect(globals.udpServerLogEvents.socket.on).toHaveBeenCalledWith(
                    'message',
                    expect.any(Function)
                );
            });
        });
    });

    describe('udp_handlers_user_activity', () => {
        describe('udpInitUserActivityServer', () => {
            test('should set up UDP user activity server', async () => {
                // Execute
                udpHandlersUserActivity.udpInitUserActivityServer();

                // Verify
                expect(globals.udpServerUserActivity.socket.on).toHaveBeenCalledWith(
                    'listening',
                    expect.any(Function)
                );
                expect(globals.udpServerUserActivity.socket.on).toHaveBeenCalledWith(
                    'message',
                    expect.any(Function)
                );
            });
        });
    });
});
