import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';

const mockLogger = {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
};

// Hoist config mock functions outside the factory so tests can configure them
const mockConfigGet = jest.fn();
const mockConfigHas = jest.fn();

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: mockLogger,
        errorTracker: null,
        config: {
            get: mockConfigGet,
            has: mockConfigHas,
        },
    },
}));

// Hoist influxdb util mock functions outside the factory for stable references
const mockIsInfluxDbEnabled = jest.fn();
const mockGetInfluxDbVersion = jest.fn();
const mockWriteBatchToInfluxV1 = jest.fn();
const mockWriteBatchToInfluxV2 = jest.fn();
const mockWriteBatchToInfluxV3 = jest.fn();

jest.unstable_mockModule('../influxdb/shared/utils.js', () => ({
    isInfluxDbEnabled: mockIsInfluxDbEnabled,
    getInfluxDbVersion: mockGetInfluxDbVersion,
    writeBatchToInfluxV1: mockWriteBatchToInfluxV1,
    writeBatchToInfluxV2: mockWriteBatchToInfluxV2,
    writeBatchToInfluxV3: mockWriteBatchToInfluxV3,
}));

// Hoist InfluxDB v2 mock Point methods outside factory for stable references
const mockPointV2Tag = jest.fn();
const mockPointV2IntField = jest.fn();
const mockPointV2StringField = jest.fn();
const mockPointV2 = {
    tag: mockPointV2Tag,
    intField: mockPointV2IntField,
    stringField: mockPointV2StringField,
};
const MockPointV2 = jest.fn(() => mockPointV2);

jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    Point: MockPointV2,
}));

// Hoist InfluxDB v3 mock Point methods outside factory for stable references
const mockPointV3SetTag = jest.fn();
const mockPointV3SetIntegerField = jest.fn();
const mockPointV3SetStringField = jest.fn();
const mockPointV3 = {
    setTag: mockPointV3SetTag,
    setIntegerField: mockPointV3SetIntegerField,
    setStringField: mockPointV3SetStringField,
};
const MockPointV3 = jest.fn(() => mockPointV3);

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    Point: MockPointV3,
}));

const { ErrorTracker } = await import('../error-tracker.js');

describe('ErrorTracker', () => {
    let tracker;

    beforeEach(() => {
        jest.clearAllMocks();
        // Default: logSummary enabled, InfluxDB error tracking disabled
        mockConfigHas.mockReturnValue(false);
        mockConfigGet.mockReturnValue(undefined);
        mockIsInfluxDbEnabled.mockReturnValue(false);
        tracker = new ErrorTracker(mockLogger);
    });

    test('increments error count', async () => {
        await tracker.incrementError('API_1', 'Server_1');
        const counts = await tracker.getErrorCounts();
        expect(counts).toHaveLength(1);
        expect(counts[0]).toEqual({ apiType: 'API_1', serverName: 'Server_1', count: 1 });
    });

    test('increments existing error count', async () => {
        await tracker.incrementError('API_1', 'Server_1');
        await tracker.incrementError('API_1', 'Server_1');
        const counts = await tracker.getErrorCounts();
        expect(counts[0].count).toBe(2);
    });

    test('handles multiple API types and servers', async () => {
        await tracker.incrementError('API_1', 'Server_1');
        await tracker.incrementError('API_2', 'Server_1');
        await tracker.incrementError('API_1', 'Server_2');
        const counts = await tracker.getErrorCounts();
        expect(counts).toHaveLength(3);
    });

    test('validates parameters', async () => {
        await tracker.incrementError(123, 'Server_1');
        expect(mockLogger.error).toHaveBeenCalled();

        await tracker.incrementError('API_1', 123);
        expect(mockLogger.error).toHaveBeenCalled();
    });

    test('resets counters when date changes', async () => {
        tracker.lastResetDate = '2000-01-01';
        await tracker.incrementError('API_1', 'Server_1');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('resetting counters')
        );
        const counts = await tracker.getErrorCounts();
        expect(counts).toHaveLength(1);
        expect(counts[0].count).toBe(1); // Reset then incremented
    });

    test('getErrorStats returns correct structure', async () => {
        await tracker.incrementError('API_1', 'Server_1');
        await tracker.incrementError('API_1', 'Server_1');
        await tracker.incrementError('API_1', ''); // No server context

        const stats = tracker.getErrorStats();
        expect(stats.API_1.total).toBe(3);
        expect(stats.API_1.servers.Server_1).toBe(2);
        expect(stats.API_1.servers._no_server_context).toBe(1);
    });

    test('logErrorSummary does nothing if no errors', async () => {
        await tracker.logErrorSummary();
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    test('logErrorSummary logs summary if errors exist', async () => {
        await tracker.incrementError('API_1', 'Server_1');
        await tracker.logErrorSummary();
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('ERROR TRACKER: Error counts today (UTC)')
        );
    });

    test('does not log summary when logSummary.enable is false', async () => {
        mockConfigHas.mockImplementation(
            (key) => key === 'Butler-SOS.errorTracking.logSummary.enable'
        );
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.logSummary.enable') return false;
            return undefined;
        });
        await tracker.incrementError('API_1', 'Server_1');
        expect(mockLogger.info).not.toHaveBeenCalledWith(
            expect.stringContaining('ERROR TRACKER: Error counts today (UTC)')
        );
    });

    test('logs summary when logSummary.enable is true', async () => {
        mockConfigHas.mockImplementation(
            (key) => key === 'Butler-SOS.errorTracking.logSummary.enable'
        );
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.logSummary.enable') return true;
            return undefined;
        });
        await tracker.incrementError('API_1', 'Server_1');
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('ERROR TRACKER: Error counts today (UTC)')
        );
    });
});

