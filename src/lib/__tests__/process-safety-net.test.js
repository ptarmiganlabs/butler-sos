import { jest } from '@jest/globals';

jest.unstable_mockModule('../crash-dump.js', () => ({
    writeCrashDump: jest.fn().mockResolvedValue(undefined),
}));

const { writeCrashDump } = await import('../crash-dump.js');
const {
    handleUnhandledRejection,
    handleUncaughtException,
    registerProcessSafetyNet,
    setGlobalsRef,
} = await import('../process-safety-net.js');

/**
 * Stand-in for the globals `getErrorMessage` method.
 *
 * @param {Error} err - The error to format.
 * @returns {string} The error message.
 */
function fakeGetErrorMessage(err) {
    return err.message;
}

/**
 * Builds a globals stub with a mock logger.
 *
 * @param {object} [logger] - Logger to use. Defaults to one with a jest mock `error`.
 * @returns {{ logger: object, getErrorMessage: Function }} Globals stub.
 */
function makeGlobals(logger = { error: jest.fn() }) {
    return { logger, getErrorMessage: fakeGetErrorMessage };
}

describe('process safety net - unhandledRejection', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        setGlobalsRef(null);
    });

    test('logs through the globals logger when globals are available', () => {
        const globals = makeGlobals();
        setGlobalsRef(globals);

        handleUnhandledRejection(new Error('influxdb write failed'));

        expect(globals.logger.error).toHaveBeenCalledTimes(1);
        expect(globals.logger.error.mock.calls[0][0]).toBe(
            'Unhandled promise rejection: influxdb write failed'
        );
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    // Regression guard: the handler previously referenced an out-of-scope `globals`, threw
    // ReferenceError on its first statement, and had that swallowed by a bare catch — so
    // every unhandled rejection was lost with no output at all.
    test('falls back to console.error when globals are not yet initialised', () => {
        handleUnhandledRejection(new Error('rejected during startup'));

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('Unhandled promise rejection');
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('rejected during startup');
    });

    test('does not throw and still reports when the logger itself throws', () => {
        const explodingLogger = {
            /**
             * Logger that always fails, simulating a broken transport.
             *
             * @returns {void}
             */
            error() {
                throw new Error('logger exploded');
            },
        };
        setGlobalsRef(makeGlobals(explodingLogger));

        expect(() => handleUnhandledRejection(new Error('original failure'))).not.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('original failure');
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('logger exploded');
    });

    test('handles non-Error rejection reasons', () => {
        const globals = makeGlobals();
        setGlobalsRef(globals);

        handleUnhandledRejection('a plain string reason');

        expect(globals.logger.error).toHaveBeenCalledWith(
            'Unhandled promise rejection: a plain string reason'
        );
    });

    test('handles symbol rejection reasons', () => {
        const globals = makeGlobals();
        setGlobalsRef(globals);

        // String(symbol) is legal (unlike implicit conversion) and yields the description.
        expect(() => handleUnhandledRejection(Symbol('nope'))).not.toThrow();

        expect(globals.logger.error).toHaveBeenCalledWith(
            'Unhandled promise rejection: Symbol(nope)'
        );
    });

    test('handles rejection reasons that cannot be stringified', () => {
        const globals = makeGlobals();
        setGlobalsRef(globals);

        const hostile = {
            /**
             * Throws on stringification, as a Proxy or exotic object might.
             *
             * @returns {string} Never returns.
             */
            toString() {
                throw new Error('toString exploded');
            },
        };

        expect(() => handleUnhandledRejection(hostile)).not.toThrow();

        expect(globals.logger.error).toHaveBeenCalledWith(
            'Unhandled promise rejection: Unhandled promise rejection with unrepresentable reason'
        );
    });

    test('survives globals without a usable logger', () => {
        // Not makeGlobals(undefined) — that would hit the default parameter and supply a
        // working mock logger, quietly testing nothing.
        setGlobalsRef({ getErrorMessage: fakeGetErrorMessage });

        expect(() => handleUnhandledRejection(new Error('no logger here'))).not.toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('no logger here');
    });
});

