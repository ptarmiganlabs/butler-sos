/**
 * End-to-end tests for the error tracker writing its own error events to InfluxDB.
 *
 * These use the real error tracker and the real InfluxDB write helpers; only globals (config,
 * logger and the InfluxDB client) are mocked. They check that when InfluxDB rejects an error
 * event, that failure is not tracked as a new error. If it were, every tracked failure would
 * schedule another error-event write, which fails the same way, and the writes would multiply.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
};

const mockConfigValues = {};

const mockGlobals = {
    logger: mockLogger,
    config: {
        has: jest.fn((key) => key in mockConfigValues),
        get: jest.fn((key) => mockConfigValues[key]),
    },
    influx: null,
    errorTracker: null,
    getErrorMessage: (err) => err?.message || String(err),
};

jest.unstable_mockModule('../../globals.js', () => ({
    default: mockGlobals,
}));

const { ErrorTracker } = await import('../error-tracker.js');

/**
 * Sets up config with error tracking and InfluxDB error events enabled.
 *
 * @param {number} version - InfluxDB version (1, 2 or 3)
 */
function configureErrorTracking(version) {
    for (const key of Object.keys(mockConfigValues)) delete mockConfigValues[key];
    Object.assign(mockConfigValues, {
        'Butler-SOS.errorTracking.enable': true,
        'Butler-SOS.errorTracking.logSummary.enable': false,
        'Butler-SOS.errorTracking.influxdb.enable': true,
        'Butler-SOS.errorTracking.influxdb.measurementName': 'butler_sos_errors',
        'Butler-SOS.influxdbConfig.version': version,
        'Butler-SOS.influxdbConfig.maxBatchSize': 1000,
        'Butler-SOS.influxdbConfig.v2Config.org': 'my-org',
        'Butler-SOS.influxdbConfig.v2Config.bucket': 'my-bucket',
        'Butler-SOS.influxdbConfig.v3Config.database': 'my-db',
    });
}

/**
 * Creates an InfluxDB client mock whose writes all fail with the given error.
 *
 * @param {number} version - InfluxDB version (1, 2 or 3)
 * @param {Error} writeError - Error every write rejects with
 * @returns {{ client: object, writeAttempts: import('jest-mock').Mock }} The client, and a mock recording each write attempt
 */
function createFailingInfluxClient(version, writeError) {
    const writeAttempts = jest.fn().mockRejectedValue(writeError);

    if (version === 1) {
        return { client: { writePoints: writeAttempts }, writeAttempts };
    }
    if (version === 2) {
        return {
            client: {
                getWriteApi: jest.fn(() => ({
                    writePoints: writeAttempts,
                    close: jest.fn().mockResolvedValue(),
                })),
            },
            writeAttempts,
        };
    }
    return { client: { write: writeAttempts }, writeAttempts };
}