describe('ErrorTracker._isInfluxDbErrorTrackingEnabled', () => {
    let tracker;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConfigHas.mockReturnValue(false);
        mockConfigGet.mockReturnValue(undefined);
        mockIsInfluxDbEnabled.mockReturnValue(false);
        tracker = new ErrorTracker(mockLogger);
    });

    test('returns false when errorTracking.enable is not in config', () => {
        mockConfigHas.mockReturnValue(false);
        expect(tracker._isInfluxDbErrorTrackingEnabled()).toBe(false);
    });

    test('returns false when errorTracking.enable is false', () => {
        mockConfigHas.mockReturnValue(true);
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.enable') return false;
            if (key === 'Butler-SOS.errorTracking.influxdb.enable') return true;
            return undefined;
        });
        mockIsInfluxDbEnabled.mockReturnValue(true);
        expect(tracker._isInfluxDbErrorTrackingEnabled()).toBe(false);
    });

    test('returns false when errorTracking.influxdb.enable is false', () => {
        mockConfigHas.mockReturnValue(true);
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.enable') return true;
            if (key === 'Butler-SOS.errorTracking.influxdb.enable') return false;
            return undefined;
        });
        mockIsInfluxDbEnabled.mockReturnValue(true);
        expect(tracker._isInfluxDbErrorTrackingEnabled()).toBe(false);
    });

    test('returns false when isInfluxDbEnabled() is false', () => {
        mockConfigHas.mockReturnValue(true);
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.enable') return true;
            if (key === 'Butler-SOS.errorTracking.influxdb.enable') return true;
            return undefined;
        });
        mockIsInfluxDbEnabled.mockReturnValue(false);
        expect(tracker._isInfluxDbErrorTrackingEnabled()).toBe(false);
    });

    test('returns true when all conditions are met', () => {
        mockConfigHas.mockReturnValue(true);
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.enable') return true;
            if (key === 'Butler-SOS.errorTracking.influxdb.enable') return true;
            return undefined;
        });
        mockIsInfluxDbEnabled.mockReturnValue(true);
        expect(tracker._isInfluxDbErrorTrackingEnabled()).toBe(true);
    });
});

