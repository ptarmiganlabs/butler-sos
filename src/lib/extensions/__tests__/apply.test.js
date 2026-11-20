import { describe, test, expect, jest } from '@jest/globals';
import { Command, Option } from 'commander';
import { default as Ajv } from 'ajv';

import {
    START_CONTEXT_KEYS,
    applyConfigSchema,
    applyOptions,
    createStartContext,
    isExpectedFailure,
    readOnlyConfig,
    runBeforeStart,
} from '../apply.js';

/**
 * A schema shaped like core's: settings under `Butler-SOS`, which accepts keys it does not know.
 *
 * A fixture rather than the real schema: `config-schemas/index.js` reaches `globals.js` through
 * `host-utils.js`, and importing it first, as a test would, runs that cycle in an order the
 * application never does.
 */
const coreConfigFileSchema = Object.freeze({
    type: 'object',
    properties: {
        'Butler-SOS': {
            type: 'object',
            properties: {
                logLevel: { type: 'string' },
                influxdbConfig: { type: 'object' },
            },
            required: ['logLevel'],
            additionalProperties: true,
        },
    },
    required: ['Butler-SOS'],
    additionalProperties: false,
});

/** Every way a build can describe nothing. Each must behave as if the seam were not there. */
const NOTHING = [
    ['the committed shape', { seamVersion: 1, options: [], configSchema: {}, hooks: {} }],
    ['an empty object', {}],
    ['undefined', undefined],
    ['null', null],
];

/**
 * A root command shaped like Butler SOS's, with one core option.
 *
 * @returns {Command} The command.
 */
const program = () =>
    new Command().name('butler-sos').option('-c, --configfile <file>', 'path to config file');

/**
 * A minimal stand-in for node-config's object.
 *
 * @param {object} tree - The config values.
 * @returns {{get: (path: string) => unknown, has: (path: string) => boolean}} get/has over dotted paths.
 */
const fakeConfig = (tree) => {
    const at = (path) => path.split('.').reduce((node, key) => node?.[key], tree);

    return {
        get: (path) => {
            const value = at(path);
            if (value === undefined)
                throw new Error(`Configuration property "${path}" is not defined`);
            return value;
        },
        has: (path) => at(path) !== undefined,
    };
};

describe('applyOptions', () => {
    test.each(NOTHING)('adds nothing for %s', (_name, description) => {
        const root = program();
        const before = root.options.map((o) => o.long);

        applyOptions(root, description);

        expect(root.options.map((o) => o.long)).toEqual(before);
    });

    test('adds a contributed option to the root command, where parse sees it', () => {
        const root = program().exitOverride();

        applyOptions(root, { options: [{ option: new Option('--extra-file <path>', 'extra') }] });
        root.parse(['node', 'butler-sos', '-c', 'x.yaml', '--extra-file', '/tmp/e'], {
            from: 'node',
        });

        expect(root.opts()).toEqual({ configfile: 'x.yaml', extraFile: '/tmp/e' });
        expect(root.helpInformation()).toContain('--extra-file <path>');
    });

    test('refuses a hook that is not a function', () => {
        expect(() => applyOptions(program(), { hooks: { beforeStart: 'later' } })).toThrow(
            "Extension hook 'beforeStart' must be a function, but the description carries a string."
        );
    });

    test('accepts a hook that is explicitly undefined', () => {
        expect(() => applyOptions(program(), { hooks: { beforeStart: undefined } })).not.toThrow();
    });

    test('refuses a contribution that carries no Commander option', () => {
        expect(() => applyOptions(program(), { options: [{ option: '--extra' }] })).toThrow(
            'must each carry a Commander Option'
        );
    });

    test('refuses an option that clashes with one core declares', () => {
        expect(() =>
            applyOptions(program(), {
                options: [{ option: new Option('-c, --configfile <file>', 'again') }],
            })
        ).toThrow();
    });
});

