import { jest, describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { PassThrough } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';

import { formatErrorBlock, initCommandLine, missingConfigFileMessage } from '../command-line.js';

/**
 * Starting Butler SOS without a config file used to print the help text and exit with code 0,
 * with nothing saying what was wrong. The usual way to get there is
 * `npm run butler-sos -c <file>`, where npm takes `-c` for itself, so the user had specified a
 * config file and was given no clue why it was ignored.
 */

describe('missingConfigFileMessage', () => {
    test('names the missing option', () => {
        const message = missingConfigFileMessage({});

        expect(message).toContain('Error: No config file specified');
        expect(message).toContain('-c <file>');
        expect(message).not.toContain('npm');
    });

    test('explains that npm took -c when run through npm run', () => {
        const message = missingConfigFileMessage({
            npm_config_call: 'src/config/production.yaml',
            npm_command: 'run',
            npm_lifecycle_event: 'butler-sos',
        });

        expect(message).toContain('npm read "-c src/config/production.yaml"');
        expect(message).toContain('npm run butler-sos -- -c src/config/production.yaml');
    });

    test('gives no npm hint for npm exec -c, which also sets npm_config_call', () => {
        const message = missingConfigFileMessage({
            npm_config_call: 'node src/butler-sos.js',
            npm_command: 'exec',
            npm_lifecycle_event: 'npx',
        });

        expect(message).not.toContain('npm read');
    });

    test.each([
        ['macOS and Linux shells', 'linux', `-c 'config/my config.yaml'`],
        ['Windows', 'win32', `-c "config/my config.yaml"`],
    ])('quotes a path with spaces in the suggested command, for %s', (_, platform, quoted) => {
        // npm keeps the file name without the quotes it was typed with. Unquoted, the suggested
        // command would split it into two arguments and fail again.
        const message = missingConfigFileMessage(
            {
                npm_config_call: 'config/my config.yaml',
                npm_command: 'run',
                npm_lifecycle_event: 'butler-sos',
            },
            platform
        );

        expect(message).toContain(`npm run butler-sos -- ${quoted}`);
    });

    test('quotes a single quote inside a path for macOS and Linux shells', () => {
        const message = missingConfigFileMessage(
            {
                npm_config_call: "goran's.yaml",
                npm_command: 'run',
                npm_lifecycle_event: 'butler-sos',
            },
            'darwin'
        );

        expect(message).toContain(`npm run butler-sos -- -c 'goran'\\''s.yaml'`);
    });

    test.each([
        // macOS and Linux shells treat a backslash as an escape, so it must be quoted there...
        [
            'macOS and Linux shells',
            'linux',
            String.raw`config/qlik\prod.yaml`,
            String.raw`-c 'config/qlik\prod.yaml'`,
        ],
        // ...while on Windows it separates folders and needs no quotes
        [
            'Windows',
            'win32',
            String.raw`C:\butler-sos\config\prod.yaml`,
            String.raw`-c C:\butler-sos\config\prod.yaml`,
        ],
    ])('keeps backslashes in the suggested command, for %s', (_, platform, path, expected) => {
        const message = missingConfigFileMessage(
            { npm_config_call: path, npm_command: 'run', npm_lifecycle_event: 'butler-sos' },
            platform
        );

        expect(message).toContain(`npm run butler-sos -- ${expected}`);
    });
});

describe('formatErrorBlock', () => {
    const message = 'Error: Short headline.\nA somewhat longer second line.';

    // These results depend only on the stream, not on the colour settings (FORCE_COLOR,
    // NO_COLOR) of whoever runs the tests: a PassThrough is not a terminal, and the colour tests
    // use a stand-in terminal that reports its own colour support.

    test('frames the message with rules as wide as its longest line', () => {
        const block = formatErrorBlock(message, new PassThrough());
        const rule = '='.repeat('A somewhat longer second line.'.length);

        expect(block).toBe(
            `\n${rule}\nError: Short headline.\nA somewhat longer second line.\n${rule}`
        );
    });

    test('caps the rules at the terminal width', () => {
        const stream = new PassThrough();
        stream.columns = 10;

        const lines = formatErrorBlock(message, stream).split('\n');

        expect(lines[1]).toBe('='.repeat(10));
        expect(lines.at(-1)).toBe('='.repeat(10));
    });

    test('colours the rules and headline red on a colour terminal', () => {
        const stream = new PassThrough();
        stream.isTTY = true;
        stream.hasColors = () => true;

        const lines = formatErrorBlock(message, stream).split('\n');

        expect(lines[1]).toContain('\u001b[31m');
        expect(lines[2]).toContain('\u001b[1m');
        expect(lines[2]).toContain('\u001b[31m');
        expect(lines[3]).toBe('A somewhat longer second line.');
    });

    test('leaves colour out on a terminal without colour support, or with NO_COLOR set', () => {
        // A real terminal's hasColors() is false for TERM=dumb, NO_COLOR and FORCE_COLOR=0
        const stream = new PassThrough();
        stream.isTTY = true;
        stream.hasColors = () => false;

        expect(formatErrorBlock(message, stream)).not.toContain('\u001b[');
    });
});

describe('initCommandLine', () => {
    let originalArgv;
    let exitSpy;
    let stderrSpy;
    let stdoutSpy;

    beforeEach(() => {
        originalArgv = process.argv;
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit(${code})`);
        });
        stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
        stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        process.argv = originalArgv;
        jest.restoreAllMocks();
    });

    test('exits with code 1 and says why when no config file is given', () => {
        process.argv = ['node', 'butler-sos.js'];

        expect(() => initCommandLine({ appVersion: '1.2.3' })).toThrow('process.exit(1)');

        // Colour depends on whether stderr is a colour terminal; only the text is checked here
        const stderr = stripVTControlCharacters(
            stderrSpy.mock.calls.map((call) => call[0]).join('')
        );
        expect(stderr).toContain('Usage: butler-sos [options]');
        expect(stderr).toMatch(/=+\nError: No config file specified\./);
        expect(stdoutSpy).not.toHaveBeenCalled();
    });

    test('accepts a config file given with -c', () => {
        process.argv = ['node', 'butler-sos.js', '-c', 'production.yaml'];
        const settings = { appVersion: '1.2.3' };

        initCommandLine(settings);

        expect(settings.options.configfile).toBe('production.yaml');
        expect(exitSpy).not.toHaveBeenCalled();
    });
});