describe('ErrorTracker._writeErrorToInfluxDB', () => {
    let tracker;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConfigHas.mockReturnValue(false);
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.influxdb.measurementName') return 'sense_errors';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 1000;
            if (key === 'Butler-SOS.influxdbConfig.v2Config.org') return 'my-org';
            if (key === 'Butler-SOS.influxdbConfig.v2Config.bucket') return 'my-bucket';
            if (key === 'Butler-SOS.influxdbConfig.v3Config.database') return 'my-db';
            return undefined;
        });
        mockWriteBatchToInfluxV1.mockResolvedValue();
        mockWriteBatchToInfluxV2.mockResolvedValue();
        mockWriteBatchToInfluxV3.mockResolvedValue();
        tracker = new ErrorTracker(mockLogger);
    });

    test('writes to InfluxDB v1 with correct datapoint structure', async () => {
        mockGetInfluxDbVersion.mockReturnValue(1);
        await tracker._writeErrorToInfluxDB('HEALTH_API', 'Server_1', { host: 'host1' });
        expect(mockWriteBatchToInfluxV1).toHaveBeenCalledTimes(1);
        const [datapoint, context, serverName] = mockWriteBatchToInfluxV1.mock.calls[0];
        expect(datapoint).toHaveLength(1);
        expect(datapoint[0].measurement).toBe('sense_errors');
        expect(datapoint[0].tags.error_type).toBe('HEALTH_API');
        expect(datapoint[0].tags.server_name).toBe('Server_1');
        expect(datapoint[0].tags.host).toBe('host1');
        expect(datapoint[0].fields.error_count).toBe(1);
        expect(context).toBe('Error event: HEALTH_API/Server_1');
        expect(serverName).toBe('Server_1');
    });

    test('writes to InfluxDB v2 with correct tags and fields', async () => {
        mockGetInfluxDbVersion.mockReturnValue(2);
        await tracker._writeErrorToInfluxDB('PROXY_API', 'Server_2', {
            host: 'host2',
            virtualProxy: '/vp',
        });
        expect(MockPointV2).toHaveBeenCalledWith('sense_errors');
        expect(mockPointV2Tag).toHaveBeenCalledWith('error_type', 'PROXY_API');
        expect(mockPointV2Tag).toHaveBeenCalledWith('server_name', 'Server_2');
        expect(mockPointV2Tag).toHaveBeenCalledWith('host', 'host2');
        expect(mockPointV2Tag).toHaveBeenCalledWith('virtual_proxy', '/vp');
        expect(mockPointV2IntField).toHaveBeenCalledWith('error_count', 1);
        expect(mockPointV2StringField).toHaveBeenCalledWith('error_category', 'unknown');
        expect(mockWriteBatchToInfluxV2).toHaveBeenCalledTimes(1);
        const [points, org, bucket, context, serverName] = mockWriteBatchToInfluxV2.mock.calls[0];
        expect(points).toContain(mockPointV2);
        expect(org).toBe('my-org');
        expect(bucket).toBe('my-bucket');
        expect(context).toBe('Error event: PROXY_API/Server_2');
        expect(serverName).toBe('Server_2');
    });

    test('writes to InfluxDB v3 with correct tags and fields', async () => {
        mockGetInfluxDbVersion.mockReturnValue(3);
        await tracker._writeErrorToInfluxDB('APP_NAMES_EXTRACT', 'Server_3', {});
        expect(MockPointV3).toHaveBeenCalledWith('sense_errors');
        expect(mockPointV3SetTag).toHaveBeenCalledWith('error_type', 'APP_NAMES_EXTRACT');
        expect(mockPointV3SetTag).toHaveBeenCalledWith('server_name', 'Server_3');
        expect(mockPointV3SetIntegerField).toHaveBeenCalledWith('error_count', 1);
        expect(mockPointV3SetStringField).toHaveBeenCalledWith('error_category', 'unknown');
        expect(mockWriteBatchToInfluxV3).toHaveBeenCalledTimes(1);
        const [points, database, context, serverName] = mockWriteBatchToInfluxV3.mock.calls[0];
        expect(points).toContain(mockPointV3);
        expect(database).toBe('my-db');
        expect(context).toBe('Error event: APP_NAMES_EXTRACT/Server_3');
        expect(serverName).toBe('Server_3');
    });

    test('does not add optional tags when metadata is empty', async () => {
        mockGetInfluxDbVersion.mockReturnValue(1);
        await tracker._writeErrorToInfluxDB('HEALTH_API', 'Server_1', {});
        const [datapoint] = mockWriteBatchToInfluxV1.mock.calls[0];
        expect(datapoint[0].tags).not.toHaveProperty('host');
        expect(datapoint[0].tags).not.toHaveProperty('virtual_proxy');
    });

    test('handles InfluxDB write failure gracefully', async () => {
        mockGetInfluxDbVersion.mockReturnValue(1);
        mockWriteBatchToInfluxV1.mockRejectedValue(new Error('Write failed'));
        // Should not throw
        await expect(
            tracker._writeErrorToInfluxDB('HEALTH_API', 'Server_1', {})
        ).resolves.toBeUndefined();
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('InfluxDB write failed')
        );
    });

    test.each([
        [1, mockWriteBatchToInfluxV1, 4],
        [2, mockWriteBatchToInfluxV2, 6],
        [3, mockWriteBatchToInfluxV3, 5],
    ])(
        'InfluxDB v%i: writes the error event with a single attempt, without retries',
        async (version, writeBatch, optionsArgIndex) => {
            mockGetInfluxDbVersion.mockReturnValue(version);
            await tracker._writeErrorToInfluxDB('HEALTH_API', 'Server_1', {});
            expect(writeBatch).toHaveBeenCalledTimes(1);
            expect(writeBatch.mock.calls[0][optionsArgIndex]).toEqual({ maxRetries: 0 });
        }
    );

    test.each([
        [1, mockWriteBatchToInfluxV1, 1],
        [2, mockWriteBatchToInfluxV2, 3],
        [3, mockWriteBatchToInfluxV3, 2],
    ])(
        'InfluxDB v%i: describes an error event without a server name without a trailing slash',
        async (version, writeBatch, contextArgIndex) => {
            mockGetInfluxDbVersion.mockReturnValue(version);
            await tracker._writeErrorToInfluxDB('INFLUXDB_V3_WRITE', '', {});
            expect(writeBatch.mock.calls[0][contextArgIndex]).toBe(
                'Error event: INFLUXDB_V3_WRITE'
            );

            writeBatch.mockClear();
            await tracker._writeErrorToInfluxDB('HEALTH_API', 'Server_1', {});
            expect(writeBatch.mock.calls[0][contextArgIndex]).toBe(
                'Error event: HEALTH_API/Server_1'
            );
        }
    );
});