describe('applyConfigSchema', () => {
    test.each(NOTHING)('returns the core schema itself for %s', (_name, description) => {
        expect(applyConfigSchema(coreConfigFileSchema, description)).toBe(coreConfigFileSchema);
    });

    test('adds contributed settings under Butler-SOS, and leaves the core schema alone', () => {
        const fragment = {
            type: 'object',
            properties: { enable: { type: 'boolean', default: false } },
            additionalProperties: false,
        };
        const before = structuredClone(coreConfigFileSchema);

        const merged = applyConfigSchema(coreConfigFileSchema, {
            configSchema: { extra: fragment },
        });

        expect(merged.properties['Butler-SOS'].properties.extra).toEqual(fragment);
        expect(merged.properties['Butler-SOS'].properties.extra).not.toBe(fragment);
        expect(coreConfigFileSchema).toEqual(before);
        expect(Object.keys(merged.properties['Butler-SOS'].properties)).toEqual([
            ...Object.keys(coreConfigFileSchema.properties['Butler-SOS'].properties),
            'extra',
        ]);
    });

    test('refuses a setting core already defines', () => {
        expect(() =>
            applyConfigSchema(coreConfigFileSchema, {
                configSchema: { logLevel: { type: 'string' } },
            })
        ).toThrow(
            "Extension config setting 'Butler-SOS.logLevel' is already defined by Butler SOS."
        );
    });

    test('gives a schema that strict AJV compiles and that checks the contributed setting', () => {
        const merged = applyConfigSchema(
            {
                type: 'object',
                properties: {
                    'Butler-SOS': {
                        type: 'object',
                        properties: { logLevel: { type: 'string' } },
                        additionalProperties: true,
                    },
                },
            },
            {
                configSchema: {
                    extra: {
                        type: 'object',
                        properties: { enable: { type: 'boolean' } },
                        additionalProperties: false,
                    },
                },
            }
        );
        const validate = new Ajv({ strict: true, allErrors: true }).compile(merged);

        expect(validate({ 'Butler-SOS': { extra: { enable: true } } })).toBe(true);
        expect(validate({ 'Butler-SOS': { extra: { enable: 'yes' } } })).toBe(false);
        expect(validate({ 'Butler-SOS': { extra: { other: 1 } } })).toBe(false);
    });
});

describe('the start context', () => {
    const settings = {
        config: fakeConfig({
            'Butler-SOS': { influxdbConfig: { enable: true, host: 'influx.local' } },
        }),
        certPath: '/certs/client.pem',
        keyPath: '/certs/client_key.pem',
        caPath: '/certs/root.pem',
        logger: { info: jest.fn() },
        options: { configfile: 'production.yaml' },
        appVersion: '15.1.3',
        isSea: false,
        mqttClient: 'not part of the context',
    };

    test('has exactly the keys the contract lists, in order', () => {
        expect(Object.keys(createStartContext(settings))).toEqual([...START_CONTEXT_KEYS]);
        expect(Object.isFrozen(START_CONTEXT_KEYS)).toBe(true);
    });

    test('carries what core resolved', () => {
        const context = createStartContext(settings);

        expect(context.certificates).toEqual({
            clientCert: '/certs/client.pem',
            clientCertKey: '/certs/client_key.pem',
            clientCertCA: '/certs/root.pem',
        });
        expect(context.logger).toBe(settings.logger);
        expect(context.options).toEqual({ configfile: 'production.yaml' });
        expect(context.appVersion).toBe('15.1.3');
        expect(context.isSea).toBe(false);
    });

    test('lets an extension read any of core config', () => {
        const { config } = createStartContext(settings);

        expect(config.get('Butler-SOS.influxdbConfig.host')).toBe('influx.local');
        expect(config.has('Butler-SOS.influxdbConfig.enable')).toBe(true);
        expect(config.has('Butler-SOS.mqttConfig')).toBe(false);
        expect(() => config.get('Butler-SOS.mqttConfig')).toThrow('is not defined');
    });

    test('cannot be used to change what core then connects to', () => {
        const context = createStartContext(settings);

        context.config.get('Butler-SOS.influxdbConfig').host = 'elsewhere';

        expect(settings.config.get('Butler-SOS.influxdbConfig.host')).toBe('influx.local');
        expect(Object.isFrozen(context)).toBe(true);
        expect(Object.isFrozen(context.config)).toBe(true);
        expect(Object.isFrozen(context.certificates)).toBe(true);
        expect(Object.isFrozen(context.options)).toBe(true);
    });

    test('works over the real config package', async () => {
        const view = readOnlyConfig({ get: () => ({ a: [1, 2] }), has: () => true });

        expect(view.get('x')).toEqual({ a: [1, 2] });
    });
});

describe('runBeforeStart', () => {
    test.each(NOTHING)('resolves at once for %s', async (_name, description) => {
        await expect(runBeforeStart(description, {})).resolves.toBeUndefined();
    });

    test('awaits the hook with the context', async () => {
        const order = [];
        const context = { marker: true };
        const beforeStart = jest.fn(async (received) => {
            await new Promise((resolve) => setTimeout(resolve, 1));
            order.push(received);
        });

        await runBeforeStart({ hooks: { beforeStart } }, context);

        expect(order).toEqual([context]);
        expect(beforeStart).toHaveBeenCalledTimes(1);
    });

    test('passes a throw on, so startup stops', async () => {
        const refusal = Object.assign(new Error('not today'), { expected: true });

        await expect(
            runBeforeStart({ hooks: { beforeStart: () => Promise.reject(refusal) } }, {})
        ).rejects.toBe(refusal);
    });
});

describe('isExpectedFailure', () => {
    test.each([
        [Object.assign(new Error('x'), { expected: true }), true],
        [new Error('x'), false],
        [Object.assign(new Error('x'), { expected: 'yes' }), false],
        [undefined, false],
        ['a string', false],
    ])('%p is expected: %p', (err, expected) => {
        expect(isExpectedFailure(err)).toBe(expected);
    });
});
