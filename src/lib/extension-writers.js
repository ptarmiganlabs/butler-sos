/**
 * The writers an extension's `afterStart` hook gets: Butler SOS's own InfluxDB and MQTT outputs,
 * reached through the same batching, retry and timestamping core's own data goes through.
 *
 * An extension describes its data as plain values and never sees an InfluxDB client, so it works
 * the same against InfluxDB v1, v2 and v3, and a change to how core writes reaches it with no
 * change of its own. See `hooks.afterStart` in `src/lib/extensions/apply.js`.
 *
 * Each writer exists only when its output is on and its client was created. A stock build calls
 * nothing here: the writers are built only when the description has an `afterStart` hook.
 */

import { Point } from '@influxdata/influxdb-client';
import { Point as Point3 } from '@influxdata/influxdb3-client';

import globals from '../globals.js';
import {
    sanitizeInfluxTagValue,
    writeBatchToInfluxV1,
    writeBatchToInfluxV2,
    writeBatchToInfluxV3,
} from './influxdb/shared/utils.js';

/** How core's write paths name these points in their logs and retries. */
const CONTEXT = 'Extension points';

/**
 * A point, as an extension describes it.
 *
 * @typedef {object} ExtensionPoint
 * @property {string} measurement - The measurement.
 * @property {{[name: string]: string|number|boolean|null|undefined}} [tags] - Tags. A null or
 *     undefined one is left out; any other is written as a string.
 * @property {{[name: string]: number|boolean|string}} fields - At least one field. A number is
 *     written as a float, in every InfluxDB version, so a field keeps one type however its values
 *     happen to come out.
 * @property {Date} [timestamp] - When it was measured. Without one, core stamps it once, so it
 *     keeps its time through every retry of its write.
 */

/**
 * Check a point, and say what is wrong with it.
 *
 * @param {unknown} point - What the extension handed over.
 * @param {number} index - Where it is in the list, for the message.
 *
 * @returns {void} Nothing.
 *
 * @throws {TypeError} When it is not a point Butler SOS can write.
 */
const assertPoint = (point, index) => {
    const where = `Extension point ${index}`;

    if (point === null || typeof point !== 'object') {
        throw new TypeError(`${where} is not an object.`);
    }

    if (typeof point.measurement !== 'string' || point.measurement.trim() === '') {
        throw new TypeError(`${where} has no measurement.`);
    }

    if (point.tags !== undefined && (point.tags === null || typeof point.tags !== 'object')) {
        throw new TypeError(`${where} (${point.measurement}) has tags that are not an object.`);
    }

    const fields = Object.entries(point.fields ?? {});

    if (fields.length === 0) {
        throw new TypeError(`${where} (${point.measurement}) has no fields.`);
    }

    for (const [name, value] of fields) {
        const usable =
            (typeof value === 'number' && Number.isFinite(value)) ||
            typeof value === 'boolean' ||
            typeof value === 'string';

        if (!usable) {
            throw new TypeError(
                `${where} (${point.measurement}) has field '${name}' that is not a finite number, a boolean or a string.`
            );
        }
    }

    if (
        point.timestamp !== undefined &&
        !(point.timestamp instanceof Date && Number.isFinite(point.timestamp.getTime()))
    ) {
        throw new TypeError(`${where} (${point.measurement}) has a timestamp that is not a Date.`);
    }
};

/**
 * A point's tags, without the absent ones, as strings.
 *
 * @param {ExtensionPoint} point - The point.
 *
 * @returns {Array<[string, string]>} Tag names and values.
 */
const tagsOf = (point) =>
    Object.entries(point.tags ?? {})
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([name, value]) => [name, String(value)]);

/**
 * A Date as the nanosecond string every write in Butler SOS uses.
 *
 * @param {Date} date - The moment.
 *
 * @returns {string} Nanoseconds since the epoch.
 */
const nanoseconds = (date) => (BigInt(date.getTime()) * 1_000_000n).toString();

/**
 * A point as the given InfluxDB version's writer takes it.
 *
 * @param {ExtensionPoint} point - The point, already checked.
 * @param {1|2|3} version - The InfluxDB version.
 *
 * @returns {object} A plain datapoint for v1, a `Point` for v2, a v3 `Point` for v3.
 */
export const toInfluxPoint = (point, version) => {
    const fields = Object.entries(point.fields);
    const tags = tagsOf(point);

    if (version === 1) {
        return {
            measurement: point.measurement,
            tags: Object.fromEntries(tags),
            fields: Object.fromEntries(fields),
            ...(point.timestamp ? { timestamp: nanoseconds(point.timestamp) } : {}),
        };
    }

    if (version === 2) {
        const p = new Point(point.measurement);

        for (const [name, value] of tags) p.tag(name, value);
        for (const [name, value] of fields) {
            if (typeof value === 'number') p.floatField(name, value);
            else if (typeof value === 'boolean') p.booleanField(name, value);
            else p.stringField(name, value);
        }
        if (point.timestamp) p.timestamp(nanoseconds(point.timestamp));

        return p;
    }

    const p = new Point3(point.measurement);

    for (const [name, value] of tags) p.setTag(name, sanitizeInfluxTagValue(value));
    for (const [name, value] of fields) {
        if (typeof value === 'number') p.setFloatField(name, value);
        else if (typeof value === 'boolean') p.setBooleanField(name, value);
        else p.setStringField(name, value);
    }
    if (point.timestamp) p.setTimestamp(nanoseconds(point.timestamp));

    return p;
};

