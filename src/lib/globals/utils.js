import fs from 'fs-extra';
import sea from '../sea-wrapper.js';

/**
 * Format error message appropriately for SEA vs non-SEA apps
 * In SEA apps, stack traces are less useful, so we prefer err.message
 * In non-SEA apps, we show full stack traces for better debugging
 *
 * @param {object} settings - The settings object
 * @param {Error} err - The error object
 * @returns {string} Formatted error message
 */
export function getErrorMessage(settings, err) {
    // Check SEA status - use direct check if isSea hasn't been initialized yet
    const isSeaApp = settings.isSea !== undefined ? settings.isSea : sea.isSea();

    if (isSeaApp) {
        // For SEA apps, prefer cleaner error messages
        return err.message || err.toString();
    }
    // For non-SEA apps, show full stack trace for debugging
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
