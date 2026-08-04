/**
 * Process-level safety net.
 *
 * Handlers for errors that escape every try/catch in the application. Kept in their own
 * module (rather than inline in butler-sos.js) so they can be unit tested without starting
 * the whole application, and so they have a well-defined way to reach the globals singleton.
 *
 * The globals object is imported dynamically inside `mainScript()` to guarantee singleton
 * init order, so it is not in scope where these handlers are registered. It is injected
 * here via {@link setGlobalsRef} once init completes; until then the handlers fall back to
 * `console.error` so nothing is lost during startup.
 */

import { writeCrashDump } from './crash-dump.js';
import sea from './sea-wrapper.js';
import { redactSensitivePatterns } from './secret-patterns.js';

/** @type {object|null} */
let globalsRef = null;

/**
 * Injects the initialised globals singleton so the handlers can log through the real logger.
 *
 * @param {object|null} globals - The initialised globals object, or null to clear it.
 * @returns {void}
 */
export function setGlobalsRef(globals) {
    globalsRef = globals;
}

/**
 * Converts an arbitrary rejection reason into an Error.
 *
 * `String(reason)` can itself throw (a Symbol, or an object with a throwing `toString`),
 * so this never lets the conversion escape.
 *
 * @param {Error|*} reason - The rejection reason.
 * @returns {Error} An Error representing the reason.
 */
function toError(reason) {
    if (reason instanceof Error) return reason;

    try {
        return new Error(String(reason));
    } catch {
        return new Error('Unhandled promise rejection with unrepresentable reason');
    }
}

/**
 * Formats an error for logging, preferring the globals-aware formatter when available.
 *
 * The fallback mirrors `getErrorMessage` in `globals/utils.js`: SEA builds get the message
 * only, because a stack trace there exposes absolute filesystem paths from the build machine.
 * Uses `||` rather than `??` for the same reason that helper does — an error carrying an
 * empty-string `stack` should fall through to the message rather than log nothing.
 *
 * @param {Error} err - The error to format.
 * @returns {string} Formatted error message.
 */
function formatError(err) {
    let text;

    if (typeof globalsRef?.getErrorMessage === 'function') {
        text = globalsRef.getErrorMessage(err);
    } else if (sea.isSea()) {
        // globals (and therefore its SEA detection) is not available yet. sea.isSea() is safe
        // to call at any time — it falls back to a heuristic before sea.initialize() runs.
        text = err?.message || String(err);
    } else {
        text = err?.stack || err?.message || String(err);
    }

    // Scrub before the text reaches the logger or stderr. Error messages from HTTP and
    // database clients routinely carry credentials — a connection URL with an embedded
    // password, an echoed Authorization header, a `token=...` query string. crash-dump.js
    // already redacts these before writing a dump file; without the same treatment here the
    // identical error would be sanitised on disk and disclosed in the log.
    return redactSensitivePatterns(text);
}

/**
 * Logs a message through the globals logger when available, always mirroring to stderr.
 *
 * A logger call can throw — a winston transport with a full disk or a closed file handle
 * does exactly that. Isolating it here means a broken transport cannot take out the rest of
 * the fatal path (the stderr write and the crash dump), which is the one moment diagnostics
 * matter most.
 *
 * @param {string} message - Already-formatted, already-redacted message.
 * @returns {void}
 */
function reportToLoggerAndStderr(message) {
    try {
        if (typeof globalsRef?.logger?.error === 'function') {
            globalsRef.logger.error(message);
        }
    } catch {
        // Broken logger transport. stderr below is the fallback.
    }

    try {
        console.error(message);
    } catch {
        // Nothing further we can safely do.
    }
}

/**
 * Handler for unhandled promise rejections.
 *
 * Logs the error and continues running — no crash dump, no exit. An unhandled rejection is
 * frequently a transient destination failure (InfluxDB, MQTT, New Relic) and must not take
 * down a monitoring daemon, but it must never be silently discarded either.
 *
 * @param {Error|*} reason - The rejection reason (usually an Error).
 * @returns {void}
 */
export function handleUnhandledRejection(reason) {
    const err = toError(reason);

    try {
        const message = `Unhandled promise rejection: ${formatError(err)}`;

        if (typeof globalsRef?.logger?.error === 'function') {
            globalsRef.logger.error(message);
        } else {
            console.error(message);
        }
    } catch (handlerErr) {
        // Must not throw. Last resort so the rejection is never silently swallowed.
        try {
            console.error(
                `Unhandled promise rejection (logging failed: ${handlerErr?.message}): ${err?.message}`
            );
        } catch {
            // Nothing further we can safely do.
        }
    }
}

/**
 * Handler for synchronous uncaught exceptions.
 * Writes a crash dump and exits with code 1.
 *
 * @param {Error} err - The uncaught error.
 * @returns {Promise<void>} Resolves once the crash dump has been attempted.
 */
export async function handleUncaughtException(err) {
    try {
        // Report the error itself, not just a banner. The crash dump is a no-op when
        // Butler-SOS.crashFile.enable is false, and its write failures are swallowed by
        // design (an unwritable crash_dumps directory is common — the Docker image runs as
        // USER node), so this may be the only record of why the process died.
        //
        // formatError and the logger are each isolated: neither a globals-supplied formatter
        // nor a broken logger transport may prevent the crash dump from being attempted.
        let detail;
        try {
            detail = formatError(err);
        } catch {
            detail = err?.message ?? 'unformattable error';
        }

        reportToLoggerAndStderr(`FATAL: Uncaught exception – writing crash dump… ${detail}`);

        await writeCrashDump(err, 'uncaughtException');
    } catch {
        // Must not throw
    } finally {
        process.exit(1);
    }
}

/**
 * Registers the process-level handlers.
 *
 * @returns {void}
 */
export function registerProcessSafetyNet() {
    process.on('uncaughtException', handleUncaughtException);
    process.on('unhandledRejection', handleUnhandledRejection);
}
