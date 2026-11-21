import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// The writers an extension's afterStart hook gets, over a fake globals and core's batch writers:
// which exist when, what each InfluxDB version is handed, and what MQTT is asked to publish.

const settings = {
    config: { get: jest.fn(), has: jest.fn() },
    influx: {},
    mqttClient: { publish: jest.fn() },
    logger: { warn: jest.fn(), verbose: jest.fn(), error: jest.fn() },
};

jest.unstable_mockModule('../../globals.js', () => ({ default: settings }));

const mockUtils = {
    sanitizeInfluxTagValue: jest.fn((value) => String(value).replace(/[<>\\\n\r]/g, '')),
    writeBatchToInfluxV1: jest.fn().mockResolvedValue(),
    writeBatchToInfluxV2: jest.fn().mockResolvedValue(),
    writeBatchToInfluxV3: jest.fn().mockResolvedValue(),
};

jest.unstable_mockModule('../influxdb/shared/utils.js', () => mockUtils);

const { createExtensionWriters, toInfluxPoint } = await import('../extension-writers.js');

/**
 * Point the fake config at a set of settings.
 *
 * @param {object} values - Dotted paths and their values.
 *
 * @returns {void} Nothing.
 */
const configure = (values) => {
    settings.config.get.mockImplementation((path) => values[path]);
    settings.config.has.mockImplementation((path) => Object.hasOwn(values, path));
};

const BASE = {
    'Butler-SOS.influxdbConfig.enable': true,
    'Butler-SOS.influxdbConfig.maxBatchSize': 500,
    'Butler-SOS.influxdbConfig.v2Config.org': 'acme',
    'Butler-SOS.influxdbConfig.v2Config.bucket': 'butler',
    'Butler-SOS.influxdbConfig.v3Config.database': 'butlerdb',
    'Butler-SOS.mqttConfig.enable': true,
    'Butler-SOS.mqttConfig.baseTopic': 'butler-sos/',
};

const POINT = {
    measurement: 'example_summary',
    tags: { host: 'sense1', proxy: '/', absent: null, count: 3 },
    fields: { users: 12, at_limit: true, state: 'ok' },
    timestamp: new Date('2026-11-21T10:00:00.000Z'),
};

beforeEach(() => {
    jest.clearAllMocks();
    settings.influx = {};
    settings.mqttClient = { publish: jest.fn((topic, message, options, done) => done()) };
});

describe('which writers an afterStart hook gets', () => {
    test('both, when both outputs are on and have a client', () => {
        configure({ ...BASE, 'Butler-SOS.influxdbConfig.version': 2 });

        const writers = createExtensionWriters(settings);

        expect(typeof writers.influxdb.writePoints).toBe('function');
        expect(typeof writers.mqtt.publish).toBe('function');
        expect(Object.isFrozen(writers.influxdb)).toBe(true);
    });

    test.each([
        ['InfluxDB is off', { 'Butler-SOS.influxdbConfig.enable': false }, 'influxdb'],
        ['MQTT is off', { 'Butler-SOS.mqttConfig.enable': false }, 'mqtt'],
    ])('no InfluxDB or MQTT writer when %s', (_name, change, absent) => {
        configure({ ...BASE, ...change });

        expect(createExtensionWriters(settings)[absent]).toBeUndefined();
    });

    test('none for an output whose client was never created', () => {
        configure(BASE);
        settings.influx = undefined;
        settings.mqttClient = undefined;

        expect(createExtensionWriters(settings)).toEqual({ influxdb: undefined, mqtt: undefined });
    });
});

describe('a point, as each InfluxDB version takes it', () => {
    test('v1: a plain datapoint, without the absent tag, with a nanosecond timestamp', () => {
        expect(toInfluxPoint(POINT, 1)).toEqual({
            measurement: 'example_summary',
            tags: { host: 'sense1', proxy: '/', count: '3' },
            fields: { users: 12, at_limit: true, state: 'ok' },
            timestamp: '1795255200000000000',
        });
    });

    test('v2: a Point, numbers as floats, in line protocol', () => {
        expect(toInfluxPoint(POINT, 2).toLineProtocol()).toBe(
            'example_summary,count=3,host=sense1,proxy=/ at_limit=T,state="ok",users=12 1795255200000000000'
        );
    });

    test('v3: a Point, numbers as floats, tags sanitised, in line protocol', () => {
        const line = toInfluxPoint(
            { ...POINT, tags: { host: 'sense<1>' }, timestamp: undefined },
            3
        ).toLineProtocol();

        expect(line).toMatch(/^example_summary,host=sense1 /);
        expect(line).toContain('users=12');
        expect(line).toContain('at_limit=T');
        expect(line).toContain('state="ok"');
        expect(mockUtils.sanitizeInfluxTagValue).toHaveBeenCalledWith('sense<1>');
    });

    test('without a timestamp, leaves the stamping to core', () => {
        expect(toInfluxPoint({ ...POINT, timestamp: undefined }, 1)).not.toHaveProperty(
            'timestamp'
        );
    });
});

