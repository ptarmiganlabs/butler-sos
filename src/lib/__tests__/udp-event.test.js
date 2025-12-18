import { jest } from '@jest/globals';

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
                if (path === 'Butler-SOS.influxdbConfig.enable') return true;
                if (path === 'Butler-SOS.qlikSenseEvents.influxdb.enable') return true;
                if (path === 'Butler-SOS.qlikSenseEvents.influxdb.writeFrequency') return 10000;
                return undefined;
            }),
        },
        rejectedEvents: {
            clearRejectedEvents: jest.fn(),
        },
        udpEvents: {
            clearLogEvents: jest.fn(),
            clearUserEvents: jest.fn(),
        },
    },
}));

jest.unstable_mockModule('../influxdb/index.js', () => ({
    storeRejectedEventCountInfluxDB: jest.fn(),
    storeEventCountInfluxDB: jest.fn(),
}));

jest.useFakeTimers();

describe('udp-event', () => {
    let UdpEvents;
    let setupUdpEventsStorage;
    let globals;
    let influxDBModule;
    let udpEventsInstance;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Import mocked modules and the module under test
        const udpModule = await import('../udp-event.js');
        UdpEvents = udpModule.UdpEvents;
        setupUdpEventsStorage = udpModule.setupUdpEventsStorage;

        globals = (await import('../../globals.js')).default;
        influxDBModule = await import('../influxdb/index.js');

        // Create an instance of UdpEvents for testing
        udpEventsInstance = new UdpEvents(globals.logger);
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    test('UdpEvents constructor should initialize properties correctly', () => {
        expect(udpEventsInstance.logEvents).toEqual([]);
        expect(udpEventsInstance.userEvents).toEqual([]);
        expect(udpEventsInstance.rejectedLogEvents).toEqual([]);
        expect(udpEventsInstance.logger).toBe(globals.logger);
    });

    test('addLogEvent should add a new log event to the array', async () => {
        const logEvent = {
            source: 'test-source',
            host: 'test-host',
            subsystem: 'test-subsystem',
        };

        await udpEventsInstance.addLogEvent(logEvent);

        const events = await udpEventsInstance.getLogEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            source: 'test-source',
            host: 'test-host',
            subsystem: 'test-subsystem',
            counter: 1,
        });
    });

    test('addLogEvent should increment counter for existing log event', async () => {
        const logEvent = {
            source: 'test-source',
            host: 'test-host',
            subsystem: 'test-subsystem',
        };

        await udpEventsInstance.addLogEvent(logEvent);
        await udpEventsInstance.addLogEvent(logEvent);

        const events = await udpEventsInstance.getLogEvents();
        expect(events).toHaveLength(1);
        expect(events[0].counter).toBe(2);
    });

    test('addLogEvent should handle missing required properties', async () => {
        const invalidEvent = {
            source: 'test-source',
            // Missing host and subsystem
        };

        await udpEventsInstance.addLogEvent(invalidEvent);

        const events = await udpEventsInstance.getLogEvents();
        expect(events).toHaveLength(0);
        expect(globals.logger.error).toHaveBeenCalled();
    });

    test('clearLogEvents should empty the log events array', async () => {
        const logEvent = {
            source: 'test-source',
            host: 'test-host',
            subsystem: 'test-subsystem',
        };

        await udpEventsInstance.addLogEvent(logEvent);
        await udpEventsInstance.clearLogEvents();

        const events = await udpEventsInstance.getLogEvents();
        expect(events).toHaveLength(0);
    });

    test('addUserEvent should add a new user event to the array', async () => {
        const userEvent = {
            source: 'test-source',
            host: 'test-host',
            subsystem: 'test-subsystem',
        };

        await udpEventsInstance.addUserEvent(userEvent);

        const events = await udpEventsInstance.getUserEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            source: 'test-source',
            host: 'test-host',
            subsystem: 'test-subsystem',
            counter: 1,
        });
    });

    test('addUserEvent should increment counter for existing user event', async () => {
        const userEvent = {
            source: 'test-source',
            host: 'test-host',
            subsystem: 'test-subsystem',
        };

        await udpEventsInstance.addUserEvent(userEvent);
        await udpEventsInstance.addUserEvent(userEvent);

        const events = await udpEventsInstance.getUserEvents();
        expect(events).toHaveLength(1);
        expect(events[0].counter).toBe(2);
    });

    test('clearUserEvents should empty the user events array', async () => {
        const userEvent = {
            source: 'test-source',
            host: 'test-host',
            subsystem: 'test-subsystem',
        };

        await udpEventsInstance.addUserEvent(userEvent);
        await udpEventsInstance.clearUserEvents();

        const events = await udpEventsInstance.getUserEvents();
        expect(events).toHaveLength(0);
    });

    test('addRejectedLogEvent should add a new performance log event to the array', async () => {
        const perfLogEvent = {
            source: 'qseow-qix-perf',
            appId: 'test-app-id',
            appName: 'Test App',
            method: 'test-method',
            objectType: 'test-object-type',
            processTime: 100.5,
        };

        await udpEventsInstance.addRejectedLogEvent(perfLogEvent);

        const events = await udpEventsInstance.getRejectedLogEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            source: 'qseow-qix-perf',
            appId: 'test-app-id',
            appName: 'Test App',
            method: 'test-method',
            objectType: 'test-object-type',
            counter: 1,
            processTime: 100.5,
        });
    });

    test('addRejectedLogEvent should add a new non-performance log event to the array', async () => {
        const nonPerfLogEvent = {
            source: 'other-source',
        };

        await udpEventsInstance.addRejectedLogEvent(nonPerfLogEvent);

        const events = await udpEventsInstance.getRejectedLogEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            source: 'other-source',
            counter: 1,
        });
    });

    test('clearRejectedEvents should empty the rejected events array', async () => {
        const rejectedEvent = {
            source: 'test-source',
        };

        await udpEventsInstance.addRejectedLogEvent(rejectedEvent);
        await udpEventsInstance.clearRejectedEvents();

        const events = await udpEventsInstance.getRejectedLogEvents();
        expect(events).toHaveLength(0);
    });

    test('setupUdpEventsStorage should set up timer for storing event counts', async () => {
        // Set up a promise that will resolve when the timer callback completes
        const timerCallbackPromise = new Promise((resolve) => {
            // Call the function with a callback that will resolve the promise
            setupUdpEventsStorage(resolve);

            // Fast forward to trigger the timer
            jest.advanceTimersByTime(10000);
        });

        // Wait for the timer callback to complete
        await timerCallbackPromise;

        // Verify that the store functions were called
        expect(influxDBModule.storeEventCountInfluxDB).toHaveBeenCalled();
        expect(influxDBModule.storeRejectedEventCountInfluxDB).toHaveBeenCalled();

        // Verify that the clear functions were called
        expect(globals.rejectedEvents.clearRejectedEvents).toHaveBeenCalled();
        expect(globals.udpEvents.clearLogEvents).toHaveBeenCalled();
        expect(globals.udpEvents.clearUserEvents).toHaveBeenCalled();
    }, 10000);

    test('setupUdpEventsStorage should not set up timer if feature is disabled', () => {
        // Mock config to disable the feature
        globals.config.get.mockImplementationOnce((path) => {
            if (path === 'Butler-SOS.influxdbConfig.enable') return false;
            return undefined;
        });

        // Call the function
        const intervalId = setupUdpEventsStorage();

        // Check that no interval was set up
        expect(intervalId).toBeUndefined();

        // Fast forward timer - this should have no effect since the interval wasn't set up
        jest.advanceTimersByTime(10000);

        // Verify that the store functions were not called
        expect(influxDBModule.storeEventCountInfluxDB).not.toHaveBeenCalled();
        expect(influxDBModule.storeRejectedEventCountInfluxDB).not.toHaveBeenCalled();
    });
});
