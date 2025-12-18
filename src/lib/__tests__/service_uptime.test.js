import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';
import def from 'ajv/dist/vocabularies/applicator/additionalItems.js';

// Mock the dependencies
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            log: jest.fn(),
        },
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
    },
}));

// Mock other dependencies
jest.unstable_mockModule('../influxdb/index.js', () => ({
    postButlerSOSMemoryUsageToInfluxdb: jest.fn(),
}));

jest.unstable_mockModule('../post-to-new-relic.js', () => ({
    postButlerSOSUptimeToNewRelic: jest.fn(),
}));

jest.unstable_mockModule('@breejs/later', () => ({
    default: {
        parse: {
            text: jest.fn().mockReturnValue({}),
        },
        schedule: jest.fn().mockReturnValue({
            next: jest.fn().mockReturnValue([
                null,
                null,
                new Date('2023-01-01T00:00:00.000Z'),
                new Date('2023-01-01T00:05:00.000Z'), // 5 minutes later
            ]),
        }),
        setInterval: jest.fn().mockImplementation((callback) => {
            // Execute callback once immediately for testing
            callback();
            return { clear: jest.fn() };
        }),
    },
}));

// Mock process.memoryUsage
const originalMemoryUsage = process.memoryUsage;
process.memoryUsage = jest.fn().mockReturnValue({
    rss: 100 * 1024 * 1024, // 100 MB
    heapTotal: 50 * 1024 * 1024, // 50 MB
    heapUsed: 30 * 1024 * 1024, // 30 MB
    external: 10 * 1024 * 1024, // 10 MB
});

// Load mocked dependencies
const globals = (await import('../../globals.js')).default;
const { postButlerSOSMemoryUsageToInfluxdb } = await import('../influxdb/index.js');
const { postButlerSOSUptimeToNewRelic } = await import('../post-to-new-relic.js');
const later = (await import('@breejs/later')).default;

// Import the module under test
const { serviceUptimeStart } = await import('../service_uptime.js');

describe('service_uptime', () => {
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock Date.now() to return a fixed timestamp
        jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01T00:00:00.000Z

        // Setup default config values
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.uptimeMonitor.logLevel') return 'verbose';
            if (path === 'Butler-SOS.uptimeMonitor.frequency') return 'every 5 minutes';
            if (path === 'Butler-SOS.influxdbConfig.enable') return true;
            if (path === 'Butler-SOS.uptimeMonitor.storeInInfluxdb.butlerSOSMemoryUsage')
                return true;
            if (path === 'Butler-SOS.uptimeMonitor.storeNewRelic.enable') return true;

            return undefined;
        });

        globals.config.has.mockImplementation((path) => {
            if (path === 'Butler-SOS.uptimeMonitor.storeInInfluxdb.instanceTag') return true;
            return false;
        });
    });

    afterEach(() => {
        // Restore original implementations
        jest.restoreAllMocks();
        process.memoryUsage = originalMemoryUsage;
    });

    test('should start uptime monitoring and log initial uptime stats', () => {
        // Call the function being tested
        serviceUptimeStart();

        // Verify later.parse.text was called with correct interval
        expect(later.parse.text).toHaveBeenCalledWith('every 5 minutes');

        // Verify later.setInterval was called
        expect(later.setInterval).toHaveBeenCalledWith(expect.any(Function), expect.any(Object));

        // Verify logger.debug was called with interval information
        expect(globals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Interval between uptime events: 300000 milliseconds')
        );

        // Verify logger.log was called with the separator line first
        expect(globals.logger.log).toHaveBeenCalledWith(
            'verbose',
            '--------------------------------'
        );

        // Verify logger.log was called with uptime information (second call)
        expect(globals.logger.log).toHaveBeenCalledWith(
            'verbose',
            expect.stringContaining('Iteration # 1, Uptime:')
        );
    });

    test('should post memory usage to InfluxDB when enabled', () => {
        // Call the function being tested
        serviceUptimeStart();

        // Verify postButlerSOSMemoryUsageToInfluxdb was called with correct parameters
        expect(postButlerSOSMemoryUsageToInfluxdb).toHaveBeenCalledWith(
            expect.objectContaining({
                heapUsedMByte: expect.any(Number),
                heapTotalMByte: expect.any(Number),
                externalMemoryMByte: expect.any(Number),
                processMemoryMByte: expect.any(Number),
            })
        );
    });

    test('should not post to InfluxDB when disabled', () => {
        // Mock config to disable InfluxDB
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.uptimeMonitor.logLevel') return 'verbose';
            if (path === 'Butler-SOS.uptimeMonitor.frequency') return 'every 5 minutes';
            if (path === 'Butler-SOS.influxdbConfig.enable') return false;
            return undefined;
        });

        // Call the function being tested
        serviceUptimeStart();

        // Verify postButlerSOSMemoryUsageToInfluxdb was not called
        expect(postButlerSOSMemoryUsageToInfluxdb).not.toHaveBeenCalled();
    });

    test('should post to New Relic when enabled', () => {
        // Call the function being tested
        serviceUptimeStart();

        // Verify postButlerSOSUptimeToNewRelic was called with correct parameters
        expect(postButlerSOSUptimeToNewRelic).toHaveBeenCalledWith(
            expect.objectContaining({
                intervalMillisec: expect.any(Number),
                heapUsed: expect.any(Number),
                heapTotal: expect.any(Number),
                externalMemory: expect.any(Number),
                processMemory: expect.any(Number),
                startIterations: expect.any(Number),
                uptimeMilliSec: expect.any(Number),
                uptimeString: expect.any(String),
            })
        );
    });

    test('should not post to New Relic when disabled', () => {
        // Mock config to disable New Relic
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.uptimeMonitor.logLevel') return 'verbose';
            if (path === 'Butler-SOS.uptimeMonitor.frequency') return 'every 5 minutes';
            if (path === 'Butler-SOS.uptimeMonitor.storeNewRelic.enable') return false;
            return undefined;
        });

        // Call the function being tested
        serviceUptimeStart();

        // Verify postButlerSOSUptimeToNewRelic was not called
        expect(postButlerSOSUptimeToNewRelic).not.toHaveBeenCalled();
    });
});
