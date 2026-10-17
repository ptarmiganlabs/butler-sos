import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Point as Point2 } from '@influxdata/influxdb-client';
import { Point as Point3 } from '@influxdata/influxdb3-client';

/**
 * Point timestamps (issue #1524).
 *
 * Metrics points used to carry no timestamp of their own. InfluxDB v2 and v3 clients stamp
 * such a point with the current time when it is serialised, which happens on every write
 * attempt, and InfluxDB v1 uses the time the server receives it. So when a write reached
 * InfluxDB but was retried anyway — after a timeout, say — the retry stored a second copy of
 * every point, inflating sums and counts.
 *
 * Every point now gets a timestamp once, before its first write attempt, and keeps it through
 * all retries, so a retried write overwrites the same points instead of adding new ones.
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
 * The timestamp at the end of a line of InfluxDB line protocol, if there is one.
 *
 * @param {string} line - A line of line protocol
 * @returns {string|undefined} The timestamp, or undefined if the line has none
 */
function lineTimestamp(line) {
    const parts = line.trim().split(' ');
    return parts.length === 3 ? parts[2] : undefined;
}

describe('nextPointTimestamp', () => {
    test('is the current time in nanoseconds, as a string of digits', () => {
        const before = BigInt(Date.now()) * 1_000_000n;
        const timestamp = utils.nextPointTimestamp();
        const after = BigInt(Date.now() + 1) * 1_000_000n;

        expect(timestamp).toMatch(/^\d+$/);
        expect(BigInt(timestamp) >= before).toBe(true);
        expect(BigInt(timestamp) < after).toBe(true);
    });

    test('never returns the same value twice, even within one millisecond', () => {
        // Two points in the same measurement with the same tags and the same timestamp are one
        // point to InfluxDB, which keeps the last. Unique timestamps keep two identical events
        // arriving in the same millisecond from overwriting each other.
        const timestamps = Array.from({ length: 5000 }, () => utils.nextPointTimestamp());

        expect(new Set(timestamps).size).toBe(timestamps.length);
    });

    test('stays within the current millisecond, so it does not drift from the clock', () => {
        jest.useFakeTimers({ now: new Date('2026-10-17T10:00:00.000Z') });
        try {
            for (let i = 0; i < 100; i++) utils.nextPointTimestamp();
            const timestamp = BigInt(utils.nextPointTimestamp());

            expect(timestamp / 1_000_000n).toBe(BigInt(Date.parse('2026-10-17T10:00:00.000Z')));
        } finally {
            jest.useRealTimers();
        }
    });
    test('does not repeat a value when the clock is set back to a millisecond already used', () => {
        // Readings T, T+1, T: restarting the sub-millisecond counter in each millisecond would
        // give the first and third calls the same timestamp
        // A millisecond no other test uses, so no earlier call has advanced its counter
        const t = Date.parse('2026-10-17T11:22:33.444Z');
        jest.useFakeTimers({ now: t });
        try {
            const first = utils.nextPointTimestamp();
            jest.setSystemTime(t + 1);
            utils.nextPointTimestamp();
            jest.setSystemTime(t);
            const revisited = utils.nextPointTimestamp();

            expect(revisited).not.toBe(first);
            expect(BigInt(revisited) / 1_000_000n).toBe(BigInt(t));
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('stampPointsOnce', () => {
    test('v1: gives a datapoint without a timestamp one, and keeps an existing one', () => {
        const unstamped = { measurement: 'm', fields: { v: 1 } };
        const stamped = { measurement: 'm', fields: { v: 1 }, timestamp: '123' };

        utils.stampPointsOnce([unstamped, stamped], 'v1');

        expect(unstamped.timestamp).toMatch(/^\d{19}$/);
        expect(stamped.timestamp).toBe('123');
    });

    test('v2: gives a Point without a timestamp one, and keeps an existing one', () => {
        // Uses the real v2 Point class: it keeps its time in a field the client does not
        // expose, so this would catch a client upgrade that changed it
        const unstamped = new Point2('m').floatField('v', 1);
        const stamped = new Point2('m').floatField('v', 1).timestamp('123');

        utils.stampPointsOnce([unstamped, stamped], 'v2');

        expect(lineTimestamp(unstamped.toLineProtocol())).toMatch(/^\d{19}$/);
        expect(lineTimestamp(stamped.toLineProtocol())).toBe('123');
    });

    test('v3: gives a Point without a timestamp one, and keeps an existing one', () => {
        const unstamped = new Point3('m').setFloatField('v', 1);
        const stamped = new Point3('m').setFloatField('v', 1).setTimestamp('123');

        utils.stampPointsOnce([unstamped, stamped], 'v3');

        expect(unstamped.getTimestamp()).toMatch(/^\d{19}$/);
        expect(lineTimestamp(stamped.toLineProtocol())).toBe('123');
    });

    test('points stamped together get distinct timestamps', () => {
        const points = Array.from({ length: 50 }, () => ({ measurement: 'm', fields: { v: 1 } }));

        utils.stampPointsOnce(points, 'v1');

        expect(new Set(points.map((p) => p.timestamp)).size).toBe(50);
    });
});

// A write that times out once and then succeeds. The timed-out attempt may well have reached
// InfluxDB, which is exactly when a retry must not create new points.
const batchWriters = [
    {
        version: 'v1',
        makePoints: () => [
            { measurement: 'm', fields: { v: 1 } },
            { measurement: 'm', fields: { v: 2 } },
        ],
        install: (record) => {
            mockGlobals.influx = {
                writePoints: jest.fn(async (chunk) => record(chunk.map((p) => p.timestamp))),
            };
        },
        writeBatch: (points) => utils.writeBatchToInfluxV1(points, 'test data', '', 1000),
    },
    {
        version: 'v2',
        makePoints: () => [new Point2('m').floatField('v', 1), new Point2('m').floatField('v', 2)],
        install: (record) => {
            mockGlobals.influx = {
                getWriteApi: jest.fn(() => ({
                    writePoints: jest.fn(async (points) =>
                        record(points.map((p) => lineTimestamp(p.toLineProtocol())))
                    ),
                    close: jest.fn().mockResolvedValue(undefined),
                })),
            };
        },
        writeBatch: (points) =>
            utils.writeBatchToInfluxV2(points, 'org', 'bucket', 'test data', '', 1000),
    },
    {
        version: 'v3',
        makePoints: () => [
            new Point3('m').setFloatField('v', 1),
            new Point3('m').setFloatField('v', 2),
        ],
        install: (record) => {
            mockGlobals.influx = {
                write: jest.fn(async (lineProtocol) =>
                    record(lineProtocol.split('\n').map(lineTimestamp))
                ),
            };
        },
        writeBatch: (points) => utils.writeBatchToInfluxV3(points, 'db', 'test data', '', 1000),
    },
];

describe.each(batchWriters)(
    'writeBatchToInflux $version',
    ({ makePoints, install, writeBatch }) => {
        beforeEach(() => {
            jest.clearAllMocks();
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
            mockGlobals.influx = null;
        });

        test('a retried write sends the same timestamps as the attempt before it', async () => {
            const attempts = [];
            install((timestamps) => {
                attempts.push(timestamps);
                if (attempts.length === 1) throw new Error('Request timed out');
            });

            const write = writeBatch(makePoints());
            await jest.advanceTimersByTimeAsync(5000);
            await write;

            expect(attempts).toHaveLength(2);
            const [first, retry] = attempts;
            expect(first.every((t) => /^\d{19}$/.test(t))).toBe(true);
            expect(retry).toEqual(first);
        });
    }
);
