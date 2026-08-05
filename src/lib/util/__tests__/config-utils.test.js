import { describe, expect, test } from '@jest/globals';

import {
    getConfigArray,
    findNullableArrayPositions,
    normalizeNullableArrays,
    applySchemaDefaults,
} from '../config-utils.js';

/**
 * Builds a stand-in for a node-config instance over a flat path->value map.
 *
 * Reproduces the two behaviours the helper depends on, both verified against the real
 * `config` package: `has()` is true for an explicitly-null value, and `get()` throws for a
 * path that is absent entirely.
 *
 * @param {object} values - Map of dotted config path to value.
 * @returns {{has: (p: string) => boolean, get: (p: string) => any}} Fake config instance.
 */
function fakeConfig(values) {
    return {
        has: (p) => Object.prototype.hasOwnProperty.call(values, p),
        get: (p) => {
            if (!Object.prototype.hasOwnProperty.call(values, p)) {
                throw new Error(`Configuration property "${p}" is not defined`);
            }
            return values[p];
        },
    };
}

describe('getConfigArray', () => {
    test('returns the configured array unchanged', () => {
        const cfg = fakeConfig({ 'a.list': ['x', 'y'] });
        expect(getConfigArray(cfg, 'a.list')).toEqual(['x', 'y']);
    });

    test('returns the same array reference, not a copy', () => {
        const list = ['x'];
        const cfg = fakeConfig({ 'a.list': list });
        expect(getConfigArray(cfg, 'a.list')).toBe(list);
    });

    test('returns [] for an explicitly null value — the #1450 case', () => {
        const cfg = fakeConfig({ 'a.list': null });
        expect(getConfigArray(cfg, 'a.list')).toEqual([]);
    });

    test('returns [] for an absent path instead of letting get() throw', () => {
        const cfg = fakeConfig({});
        expect(() => cfg.get('a.list')).toThrow(/not defined/);
        expect(getConfigArray(cfg, 'a.list')).toEqual([]);
    });

    test('returns [] for an already-empty array', () => {
        const cfg = fakeConfig({ 'a.list': [] });
        expect(getConfigArray(cfg, 'a.list')).toEqual([]);
    });

    test('returns [] for undefined', () => {
        const cfg = fakeConfig({ 'a.list': undefined });
        expect(getConfigArray(cfg, 'a.list')).toEqual([]);
    });

    test.each([
        ['a string', 'not-a-list'],
        ['a number', 42],
        ['an object', { name: 'x' }],
        ['a boolean', true],
    ])('returns [] for %s, which the schema would already have rejected', (_label, value) => {
        const cfg = fakeConfig({ 'a.list': value });
        expect(getConfigArray(cfg, 'a.list')).toEqual([]);
    });

    test.each([
        ['null', null],
        ['undefined', undefined],
        ['an object with no has/get', {}],
    ])('returns [] when the config instance is %s', (_label, cfg) => {
        expect(getConfigArray(cfg, 'a.list')).toEqual([]);
    });
});

