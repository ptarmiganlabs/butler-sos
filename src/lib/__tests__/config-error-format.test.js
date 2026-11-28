import { describe, test, expect } from '@jest/globals';
import { default as Ajv } from 'ajv';
import ajvKeywords from 'ajv-keywords';
import ajvFormats from 'ajv-formats';
import { load } from 'js-yaml';

import {
    closestSetting,
    createPositionLocator,
    formatAjvErrors,
    pointerToSegments,
    renderConfigReport,
    settingProblem,
    toDottedPath,
    yamlSyntaxProblem,
} from '../config-error-format.js';
import { applyConfigSchema } from '../extensions/apply.js';

// The formatter is tested against real AJV output, with the options the config file check uses,
// so a change in what AJV reports shows up here rather than in front of an administrator.

const schema = {
    type: 'object',
    properties: {
        'Butler-SOS': {
            type: 'object',
            properties: {
                logLevel: { type: 'string', enum: ['error', 'warn', 'info'] },
                port: { type: 'integer', default: 8086 },
                nullableList: { type: ['array', 'null'] },
                enable: { type: 'boolean' },
                interval: { type: 'number', minimum: 1, maximum: 60 },
                ratio: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
                host: { type: 'string', format: 'hostname' },
                url: { type: 'string', format: 'uri' },
                code: { type: 'string', pattern: '^[A-Z]{3}$' },
                name: { type: 'string', minLength: 1 },
                label: { type: 'string', minLength: 3, pattern: '^[a-z]+$' },
                mode: { type: 'string', const: 'fixed' },
                tags: { type: 'array', minItems: 1, uniqueItems: true },
                hostIP: {
                    type: 'string',
                    anyOf: [
                        { format: 'ipv4' },
                        { pattern: '^[a-z][a-z0-9.-]*$', description: 'a host name' },
                    ],
                },
                target: { oneOf: [{ type: 'number' }, { type: 'integer' }] },
                heartbeat: {
                    type: 'object',
                    properties: {
                        enable: { type: 'boolean' },
                        remoteURL: { type: 'string' },
                        frequency: { type: 'string' },
                    },
                    required: ['enable', 'remoteURL'],
                    additionalProperties: false,
                },
                feature: {
                    type: 'object',
                    properties: { enable: { type: 'boolean' }, port: { type: 'number' } },
                    if: { properties: { enable: { const: true } } },
                    then: { properties: { port: { type: 'number' } }, required: ['port'] },
                },
                servers: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: { host: { type: 'string', format: 'hostname' } },
                    },
                },
            },
            required: ['logLevel'],
            additionalProperties: false,
        },
    },
    required: ['Butler-SOS'],
};

/**
 * Compiles a schema with the AJV options and plugins the config file check uses.
 *
 * @param {object} against - The schema.
 * @returns {import('ajv').ValidateFunction} The validator.
 */
function compile(against) {
    const ajv = new Ajv({ strict: true, allErrors: true, verbose: true });
    ajvKeywords(ajv);
    ajvFormats(ajv);
    return ajv.compile(against);
}

/**
 * Validates YAML text against a schema the way the config file check does, and formats the errors.
 *
 * @param {string} text - The YAML text.
 * @param {object} [against] - The schema; the test schema above by default.
 * @returns {object[]} The formatted problems.
 */
function check(text, against = schema) {
    const validate = compile(against);
    const data = load(text);
    validate(data);
    return formatAjvErrors(validate.errors ?? [], {
        data,
        locate: createPositionLocator(text),
    });
}

/**
 * Builds the YAML text for a Butler-SOS section with the given lines under it.
 *
 * @param {...string} lines - Lines under `Butler-SOS:`, already indented by two spaces.
 * @returns {string} The YAML text. `logLevel: info` is always the first setting, on line 2.
 */
const yaml = (...lines) => ['Butler-SOS:', '  logLevel: info', ...lines, ''].join('\n');

