/**
 * Crash dump module for Butler SOS.
 *
 * Writes a crash dump file (JSON and/or plain text) when Butler SOS encounters
 * an unrecoverable error such as an uncaught exception, unhandled promise
 * rejection, or an explicit fatal error logged via logFatal().
 *
 * Key design goals:
 * - Sensitive config data (IPs, passwords, tokens, certificates) is never written
 * - Best-effort redaction of common sensitive patterns in error messages/stacks
 * - Non-blocking: file write failures must never throw or block process exit
 * - SEA-compatible: works correctly in packaged Single Executable Applications
 * - Machine-readable (JSON) and human-readable (TXT) output
 *
 * NOTE: Error messages and stack traces are included for debugging purposes.
 * While best-effort redaction is applied, error content may still contain
 * sensitive data depending on what the upstream error captured.
 */

import fs from 'fs';
import path from 'path';

import globals from '../globals.js';
import sea from './sea-wrapper.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a timestamp string suitable for use in crash dump filenames.
 * Format: YYYYMMDD_HHMMSS_mmm (local time)
 *
 * @returns {string} Timestamp string in YYYYMMDD_HHMMSS_mmm format
 */
function buildTimestampForFilename() {
    const now = new Date();
    const YYYY = String(now.getFullYear()).padStart(4, '0');
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const SS = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${YYYY}${MM}${DD}_${HH}${mm}${SS}_${ms}`;
}

/**
 * Sanitizes a stack trace by removing absolute path prefixes.
 * Handles both POSIX and Windows path separators.
 * Frames containing "src/" keep only the relative portion; other
 * standalone absolute path tokens are replaced with "[path]".
 *
 * @param {string|undefined} stack - The raw stack trace string
 * @returns {string} Sanitized stack trace
 */
function sanitizeStackTrace(stack) {
    if (!stack) return '';

    // 1. Strip absolute prefixes from frames that include "src/" (handles both POSIX and Windows)
    let result = stack.replace(/[^\s\n(]*[/\\]src[/\\]/g, 'src/');

    // 2. Redact remaining standalone absolute POSIX paths (start with /).
    //    Use lookbehind to match only paths that follow whitespace or '(' so we
    //    don't accidentally match within already-reduced 'src/...' paths.
    result = result.replace(/(?<=[\s(])\/[^\s\n()]+/g, '[path]');

    // 3. Redact remaining absolute Windows paths (e.g. C:\...)
    result = result.replace(/[A-Za-z]:\\[^\s\n()]+/g, '[path]');

    return result;
}

/**
 * Applies best-effort redaction of common sensitive patterns from a string.
 * This covers URLs with embedded credentials, bearer tokens, and common
 * key=value secret patterns found in error messages.
 *
 * This is best-effort only: it cannot guarantee that all sensitive data is
 * removed, especially when errors embed unusual secret formats.
 *
 * @param {string|undefined} text - The text to redact
 * @returns {string} Text with common sensitive patterns replaced
 */
function redactSensitivePatterns(text) {
    if (!text) return '';

    let result = text;

    // 1. URLs with embedded credentials: protocol://user:pass@host
    result = result.replace(/([\w+.-]+:\/\/)[^@\s]+@/g, '$1[REDACTED]@');

    // 2. Bearer / Basic / Token authorization headers
    result = result.replace(/\b(Bearer|Basic|Token)\s+[A-Za-z0-9+/=._-]{8,}/gi, '$1 [REDACTED]');

    // 3. Common key=value secret patterns (query strings, connection strings, etc.)
    //    Matches: password=, passwd=, pwd=, secret=, token=, api_key=, apiKey=, apitoken=,
    //             access_key=, accessKey=, auth=, passphrase=, clientSecret=, client_secret=
    result = result.replace(
        /\b(password|passwd|pwd|secret|token|api[_-]?key|api[_-]?token|access[_-]?key|auth|passphrase|client[_-]?secret)\s*[=:]\s*[^\s&,;"'\]}{)]+/gi,
        '$1=[REDACTED]'
    );

    // 4. JSON-style quoted key/value pairs for the same patterns
    //    e.g. "password": "mysecret" or 'token': 'abc123'
    result = result.replace(
        /["'](password|passwd|pwd|secret|token|api[_-]?key|api[_-]?token|access[_-]?key|auth|passphrase|client[_-]?secret)["']\s*:\s*["'][^"']+["']/gi,
        '"$1": "[REDACTED]"'
    );

    return result;
}

/**
 * Builds a sanitized subset of the application configuration for inclusion in
 * crash dump files.  Only non-sensitive fields are included.
 *
 * @returns {object} Object containing safe, non-sensitive config values
 */
function buildSafeConfig() {
    const safeConfig = {};

    try {
        const cfg = globals.config;
        if (!cfg) return safeConfig;

        /**
         * Safely reads a config value, returning undefined on failure.
         *
         * @param {string} key - The config key to read
         * @returns {unknown} The config value or undefined if the key is not found
         */
        const safeGet = (key) => {
            try {
                return cfg.has(key) ? cfg.get(key) : undefined;
            } catch {
                return undefined;
            }
        };

        // Non-sensitive operational settings
        const logLevel = safeGet('Butler-SOS.logLevel');
        if (logLevel !== undefined) safeConfig.logLevel = logLevel;

        const fileLogging = safeGet('Butler-SOS.fileLogging');
        if (fileLogging !== undefined) safeConfig.fileLogging = fileLogging;

        const logDirectory = safeGet('Butler-SOS.logDirectory');
        if (logDirectory !== undefined) safeConfig.logDirectory = logDirectory;

        const anonTelemetry = safeGet('Butler-SOS.anonTelemetry');
        if (anonTelemetry !== undefined) safeConfig.anonTelemetry = anonTelemetry;

        const systemInfoEnable = safeGet('Butler-SOS.systemInfo.enable');
        if (systemInfoEnable !== undefined) safeConfig.systemInfoEnable = systemInfoEnable;

        const userEventsEnable = safeGet('Butler-SOS.userEvents.enable');
        if (userEventsEnable !== undefined) safeConfig.userEventsEnable = userEventsEnable;

        const influxdbEnable = safeGet('Butler-SOS.influxdbConfig.enable');
        if (influxdbEnable !== undefined) safeConfig.influxdbEnable = influxdbEnable;

        const influxdbVersion = safeGet('Butler-SOS.influxdbConfig.version');
        if (influxdbVersion !== undefined) safeConfig.influxdbVersion = influxdbVersion;

        const prometheusEnable = safeGet('Butler-SOS.prometheus.enable');
        if (prometheusEnable !== undefined) safeConfig.prometheusEnable = prometheusEnable;

        const mqttEnable = safeGet('Butler-SOS.mqttConfig.enable');
        if (mqttEnable !== undefined) safeConfig.mqttEnable = mqttEnable;

        const auditEventsEnable = safeGet('Butler-SOS.auditEvents.enable');
        if (auditEventsEnable !== undefined) safeConfig.auditEventsEnable = auditEventsEnable;
    } catch {
        // Config access failed entirely – return whatever we have so far
    }

    return safeConfig;
}

/**
 * Resolves the directory to write crash dump files into.
 * Falls back to `process.cwd()` when the configured directory is empty.
 *
 * @param {string} configuredDir - The directory path from config (may be relative or absolute)
 * @returns {string} Absolute path to the crash dump directory
 */
function resolveCrashDir(configuredDir) {
    if (!configuredDir || configuredDir.trim() === '') {
        return process.cwd();
    }
    return path.isAbsolute(configuredDir)
        ? configuredDir
        : path.resolve(process.cwd(), configuredDir);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Writes crash dump files (JSON and/or plain text) for a fatal error.
 *
 * The function swallows its own errors and all I/O failures so that crash dump
 * issues cannot prevent process.exit() from working.  Callers that await this
 * function should be aware that writes may block briefly on slow storage.
 *
 * Sensitive config data is excluded entirely.  Error messages and stack traces
 * are included for debugging, with best-effort redaction of common secret
 * patterns (URLs with credentials, bearer tokens, key=value secrets).
 * Redaction cannot guarantee removal of all sensitive data from error content;
 * treat crash dump files as potentially sensitive.
 *
 * @param {Error|unknown} error - The error object (or any value) that caused the crash
 * @param {string} source - Where the crash originated:
 *   "uncaughtException" | "unhandledRejection" | "logFatal"
 *
 * @returns {Promise<void>} Resolves when writing is complete (or has been skipped)
 */
export async function writeCrashDump(error, source) {
    try {
        // ----------------------------------------------------------------
        // Read crash-dump config.  Default to enabled / ./crash_dumps if
        // globals are not yet available (very early crashes).
        // ----------------------------------------------------------------
        let enable = true;
        let crashDir = './crash_dumps';
        let createJson = true;
        let createText = true;

        try {
            const cfg = globals.config;
            if (cfg) {
                if (cfg.has('Butler-SOS.crashFile.enable')) {
                    enable = cfg.get('Butler-SOS.crashFile.enable');
                }
                if (cfg.has('Butler-SOS.crashFile.crashFileDirectory')) {
                    crashDir = cfg.get('Butler-SOS.crashFile.crashFileDirectory');
                }
                if (cfg.has('Butler-SOS.crashFile.crashFileCreateJson')) {
                    createJson = cfg.get('Butler-SOS.crashFile.crashFileCreateJson');
                }
                if (cfg.has('Butler-SOS.crashFile.crashFileCreateText')) {
                    createText = cfg.get('Butler-SOS.crashFile.crashFileCreateText');
                }
            }
        } catch {
            // Config not yet initialised – use defaults above
        }

        if (!enable) return;
        if (!createJson && !createText) return;

        // ----------------------------------------------------------------
        // Build the crash dump payload
        // ----------------------------------------------------------------
        const timestamp = new Date().toISOString();
        const appName = 'butler-sos';
        const appVersion = globals.appVersion ?? 'unknown';
        const nodeVersion = process.version.replace(/^v/, '');
        const platform = `${process.platform}/${process.arch}`;
        const isSea = globals.isSea !== undefined ? globals.isSea : sea.isSea();

        const errorType = error?.constructor?.name ?? 'Error';
        const errorMessage = redactSensitivePatterns(error?.message ?? String(error));
        const errorStack = redactSensitivePatterns(sanitizeStackTrace(error?.stack));

        const crashData = {
            version: '1.0',
            timestamp,
            app: {
                name: appName,
                version: appVersion,
            },
            runtime: {
                nodeVersion,
                platform,
                isSea,
            },
            error: {
                type: errorType,
                message: errorMessage,
                stack: errorStack,
            },
            context: {
                exitCode: 1,
                source: source ?? 'unknown',
            },
            config: buildSafeConfig(),
        };

        // ----------------------------------------------------------------
        // Determine output paths
        // ----------------------------------------------------------------
        const resolvedDir = resolveCrashDir(crashDir);
        const ts = buildTimestampForFilename();
        const jsonFilePath = path.join(resolvedDir, `crash_dump_${ts}.json`);
        const txtFilePath = path.join(resolvedDir, `crash_dump_${ts}.txt`);

        // Create directory (non-blocking, synchronous is fine here since we
        // are about to exit anyway and a synchronous mkdir avoids the need for
        // an extra await before the actual file writes)
        try {
            fs.mkdirSync(resolvedDir, { recursive: true });
        } catch {
            // Directory creation failed – attempt to write anyway in case it
            // already exists
        }

        // ----------------------------------------------------------------
        // Build plain-text report
        // ----------------------------------------------------------------
        const executableType = isSea ? 'SEA (packaged)' : 'Node.js';
        const textReport = [
            '====================================',
            'BUTLER SOS CRASH REPORT',
            '====================================',
            `Generated: ${timestamp}`,
            '',
            '=== APPLICATION INFO ===',
            `Butler SOS Version: ${appVersion}`,
            `Node.js Version: ${nodeVersion}`,
            `Platform: ${platform}`,
            `Executable: ${executableType}`,
            '',
            '=== CRASH INFO ===',
            `Error Type: ${errorType}`,
            `Source: ${source ?? 'unknown'}`,
            `Exit Code: 1`,
            '',
            '=== ERROR MESSAGE ===',
            errorMessage,
            '',
            '=== STACK TRACE ===',
            errorStack || '(no stack trace available)',
            '',
            '====================================',
            'END OF CRASH REPORT',
            '====================================',
        ].join('\n');

        // ----------------------------------------------------------------
        // Write files
        // ----------------------------------------------------------------
        const writePromises = [];

        if (createJson) {
            writePromises.push(
                fs.promises
                    .writeFile(jsonFilePath, JSON.stringify(crashData, null, 2), 'utf8')
                    .catch(() => {})
            );
        }

        if (createText) {
            writePromises.push(
                fs.promises.writeFile(txtFilePath, textReport, 'utf8').catch(() => {})
            );
        }

        await Promise.all(writePromises);

        // Log paths to console as a last-resort notification (logger may be down)
        if (createJson) {
            try {
                if (globals.logger) {
                    globals.logger.error(`CRASH DUMP: Written to ${jsonFilePath}`);
                } else {
                    console.error(`CRASH DUMP: Written to ${jsonFilePath}`);
                }
            } catch {
                console.error(`CRASH DUMP: Written to ${jsonFilePath}`);
            }
        }
        if (createText) {
            try {
                if (globals.logger) {
                    globals.logger.error(`CRASH DUMP: Written to ${txtFilePath}`);
                } else {
                    console.error(`CRASH DUMP: Written to ${txtFilePath}`);
                }
            } catch {
                console.error(`CRASH DUMP: Written to ${txtFilePath}`);
            }
        }
    } catch {
        // writeCrashDump must never throw
    }
}
