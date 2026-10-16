import path from 'node:path';
import { jest, describe, expect, test, beforeEach, afterEach } from '@jest/globals';

/**
 * Where initLogging puts log files.
 *
 * An absolute Butler-SOS.logDirectory used to be appended to the executable's directory, so
 * /var/log/butler-sos became <execPath>/var/log/butler-sos, and on Windows D:\logs became the
 * invalid C:\Program Files\Butler SOS\D:\logs. These tests exist to make the following mutations
 * fail. If they are ever rewritten, check them the same way: make each change in logging.js and
 * confirm this file goes red.
 *
 * - building the rotating file transport's dirname with upath.join(execPath, logDirectory)
 * - doing the same in the "Log file directory" startup line
 * - reading Butler-SOS.logDirectory when nothing uses it (see the last test)
 */

// logging.js imports Node's own 'path' (under the name upath), so it follows the rules of the OS
// running it, and CI runs on Linux only. Routing its path calls through this delegate lets each
// describe block choose POSIX or Windows rules, so both are exercised on every OS.
let platformPath = path.posix;
const pathDelegate = {
    isAbsolute: (p) => platformPath.isAbsolute(p),
    join: (...parts) => platformPath.join(...parts),
    dirname: (p) => platformPath.dirname(p),
};
jest.unstable_mockModule('path', () => ({ ...pathDelegate, default: pathDelegate }));

const mockDailyRotateFile = jest.fn();
jest.unstable_mockModule('winston', () => ({
    default: {
        createLogger: jest.fn(() => ({ debug: jest.fn(), info: jest.fn() })),
        format: {
            combine: jest.fn(),
            errors: jest.fn(),
            timestamp: jest.fn(),
            colorize: jest.fn(),
            simple: jest.fn(),
            printf: jest.fn(),
        },
        transports: {
            Console: jest.fn(),
            DailyRotateFile: mockDailyRotateFile,
        },
    },
}));
jest.unstable_mockModule('winston-daily-rotate-file', () => ({ default: {} }));

const { initLogging } = await import('../logging.js');

const LOG_DIRECTORY_LINE = 'Log file directory: ';

/**
 * Builds the settings object initLogging reads. Its config.get() throws for a missing key, the
 * way node-config does.
 *
 * @param {object} options - Values for the settings under test.
 * @param {string} options.execPath - Directory Butler SOS resolves relative paths against.
 * @param {string} [options.logDirectory] - Butler-SOS.logDirectory. Omit it to leave the setting
 *   out of the config entirely.
 * @param {string} [options.logLevel] - Butler-SOS.logLevel. Debug prints the startup lines.
 * @param {boolean} [options.fileLogging] - Butler-SOS.fileLogging.
 * @returns {object} Settings stand-in.
 */
function makeSettings({ execPath, logDirectory, logLevel = 'debug', fileLogging = true }) {
    const values = {
        'Butler-SOS.logLevel': logLevel,
        'Butler-SOS.fileLogging': fileLogging,
        'Butler-SOS.logDirectory': logDirectory,
    };

    return {
        execPath,
        isSea: false,
        configFile: 'production.yaml',
        config: {
            'Butler-SOS': { logLevel },
            get: (key) => {
                if (values[key] === undefined) {
                    throw new Error(`Configuration property "${key}" is not defined`);
                }
                return values[key];
            },
        },
    };
}

/**
 * Runs initLogging and reports the log directory each of its two outputs used.
 *
 * @param {object} settings - Settings from makeSettings.
 * @returns {object} `printed`: the directory in the "Log file directory" startup line.
 *   `dirname`: the directory handed to the rotating file transport.
 */
function logDirectoriesUsed(settings) {
    initLogging(settings);

    const line = console.log.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.startsWith(LOG_DIRECTORY_LINE));

    return {
        printed: line?.slice(LOG_DIRECTORY_LINE.length),
        dirname: mockDailyRotateFile.mock.calls[0]?.[0].dirname,
    };
}

describe('initLogging log file directory', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        console.log.mockRestore();
    });

    describe('with POSIX path rules (Linux, macOS)', () => {
        const execPath = '/opt/butler-sos';

        beforeEach(() => {
            platformPath = path.posix;
        });

        test.each(['log', './log'])(
            'resolves relative "%s" against the executable directory',
            (logDirectory) => {
                expect(logDirectoriesUsed(makeSettings({ execPath, logDirectory }))).toEqual({
                    printed: '/opt/butler-sos/log',
                    dirname: '/opt/butler-sos/log',
                });
            }
        );

        test('uses an absolute path as given', () => {
            const logDirectory = '/var/log/butler-sos';

            expect(logDirectoriesUsed(makeSettings({ execPath, logDirectory }))).toEqual({
                printed: logDirectory,
                dirname: logDirectory,
            });
        });
    });

    describe('with Windows path rules', () => {
        const execPath = 'C:\\Program Files\\Butler SOS';

        beforeEach(() => {
            platformPath = path.win32;
        });

        test('resolves relative "log" against the executable directory', () => {
            expect(logDirectoriesUsed(makeSettings({ execPath, logDirectory: 'log' }))).toEqual({
                printed: 'C:\\Program Files\\Butler SOS\\log',
                dirname: 'C:\\Program Files\\Butler SOS\\log',
            });
        });

        test.each(['D:\\Butler SOS\\log', 'D:/Butler SOS/log'])(
            'uses absolute "%s" as given',
            (logDirectory) => {
                expect(logDirectoriesUsed(makeSettings({ execPath, logDirectory }))).toEqual({
                    printed: logDirectory,
                    dirname: logDirectory,
                });
            }
        );
    });

    test('does not read logDirectory when neither file logging nor startup output uses it', () => {
        // --skip-config-verification skips the schema check too, so a config without this
        // setting can reach initLogging, and node-config's get() throws for it. Such a config
        // starts today because the setting is only read when something uses it. Reading it up
        // front would stop it starting.
        platformPath = path.posix;
        const settings = makeSettings({
            execPath: '/opt/butler-sos',
            logLevel: 'info',
            fileLogging: false,
        });

        expect(() => initLogging(settings)).not.toThrow();
        expect(mockDailyRotateFile).not.toHaveBeenCalled();
    });
});