describe('config-error-format', () => {
    describe('per-keyword wording', () => {
        test('enum lists the allowed values', () => {
            expect(check(['Butler-SOS:', '  logLevel: chatty', ''].join('\n'))).toEqual([
                {
                    path: 'Butler-SOS.logLevel',
                    line: 2,
                    column: 3,
                    message: 'is "chatty", but must be one of: "error", "warn", "info".',
                },
            ]);
        });

        test('type shows the value found, the type expected and an example', () => {
            const [problem] = check(yaml('  port: 8086a'));
            expect(problem.path).toBe('Butler-SOS.port');
            expect(problem.message).toBe(
                'is "8086a", but must be a whole number, for example 8086.'
            );
        });

        test('type points out a number in quotes', () => {
            const [problem] = check(yaml('  port: "8086"'));
            expect(problem.message).toBe(
                'is "8086", but must be a whole number, for example 8086. Remove the quotes around it.'
            );
        });

        test('type names each allowed type, and true or false for booleans', () => {
            const problems = check(yaml('  nullableList: 5', '  enable: "yes"'));
            expect(problems.map((p) => [p.path, p.message])).toEqual([
                ['Butler-SOS.nullableList', 'is 5, but must be a list or empty.'],
                ['Butler-SOS.enable', 'is "yes", but must be true or false.'],
            ]);
        });

        test('required names the missing setting and the section it goes in', () => {
            const problems = check(yaml('  heartbeat:', '    enable: true'));
            expect(problems).toEqual([
                {
                    path: 'Butler-SOS.heartbeat.remoteURL',
                    // The missing setting has no line of its own, so the section's line is given.
                    line: 3,
                    column: 3,
                    message: 'is missing. Add it under Butler-SOS.heartbeat.',
                },
            ]);
        });

        test('required at the top level of the file', () => {
            expect(check('Other: 1\n', { ...schema, additionalProperties: true })).toEqual([
                {
                    path: 'Butler-SOS',
                    line: null,
                    column: null,
                    message: 'is missing. Add it at the top level of the file.',
                },
            ]);
        });

        test('minimum, maximum, exclusiveMinimum and exclusiveMaximum give the range', () => {
            expect(check(yaml('  interval: 0')).map((p) => p.message)).toEqual([
                'is 0, but must be at least 1.',
            ]);
            expect(check(yaml('  interval: 61')).map((p) => p.message)).toEqual([
                'is 61, but must be at most 60.',
            ]);
            expect(check(yaml('  ratio: 0')).map((p) => p.message)).toEqual([
                'is 0, but must be greater than 0.',
            ]);
            expect(check(yaml('  ratio: 1')).map((p) => p.message)).toEqual([
                'is 1, but must be less than 1.',
            ]);
        });

        test('format says what is expected, with an example', () => {
            expect(check(yaml('  host: "not a host!"')).map((p) => p.message)).toEqual([
                'is "not a host!", but must be a host name, for example qlik.example.com.',
            ]);
            expect(check(yaml('  url: not a url')).map((p) => p.message)).toEqual([
                'is "not a url", but must be a full URL, for example https://example.com/path.',
            ]);
        });

        test('pattern shows a short pattern', () => {
            expect(check(yaml('  code: ab')).map((p) => p.message)).toEqual([
                'is "ab", but must be text of the form ^[A-Z]{3}$.',
            ]);
        });

        test('minLength of 1 says the value is empty', () => {
            expect(check(yaml('  name: ""')).map((p) => p.message)).toEqual([
                'is empty, but must have a value.',
            ]);
        });

        test('const says the one allowed value', () => {
            expect(check(yaml('  mode: free')).map((p) => p.message)).toEqual([
                'is "free", but must be "fixed".',
            ]);
        });

        test('minItems counts the entries', () => {
            expect(check(yaml('  tags: []')).map((p) => p.message)).toEqual([
                'has 0 entries, but must have at least 1 entry.',
            ]);
        });

        test("keywords without wording of their own keep AJV's message", () => {
            const [problem] = check(yaml('  tags: [a, a]'));
            expect(problem.path).toBe('Butler-SOS.tags');
            expect(problem.line).toBe(3);
            expect(problem.message).toMatch(/^must NOT have duplicate items/);
        });
    });

    describe('misspelt settings', () => {
        test('a misspelt setting is named, with the setting it was meant to be', () => {
            // AJV reports this one mistake twice: remoteUrll is not allowed, and remoteURL is
            // missing. It is one message.
            const problems = check(
                yaml('  heartbeat:', '    enable: true', '    remoteUrll: http://example.com')
            );
            expect(problems).toEqual([
                {
                    path: 'Butler-SOS.heartbeat.remoteUrll',
                    line: 5,
                    column: 5,
                    message:
                        'is not a known setting. Did you mean "remoteURL"? "remoteURL" is required.',
                },
            ]);
        });

        test('a setting with no close match is not given a suggestion', () => {
            const problems = check(
                yaml(
                    '  heartbeat:',
                    '    enable: true',
                    '    remoteURL: http://example.com',
                    '    somethingElse: 1'
                )
            );
            expect(problems).toEqual([
                {
                    path: 'Butler-SOS.heartbeat.somethingElse',
                    line: 6,
                    column: 5,
                    message: 'is not a known setting. Check the spelling, or remove it.',
                },
            ]);
        });

        test('a setting already in the file is not suggested again', () => {
            const problems = check(
                yaml(
                    '  heartbeat:',
                    '    enable: true',
                    '    remoteURL: http://example.com',
                    '    remoteURLL: http://example.com'
                )
            );
            expect(problems.map((p) => p.message)).toEqual([
                'is not a known setting. Check the spelling, or remove it.',
            ]);
        });

        test('closestSetting ignores case and refuses distant names', () => {
            expect(closestSetting('remoteurl', ['enable', 'remoteURL'])).toBe('remoteURL');
            expect(closestSetting('enabel', ['enable', 'remoteURL'])).toBe('enable');
            expect(closestSetting('xyz', ['enable', 'remoteURL'])).toBeNull();
            expect(closestSetting('anything', [])).toBeNull();
        });
    });

    describe('collapsing', () => {
        test('the branches of an anyOf become one message listing what each accepts', () => {
            expect(check(yaml('  hostIP: NOT_A_HOST'))).toEqual([
                {
                    path: 'Butler-SOS.hostIP',
                    line: 3,
                    column: 3,
                    message: 'is "NOT_A_HOST", but must be an IPv4 address or a host name.',
                },
            ]);
        });

        test('a oneOf that no branch matches becomes one message', () => {
            expect(check(yaml('  target: true')).map((p) => p.message)).toEqual([
                'is true, but must be a number or a whole number.',
            ]);
        });

        test('a oneOf that several branches match says so', () => {
            expect(check(yaml('  target: 5')).map((p) => p.message)).toEqual([
                'is 5, which matches more than one of the allowed forms. It must match exactly one.',
            ]);
        });

        test('an if/then failure is reported by what the then part requires, once', () => {
            expect(check(yaml('  feature:', '    enable: true'))).toEqual([
                {
                    path: 'Butler-SOS.feature.port',
                    line: 3,
                    column: 3,
                    message: 'is missing. Add it under Butler-SOS.feature.',
                },
            ]);
        });

        test('exact duplicates are reported once', () => {
            const text = yaml('  logLevel2: x');
            const validate = compile(schema);
            const data = load(text);
            validate(data);
            const once = formatAjvErrors(validate.errors, { data });
            const twice = formatAjvErrors([...validate.errors, ...validate.errors], { data });
            expect(twice).toEqual(once);
        });

        test('several problems with one setting become one message', () => {
            const problems = check(yaml('  label: A'));
            expect(problems).toHaveLength(1);
            expect(problems[0].message).toBe(
                'is "A", but must be at least 3 characters long. is "A", but must be text of the form ^[a-z]+$.'
            );
        });
    });

    describe('paths and positions', () => {
        test('a list item is written with its index and located in the file', () => {
            const problems = check(
                yaml('  servers:', '    - host: good.example.com', '    - host: "bad host!"')
            );
            expect(problems).toEqual([
                {
                    path: 'Butler-SOS.servers[1].host',
                    line: 5,
                    column: 7,
                    message:
                        'is "bad host!", but must be a host name, for example qlik.example.com.',
                },
            ]);
        });

        test('problems are sorted by line', () => {
            const problems = check(yaml('  mode: free', '  code: ab', '  interval: 0'));
            expect(problems.map((p) => p.line)).toEqual([3, 4, 5]);
        });

        test('pointerToSegments decodes escaped characters', () => {
            expect(pointerToSegments('/Butler-SOS/a~1b/c~0d')).toEqual([
                'Butler-SOS',
                'a/b',
                'c~d',
            ]);
            expect(pointerToSegments('')).toEqual([]);
        });

        test('toDottedPath writes list indexes in brackets', () => {
            const data = { 'Butler-SOS': { servers: [{ host: 'a' }] } };
            expect(toDottedPath(['Butler-SOS', 'servers', '0', 'host'], data)).toBe(
                'Butler-SOS.servers[0].host'
            );
            expect(toDottedPath(['Butler-SOS', 'servers', 0, 'host'])).toBe(
                'Butler-SOS.servers[0].host'
            );
            expect(toDottedPath([])).toBeNull();
        });

        test('the locator gives null for settings not in the file, and for text it cannot use', () => {
            const locate = createPositionLocator(yaml('  port: 1'));
            expect(locate(['Butler-SOS', 'port'])).toEqual({ line: 3, column: 3 });
            expect(locate(['Butler-SOS', 'nothere'])).toBeNull();
            expect(locate([])).toBeNull();
            expect(createPositionLocator(undefined)(['Butler-SOS'])).toBeNull();
        });

        test('settingProblem locates a setting outside the schema, or its section', () => {
            const locate = createPositionLocator(yaml('  heartbeat:', '    enable: true'));
            expect(
                settingProblem(['Butler-SOS', 'heartbeat', 'enable'], 'is odd.', locate)
            ).toEqual({
                path: 'Butler-SOS.heartbeat.enable',
                line: 4,
                column: 5,
                message: 'is odd.',
            });
            expect(
                settingProblem(['Butler-SOS', 'heartbeat', 'missing'], 'is missing.', locate)
            ).toMatchObject({ line: 3, column: 3 });
        });
    });

    describe('YAML syntax errors', () => {
        test('are one problem with the line, the column and what the parser expected', () => {
            let parseError;
            try {
                load('Butler-SOS:\n  logLevel: info\n fileLogging: true\n');
            } catch (err) {
                parseError = err;
            }
            const problem = yamlSyntaxProblem(parseError);
            expect(problem).toMatchObject({
                path: null,
                line: 3,
                column: 2,
                message: 'The file is not valid YAML: bad indentation of a mapping entry.',
            });
            expect(problem.snippet).toContain('fileLogging: true');
        });

        test('an error without a position still gives a message', () => {
            expect(yamlSyntaxProblem(new Error('broken'))).toEqual({
                path: null,
                line: null,
                column: null,
                message: 'The file is not valid YAML: broken.',
            });
        });
    });

    describe('settings contributed through the extension seam', () => {
        test('get the same messages, suggestions and lines as core settings', () => {
            // A build can add settings under Butler-SOS. The formatter knows nothing about them in
            // advance: everything it says comes from the schema the file was checked against.
            const extended = applyConfigSchema(schema, {
                configSchema: {
                    exampleSetting: {
                        type: 'object',
                        properties: {
                            enable: { type: 'boolean' },
                            threshold: { type: 'number', minimum: 0 },
                        },
                        additionalProperties: false,
                    },
                },
            });

            const problems = check(
                yaml('  exampleSetting:', '    enable: true', '    threshhold: 5'),
                extended
            );
            expect(problems).toEqual([
                {
                    path: 'Butler-SOS.exampleSetting.threshhold',
                    line: 5,
                    column: 5,
                    message: 'is not a known setting. Did you mean "threshold"?',
                },
            ]);

            expect(
                check(yaml('  exampleSetting:', '    threshold: -1'), extended).map((p) => [
                    p.path,
                    p.message,
                ])
            ).toEqual([['Butler-SOS.exampleSetting.threshold', 'is -1, but must be at least 0.']]);
        });
    });

    describe('renderConfigReport', () => {
        test('gives a heading with the count, each problem, and one closing line', () => {
            const report = renderConfigReport('/opt/butler-sos/config/production.yaml', [
                { path: null, line: null, column: null, message: 'The file is odd.' },
                {
                    path: 'Butler-SOS.heartbeat.remoteUrll',
                    line: 17,
                    column: 9,
                    message: 'is not a known setting. Did you mean "remoteURL"?',
                },
                {
                    path: 'Butler-SOS.influxdbConfig.port',
                    line: 142,
                    column: 9,
                    message: 'is "8086a", but must be a number.',
                },
            ]);

            expect(report).toBe(
                [
                    'Config file /opt/butler-sos/config/production.yaml has 3 problems:',
                    '',
                    '                   The file is odd.',
                    '',
                    '  line 17, col 9   Butler-SOS.heartbeat.remoteUrll',
                    '                   is not a known setting. Did you mean "remoteURL"?',
                    '',
                    '  line 142, col 9  Butler-SOS.influxdbConfig.port',
                    '                   is "8086a", but must be a number.',
                    '',
                    'Fix these and start Butler SOS again. Run with --help for the command-line options.',
                ].join('\n')
            );
        });

        test('uses the singular for one problem, and includes a snippet', () => {
            const report = renderConfigReport(null, [
                {
                    path: null,
                    line: 3,
                    column: 2,
                    message: 'The file is not valid YAML: bad indentation of a mapping entry.',
                    snippet: ' 3 |  fileLogging: true\n------^\n',
                },
            ]);

            expect(report).toBe(
                [
                    'The config has 1 problem:',
                    '',
                    '  line 3, col 2  The file is not valid YAML: bad indentation of a mapping entry.',
                    '                  3 |  fileLogging: true',
                    '                 ------^',
                    '',
                    'Fix this and start Butler SOS again. Run with --help for the command-line options.',
                ].join('\n')
            );
            expect(report).not.toMatch(/\n\s+at /);
        });
    });
});