describe('ErrorTracker.incrementError with InfluxDB enabled', () => {
    let tracker;

    beforeEach(() => {
        jest.clearAllMocks();
        // Enable all error tracking
        mockConfigHas.mockReturnValue(true);
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.enable') return true;
            if (key === 'Butler-SOS.errorTracking.influxdb.enable') return true;
            if (key === 'Butler-SOS.errorTracking.logSummary.enable') return false;
            if (key === 'Butler-SOS.errorTracking.influxdb.measurementName') return 'sense_errors';
            if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 1000;
            return undefined;
        });
        mockIsInfluxDbEnabled.mockReturnValue(true);
        mockGetInfluxDbVersion.mockReturnValue(1);
        mockWriteBatchToInfluxV1.mockResolvedValue();
        tracker = new ErrorTracker(mockLogger);
    });

    test('triggers InfluxDB write via setImmediate when errorTracking is enabled', async () => {
        await tracker.incrementError('HEALTH_API', 'Server_1', { host: 'host1' });
        // Flush setImmediate queue then microtask queue
        await new Promise((resolve) => setImmediate(resolve));
        await Promise.resolve();
        expect(mockWriteBatchToInfluxV1).toHaveBeenCalledTimes(1);
    });

    test('does not trigger InfluxDB write when errorTracking.enable is false', async () => {
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.errorTracking.enable') return false;
            if (key === 'Butler-SOS.errorTracking.logSummary.enable') return false;
            return undefined;
        });
        await tracker.incrementError('HEALTH_API', 'Server_1', {});
        await new Promise((resolve) => setImmediate(resolve));
        await Promise.resolve();
        expect(mockWriteBatchToInfluxV1).not.toHaveBeenCalled();
    });

    /**
     * Gives scheduled error-event writes, and any writes they schedule in turn, time to run.
     */
    async function flushErrorEventWrites() {
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }

    test('counts, but does not write, an error raised while writing an error event', async () => {
        // A write path that tracks its own failure, as if it had not been told to skip error
        // tracking. Without the guard, every such failure would start another write.
        mockWriteBatchToInfluxV1.mockImplementation(async () => {
            await tracker.incrementError('INFLUXDB_V1_WRITE', 'Server_1');
            throw new Error('Write failed');
        });

        await tracker.incrementError('HEALTH_API', 'Server_1');
        await flushErrorEventWrites();

        expect(mockWriteBatchToInfluxV1).toHaveBeenCalledTimes(1);
        expect(await tracker.getErrorCounts()).toEqual([
            { apiType: 'HEALTH_API', serverName: 'Server_1', count: 1 },
            { apiType: 'INFLUXDB_V1_WRITE', serverName: 'Server_1', count: 1 },
        ]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining('raised while writing another error event')
        );
    });

    test('writes later errors normally once an error-event write has finished', async () => {
        await tracker.incrementError('HEALTH_API', 'Server_1');
        await flushErrorEventWrites();
        await tracker.incrementError('PROXY_API', 'Server_1');
        await flushErrorEventWrites();

        expect(mockWriteBatchToInfluxV1).toHaveBeenCalledTimes(2);
    });
});