describe('process safety net - uncaughtException', () => {
    let consoleErrorSpy;
    let exitSpy;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        writeCrashDump.mockClear();
        writeCrashDump.mockResolvedValue(undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
        setGlobalsRef(null);
    });

    test('writes a crash dump and exits non-zero', async () => {
        const err = new Error('fatal boom');

        await handleUncaughtException(err);

        expect(writeCrashDump).toHaveBeenCalledTimes(1);
        expect(writeCrashDump).toHaveBeenCalledWith(err, 'uncaughtException');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    // The crash dump is a no-op when crashFile.enable is false, and its write failures are
    // swallowed by design. If the banner is the only output, a fatal error can be logged with
    // no message, stack or type at all — so the error detail must be reported separately.
    test('reports the error detail, not just a banner', async () => {
        setGlobalsRef(makeGlobals());

        await handleUncaughtException(new Error('fatal detail must survive'));

        const everythingLogged = consoleErrorSpy.mock.calls.flat().join(' ');
        expect(everythingLogged).toContain('fatal detail must survive');
    });

    test('still exits when the crash dump throws', async () => {
        writeCrashDump.mockRejectedValue(new Error('disk full'));

        await expect(handleUncaughtException(new Error('boom'))).resolves.toBeUndefined();

        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    // A winston transport with a full disk or a closed file handle throws synchronously.
    // Before the logger call was isolated, that skipped both the stderr write and the crash
    // dump, leaving the exit code as the only evidence the daemon had died.
    test('still writes the crash dump and stderr when the logger throws', async () => {
        const explodingLogger = {
            /**
             * Logger that always fails, simulating a broken transport.
             *
             * @returns {void}
             */
            error() {
                throw new Error('transport closed');
            },
        };
        setGlobalsRef(makeGlobals(explodingLogger));

        await handleUncaughtException(new Error('fatal with broken logger'));

        expect(writeCrashDump).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy.mock.calls.flat().join(' ')).toContain('fatal with broken logger');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('still writes the crash dump when the error formatter throws', async () => {
        setGlobalsRef({
            logger: { error: jest.fn() },
            /**
             * Formatter that always fails.
             *
             * @returns {string} Never returns.
             */
            getErrorMessage() {
                throw new Error('formatter exploded');
            },
        });

        await handleUncaughtException(new Error('fatal with broken formatter'));

        expect(writeCrashDump).toHaveBeenCalledTimes(1);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});

// crash-dump.js redacts these patterns before writing a dump file. Without the same
// treatment here, the identical error was sanitised on disk and disclosed in the log.
describe('process safety net - secret redaction in logged errors', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        setGlobalsRef(null);
    });

    test.each([
        ['key=value secret', 'Connection failed: password=hunter2', 'hunter2'],
        [
            'bearer token',
            'Request rejected: Authorization: Bearer abcdef1234567890',
            'abcdef1234567890',
        ],
        [
            'credentials in a URL',
            'connect ECONNREFUSED https://admin:s3cr3t@influx.example.com',
            's3cr3t',
        ],
    ])('redacts a %s from a rejection before logging', (_name, message, secret) => {
        const logger = { error: jest.fn() };
        setGlobalsRef({ logger, getErrorMessage: (err) => err.message });

        handleUnhandledRejection(new Error(message));

        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error.mock.calls[0][0]).not.toContain(secret);
        expect(logger.error.mock.calls[0][0]).toContain('[REDACTED]');
    });

    test('redacts a secret from a fatal error before logging', async () => {
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        const logger = { error: jest.fn() };
        setGlobalsRef({ logger, getErrorMessage: (err) => err.message });

        await handleUncaughtException(new Error('fatal: api_key=super-secret-value'));

        expect(logger.error.mock.calls[0][0]).not.toContain('super-secret-value');
        expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toContain('super-secret-value');

        exitSpy.mockRestore();
    });
});

describe('registerProcessSafetyNet', () => {
    let onSpy;

    beforeEach(() => {
        onSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
    });

    afterEach(() => {
        onSpy.mockRestore();
    });

    // Regression guard with teeth: swapping the two registrations used to pass the entire
    // suite, and in production would make the first transient InfluxDB rejection write a
    // crash dump and kill the daemon.
    test('binds each handler to the correct process event', () => {
        registerProcessSafetyNet();

        const bindings = Object.fromEntries(onSpy.mock.calls.map(([event, fn]) => [event, fn]));

        expect(bindings.uncaughtException).toBe(handleUncaughtException);
        expect(bindings.unhandledRejection).toBe(handleUnhandledRejection);
    });

    test('registers both handlers exactly once', () => {
        registerProcessSafetyNet();

        const events = onSpy.mock.calls.map(([event]) => event);
        expect(events.filter((e) => e === 'uncaughtException')).toHaveLength(1);
        expect(events.filter((e) => e === 'unhandledRejection')).toHaveLength(1);
    });
});
