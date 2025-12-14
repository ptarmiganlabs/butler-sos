/**
 * Enhanced error logging utility for Butler SOS
 *
 * Provides consistent error logging across the application with different
 * behavior for SEA (Single Executable Application) vs non-SEA environments.
 *
 * In SEA mode: Only the error message is logged (cleaner output for end users)
 * In non-SEA mode: Both error message and stack trace are logged as separate
 *                  entries (better debugging for developers)
 */

import globals from '../globals.js';
import sea from './sea-wrapper.js';

/**
 * Log an error with appropriate formatting based on execution environment
 *
 * This function wraps the global logger and provides enhanced error logging:
 * - In SEA apps: logs only the error message (cleaner for production)
 * - In non-SEA apps: logs error message and stack trace separately (better for debugging)
 *
 * The function accepts the same parameters as winston logger methods.
 *
 * @param {string} level - The log level ('error', 'warn', 'info', 'verbose', 'debug')
 * @param {string} message - The log message (prefix/context for the error)
 * @param {Error} error - The error object to log
 * @param {...unknown} args - Additional arguments to pass to the logger
 *
 * @example
 * // Basic error logging
 * try {
 *   // some code
 * } catch (err) {
 *   logError('HEALTH: Error when calling health check API', err);
 * }
 *
 * @example
 * // With contextual information
 * try {
 *   // some code
 * } catch (err) {
 *   logError(`PROXY SESSIONS: Error for server '${serverName}' (${host})`, err);
 * }
 */
function logErrorWithLevel(level, message, error, ...args) {
    // Check if running as SEA app
    const isSeaApp = globals.isSea !== undefined ? globals.isSea : sea.isSea();

    if (!error) {
        // If no error object provided, just log the message normally
        globals.logger[level](message, ...args);
        return;
    }

    // Get error message - prefer error.message, fallback to toString()
    const errorMessage = error.message || error.toString();

    if (isSeaApp) {
        // SEA mode: Only log the error message (cleaner output)
        globals.logger[level](`${message}: ${errorMessage}`, ...args);
    } else {
        // Non-SEA mode: Log error message first, then stack trace separately
        // This provides better readability and debugging information

        // Log 1: The error message with context
        globals.logger[level](`${message}: ${errorMessage}`, ...args);

        // Log 2: The stack trace (if available)
        if (error.stack) {
            globals.logger[level](`Stack trace: ${error.stack}`, ...args);
        }
    }
}

/**
 * Convenience function for logging errors at 'error' level
 *
 * @param {string} message - The log message (prefix/context for the error)
 * @param {Error} error - The error object to log
 * @param {...unknown} args - Additional arguments to pass to the logger
 *
 * @example
 * try {
 *   // some code
 * } catch (err) {
 *   logError('HEALTH: Error when calling health check API', err);
 * }
 */
export function logError(message, error, ...args) {
    logErrorWithLevel('error', message, error, ...args);
}

/**
 * Convenience function for logging errors at 'warn' level
 *
 * @param {string} message - The log message (prefix/context for the error)
 * @param {Error} error - The error object to log
 * @param {...unknown} args - Additional arguments to pass to the logger
 */
export function logWarn(message, error, ...args) {
    logErrorWithLevel('warn', message, error, ...args);
}

/**
 * Convenience function for logging errors at 'info' level
 *
 * @param {string} message - The log message (prefix/context for the error)
 * @param {Error} error - The error object to log
 * @param {...unknown} args - Additional arguments to pass to the logger
 */
export function logInfo(message, error, ...args) {
    logErrorWithLevel('info', message, error, ...args);
}

/**
 * Convenience function for logging errors at 'verbose' level
 *
 * @param {string} message - The log message (prefix/context for the error)
 * @param {Error} error - The error object to log
 * @param {...unknown} args - Additional arguments to pass to the logger
 */
export function logVerbose(message, error, ...args) {
    logErrorWithLevel('verbose', message, error, ...args);
}

/**
 * Convenience function for logging errors at 'debug' level
 *
 * @param {string} message - The log message (prefix/context for the error)
 * @param {Error} error - The error object to log
 * @param {...unknown} args - Additional arguments to pass to the logger
 */
export function logDebug(message, error, ...args) {
    logErrorWithLevel('debug', message, error, ...args);
}