describe('ErrorTracker running error summary', () => {
    let tracker;

    const summaryLines = () =>
        mockLogger.info.mock.calls
            .map(([message]) => message)
            .filter((message) => message.includes('ERROR TRACKER: Error counts today (UTC)'));

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        // logSummary.enable absent from config, so summary logging defaults to enabled
        mockConfigHas.mockReturnValue(false);
        mockConfigGet.mockReturnValue(undefined);
        mockIsInfluxDbEnabled.mockReturnValue(false);
        tracker = new ErrorTracker(mockLogger);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('logs the first error at once', async () => {
        await tracker.incrementError('API_1', 'Server_1');
        expect(summaryLines()).toHaveLength(1);
        expect(summaryLines()[0]).toContain('Total=1');
    });

    test('logs errors that arrive within a minute of the last line once, when the minute is up', async () => {
        await tracker.incrementError('API_1', 'Server_1');
        await tracker.incrementError('API_1', 'Server_1');
        await tracker.incrementError('API_2', 'Server_1');
        expect(summaryLines()).toHaveLength(1);

        jest.advanceTimersByTime(59 * 1000);
        expect(summaryLines()).toHaveLength(1);

        jest.advanceTimersByTime(1000);
        expect(summaryLines()).toHaveLength(2);
        expect(summaryLines()[1]).toContain('Total=3');
    });

    test('logs at once when a minute has passed since the last line', async () => {
        await tracker.incrementError('API_1', 'Server_1');
        jest.advanceTimersByTime(61 * 1000);
        await tracker.incrementError('API_1', 'Server_1');

        expect(summaryLines()).toHaveLength(2);
        expect(summaryLines()[1]).toContain('Total=2');
    });

    test('does not log twice when an error arrives while the pending summary is overdue', async () => {
        await tracker.incrementError('API_1', 'Server_1'); // Logged at once
        jest.advanceTimersByTime(10 * 1000);
        await tracker.incrementError('API_1', 'Server_1'); // Schedules the pending summary

        // The clock passes the pending summary's due time, but its timer has not run yet,
        // as when the event loop is busy. An error arriving now is logged at once...
        jest.setSystemTime(Date.now() + 60 * 1000);
        await tracker.incrementError('API_1', 'Server_1');
        expect(summaryLines()).toHaveLength(2);
        expect(summaryLines()[1]).toContain('Total=3');

        // ...so the overdue timer must not log the same totals again right after
        jest.runOnlyPendingTimers();
        expect(summaryLines()).toHaveLength(2);
    });

    test('logs one line a minute during a steady stream of errors', async () => {
        // One error a second for five minutes
        for (let second = 0; second < 300; second++) {
            await tracker.incrementError('API_1', 'Server_1');
            jest.advanceTimersByTime(1000);
        }

        // Lines at 0, 60, 120, 180, 240 and 300 seconds, instead of one per error
        expect(summaryLines()).toHaveLength(6);
        expect(summaryLines()[5]).toContain('Total=300');
    });
});

