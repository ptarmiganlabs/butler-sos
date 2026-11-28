import { describe, test, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// End to end through verifyConfigFileSchema, with the real file system, the real YAML parser and
// the shipped config template, unlike config-file-verify.test.js, which mocks both. The build's
// extensions contribute one setting, so the report is checked for a setting core does not define.

jest.unstable_mockModule('#extensions', () => ({
    extensions: {
        seamVersion: 1,
        options: [],
        configSchema: {
            exampleSetting: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean' },
                    threshold: { type: 'number', minimum: 0 },
                },
                required: ['enable'],
                additionalProperties: false,
            },
        },
        hooks: {},
    },
}));

const { verifyConfigFileSchema } = await import('../config-file-verify.js');

const templatePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../config/production_template.yaml'
);

/**
 * Finds the 1-based line of the first line matching a pattern, at or after a starting line.
 *
 * @param {string} text - The file's text.
 * @param {RegExp} pattern - What to look for.
 * @param {number} [after] - 1-based line to start at.
 * @returns {number} The line.
 */
function lineOf(text, pattern, after = 1) {
    const lines = text.split('\n');
    for (let i = after - 1; i < lines.length; i++) {
        if (pattern.test(lines[i])) return i + 1;
    }
    throw new Error(`No line matches ${pattern}`);
}

describe('verifyConfigFileSchema report', () => {
    let dir;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
    });

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'butler-sos-config-report-'));
    });

    afterEach(() => {
        errorSpy.mockClear();
        infoSpy.mockClear();
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
        errorSpy.mockRestore();
        infoSpy.mockRestore();
        exitSpy.mockRestore();
    });

    /**
     * Writes a config file and runs the check on it.
     *
     * @param {string} name - File name.
     * @param {string} text - File contents.
     * @returns {Promise<{result: boolean, report: string}>} The result, and the report printed.
     */
    async function run(name, text) {
        const file = path.join(dir, name);
        fs.writeFileSync(file, text);
        const result = await verifyConfigFileSchema(file);
        expect(exitSpy).not.toHaveBeenCalled();
        expect(errorSpy.mock.calls.length).toBeLessThanOrEqual(1);
        return { result, report: errorSpy.mock.calls[0]?.[0] ?? '', file };
    }

    test('reports the common mistakes in a real config file, each with its line', async () => {
        let text = fs.readFileSync(templatePath, 'utf8');

        // A misspelt setting in an enabled section, a value not in the allowed list, a number with
        // a typo in it, and a misspelt setting in a section a build contributes.
        const heartbeatLine = lineOf(text, /^ {4}heartbeat:/);
        const heartbeatEnable = lineOf(text, /^ {8}enable:/, heartbeatLine);
        let lines = text.split('\n');
        lines[heartbeatEnable - 1] = lines[heartbeatEnable - 1].replace('false', 'true');
        text = lines.join('\n');
        text = text.replace('remoteURL:', 'remoteUrll:');
        text = text.replace(/logLevel: info/, 'logLevel: chatty');
        const influxLine = lineOf(text, /^ {4}influxdbConfig:/);
        const portLine = lineOf(text, /^ {8}port:/, influxLine);
        lines = text.split('\n');
        lines[portLine - 1] = lines[portLine - 1].replace(/port: \d+/, 'port: 8086a');
        text = lines.join('\n');
        text = text.replace(
            /\nButler-SOS:\n/,
            '\nButler-SOS:\n    exampleSetting:\n        enable: true\n        threshhold: 5\n'
        );

        const { result, report, file } = await run('broken.yaml', text);
        expect(result).toBe(false);

        const at = (pattern) => lineOf(text, pattern);
        expect(report).toMatch(new RegExp(`^Config file ${file} has \\d+ problems:\\n`));
        expect(report).toMatch(
            new RegExp(
                `line ${at(/threshhold: 5/)}, col 9 +Butler-SOS\\.exampleSetting\\.threshhold\\n +is not a known setting\\. Did you mean "threshold"\\?\\n`
            )
        );
        expect(report).toMatch(
            new RegExp(
                `line ${at(/logLevel: chatty/)}, col 5 +Butler-SOS\\.logLevel\\n +is "chatty", but must be one of: "error", "warn", "info", "verbose", "debug", "silly"\\.\\n`
            )
        );
        expect(report).toMatch(
            new RegExp(
                `line ${at(/remoteUrll:/)}, col 9 +Butler-SOS\\.heartbeat\\.remoteUrll\\n +is not a known setting\\. Did you mean "remoteURL"\\? "remoteURL" is required\\.\\n`
            )
        );
        expect(report).toMatch(
            new RegExp(
                `line ${at(/port: 8086a/)}, col 9 +Butler-SOS\\.influxdbConfig\\.port\\n +is "8086a", but must be a number\\.\\n`
            )
        );
        // One message for the misspelling, not a second one for the missing setting.
        expect(report).not.toContain('Butler-SOS.heartbeat.remoteURL\n');
        expect(report).not.toMatch(/must match "then" schema|VERIFY CONFIG FILE ERROR/);
        expect(report.trimEnd().split('\n').pop()).toBe(
            'Fix these and start Butler SOS again. Run with --help for the command-line options.'
        );
    });

    test('reports a YAML syntax error once, with its line and column', async () => {
        const { result, report, file } = await run(
            'syntax.yaml',
            'Butler-SOS:\n    logLevel: info\n   fileLogging: true\n'
        );
        expect(result).toBe(false);
        expect(report).toContain(`Config file ${file} has 1 problem:`);
        expect(report).toContain(
            'line 3, col 4  The file is not valid YAML: bad indentation of a mapping entry.'
        );
        expect(report).not.toMatch(/\n\s+at /);
    });

    test('accepts a contributed setting that is correct', async () => {
        // Only the contributed section is checked here: the template's placeholder host names
        // fail on their own, so the assertion is that nothing is said about exampleSetting.
        const text = fs
            .readFileSync(templatePath, 'utf8')
            .replace(
                /\nButler-SOS:\n/,
                '\nButler-SOS:\n    exampleSetting:\n        enable: true\n        threshold: 5\n'
            );
        const { report } = await run('extension-ok.yaml', text);
        expect(report).toMatch(/^Config file .* has \d+ problems?:/);
        expect(report).not.toContain('exampleSetting');
    });
});
