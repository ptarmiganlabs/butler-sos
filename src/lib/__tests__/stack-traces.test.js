import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Stack traces in error log lines.
 *
 * Error lines include a stack trace only when Butler SOS runs from source code on an ordinary
 * machine — a developer running `node src/butler-sos.js` from a checkout. Everywhere else they
 * carry the error message alone. The packaged executables already worked that way. The Docker
 * image did not: it also runs `node src/butler-sos.js`, so every error in a container log came
 * with a multi-line stack trace, which made the log hard to read.
 */

const mockSea = { isSea: jest.fn(() => false) };
jest.unstable_mockModule('../sea-wrapper.js', () => ({ default: mockSea }));

// Butler SOS detects Docker by the /.dockerenv file Docker puts in every container
const mockAccessSync = jest.fn();
jest.unstable_mockModule('fs-extra', () => ({
    default: { accessSync: mockAccessSync, constants: { F_OK: 0 } },
}));

const mockGlobals = {
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
    },
};
jest.unstable_mockModule('../../globals.js', () => ({ default: mockGlobals }));
jest.unstable_mockModule('../crash-dump.js', () => ({ writeCrashDump: jest.fn() }));

const { shouldLogStackTraces, getErrorMessage } = await import('../globals/utils.js');
const { logError } = await import('../log-error.js');
const { handleUnhandledRejection, setGlobalsRef } = await import('../process-safety-net.js');

/** Butler SOS started with `node src/butler-sos.js` on an ordinary machine. */
function runFromSource() {
    mockSea.isSea.mockReturnValue(false);
    mockAccessSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
    });
}

/** Butler SOS in the Docker image: also `node src/butler-sos.js`, but inside a container. */
function runInDocker() {
    mockSea.isSea.mockReturnValue(false);
    mockAccessSync.mockImplementation(() => undefined);
}

/** Butler SOS as one of the packaged executables. */
function runAsExecutable() {
    mockSea.isSea.mockReturnValue(true);
    mockAccessSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
    });
}

/**
 * An error with a recognisable stack trace.
 *
 * @returns {Error} The error
 */
function makeError() {
    const err = new Error('connect ECONNREFUSED 192.168.1.176:8181');
    err.stack = `${err.message}\n    at TCPConnectWrap.afterConnect (node:net:1864:16)`;
    return err;
}

beforeEach(() => {
    jest.clearAllMocks();
    delete mockGlobals.isSea;
    delete mockGlobals.hostInfo;
});

describe('shouldLogStackTraces', () => {
    test('is true when running from source', () => {
        runFromSource();
        expect(shouldLogStackTraces({})).toBe(true);
    });

    test('is false in Docker', () => {
        runInDocker();
        expect(shouldLogStackTraces({})).toBe(false);
    });

    test('is false in a packaged executable', () => {
        runAsExecutable();
        expect(shouldLogStackTraces({})).toBe(false);
    });

    test('follows the Docker check made at startup once it is available', () => {
        // The "Running in Docker" line in the startup log comes from the same value
        runFromSource();
        expect(shouldLogStackTraces({ hostInfo: { isRunningInDocker: true } })).toBe(false);

        runInDocker();
        expect(shouldLogStackTraces({ hostInfo: { isRunningInDocker: false } })).toBe(true);
    });

    test('follows the packaged-executable check made at startup once it is available', () => {
        runFromSource();
        expect(shouldLogStackTraces({ isSea: true })).toBe(false);
    });
});

describe('getErrorMessage', () => {
    test('returns the stack trace when running from source', () => {
        runFromSource();
        expect(getErrorMessage({}, makeError())).toContain('at TCPConnectWrap.afterConnect');
    });

    test.each([
        ['in Docker', runInDocker],
        ['in a packaged executable', runAsExecutable],
    ])('returns only the message %s', (_, setUp) => {
        setUp();
        expect(getErrorMessage({}, makeError())).toBe('connect ECONNREFUSED 192.168.1.176:8181');
    });
});

describe('logError', () => {
    test('logs the message, then the stack trace, when running from source', () => {
        runFromSource();

        logError('HEALTH: Error when calling health check API', makeError());

        expect(mockGlobals.logger.error).toHaveBeenCalledTimes(2);
        expect(mockGlobals.logger.error.mock.calls[1][0]).toMatch(/^Stack trace: /);
    });

    test.each([
        ['in Docker', runInDocker],
        ['in a packaged executable', runAsExecutable],
    ])('logs one line, without the stack trace, %s', (_, setUp) => {
        setUp();

        logError('HEALTH: Error when calling health check API', makeError());

        expect(mockGlobals.logger.error).toHaveBeenCalledTimes(1);
        expect(mockGlobals.logger.error).toHaveBeenCalledWith(
            'HEALTH: Error when calling health check API: connect ECONNREFUSED 192.168.1.176:8181'
        );
    });
});

describe('crash handler, before startup has finished', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        // No globals yet, so the handler decides for itself
        setGlobalsRef(null);
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    test('includes the stack trace when running from source', () => {
        runFromSource();

        handleUnhandledRejection(makeError());

        expect(consoleErrorSpy.mock.calls[0][0]).toContain('at TCPConnectWrap.afterConnect');
    });

    test('leaves the stack trace out in Docker', () => {
        runInDocker();

        handleUnhandledRejection(makeError());

        expect(consoleErrorSpy.mock.calls[0][0]).toBe(
            'Unhandled promise rejection: connect ECONNREFUSED 192.168.1.176:8181'
        );
    });
});