describe('findNullableArrayPositions', () => {
    test('finds nullable array fields at any depth', () => {
        const schema = {
            type: 'object',
            properties: {
                'Butler-SOS': {
                    type: 'object',
                    properties: {
                        tags: { type: ['array', 'null'] },
                        nested: {
                            type: 'object',
                            properties: { rules: { type: ['array', 'null'] } },
                        },
                    },
                },
            },
        };
        const config = { 'Butler-SOS': { tags: null, nested: { rules: [] } } };

        expect(findNullableArrayPositions(config, schema)).toEqual([
            'Butler-SOS.tags',
            'Butler-SOS.nested.rules',
        ]);
    });

    test('ignores nullable fields that are not arrays', () => {
        const schema = {
            type: 'object',
            properties: {
                passphrase: { type: ['string', 'null'] },
                serverTags: { type: ['object', 'null'] },
                plainArray: { type: 'array' },
            },
        };
        const config = { passphrase: null, serverTags: null, plainArray: [] };

        expect(findNullableArrayPositions(config, schema)).toEqual([]);
    });

    test.each([['allOf'], ['anyOf'], ['oneOf'], ['if'], ['then'], ['else']])(
        'follows %s branches',
        (keyword) => {
            // The real schema uses if/then eleven times, for the InfluxDB v1/v2/v3 and QPS
            // shapes. A nullable list declared inside one describes the same config node as the
            // branch's parent, so missing it would exempt that list from normalisation forever.
            const branchSchema = { properties: { fromBranch: { type: ['array', 'null'] } } };
            const schema = {
                type: 'object',
                [keyword]: ['allOf', 'anyOf', 'oneOf'].includes(keyword)
                    ? [branchSchema]
                    : branchSchema,
            };
            const config = { fromBranch: null };

            expect(findNullableArrayPositions(config, schema)).toEqual(['fromBranch']);
        }
    );

    test('descends into array items, reporting one position per element', () => {
        // Seven real nullable lists live under monitorFilter.appSpecific.app[]. A path-based
        // walk could not express "the include field of every element of this array".
        const schema = {
            type: 'object',
            properties: {
                servers: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: { headers: { type: ['array', 'null'] } },
                    },
                },
            },
        };
        const config = { servers: [{ headers: null }, { headers: ['a'] }] };

        expect(findNullableArrayPositions(config, schema)).toEqual([
            'servers[0].headers',
            'servers[1].headers',
        ]);
    });

    test('reports only positions that exist in the config', () => {
        const schema = {
            type: 'object',
            properties: {
                present: { type: ['array', 'null'] },
                absent: { type: ['array', 'null'] },
            },
        };

        expect(findNullableArrayPositions({ present: null }, schema)).toEqual(['present']);
    });

    test('descends into the items of an array that is itself nullable', () => {
        // The real shape of appSpecific.app: the array is declared ['array', 'null'] AND its
        // elements contain further nullable lists. An earlier version treated the nullable
        // array as a leaf and never entered its elements, leaving all seven inner lists
        // un-normalised — while its own docstring named them as the motivating case.
        const schema = {
            type: 'object',
            properties: {
                app: {
                    type: ['array', 'null'],
                    items: {
                        type: 'object',
                        properties: { include: { type: ['array', 'null'] } },
                    },
                },
            },
        };
        const config = { app: [{ include: null }] };

        expect(findNullableArrayPositions(config, schema)).toEqual(['app', 'app[0].include']);

        normalizeNullableArrays(config, schema);
        expect(config.app[0].include).toEqual([]);
    });

    test('terminates on a cyclic schema', () => {
        const schema = { type: 'object', properties: {} };
        schema.properties.self = schema;
        schema.properties.list = { type: ['array', 'null'] };
        const config = { list: null, self: { list: null } };

        expect(findNullableArrayPositions(config, schema)).toContain('list');
    });
});

describe('normalizeNullableArrays', () => {
    const schema = {
        type: 'object',
        properties: {
            'Butler-SOS': {
                type: 'object',
                properties: {
                    tags: { type: ['array', 'null'] },
                    rules: { type: ['array', 'null'] },
                    absent: { type: ['array', 'null'] },
                    name: { type: 'string' },
                },
            },
        },
    };

    test('replaces null with an empty array and reports what changed', () => {
        const config = { 'Butler-SOS': { tags: null, rules: [{ a: 1 }], name: 'x' } };

        const changed = normalizeNullableArrays(config, schema);

        expect(config['Butler-SOS'].tags).toEqual([]);
        expect(changed).toEqual(['Butler-SOS.tags']);
    });

    test('leaves populated arrays untouched, by reference', () => {
        const rules = [{ a: 1 }];
        const config = { 'Butler-SOS': { tags: [], rules, name: 'x' } };

        expect(normalizeNullableArrays(config, schema)).toEqual([]);
        expect(config['Butler-SOS'].rules).toBe(rules);
    });

    test('does not create keys that are absent from the config', () => {
        const config = { 'Butler-SOS': { tags: null } };

        normalizeNullableArrays(config, schema);

        expect(Object.hasOwn(config['Butler-SOS'], 'absent')).toBe(false);
    });

    test('ignores inherited keys instead of materialising them on the config', () => {
        // The walk must consider own properties only. With `key in value` it would also act on
        // anything reachable through the prototype chain, and the visitor's assignment would
        // then create an own `[]` on the config object for a setting the administrator never
        // wrote — inventing configuration out of the prototype.
        //
        // Note this is why the obvious `__proto__` literal test does not work: in an object
        // literal `__proto__:` sets the [[Prototype]] rather than creating an own property, so
        // the walk never sees the key and the test passes with or without the guard.
        const inheritedSchema = {
            type: 'object',
            properties: {
                a: { type: 'object', properties: { inheritedList: { type: ['array', 'null'] } } },
            },
        };
        const proto = { inheritedList: null };
        const config = { a: Object.create(proto) };

        expect('inheritedList' in config.a).toBe(true);
        expect(Object.hasOwn(config.a, 'inheritedList')).toBe(false);

        const changed = normalizeNullableArrays(config, inheritedSchema);

        expect(changed).toEqual([]);
        expect(Object.hasOwn(config.a, 'inheritedList')).toBe(false);
        expect(proto.inheritedList).toBeNull();
    });

    test.each([
        ['a null config', null],
        ['a non-object config', 'nope'],
    ])('returns [] for %s', (_label, config) => {
        expect(normalizeNullableArrays(config, schema)).toEqual([]);
    });
});

