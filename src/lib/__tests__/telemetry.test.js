import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock the dependencies
jest.unstable_mockModule('posthog-node', () => ({
    PostHog: jest.fn().mockImplementation(() => ({
        capture: jest.fn(),
    })),
}));
const { PostHog } = await import('posthog-node');

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        },
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
        hostInfo: {
            id: 'mock-host-id',
            isRunningInDocker: false,
            si: {
                os: {
                    arch: 'x64',
                    platform: 'linux',
                    release: '20.04',
                    distro: 'Ubuntu',
                    codename: 'focal',
                },
                system: {
                    virtual: false,
                },
            },
            node: {
                nodeVersion: '16.15.0',
            },
        },
        appVersion: '11.0.3',
    },
}));
const globals = (await import('../../globals.js')).default;

// Import the module under test
const { setupAnonUsageReportTimer } = await import('../telemetry.js');

describe('telemetry', () => {
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup default config values
        globals.config.get.mockImplementation((path) => {
            // Default returns for general settings
            if (path === 'Butler-SOS.heartbeat.enable') return true;
            if (path === 'Butler-SOS.dockerHealthCheck.enable') return false;
            if (path === 'Butler-SOS.uptimeMonitor.enable') return true;
            if (path === 'Butler-SOS.uptimeMonitor.storeNewRelic.enable') return false;
            if (path === 'Butler-SOS.qlikSenseEvents.eventCount.enable') return true;
            if (path === 'Butler-SOS.qlikSenseEvents.rejectedEventCount.enable') return false;
            if (path === 'Butler-SOS.userEvents.enable') return true;
            if (path === 'Butler-SOS.userEvents.sendToMQTT.enable') return true;
            if (path === 'Butler-SOS.userEvents.sendToInfluxdb.enable') return false;
            if (path === 'Butler-SOS.userEvents.sendToNewRelic.enable') return false;
            if (path === 'Butler-SOS.logEvents.source.proxy.enable') return true;
            if (path === 'Butler-SOS.logEvents.source.scheduler.enable') return true;
            if (path === 'Butler-SOS.logEvents.source.repository.enable') return false;
            if (path === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
            if (path === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return true;
            if (path === 'Butler-SOS.logEvents.sendToNewRelic.enable') return false;
            if (path === 'Butler-SOS.logEvents.categorise.enable') return true;
            if (path === 'Butler-SOS.logEvents.categorise.ruleDefault.enable') return true;
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.enable') return true;
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.appNameLookup.enable')
                return true;
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.enable')
                return false;
            if (path === 'Butler-SOS.mqttConfig.enable') return true;
            if (path === 'Butler-SOS.newRelic.enable') return false;
            if (path === 'Butler-SOS.prometheus.enable') return false;
            if (path === 'Butler-SOS.influxdbConfig.enable') return true;
            if (path === 'Butler-SOS.influxdbConfig.version') return 'v2';
            if (path === 'Butler-SOS.appNames.enableAppNameExtract') return true;
            if (path === 'Butler-SOS.userSessions.enableSessionExtract') return true;

            return undefined;
        });

        globals.config.has.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') return true;
        });

        // Mock the rules array
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') {
                return [{}, {}, {}]; // Array with 3 mock rules
            }
            return globals.config.get.getMockImplementation()(path);
        });

        // Mock setInterval to execute the callback immediately
        jest.spyOn(global, 'setInterval').mockImplementation((cb) => {
            cb();
            return 123; // Mock timer ID
        });
    });

    afterEach(() => {
        // Restore original implementation of setInterval
        global.setInterval.mockRestore();
    });

    test('should initialize PostHog client and send initial telemetry', () => {
        // Setup mock logger and hostInfo
        const mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
        };

        const mockHostInfo = {
            id: 'test-host',
            si: {
                os: {
                    arch: 'x64',
                    platform: 'darwin',
                    release: '20.1.0',
                    distro: 'macOS',
                    codename: 'Big Sur',
                },
                system: {
                    virtual: false,
                },
            },
            isRunningInDocker: false,
            node: {
                nodeVersion: '16.14.0',
            },
        };

        // Call the function being tested
        setupAnonUsageReportTimer(mockLogger, mockHostInfo);

        // Verify PostHog constructor was called with correct parameters
        expect(PostHog).toHaveBeenCalledWith(
            'phc_5cmKiX9OubQjsSfOZuaolWaxo2z7WXqd295eB0uOtTb',
            expect.objectContaining({
                host: 'https://eu.posthog.com',
                flushAt: 1,
                flushInterval: 60 * 1000,
                requestTimeout: 30 * 1000,
                disableGeoip: false,
            })
        );

        // Verify setInterval was called with correct interval
        expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000 * 60 * 60 * 12);
    });

    test('should handle errors during telemetry setup', () => {
        // Force PostHog constructor to throw an error
        PostHog.mockImplementationOnce(() => {
            throw new Error('PostHog initialization failed');
        });

        // Setup mock logger
        const mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
        };

        // Call the function being tested
        setupAnonUsageReportTimer(mockLogger, {});

        // Verify error was logged
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('TELEMETRY'));
    });

    test('should handle errors during telemetry sending', () => {
        // Reset the original implementation to test error handling
        jest.resetModules();

        // Mock the PostHog capture method to throw an error
        const mockPostHogInstance = {
            capture: jest.fn().mockImplementation(() => {
                throw new Error('Capture failed');
            }),
        };

        PostHog.mockImplementationOnce(() => mockPostHogInstance);

        // Call the function being tested
        setupAnonUsageReportTimer(globals.logger, globals.hostInfo);

        // Since the error is caught in callRemoteURL which is called inside setupAnonUsageReportTimer,
        // we won't see the error here. Instead, we're verifying that the function completes without crashing.
        expect(PostHog).toHaveBeenCalled();
    });
});