describe('setupErrorCounterReset', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('schedules reset and handles midnight', async () => {
        const { setupErrorCounterReset } = await import('../error-tracker.js');
        const globals = (await import('../../globals.js')).default;

        globals.errorTracker = new ErrorTracker(mockLogger);

        setupErrorCounterReset();
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Scheduled next error counter reset')
        );

        // Fast forward to midnight
        // We need to be careful here because the delay is calculated based on real time.
        // But since we use fake timers, we can just advance by a large enough amount.
        // Or better, we can mock Date to return a fixed time.

        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setUTCHours(24, 0, 0, 0);
        const msUntilMidnight = nextMidnight - now;

        jest.advanceTimersByTime(msUntilMidnight);

        // Wait for any pending promises (like the async callback in setTimeout)
        await Promise.resolve();
        await Promise.resolve();

        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Midnight UTC reached')
        );
    });

    /**
     * Starts the midnight reset cycle with three errors counted, and runs it to midnight UTC.
     *
     * @param {boolean} logSummaryEnabled - Value of Butler-SOS.errorTracking.logSummary.enable
     * @returns {Promise<string[]>} Messages logged at info level
     */
    async function runToMidnight(logSummaryEnabled) {
        const { setupErrorCounterReset } = await import('../error-tracker.js');
        const globals = (await import('../../globals.js')).default;

        mockConfigHas.mockImplementation(
            (key) => key === 'Butler-SOS.errorTracking.logSummary.enable'
        );
        mockConfigGet.mockImplementation((key) =>
            key === 'Butler-SOS.errorTracking.logSummary.enable' ? logSummaryEnabled : undefined
        );
        globals.errorTracker = new ErrorTracker(mockLogger);
        globals.errorTracker.errorCounts.push({
            apiType: 'API_1',
            serverName: 'Server_1',
            count: 3,
        });

        setupErrorCounterReset();

        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setUTCHours(24, 0, 0, 0);
        await jest.advanceTimersByTimeAsync(nextMidnight - now);

        return mockLogger.info.mock.calls.map(([message]) => message);
    }

    test('logs the daily summary at midnight when logSummary.enable is true', async () => {
        const messages = await runToMidnight(true);
        expect(messages).toContainEqual(
            expect.stringContaining('ERROR TRACKER: Error counts today (UTC): Total=3')
        );
        expect(messages).toContain('ERROR TRACKER: Reset all error counters');
    });

    test('resets counters at midnight without logging a summary when logSummary.enable is false', async () => {
        const messages = await runToMidnight(false);
        expect(messages).not.toContainEqual(
            expect.stringContaining('ERROR TRACKER: Error counts today (UTC)')
        );
        expect(messages).toContain('ERROR TRACKER: Reset all error counters');
    });

    describe('when errors arrive around midnight', () => {
        /**
         * Reads the summary lines logged so far.
         *
         * @returns {number[]} The Total= value of each summary line logged, in order
         */
        const summaryTotals = () =>
            mockLogger.info.mock.calls
                .map(([message]) => message)
                .filter((message) => message.includes('ERROR TRACKER: Error counts today (UTC)'))
                .map((message) => Number(message.match(/Total=(\d+)/)[1]));

        /**
         * Counts the counter resets logged so far.
         *
         * @returns {number} How many times the counters were reset
         */
        const resetCount = () =>
            mockLogger.info.mock.calls.filter(
                ([message]) => message === 'ERROR TRACKER: Reset all error counters'
            ).length;

        /**
         * Sets the clock to 23:59:00 UTC, starts the midnight reset cycle, and counts three
         * errors before midnight. The one at 23:59:30 is logged at once. The ones at 23:59:45
         * and 23:59:59 wait for the pending running summary, due at 00:00:30.
         *
         * @returns {Promise<ErrorTracker>} The tracker, also set as globals.errorTracker
         */
        async function countErrorsUntilJustBeforeMidnight() {
            const { setupErrorCounterReset } = await import('../error-tracker.js');
            const globals = (await import('../../globals.js')).default;

            // logSummary.enable absent from config, so summary logging defaults to enabled
            mockConfigHas.mockReturnValue(false);
            mockConfigGet.mockReturnValue(undefined);
            mockIsInfluxDbEnabled.mockReturnValue(false);
            jest.setSystemTime(new Date('2026-10-16T23:59:00.000Z'));

            const tracker = new ErrorTracker(mockLogger);
            globals.errorTracker = tracker;
            setupErrorCounterReset();

            jest.advanceTimersByTime(30 * 1000); // 23:59:30
            await tracker.incrementError('API_1', 'Server_1');
            jest.advanceTimersByTime(15 * 1000); // 23:59:45
            await tracker.incrementError('API_1', 'Server_1');
            jest.advanceTimersByTime(14 * 1000); // 23:59:59
            await tracker.incrementError('API_1', 'Server_1');

            expect(summaryTotals()).toEqual([1]);
            return tracker;
        }

        test('an error just after midnight, before the midnight timer runs, closes the previous day once', async () => {
            const tracker = await countErrorsUntilJustBeforeMidnight();

            // The clock passes midnight, but the midnight timer has not run yet, as on a busy
            // event loop. An error arrives first.
            jest.setSystemTime(new Date('2026-10-17T00:00:00.003Z'));
            await tracker.incrementError('API_1', 'Server_1');

            // Then the late midnight timer runs, and the old pending summary's time passes
            await jest.advanceTimersByTimeAsync(60 * 1000);

            // The 23:59:30 running total, the final total for 2026-10-16 with all three of its
            // errors, and the new day's first error. Nothing logged twice, nothing lost.
            expect(summaryTotals()).toEqual([1, 3, 1]);
            expect(resetCount()).toBe(1);
            expect(tracker.lastResetDate).toBe('2026-10-17');
            expect(await tracker.getErrorCounts()).toEqual([
                { apiType: 'API_1', serverName: 'Server_1', count: 1 },
            ]);
        });

        test('the midnight timer running first closes the previous day once, and the next error starts the new one', async () => {
            const tracker = await countErrorsUntilJustBeforeMidnight();

            // Midnight passes and the timer runs on time
            await jest.advanceTimersByTimeAsync(1000);
            expect(summaryTotals()).toEqual([1, 3]);

            // The new day's first error is logged at once, as the new day's total
            jest.advanceTimersByTime(10);
            await tracker.incrementError('API_1', 'Server_1');
            expect(summaryTotals()).toEqual([1, 3, 1]);

            // The running summary that was pending at midnight does not log again
            await jest.advanceTimersByTimeAsync(60 * 1000);
            expect(summaryTotals()).toEqual([1, 3, 1]);
            expect(resetCount()).toBe(1);
            expect(tracker.lastResetDate).toBe('2026-10-17');
            expect(await tracker.getErrorCounts()).toEqual([
                { apiType: 'API_1', serverName: 'Server_1', count: 1 },
            ]);
        });
    });
});
