import { jest, describe, expect, test, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { load } from 'js-yaml';

/**
 * Regression suite for issue #1450 — and for #276, which is the same defect twice before it.
 *
 * The config schema declares ~40 settings as `['array', 'null']`, and `production_template.yaml`
 * ships many of them with every entry commented out, which YAML parses as `null`. Iterating one
 * of those threw `TypeError: X is not iterable` and stopped startup.
 *
 * These tests run against **the real shipped template**, and drive the real startup functions.
 * An earlier version of this guard was a regex scanner over source text; it was replaced because
 * it could not see the `const x = cfg.get(p); for (const y of x)` idiom — which is both the
 * dominant idiom in this codebase and the exact shape of #1450 — and so passed while the bug
 * was present. Anything that replaces these tests must be checked by reverting a fix and
 * confirming the suite goes red.
 */

// host-utils is mocked only to keep verifyAppConfig off the network. The other exports are
// re-declared because the config schema imports this module too, and an ESM mock replaces the
// whole module — omitting them breaks the schema's import rather than this test's.
const mockVerifyHost = jest.fn();
jest.unstable_mockModule('../host-utils.js', () => ({
    verifyHost: mockVerifyHost,
    hostnamePattern: /^[a-z0-9.-]+$/i,
    isValidHostname: () => true,
    resolvesToIpAddress: async () => true,
}));

const { verifyAppConfig } = await import('../config-file-verify.js');
const configFileSchema = (await import('../config-file-schema.js')).default;
const { findNullableArrayPositions, normalizeNullableArrays, applySchemaDefaults } =
    await import('../util/config-utils.js');

const templatePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../config/production_template.yaml'
);

/**
 * Parses a fresh copy of the shipped production template.
 *
 * A fresh copy per test matters: these tests mutate the tree, and the normalisation under test
 * mutates in place.
 *
 * @returns {object} The parsed template.
 */
function loadTemplate() {
    return load(readFileSync(templatePath, 'utf8'));
}

/**
 * Splits a position path into traversal segments, expanding `name[idx]` notation.
 *
 * `findNullableArrayPositions` reports positions inside array elements as `app[0].include`;
 * a plain split on `.` would treat `app[0]` as a single key and never find it.
 *
 * @param {string} dotted - Position path, e.g. `a.b[0].c`.
 * @returns {Array<string|number>} Segments, with array indexes as numbers.
 */
function toSegments(dotted) {
    const segments = [];
    for (const part of dotted.split('.')) {
        const base = part.replace(/\[\d+\]/g, '');
        if (base) segments.push(base);
        for (const match of part.matchAll(/\[(\d+)\]/g)) {
            segments.push(Number(match[1]));
        }
    }
    return segments;
}

/**
 * Reads a position path out of a plain object.
 *
 * @param {object} root - Object to read from.
 * @param {string} dotted - Position path, `name[idx]` notation supported.
 * @returns {*} The value, or undefined if any segment is missing.
 */
function readPath(root, dotted) {
    return toSegments(dotted).reduce((node, key) => (node == null ? undefined : node[key]), root);
}

/**
 * Writes a position path into a plain object, creating nothing that does not already exist.
 *
 * @param {object} root - Object to write into.
 * @param {string} dotted - Position path, `name[idx]` notation supported.
 * @param {*} value - Value to set.
 * @returns {boolean} True if the path existed and was written.
 */
function writePath(root, dotted, value) {
    const segments = toSegments(dotted);
    const leaf = segments.pop();
    let node = root;
    for (const segment of segments) {
        if (node == null || typeof node !== 'object' || !(segment in node)) return false;
        node = node[segment];
    }
    if (node == null || typeof node !== 'object' || !(leaf in node)) return false;
    node[leaf] = value;
    return true;
}

/**
 * Wraps a plain object in a node-config-compatible `has`/`get` facade.
 *
 * Reproduces the two behaviours the production code depends on, both verified against the
 * installed `config` package: `has()` is true for an explicitly-null value, and `get()` throws
 * for a path that is absent entirely.
 *
 * @param {object} tree - The parsed config tree.
 * @returns {{has: (p: string) => boolean, get: (p: string) => any, set: undefined}} Facade.
 */
function asConfig(tree) {
    return {
        has: (p) => readPath(tree, p) !== undefined,
        get: (p) => {
            const value = readPath(tree, p);
            if (value === undefined) {
                throw new Error(`Configuration property "${p}" is not defined`);
            }
            return value;
        },
        // Deliberately absent, mirroring node-config: there is no set(). A mock that supplied
        // one is what hid a real `cfg.set is not a function` crash in verifyAppConfig.
        set: undefined,
    };
}

// Positions found in the SHIPPED TEMPLATE, not paths derived from the schema alone. That
// distinction is the point: a schema-only list included ten paths that do not exist in the
// template at all, so writePath silently no-opped and twenty parameterised cases re-ran the
// unmodified template while reporting green under the name of a path they never touched.
const nullablePaths = findNullableArrayPositions(loadTemplate(), configFileSchema);

