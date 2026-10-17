import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Writes that fail with a transient HTTP status (408, 429, 502, 503, 504): InfluxDB is
 * overloaded or briefly unavailable.
 *
 * The InfluxDB v2 client used to retry these itself. The batch writers now turn its retries off
 * and leave retrying to writeToInfluxWithRetry, which only knew timeouts and network errors: a
 * 429 or 503 failed at once, and a larger batch went straight on to smaller requests against the
 * overloaded server. Such a status is now retried with back-off, waiting as long as a
 * Retry-After header asks (up to 60 s), and if it persists the batch stops instead of shrinking.
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
 * An HTTP error shaped like the v2 and v3 clients' HttpError.
 *
 * @param {number} statusCode - HTTP status
 * @param {object} [extra] - More properties, such as headers or retryAfter
 * @returns {Error} The error
 */
function httpError(statusCode, extra = {}) {
    return Object.assign(new Error(`${statusCode} Service Unavailable`), { statusCode }, extra);
}

// The v1 client (node-influx) reports any 5xx response with this class, without a status
class ServiceNotAvailableError extends Error {}

/**
 * Runs a promise to completion, moving fake timers along.
 *
 * @param {Promise} promise - The promise
 * @returns {Promise<{ error: Error|undefined }>} The error it rejected with, if any
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

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGlobals.errorTracker = { incrementError: jest.fn().mockResolvedValue(undefined) };
});

afterEach(() => {
    jest.useRealTimers();
    mockGlobals.influx = null;
});

describe('transientHttpStatus', () => {
    test.each([
        ['a 503 from the v2/v3 clients', httpError(503), 503],
        ['a 429 from the v2/v3 clients', httpError(429), 429],
        ['a 504 from the v2/v3 clients', httpError(504), 504],
        [
            'a 429 from the v1 client',
            Object.assign(new Error('A 429 error'), { res: { statusCode: 429 } }),
            429,
        ],
        ['a 5xx from the v1 client', new ServiceNotAvailableError('Service Unavailable'), 503],
    ])('recognises %s', (_, err, status) => {
        expect(utils.transientHttpStatus(err)).toBe(status);
    });

    test.each([
        ['a rejected write (400)', httpError(400)],
        ['an authorisation failure (401)', httpError(401)],
        ['a server error (500)', httpError(500)],
        [
            'a network error',
            Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
        ],
        ['no error', undefined],
    ])('does not treat %s as transient', (_, err) => {
        expect(utils.transientHttpStatus(err)).toBeUndefined();
    });
});

describe('writeToInfluxWithRetry and transient HTTP statuses', () => {
    test('retries a 503 and succeeds', async () => {
        const writeFn = jest.fn().mockRejectedValueOnce(httpError(503)).mockResolvedValue();

        const { error } = await settle(utils.writeToInfluxWithRetry(writeFn, 'test', 'v2'));

        expect(error).toBeUndefined();
        expect(writeFn).toHaveBeenCalledTimes(2);
    });

    test.each([
        ['the v2 client (retryAfter())', httpError(429, { retryAfter: () => 5 })],
        ['the v3 client (headers)', httpError(429, { headers: { 'retry-after': '5' } })],
        [
            'the v1 client (response headers)',
            Object.assign(new Error('A 429 error'), {
                res: { statusCode: 429, headers: { 'retry-after': '5' } },
            }),
        ],
    ])('waits as long as Retry-After asks, from %s', async (_, err) => {
        const writeFn = jest.fn().mockRejectedValueOnce(err).mockResolvedValue();

        const write = utils.writeToInfluxWithRetry(writeFn, 'test', 'v2');
        // The normal first back-off is 1 s; the server asked for 5 s
        await jest.advanceTimersByTimeAsync(4900);
        expect(writeFn).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(200);
        await write;
        expect(writeFn).toHaveBeenCalledTimes(2);
    });

    test('reads Retry-After given as an HTTP date', async () => {
        const retryAt = new Date(Date.now() + 8000).toUTCString();
        const writeFn = jest
            .fn()
            .mockRejectedValueOnce(httpError(503, { headers: { 'retry-after': retryAt } }))
            .mockResolvedValue();

        const write = utils.writeToInfluxWithRetry(writeFn, 'test', 'v3');
        await jest.advanceTimersByTimeAsync(6000);
        expect(writeFn).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(3000);
        await write;
        expect(writeFn).toHaveBeenCalledTimes(2);
    });

    test('reads an HTTP-date Retry-After from the v2 client, whose retryAfter() returns 0 for it', async () => {
        // The v2 client only parses a number of seconds; for a date it returns 0 and keeps the
        // raw header
        const retryAt = new Date(Date.now() + 8000).toUTCString();
        const writeFn = jest
            .fn()
            .mockRejectedValueOnce(
                httpError(503, { retryAfter: () => 0, headers: { 'retry-after': retryAt } })
            )
            .mockResolvedValue();

        const write = utils.writeToInfluxWithRetry(writeFn, 'test', 'v2');
        await jest.advanceTimersByTimeAsync(6000);
        expect(writeFn).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(3000);
        await write;
        expect(writeFn).toHaveBeenCalledTimes(2);
    });

    test('waits no longer than 60 s, whatever Retry-After asks', async () => {
        const writeFn = jest
            .fn()
            .mockRejectedValueOnce(httpError(503, { headers: { 'retry-after': '3600' } }))
            .mockResolvedValue();

        const write = utils.writeToInfluxWithRetry(writeFn, 'test', 'v3');
        await jest.advanceTimersByTimeAsync(60 * 1000 + 100);
        await write;

        expect(writeFn).toHaveBeenCalledTimes(2);
    });

    test('still makes a single attempt when no retries are asked for, as for error events', async () => {
        const writeFn = jest.fn().mockRejectedValue(httpError(503));

        const { error } = await settle(
            utils.writeToInfluxWithRetry(writeFn, 'test', 'v2', '', {}, { maxRetries: 0 })
        );

        expect(error).toBeDefined();
        expect(writeFn).toHaveBeenCalledTimes(1);
    });
});

// Each batch writer, with a way to install a client whose writes go through `write(ids)`
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
            utils.writeBatchToInfluxV1(points, 'test data', '', maxBatchSize),
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
            utils.writeBatchToInfluxV2(points, 'org', 'bucket', 'test data', '', maxBatchSize),
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
            utils.writeBatchToInfluxV3(points, 'db', 'test data', '', maxBatchSize),
    },
];

describe.each(batchWriters)(
    'writeBatchToInflux $version and transient HTTP statuses',
    ({ makePoints, install, writeBatch }) => {
        let attempts;

        beforeEach(() => {
            attempts = 0;
        });

        const shrinkWarnings = () =>
            mockGlobals.logger.warn.mock.calls.filter(([message]) =>
                message.includes('again, with batch size')
            ).length;

        test('retries a single point after a 503 instead of failing at once', async () => {
            install(async () => {
                attempts++;
                if (attempts === 1) throw httpError(503);
            });

            const { error } = await settle(writeBatch(makePoints(1), 1000));

            expect(error).toBeUndefined();
            expect(attempts).toBe(2);
        });

        test('retries the same chunk after a 503 instead of trying smaller batches', async () => {
            install(async (ids) => {
                attempts++;
                if (attempts === 1 && ids.includes(0)) throw httpError(503);
            });

            const { error } = await settle(writeBatch(makePoints(25), 10));

            expect(error).toBeUndefined();
            // The first chunk twice, then the other two chunks once each
            expect(attempts).toBe(4);
            expect(shrinkWarnings()).toBe(0);
        });

        test('stops when the 503 persists, instead of writing smaller batches to an overloaded server', async () => {
            install(async () => {
                attempts++;
                throw httpError(503);
            });

            const { error } = await settle(writeBatch(makePoints(25), 10));

            // Four attempts at the first chunk, and nothing after that
            expect(attempts).toBe(4);
            expect(shrinkWarnings()).toBe(0);
            expect(error.message).toContain('Failed to write 25 of 25 point(s)');
            expect(mockGlobals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('InfluxDB is not accepting writes right now (HTTP 503)')
            );
        });
    }
);
