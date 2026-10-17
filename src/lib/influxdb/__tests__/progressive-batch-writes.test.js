import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * How the batch writers behave when writes fail (issue #1524).
 *
 * A failed batch is written again in progressively smaller chunks. That used to go wrong in
 * three ways, each of which these tests pin down:
 *
 * - Every batch size was tried even when it could not make the chunks any smaller, so a single
 *   point was written up to six times, each time with the full retry back-off. With InfluxDB
 *   down, one point cost 24 write attempts and several dozen log lines.
 * - When InfluxDB could not be reached at all, the writer still went on to smaller batches,
 *   down to one point per request, so a batch of N points cost 4 × N attempts or more.
 * - Each smaller pass rewrote every point, including those already written, so the points in
 *   chunks that succeeded were stored more than once.
 *
 * The failure was also counted in the error tracker once per pass, on top of the count the
 * caller makes when the batch write throws.
 */

const mockGlobals = {
    logger: {
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    config: { get: jest.fn(), has: jest.fn() },
    influx: null,
    errorTracker: null,
    getErrorMessage: (err) => err?.message || String(err),
};

jest.unstable_mockModule('../../../globals.js', () => ({
    default: mockGlobals,
}));

const utils = await import('../shared/utils.js');

/**
 * Builds a network error like the ones Node's net layer produces.
 *
 * @param {string} code - Error code, e.g. 'ECONNREFUSED'
 * @returns {Error} The error
 */
function networkError(code) {
    const err = new Error(`connect ${code} 192.168.1.176:8181`);
    err.code = code;
    err.address = '192.168.1.176';
    err.port = 8181;
    err.syscall = 'connect';
    return err;
}

// Each batch writer, with a way to install a client whose writes go through `write(ids)`, where
// ids are the numbers of the points in the chunk being written
const batchWriters = [
    {
        version: 'v1',
        makePoints: (n) =>
            Array.from({ length: n }, (_, id) => ({ measurement: 'm', fields: { id } })),
        install: (write) => {
            mockGlobals.influx = {
                writePoints: jest.fn((chunk) => write(chunk.map((p) => p.fields.id))),
            };
        },
        writeBatch: (points, maxBatchSize) =>
            utils.writeBatchToInfluxV1(points, 'test data', 'server1', maxBatchSize),
    },
    {
        version: 'v2',
        makePoints: (n) => Array.from({ length: n }, (_, id) => ({ id })),
        install: (write) => {
            mockGlobals.influx = {
                getWriteApi: jest.fn(() => ({
                    writePoints: jest.fn((chunk) => write(chunk.map((p) => p.id))),
                    close: jest.fn().mockResolvedValue(undefined),
                })),
            };
        },
        writeBatch: (points, maxBatchSize) =>
            utils.writeBatchToInfluxV2(
                points,
                'org',
                'bucket',
                'test data',
                'server1',
                maxBatchSize
            ),
    },
    {
        version: 'v3',
        makePoints: (n) =>
            Array.from({ length: n }, (_, id) => ({ toLineProtocol: () => `m id=${id}` })),
        install: (write) => {
            mockGlobals.influx = {
                write: jest.fn((lineProtocol) =>
                    write(lineProtocol.split('\n').map((line) => Number(line.split('=')[1])))
                ),
            };
        },
        writeBatch: (points, maxBatchSize) =>
            utils.writeBatchToInfluxV3(points, 'db', 'test data', 'server1', maxBatchSize),
    },
];

/**
 * Runs a write to completion, moving fake timers along so retry back-off does not take real time.
 *
 * @param {Promise} promise - The write
 * @returns {Promise<{ error: Error|undefined }>} The error the write threw, if any
 */
async function settle(promise) {
    let done = false;
    const result = promise.then(
        () => ({ error: undefined }),
        (error) => ({ error })
    );
    result.finally(() => {
        done = true;
    });
    for (let step = 0; !done && step < 10000; step++) {
        await jest.advanceTimersByTimeAsync(1000);
    }
    return result;
}

/**
 * Number of warn and error lines logged so far.
 *
 * @returns {number} Log line count
 */
function warnAndErrorLines() {
    return mockGlobals.logger.warn.mock.calls.length + mockGlobals.logger.error.mock.calls.length;
}

describe.each(batchWriters)(
    'writeBatchToInflux $version',
    ({ makePoints, install, writeBatch }) => {
        let attempts;
        let written;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.useFakeTimers();
            mockGlobals.errorTracker = { incrementError: jest.fn().mockResolvedValue(undefined) };
            attempts = 0;
            written = [];
        });

        afterEach(() => {
            jest.useRealTimers();
            mockGlobals.influx = null;
            mockGlobals.errorTracker = null;
        });

        describe('when InfluxDB cannot be reached', () => {
            beforeEach(() => {
                install(async () => {
                    attempts++;
                    throw networkError('ECONNREFUSED');
                });
            });

            test('a single point is attempted 4 times (1 + 3 retries), not once per batch size', async () => {
                const { error } = await settle(writeBatch(makePoints(1), 1000));

                expect(error).toBeDefined();
                expect(attempts).toBe(4);
                // 3 retry warnings, "all attempts failed", and one line saying the point was not written
                expect(warnAndErrorLines()).toBeLessThanOrEqual(5);
            });

            test('a large batch stops at the first chunk instead of shrinking to one point per request', async () => {
                const { error } = await settle(writeBatch(makePoints(25), 10));

                expect(error).toBeDefined();
                expect(attempts).toBe(4);
                expect(error.message).toContain('25 of 25 point(s)');
            });

            test('the thrown error keeps the network error, so the error tracker can categorise it', async () => {
                const { error } = await settle(writeBatch(makePoints(1), 1000));

                expect(error.code).toBe('ECONNREFUSED');
                expect(error.cause).toBeInstanceOf(Error);
                expect(error.cause.address).toBe('192.168.1.176');
                expect(error.message).toContain('connect ECONNREFUSED');
            });

            test('the thrown error has a one-line message, even where error messages carry stack traces', async () => {
                // Running from source, getErrorMessage() returns the whole stack trace. That
                // must not end up inside the message of the error thrown to the caller.
                const getErrorMessage = mockGlobals.getErrorMessage;
                mockGlobals.getErrorMessage = (err) => err?.stack || String(err);
                try {
                    const { error } = await settle(writeBatch(makePoints(1), 1000));

                    expect(error.message).toBe(
                        'Failed to write 1 of 1 point(s): connect ECONNREFUSED 192.168.1.176:8181'
                    );
                } finally {
                    mockGlobals.getErrorMessage = getErrorMessage;
                }
            });

            test('the failure is not counted here: the caller counts the failed batch once', async () => {
                await settle(writeBatch(makePoints(25), 10));

                expect(mockGlobals.errorTracker.incrementError).not.toHaveBeenCalled();
            });
        });

        describe('when InfluxDB rejects a write', () => {
            test('a single rejected point is attempted once, not once per batch size', async () => {
                install(async () => {
                    attempts++;
                    throw new Error('400 Bad Request: field type conflict');
                });

                const { error } = await settle(writeBatch(makePoints(1), 1000));

                expect(error).toBeDefined();
                expect(attempts).toBe(1);
            });

            test('only the points of the failed chunk are written again, so none is stored twice', async () => {
                // The chunk holding point 10 is rejected once; written alone, every point succeeds
                let rejected = false;
                install(async (ids) => {
                    attempts++;
                    if (!rejected && ids.includes(10)) {
                        rejected = true;
                        throw new Error('400 Bad Request: field type conflict');
                    }
                    written.push(...ids);
                });

                const { error } = await settle(writeBatch(makePoints(25), 10));

                expect(error).toBeUndefined();
                expect(written.sort((a, b) => a - b)).toEqual(
                    Array.from({ length: 25 }, (_, i) => i)
                );
                // Chunks 0-9, 10-19 (rejected) and 20-24, then points 10-19 one at a time
                expect(attempts).toBe(3 + 10);
            });

            test('a failed short last chunk is not written again unchanged', async () => {
                // 1001 points in batches of 1000: the first 1000 are written, the 1-point tail is
                // rejected. Writing that one point again "with batch size 500" would repeat the
                // same write, with another full round of retries for a retryable error.
                install(async (ids) => {
                    attempts++;
                    if (ids.includes(1000)) {
                        throw new Error('400 Bad Request: field type conflict');
                    }
                });

                const { error } = await settle(writeBatch(makePoints(1001), 1000));

                expect(attempts).toBe(2);
                expect(error.message).toContain('Failed to write 1 of 1001 point(s)');
            });
        });
    }
);

describe('isInfluxUnreachableError', () => {
    test.each([
        ['an error code', networkError('ECONNREFUSED')],
        ['a DNS failure', networkError('ENOTFOUND')],
        ['an unreachable host', networkError('EHOSTUNREACH')],
        ['a code on the cause', new Error('fetch failed', { cause: networkError('ECONNREFUSED') })],
        ['a code only in the message', new Error('connect ECONNREFUSED 127.0.0.1:8086')],
        ['the v1 client with no hosts left', new Error('No host available')],
    ])('recognises %s', (_, err) => {
        expect(utils.isInfluxUnreachableError(err)).toBe(true);
    });

    test.each([
        ['a timeout', networkError('ETIMEDOUT')],
        ['a reset connection', networkError('ECONNRESET')],
        ['a rejected write', new Error('400 Bad Request: field type conflict')],
        ['no error', undefined],
    ])('does not treat %s as unreachable', (_, err) => {
        expect(utils.isInfluxUnreachableError(err)).toBe(false);
    });
});
