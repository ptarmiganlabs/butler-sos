import fs from 'fs-extra';
import sea from '../sea-wrapper.js';

/**
 * Decides whether error log lines include stack traces: only when Butler SOS runs from source
 * code outside a container, as on a developer's machine. The packaged executables and the
 * Docker image log the error message alone. The Docker image runs from source too, but a stack
 * trace on every error line makes a container log hard to read.
 *
 * Uses the checks made at startup once they are available (settings.isSea, and
 * settings.hostInfo.isRunningInDocker, which the startup log reports as "Running in Docker"),
 * and checks directly before then.
 *
 * @param {object} [settings] - The settings object, if available
 * @returns {boolean} True if stack traces should be logged
 */
export function shouldLogStackTraces(settings) {
    const isSeaApp = settings?.isSea !== undefined ? settings.isSea : sea.isSea();
    if (isSeaApp) {
        return false;
    }

    const inDocker = settings?.hostInfo?.isRunningInDocker ?? isRunningInDocker();
    return !inDocker;
}

/**
 * Formats an error for a log line: the full stack trace when Butler SOS runs from source code
 * outside a container, and the error message alone otherwise. See shouldLogStackTraces.
 *
 * @param {object} settings - The settings object
 * @param {Error} err - The error object
 * @returns {string} Formatted error message
 */
export function getErrorMessage(settings, err) {
    if (!shouldLogStackTraces(settings)) {
        return err.message || err.toString();
    }
    return err.stack || err.message || err.toString();
}

/**
 * Checks if a file exists at the specified file path.
 *
 * @param {string} filepath - Path to the file to check
 *
 * @returns {boolean} True if the file exists, false otherwise
 */
export function checkFileExistsSync(filepath) {
    let flag = true;
    try {
        fs.accessSync(filepath, fs.constants.F_OK);
    } catch (e) {
        flag = false;
    }
    return flag;
}

/**
 * Creates a Promise that resolves after a specified time in milliseconds.
 * Used for implementing delays in asynchronous code.
 *
 * @param {number} ms - The number of milliseconds to sleep
 *
 * @returns {Promise} A promise that resolves after the specified delay
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detects if Butler SOS is running inside a Docker container.
 *
 * @returns {boolean} True if running in Docker, false otherwise
 */
export function isRunningInDocker() {
    try {
        fs.accessSync('/.dockerenv');
        return true;
    } catch (_) {
        return false;
    }
}