describe('writePoints', () => {
    test.each([
        [1, 'writeBatchToInfluxV1', ['Extension points', 'EXTENSION', 500]],
        [2, 'writeBatchToInfluxV2', ['acme', 'butler', 'Extension points', 'EXTENSION', 500]],
        [3, 'writeBatchToInfluxV3', ['butlerdb', 'Extension points', 'EXTENSION', 500]],
    ])('goes through core’s v%s batch writer', async (version, writer, args) => {
        configure({ ...BASE, 'Butler-SOS.influxdbConfig.version': version });

        await createExtensionWriters(settings).influxdb.writePoints([POINT, POINT]);

        expect(mockUtils[writer]).toHaveBeenCalledTimes(1);
        expect(mockUtils[writer].mock.calls[0][0]).toHaveLength(2);
        expect(mockUtils[writer].mock.calls[0].slice(1)).toEqual(args);
    });

    test('writes nothing for no points', async () => {
        configure({ ...BASE, 'Butler-SOS.influxdbConfig.version': 1 });

        await createExtensionWriters(settings).influxdb.writePoints([]);

        expect(mockUtils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test.each([
        ['not an array', POINT, 'takes an array'],
        ['a point that is not an object', [null], 'is not an object'],
        ['a point with no measurement', [{ ...POINT, measurement: ' ' }], 'has no measurement'],
        ['a point with no fields', [{ ...POINT, fields: {} }], 'has no fields'],
        ['a NaN field', [{ ...POINT, fields: { users: Number.NaN } }], "field 'users'"],
        ['an object field', [{ ...POINT, fields: { users: {} } }], "field 'users'"],
        ['tags that are not an object', [{ ...POINT, tags: 'host=x' }], 'tags that are not'],
        ['a timestamp that is not a Date', [{ ...POINT, timestamp: 1 }], 'not a Date'],
    ])('refuses %s, and writes none of the points', async (_name, points, message) => {
        configure({ ...BASE, 'Butler-SOS.influxdbConfig.version': 1 });

        await expect(
            createExtensionWriters(settings).influxdb.writePoints(
                Array.isArray(points) ? [POINT, ...points] : points
            )
        ).rejects.toThrow(message);
        expect(mockUtils.writeBatchToInfluxV1).not.toHaveBeenCalled();
    });

    test('rejects when core’s writer gives up', async () => {
        configure({ ...BASE, 'Butler-SOS.influxdbConfig.version': 2 });
        mockUtils.writeBatchToInfluxV2.mockRejectedValueOnce(new Error('InfluxDB unreachable'));

        await expect(
            createExtensionWriters(settings).influxdb.writePoints([POINT])
        ).rejects.toThrow('InfluxDB unreachable');
    });
});

describe('publish', () => {
    test('publishes under the base topic, an object as JSON', async () => {
        configure(BASE);

        await createExtensionWriters(settings).mqtt.publish('example/summary', { users: 12 });

        expect(settings.mqttClient.publish).toHaveBeenCalledWith(
            'butler-sos/example/summary',
            '{"users":12}',
            { retain: false },
            expect.any(Function)
        );
    });

    test('sends a string as it is, retained when asked', async () => {
        configure(BASE);

        await createExtensionWriters(settings).mqtt.publish('example/state', 'ok', {
            retain: true,
        });

        expect(settings.mqttClient.publish.mock.calls[0].slice(0, 3)).toEqual([
            'butler-sos/example/state',
            'ok',
            { retain: true },
        ]);
    });

    test('rejects when the client reports an error, and for no topic', async () => {
        configure(BASE);
        settings.mqttClient.publish.mockImplementationOnce((topic, message, options, done) =>
            done(new Error('not connected'))
        );

        const { mqtt } = createExtensionWriters(settings);

        await expect(mqtt.publish('example', 'x')).rejects.toThrow('not connected');
        await expect(mqtt.publish('', 'x')).rejects.toThrow('takes a topic');
    });
});
