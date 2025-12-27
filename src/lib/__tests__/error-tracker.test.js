import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';

const mockLogger = {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
};

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: mockLogger,
        errorTracker: null,
    },
}));

jest.unstable_mockModule('../influxdb/error-metrics.js', () => ({
    postErrorMetricsToInfluxdb: jest.fn().mockResolvedValue(true),
}));

const { ErrorTracker } = await import('../error-tracker.js');

describe('ErrorTracker', () => {
    let tracker;

    beforeEach(() => {
        jest.clearAllMocks();
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
});
