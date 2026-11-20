import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Option } from 'commander';

// What initCommandLine does with a variant build's description. The stock build's behaviour is
// command-line.test.js; this replaces the module behind `#extensions`, as a variant build does.

jest.unstable_mockModule('#extensions', () => ({
    extensions: {
        seamVersion: 1,
        variant: 'acme',
        options: [{ option: new Option('--extra-file <path>', 'an extra file') }],
        configSchema: {},
        hooks: {},
    },
}));

const { initCommandLine } = await import('../command-line.js');

describe('initCommandLine with a variant build description', () => {
    let originalArgv;
    let stdoutSpy;

    beforeEach(() => {
        originalArgv = process.argv;
        stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        process.argv = originalArgv;
        jest.restoreAllMocks();
    });

    test('parses a contributed option like a core one', () => {
        process.argv = ['node', 'butler-sos.js', '-c', 'production.yaml', '--extra-file', 'x.txt'];
        const settings = { appVersion: '1.2.3' };

        initCommandLine(settings);

        expect(settings.options).toMatchObject({
            configfile: 'production.yaml',
            extraFile: 'x.txt',
        });
    });

    test('names the variant in what --version prints', () => {
        process.argv = ['node', 'butler-sos.js', '-c', 'production.yaml'];
        const settings = { appVersion: '1.2.3' };

        initCommandLine(settings);

        expect(settings.versionReport).toBe('butler-sos 1.2.3 (acme)\n  core    1.2.3');
    });

    test('lists a contributed option in --help', () => {
        process.argv = ['node', 'butler-sos.js', '--help'];
        jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit(${code})`);
        });

        expect(() => initCommandLine({ appVersion: '1.2.3' })).toThrow('process.exit(0)');
        expect(stdoutSpy.mock.calls.map((call) => call[0]).join('')).toContain(
            '--extra-file <path>'
        );
    });
});