describe('nullable config settings at startup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockVerifyHost.mockResolvedValue({ resolvesToIp: true, tcpReachable: true });
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('the template contains a meaningful number of nullable list settings', () => {
        // Non-vacuity guard: if the walk silently returned nothing, every parameterised test
        // below would vanish rather than fail. 36 positions exist in the shipped template
        // today (7 of them inside appSpecific.app[0]); the schema declares more (the
        // auditEvents destinations are absent from the template entirely), and only positions
        // that exist can be set to null and asserted on.
        expect(nullablePaths.length).toBeGreaterThan(20);
    });

    test('every enumerated position is actually present in the template', () => {
        // The property that makes `expect(writePath(...)).toBe(true)` below meaningful.
        const missing = nullablePaths.filter((p) => readPath(loadTemplate(), p) === undefined);

        expect(missing).toEqual([]);
    });

    test('the shipped template really does contain null list settings', () => {
        // If this ever reaches zero, the template stopped exercising the bug and the tests
        // below would no longer be reproducing #1450 against real shipped content.
        const nullInTemplate = nullablePaths.filter((p) => readPath(loadTemplate(), p) === null);

        expect(nullInTemplate.length).toBeGreaterThan(10);
    });

    test('normalisation leaves no null list anywhere in the shipped template', () => {
        const tree = loadTemplate();

        normalizeNullableArrays(tree, configFileSchema);

        const stillNull = nullablePaths.filter((p) => readPath(tree, p) === null);
        expect(stillNull).toEqual([]);
    });

    test('verifyAppConfig accepts the shipped template unchanged', async () => {
        // The headline #1450 reproduction: a fresh copy of the template, with the nullable
        // settings exactly as shipped, must pass verification.
        await expect(verifyAppConfig(asConfig(loadTemplate()))).resolves.toBe(true);
    });

    test.each(nullablePaths)(
        'verifyAppConfig survives %s being null, without normalisation',
        async (nullablePath) => {
            // Deliberately NOT normalised. This is the defence-in-depth layer: even if a
            // config reaches verification with a null list — via a code path that skips
            // normalisation, or a future refactor that moves it — verification must report a
            // verdict rather than throwing.
            const tree = loadTemplate();
            // Assert the write landed. Without this the case silently degrades into re-running
            // the unmodified template.
            expect(writePath(tree, nullablePath, null)).toBe(true);

            await expect(verifyAppConfig(asConfig(tree))).resolves.toEqual(expect.any(Boolean));
        }
    );

    test.each(nullablePaths)(
        'verifyAppConfig accepts %s being null once normalised',
        async (nullablePath) => {
            const tree = loadTemplate();
            expect(writePath(tree, nullablePath, null)).toBe(true);
            normalizeNullableArrays(tree, configFileSchema);

            await expect(verifyAppConfig(asConfig(tree))).resolves.toBe(true);
        }
    );

    test('verifyAppConfig does not call set() on the config object', async () => {
        // node-config has no set(). verifyAppConfig used to call it for the maxBatchSize
        // default, which threw outside its try/catch whenever an administrator removed or
        // mis-set that line; the unit-test mock supplied a set() the real object lacks.
        const tree = loadTemplate();
        writePath(tree, 'Butler-SOS.influxdbConfig.enable', true);
        writePath(tree, 'Butler-SOS.influxdbConfig.maxBatchSize', 20000);
        const cfg = asConfig(tree);
        cfg.set = jest.fn();

        await expect(verifyAppConfig(cfg)).resolves.toBe(true);
        expect(cfg.set).not.toHaveBeenCalled();
    });
});