describe('applySchemaDefaults', () => {
    // Mirrors the real schema's declaration for maxBatchSize plus its enable flag: every value
    // the function uses is read from the schema node, so a schema change flows through without
    // touching the code.
    const schema = {
        type: 'object',
        properties: {
            'Butler-SOS': {
                type: 'object',
                properties: {
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

    /**
     * Builds a config object carrying an influxdbConfig section.
     *
     * @param {object} influxdbConfig - The section contents.
     * @returns {object} Config object.
     */
    function makeConfig(influxdbConfig) {
        return { 'Butler-SOS': { influxdbConfig } };
    }

    test.each([
        ['absent', {}],
        ['null', { maxBatchSize: null }],
    ])('applies the schema default at info level when the value is %s', (_label, section) => {
        const config = makeConfig({ enable: true, ...section });

        const messages = applySchemaDefaults(config, schema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(1000);
        expect(messages).toEqual([
            { level: 'info', message: expect.stringContaining('not specified') },
        ]);
    });

    test('takes the default from the schema rather than a hardcoded constant', () => {
        // The point of reading the schema: change it and the applied value follows. An earlier
        // version hardcoded 1000 next to a schema that already declared it.
        const customSchema = JSON.parse(JSON.stringify(schema));
        customSchema.properties[
            'Butler-SOS'
        ].properties.influxdbConfig.properties.maxBatchSize.default = 42;
        const config = makeConfig({ enable: true });

        applySchemaDefaults(config, customSchema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(42);
    });

    test.each([
        ['above the maximum', 20000],
        ['below the minimum', 0],
        ['negative', -5],
        ['NaN', NaN],
        ['a numeric string', '1000'],
        ['a non-numeric string', 'abc'],
        ['a boolean', true],
        ['a non-integer', 1.5],
    ])('replaces a value that is %s with the default, at warn level', (_label, value) => {
        // Passing invalid values through is not neutral: NaN and strings empty the batch
        // writers' progressive-retry ladder so every InfluxDB write silently discards its
        // data, and 0 collapses batching into a single unretried write. An earlier revision
        // only reported these, on the false premise that schema validation was the sole route
        // by which they could arrive.
        const config = makeConfig({ enable: true, maxBatchSize: value });

        const messages = applySchemaDefaults(config, schema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(1000);
        expect(messages).toEqual([
            { level: 'warn', message: expect.stringContaining('is invalid') },
        ]);
    });

    test.each([
        ['the lower bound', 1],
        ['the upper bound', 10000],
        ['a normal value', 500],
    ])('leaves %s untouched and says nothing', (_label, value) => {
        const config = makeConfig({ enable: true, maxBatchSize: value });

        expect(applySchemaDefaults(config, schema)).toEqual([]);
        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(value);
    });

    test.each([
        ['disabled', { enable: false, maxBatchSize: 20000 }],
        ['missing its enable flag', { maxBatchSize: 20000 }],
    ])('does nothing when the owning feature is %s', (_label, section) => {
        // A disabled feature's readers never run, and the conditional schema stops validating
        // the section, so both defaulting and warnings would be noise about an unused value.
        const config = makeConfig(section);

        expect(applySchemaDefaults(config, schema)).toEqual([]);
        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(20000);
    });

    test('resolves a path declared inside a then branch', () => {
        // The real schema expresses the InfluxDB v1/v2/v3 shapes with if/then, so the schema
        // lookup has to follow then-branches to find the declaration at all.
        const branchSchema = {
            type: 'object',
            properties: {
                'Butler-SOS': {
                    type: 'object',
                    properties: {
                        influxdbConfig: {
                            type: 'object',
                            properties: { enable: { type: 'boolean' } },
                            then: {
                                properties: { maxBatchSize: { type: 'integer', default: 77 } },
                            },
                        },
                    },
                },
            },
        };
        const config = makeConfig({ enable: true });

        applySchemaDefaults(config, branchSchema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(77);
    });

    test('never reads a declaration out of an if condition', () => {
        // An if-subschema describes a condition to test, not the value's shape — a `default`
        // inside one is not the setting's default. With the declaration invisible, the entry
        // reports itself as not found rather than silently using the condition's default.
        const conditionSchema = {
            type: 'object',
            properties: {
                'Butler-SOS': {
                    type: 'object',
                    properties: {
                        influxdbConfig: {
                            type: 'object',
                            properties: { enable: { type: 'boolean' } },
                            if: {
                                properties: { maxBatchSize: { type: 'integer', default: 99 } },
                            },
                        },
                    },
                },
            },
        };
        const config = makeConfig({ enable: true });

        expect(applySchemaDefaults(config, conditionSchema)).toEqual([
            { level: 'warn', message: expect.stringContaining('not found in the config schema') },
        ]);
        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBeUndefined();
    });

    test('accepts the nullable-union spelling of the type', () => {
        // The schema's own idiom spells nullable types as ['integer', 'null']. An earlier
        // version compared node.type with === so the union spelling silently disabled the type
        // check entirely — 'abc' validated as fine via NaN-coerced bounds comparisons.
        const unionSchema = JSON.parse(JSON.stringify(schema));
        unionSchema.properties[
            'Butler-SOS'
        ].properties.influxdbConfig.properties.maxBatchSize.type = ['integer', 'null'];
        const config = makeConfig({ enable: true, maxBatchSize: 'abc' });

        const messages = applySchemaDefaults(config, unionSchema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(1000);
        expect(messages).toEqual([
            { level: 'warn', message: expect.stringContaining('is invalid') },
        ]);
    });

    test('refuses loudly an entry whose schema type it cannot validate', () => {
        // Failing open here would recreate the silent-passthrough class this mechanism exists
        // to stop: garbage would validate as fine the day a non-numeric entry is added.
        const stringSchema = JSON.parse(JSON.stringify(schema));
        stringSchema.properties[
            'Butler-SOS'
        ].properties.influxdbConfig.properties.maxBatchSize.type = 'string';
        stringSchema.properties[
            'Butler-SOS'
        ].properties.influxdbConfig.properties.maxBatchSize.default = 'x';
        const config = makeConfig({ enable: true, maxBatchSize: 42 });

        const messages = applySchemaDefaults(config, stringSchema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(42);
        expect(messages).toEqual([
            { level: 'warn', message: expect.stringContaining('does not support') },
        ]);
    });

    test('refuses loudly an entry whose schema node declares no default', () => {
        // There is nothing to repair with, and silence would hide the misconfigured entry.
        const noDefaultSchema = JSON.parse(JSON.stringify(schema));
        delete noDefaultSchema.properties['Butler-SOS'].properties.influxdbConfig.properties
            .maxBatchSize.default;
        const config = makeConfig({ enable: true, maxBatchSize: 20000 });

        const messages = applySchemaDefaults(config, noDefaultSchema);

        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBe(20000);
        expect(messages).toEqual([
            { level: 'warn', message: expect.stringContaining('declares no default') },
        ]);
    });

    test('does not write onto a section that YAML parsed as a list', () => {
        // A malformed config where influxdbConfig is a sequence instead of a map must not get
        // an expando maxBatchSize property no reader would find.
        const config = { 'Butler-SOS': { influxdbConfig: [] } };

        expect(applySchemaDefaults(config, schema)).toEqual([]);
        expect(Object.hasOwn(config['Butler-SOS'].influxdbConfig, 'maxBatchSize')).toBe(false);
    });

    test('warns loudly when the schema does not describe the path', () => {
        // A silent skip here is how a schema rename would quietly disable the whole
        // treatment; the 24 bare readers of maxBatchSize would then crash on the first
        // InfluxDB write with nothing in the startup log explaining why.
        const config = makeConfig({ enable: true });

        expect(applySchemaDefaults(config, { type: 'object', properties: {} })).toEqual([
            { level: 'warn', message: expect.stringContaining('not found in the config schema') },
        ]);
        expect(config['Butler-SOS'].influxdbConfig.maxBatchSize).toBeUndefined();
    });

    test('does nothing when the influxdbConfig section is missing entirely', () => {
        // No section means no enable flag, so the feature gate keeps this silent — correct,
        // since without the section the feature's readers cannot be enabled either.
        const config = { 'Butler-SOS': {} };

        expect(applySchemaDefaults(config, schema)).toEqual([]);
    });

    test.each([
        ['a null config', null],
        ['a non-object config', 'nope'],
    ])('returns [] for %s', (_label, config) => {
        expect(applySchemaDefaults(config, schema)).toEqual([]);
    });
});
