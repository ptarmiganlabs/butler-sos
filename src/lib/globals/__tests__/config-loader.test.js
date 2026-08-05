import { jest, describe, expect, test, beforeEach, afterEach } from '@jest/globals';

/**
 * Wiring tests for initConfig.
 *
 * The config-utils helpers were thoroughly unit-tested while nothing verified that initConfig
 * actually calls them: replacing the `normalizeNullableArrays(...)` call with `[]` left the
 * entire 1481-test suite green, so issue #1450 would have reproduced for every read site
 * outside verifyAppConfig with CI reporting success. These tests exist to make that mutation
 * fail. If they are ever rewritten, check them the same way — delete the call in
 * config-loader.js and confirm this file goes red.
 */

// A config tree shaped like the shipped template: nullable lists present but null, including
// one nested inside an array element, which only a schema-and-config walk can reach.
const configTree = {
    'Butler-SOS': {
        logEvents: {
            tags: null,
            categorise: { rules: null },
        },
        serversToMonitor: {
            serverTagsDefinition: null,
            servers: [{ serverName: 'S1', headers: null }],
        },
        influxdbConfig: { enable: true, maxBatchSize: 20000 },
    },
};

const testSchema = {
    type: 'object',
    properties: {
        'Butler-SOS': {
            type: 'object',
            properties: {
                logEvents: {
                    type: 'object',
                    properties: {
                        tags: { type: ['array', 'null'] },
                        categorise: {
                            type: 'object',
                            properties: { rules: { type: ['array', 'null'] } },
                        },
                    },
                },
                serversToMonitor: {
                    type: 'object',
                    properties: {
                        serverTagsDefinition: { type: ['array', 'null'] },
                        servers: {
                            // ['array', 'null'], matching the real schema. An earlier fixture
                            // said plain 'array' here, and the nested-normalisation test below
                            // passed against it while the real shape — a nullable array whose
                            // elements hold nullable lists — was broken in production code.
                            type: ['array', 'null'],
                            items: {
                                type: 'object',
                                properties: { headers: { type: ['array', 'null'] } },
                            },
                        },
                    },
                },
                influxdbConfig: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        maxBatchSize: {
                            type: 'integer',
                            default: 1000,
                            minimum: 1,
                            maximum: 10000,
                        },
                    },
                },
            },
        },
    },
};

jest.unstable_mockModule('config', () => ({ default: configTree }));
jest.unstable_mockModule('../../config-file-schema.js', () => ({ default: testSchema }));
jest.unstable_mockModule('../../sea-wrapper.js', () => ({
    default: { isSea: () => false, initialize: () => {} },
}));
jest.unstable_mockModule('../../config-file-verify.js', () => ({
    verifyConfigFileSchema: jest.fn().mockResolvedValue(true),
    verifyAppConfig: jest.fn().mockResolvedValue(true),
}));

const { initConfig } = await import('../config-loader.js');

/**
 * Builds the minimal settings object initConfig expects.
 *
 * @returns {object} Settings stand-in.
 */
function makeSettings() {
    return {
        // skipConfigVerification keeps the test off the real schema validator and
        // verifyAppConfig; the normalisation under test runs before both branches.
        options: { skipConfigVerification: true },
        isSea: false,
        checkFileExistsSync: () => true,
    };
}

describe('initConfig config normalisation wiring', () => {
    let originalTree;

    beforeEach(() => {
        jest.clearAllMocks();
        originalTree = JSON.parse(JSON.stringify(configTree));
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        // initConfig mutates the shared module-level tree in place, exactly as it does to the
        // real node-config singleton. Restore it so tests stay order-independent.
        Object.assign(configTree, originalTree);
    });

    test('turns every null list in the loaded config into an empty list', async () => {
        const settings = makeSettings();

        await initConfig(settings);

        const butler = settings.config['Butler-SOS'];
        expect(butler.logEvents.tags).toEqual([]);
        expect(butler.logEvents.categorise.rules).toEqual([]);
        expect(butler.serversToMonitor.serverTagsDefinition).toEqual([]);
    });

    test('normalises a null list nested inside an array element', async () => {
        // The case a schema-path walk could not reach: seven real settings live under
        // logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].
        const settings = makeSettings();

        await initConfig(settings);

        expect(settings.config['Butler-SOS'].serversToMonitor.servers[0].headers).toEqual([]);
    });

    test('reports what it normalised', async () => {
        const settings = makeSettings();

        await initConfig(settings);

        expect(console.info).toHaveBeenCalledWith(
            expect.stringContaining('Treating 4 empty config setting(s) as empty lists')
        );
    });

    test('replaces an out-of-range maxBatchSize with the schema default and warns', async () => {
        // Passing an invalid value through is not neutral — NaN or a string empties the batch
        // writers' retry ladder so every InfluxDB write silently discards its data, and 0
        // collapses batching into a single unretried write. An earlier revision only reported
        // the value; review showed unvalidated values also arrive via node-config merge layers
        // (local.yaml, NODE_CONFIG), not just --skipConfigVerification.
        const settings = makeSettings();

        await initConfig(settings);

        expect(settings.config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(1000);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('is invalid'));
    });

    test('applies the schema default at info level when maxBatchSize is absent', async () => {
        // Absence is the case that matters most: 24 modules read this path with a bare
        // config.get(), and node-config throws for an absent path. It is info, not warn —
        // filling a documented default is routine, not a problem to alert on.
        delete configTree['Butler-SOS'].influxdbConfig.maxBatchSize;
        const settings = makeSettings();

        await initConfig(settings);

        expect(settings.config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(1000);
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('not specified'));
        expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('not specified'));
    });

    test('normalises even when config verification is skipped', async () => {
        // --skipConfigVerification bypasses both verifiers, so normalisation must not live
        // inside either of them. It previously did, which is how the maxBatchSize default
        // ended up unreachable in the one mode where it mattered.
        const settings = makeSettings();
        settings.options.skipConfigVerification = true;

        await initConfig(settings);

        expect(settings.config['Butler-SOS'].logEvents.tags).toEqual([]);
    });
});