describe('ErrorTracker: failed InfluxDB error-event writes are not tracked again', () => {
    let tracker;
    let errorEventWrites;

    beforeEach(() => {
        jest.clearAllMocks();
        tracker = new ErrorTracker(mockLogger);
        mockGlobals.errorTracker = tracker;

        // Record each error-event write so the tests can wait for all of them to finish.
        // Only the first MAX_REAL_WRITES are carried out. Without the fix the writes grow
        // exponentially and exhaust the heap within seconds; the cap turns that into an
        // ordinary failed assertion on the number of writes.
        const MAX_REAL_WRITES = 20;
        errorEventWrites = [];
        const writeErrorEvent = tracker._writeErrorToInfluxDB.bind(tracker);
        jest.spyOn(tracker, '_writeErrorToInfluxDB').mockImplementation((...args) => {
            if (errorEventWrites.length >= MAX_REAL_WRITES) {
                return Promise.resolve();
            }
            const write = writeErrorEvent(...args);
            errorEventWrites.push(write);
            return write;
        });
        jest.spyOn(tracker, 'incrementError');
    });

    afterEach(() => {
        jest.useRealTimers();
        mockGlobals.errorTracker = null;
        mockGlobals.influx = null;
    });

    /**
     * Waits until no new error-event writes are being started, for up to `rounds` rounds.
     * Any write the code starts gets several chances to run, so a feedback loop would show up
     * as more than one write.
     *
     * @param {() => Promise<void>} [advanceTimers] - Called while waiting, to move fake timers along
     * @param {number} [rounds] - Maximum number of rounds to wait
     */
    async function waitForErrorEventWrites(advanceTimers, rounds = 5) {
        for (let round = 0; round < rounds; round++) {
            await new Promise((resolve) => setImmediate(resolve));

            let settled = false;
            const allWrites = Promise.allSettled(errorEventWrites).then(() => {
                settled = true;
            });
            for (let step = 0; advanceTimers && !settled && step < 500; step++) {
                await advanceTimers();
            }
            await allWrites;
        }
    }

    test.each([1, 2, 3])(
        'InfluxDB v%i: a non-retryable write failure does not call incrementError again',
        async (version) => {
            configureErrorTracking(version);
            const { client, writeAttempts } = createFailingInfluxClient(
                version,
                new Error('400 Bad Request: field type conflict')
            );
            mockGlobals.influx = client;

            await tracker.incrementError('HEALTH_API', 'sense1');
            await waitForErrorEventWrites();

            // The error event was written, and InfluxDB rejected it
            expect(tracker._writeErrorToInfluxDB).toHaveBeenCalledTimes(1);
            expect(writeAttempts).toHaveBeenCalled();

            // ...but the rejection was not tracked, so no further error event was written
            expect(tracker.incrementError).toHaveBeenCalledTimes(1);
            expect(await tracker.getErrorCounts()).toEqual([
                { apiType: 'HEALTH_API', serverName: 'sense1', count: 1 },
            ]);
        }
    );

    test.each([1, 2, 3])(
        'InfluxDB v%i: an error event that cannot reach InfluxDB gets one attempt and does not call incrementError again',
        async (version) => {
            // Leave setImmediate real: the error tracker uses it to start the write
            jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
            configureErrorTracking(version);
            const { client, writeAttempts } = createFailingInfluxClient(
                version,
                new Error('connect ECONNREFUSED 127.0.0.1:8086')
            );
            mockGlobals.influx = client;

            await tracker.incrementError('PROXY_API', 'sense1');
            await waitForErrorEventWrites(() => jest.advanceTimersByTimeAsync(1000));

            expect(tracker._writeErrorToInfluxDB).toHaveBeenCalledTimes(1);
            // Error events are written without retries, and an unreachable InfluxDB is not
            // tried again with smaller batches: one attempt in all
            expect(writeAttempts).toHaveBeenCalledTimes(1);
            expect(tracker.incrementError).toHaveBeenCalledTimes(1);
            expect(await tracker.getErrorCounts()).toEqual([
                { apiType: 'PROXY_API', serverName: 'sense1', count: 1 },
            ]);
        }
    );

    test('a failed data write is counted once by its caller, and its error event is written once', async () => {
        configureErrorTracking(1);
        const { client, writeAttempts } = createFailingInfluxClient(
            1,
            new Error('400 Bad Request: field type conflict')
        );
        mockGlobals.influx = client;
        const { writeBatchToInfluxV1 } = await import('../influxdb/shared/utils.js');

        // An ordinary data write (not an error event) that InfluxDB rejects, counted the way
        // every caller of the batch writers counts it: once, where the failed batch is caught
        try {
            await writeBatchToInfluxV1(
                [{ measurement: 'sense_server', fields: { version: '1' } }],
                'Health metrics',
                'sense1',
                1000
            );
            throw new Error('the write was expected to fail');
        } catch (err) {
            expect(err.message).toContain('Failed to write 1 of 1 point(s)');
            await tracker.incrementError('INFLUXDB_V1_WRITE', 'sense1', {}, err);
        }

        await waitForErrorEventWrites();

        // The batch writer itself counted nothing: the caller's count is the only one. It used
        // to count once per batch size tried as well, each count writing its own error event.
        expect(tracker.incrementError).toHaveBeenCalledTimes(1);
        expect(tracker._writeErrorToInfluxDB).toHaveBeenCalledTimes(1);
        // One attempt for the data point, one for its error event, which also fails untracked
        expect(writeAttempts).toHaveBeenCalledTimes(2);
        expect(await tracker.getErrorCounts()).toEqual([
            { apiType: 'INFLUXDB_V1_WRITE', serverName: 'sense1', count: 1 },
        ]);
    });
});