/**
 * Write points through Butler SOS's InfluxDB output.
 *
 * @param {object} settings - The globals singleton.
 * @param {unknown} points - The points, as {@link ExtensionPoint}s.
 *
 * @returns {Promise<void>} Resolves when they are written; rejects when one is malformed, before
 *     any is written, or when the write failed after core's own retries.
 */
const writePoints = async (settings, points) => {
    if (!Array.isArray(points)) {
        throw new TypeError('writePoints takes an array of points.');
    }

    points.forEach(assertPoint);

    if (points.length === 0) {
        return;
    }

    const config = settings.config.get.bind(settings.config);
    const version = config('Butler-SOS.influxdbConfig.version');
    const maxBatchSize = config('Butler-SOS.influxdbConfig.maxBatchSize');
    const written = points.map((point) => toInfluxPoint(point, version));

    if (version === 1) {
        await writeBatchToInfluxV1(written, CONTEXT, 'EXTENSION', maxBatchSize);
    } else if (version === 2) {
        await writeBatchToInfluxV2(
            written,
            config('Butler-SOS.influxdbConfig.v2Config.org'),
            config('Butler-SOS.influxdbConfig.v2Config.bucket'),
            CONTEXT,
            'EXTENSION',
            maxBatchSize
        );
    } else {
        await writeBatchToInfluxV3(
            written,
            config('Butler-SOS.influxdbConfig.v3Config.database'),
            CONTEXT,
            'EXTENSION',
            maxBatchSize
        );
    }
};

/**
 * Publish a message through Butler SOS's MQTT output.
 *
 * @param {object} settings - The globals singleton.
 * @param {string} topic - Relative to `Butler-SOS.mqttConfig.baseTopic`.
 * @param {unknown} payload - A string or Buffer is sent as it is; anything else as JSON.
 * @param {{retain?: boolean}} [options] - Whether the broker keeps it for new subscribers.
 *
 * @returns {Promise<void>} Resolves when the client has handed it on.
 */
const publish = (settings, topic, payload, { retain = false } = {}) => {
    if (typeof topic !== 'string' || topic === '') {
        return Promise.reject(new TypeError('publish takes a topic.'));
    }

    const message =
        typeof payload === 'string' || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload);
    const fullTopic = `${settings.config.get('Butler-SOS.mqttConfig.baseTopic')}${topic}`;

    return new Promise((resolve, reject) => {
        settings.mqttClient.publish(fullTopic, message, { retain }, (err) =>
            err ? reject(err) : resolve()
        );
    });
};

/**
 * Whether a setting is exactly `true`.
 *
 * @param {object} settings - The globals singleton.
 * @param {string} path - The setting.
 *
 * @returns {boolean} True when it is set to true.
 */
const on = (settings, path) => settings.config.has(path) && settings.config.get(path) === true;

/**
 * The writers for an `afterStart` hook.
 *
 * @param {object} [settings] - The globals singleton, once core's services have started.
 *
 * @returns {{influxdb?: {writePoints: (points: ExtensionPoint[]) => Promise<void>},
 *     mqtt?: {publish: (topic: string, payload: unknown, options?: {retain?: boolean}) => Promise<void>}}}
 *     A writer for each output that is on and has a client; undefined for the others.
 */
export const createExtensionWriters = (settings = globals) => ({
    influxdb:
        on(settings, 'Butler-SOS.influxdbConfig.enable') && settings.influx
            ? Object.freeze({
                  /**
                   * Write points to the configured InfluxDB.
                   *
                   * @param {ExtensionPoint[]} points - The points.
                   * @returns {Promise<void>} Resolves when they are written.
                   */
                  writePoints: (points) => writePoints(settings, points),
              })
            : undefined,
    mqtt:
        on(settings, 'Butler-SOS.mqttConfig.enable') && settings.mqttClient
            ? Object.freeze({
                  /**
                   * Publish a message under the configured base topic.
                   *
                   * @param {string} topic - Relative to the base topic.
                   * @param {unknown} payload - A string or Buffer as it is, anything else as JSON.
                   * @param {{retain?: boolean}} [options] - Whether the broker keeps it.
                   * @returns {Promise<void>} Resolves when the client has handed it on.
                   */
                  publish: (topic, payload, options) => publish(settings, topic, payload, options),
              })
            : undefined,
});