describe('server tag verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockVerifyHost.mockResolvedValue({ resolvesToIp: true, tcpReachable: true });
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    /**
     * Builds a minimal config tree exercising only the server-tag checks.
     *
     * @param {Array<string>|null} serverTagsDefinition - Tag names, or null.
     * @param {Array<object>|null} servers - Server entries, or null.
     * @returns {object} Config facade.
     */
    function tagConfig(serverTagsDefinition, servers) {
        const tree = loadTemplate();
        writePath(tree, 'Butler-SOS.appNames.enableAppNameExtract', false);
        writePath(tree, 'Butler-SOS.influxdbConfig.enable', false);
        writePath(tree, 'Butler-SOS.anonTelemetry', false);
        writePath(tree, 'Butler-SOS.serversToMonitor.serverTagsDefinition', serverTagsDefinition);
        writePath(tree, 'Butler-SOS.serversToMonitor.servers', servers);
        return asConfig(tree);
    }

    test('accepts a falsy tag value', async () => {
        // Tag values are unconstrained by the schema, so false/0/"" are legitimate. A
        // truthiness test used to report them as "not defined" and refuse to start.
        await expect(
            verifyAppConfig(
                tagConfig(['isProd'], [{ serverName: 'S1', serverTags: { isProd: false } }])
            )
        ).resolves.toBe(true);
    });

    test.each([
        ['zero', 0],
        ['empty string', ''],
        ['false', false],
    ])('accepts a tag value of %s', async (_label, value) => {
        await expect(
            verifyAppConfig(tagConfig(['t'], [{ serverName: 'S1', serverTags: { t: value } }]))
        ).resolves.toBe(true);
    });

    test.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'])(
        'rejects a tag named %s when the server does not define it',
        async (tag) => {
            // `in` walks the prototype chain, so these all resolve as "present" on any object.
            // getServerTags builds tags from Object.entries (own enumerable keys), so such a
            // tag would be declared, silently accepted, and then absent from every data point.
            await expect(
                verifyAppConfig(tagConfig([tag], [{ serverName: 'S1', serverTags: {} }]))
            ).resolves.toBe(false);
        }
    );

    test('accepts a prototype-named tag the server genuinely defines', async () => {
        await expect(
            verifyAppConfig(
                tagConfig(['toString'], [{ serverName: 'S1', serverTags: { toString: 'x' } }])
            )
        ).resolves.toBe(true);
    });

    test('rejects a tag key present with no value', async () => {
        // `myTag:` with nothing after it parses as null. InfluxDB v1 would write the literal
        // string "null" while v2 and v3 drop the tag, so the data would differ by version.
        await expect(
            verifyAppConfig(tagConfig(['t'], [{ serverName: 'S1', serverTags: { t: null } }]))
        ).resolves.toBe(false);
    });

    test('still rejects a tag that is genuinely missing from a server', async () => {
        await expect(
            verifyAppConfig(tagConfig(['isProd'], [{ serverName: 'S1', serverTags: {} }]))
        ).resolves.toBe(false);
    });

    test('still rejects a server tag that is not in the definition list', async () => {
        await expect(
            verifyAppConfig(tagConfig([], [{ serverName: 'S1', serverTags: { rogue: 'x' } }]))
        ).resolves.toBe(false);
    });

    test('survives a server with no serverTags key at all', async () => {
        await expect(verifyAppConfig(tagConfig(['isProd'], [{ serverName: 'S1' }]))).resolves.toBe(
            false
        );
    });

    test('accepts a null serverTagsDefinition with servers present', async () => {
        // The exact shape the shipped template produces.
        await expect(
            verifyAppConfig(tagConfig(null, [{ serverName: 'S1', serverTags: {} }]))
        ).resolves.toBe(true);
    });
});

describe('applySchemaDefaults against the shipped schema', () => {
    // These run against the real config-file-schema.js, not a fixture. The unit tests in
    // config-utils.test.js prove the mechanism; these prove the one path in
    // SCHEMA_DEFAULT_ENTRIES still resolves in the schema as it actually ships — if
    // maxBatchSize is ever renamed or moved, this suite goes red where a fixture would not.

    /**
     * Builds a config tree with the given influxdbConfig section.
     *
     * @param {object} influxdbConfig - Section contents.
     * @returns {object} Config tree.
     */
    function influxConfig(influxdbConfig) {
        return { 'Butler-SOS': { influxdbConfig } };
    }

    test('fills an absent maxBatchSize with the schema default', () => {
        const config = influxConfig({ enable: true });

        const messages = applySchemaDefaults(config, configFileSchema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(1000);
        expect(messages).toEqual([
            { level: 'info', message: expect.stringContaining('not specified') },
        ]);
    });

    test.each([
        ['NaN', NaN],
        ['a numeric string', '20000'],
        ['a non-numeric string', 'abc'],
        ['a boolean', true],
        ['zero', 0],
        ['a negative number', -5],
        ['a value above the maximum', 20000],
        ['a non-integer', 1.5],
    ])('replaces %s with the schema default and warns', (_label, value) => {
        // Passing these through is not neutral: NaN and strings empty the batch writers'
        // progressive-retry ladder, so every InfluxDB write silently discards its data while
        // reporting success, and 0 collapses batching to a single unretried write.
        const config = influxConfig({ enable: true, maxBatchSize: value });

        const messages = applySchemaDefaults(config, configFileSchema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(1000);
        expect(messages).toEqual([
            { level: 'warn', message: expect.stringContaining('is invalid') },
        ]);
    });

    test('leaves a valid value untouched and says nothing', () => {
        const config = influxConfig({ enable: true, maxBatchSize: 500 });

        expect(applySchemaDefaults(config, configFileSchema)).toEqual([]);
        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(500);
    });

    test('does nothing when InfluxDB is disabled', () => {
        // With the feature off its readers never run, so a missing or invalid value is
        // irrelevant — and a config that disables InfluxDB is schema-valid without the section
        // being fully populated, so messages here would be pure noise.
        const config = influxConfig({ enable: false, maxBatchSize: 20000 });

        expect(applySchemaDefaults(config, configFileSchema)).toEqual([]);
        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(20000);
    });
});
