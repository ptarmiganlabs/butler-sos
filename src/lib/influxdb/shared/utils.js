import globals from '../../../globals.js';

const sessionAppPrefix = 'SessionApp';
const MIN_TIMESTAMP_LENGTH = 15;

/**
 * Calculates and formats the uptime of a Qlik Sense engine.
 *
 * This function takes the server start time from the engine healthcheck API
 * and calculates how long the server has been running, returning a formatted string.
 *
 * @param {string} serverStarted - The server start time in format "YYYYMMDDThhmmss"
 * @returns {string} A formatted string representing uptime (e.g. "5 days, 3h 45m 12s")
 */
export function getFormattedTime(serverStarted) {
    // Handle invalid or empty input
    if (
        !serverStarted ||
        typeof serverStarted !== 'string' ||
        serverStarted.length < MIN_TIMESTAMP_LENGTH
    ) {
        return '';
    }

    const dateTime = Date.now();
    const timestamp = Math.floor(dateTime);

    const str = serverStarted;
    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);
    const hour = str.substring(9, 11);
    const minute = str.substring(11, 13);
    const second = str.substring(13, 15);

    // Validate date components
    if (
        isNaN(year) ||
        isNaN(month) ||
        isNaN(day) ||
        isNaN(hour) ||
        isNaN(minute) ||
        isNaN(second)
    ) {
        return '';
    }

    const dateTimeStarted = new Date(year, month - 1, day, hour, minute, second);

    // Check if the date is valid
    if (isNaN(dateTimeStarted.getTime())) {
        return '';
    }

    const timestampStarted = Math.floor(dateTimeStarted);

    const diff = timestamp - timestampStarted;

    // Create a new JavaScript Date object based on the timestamp
    // multiplied by 1000 so that the argument is in milliseconds, not seconds.
    const date = new Date(diff);

    const days = Math.trunc(diff / (1000 * 60 * 60 * 24));

    // Hours part from the timestamp
    const hours = date.getHours();

    // Minutes part from the timestamp
    const minutes = `0${date.getMinutes()}`;

    // Seconds part from the timestamp
    const seconds = `0${date.getSeconds()}`;

    // Will display time in 10:30:23 format
    return `${days} days, ${hours}h ${minutes.substr(-2)}m ${seconds.substr(-2)}s`;
}

/**
 * Processes app documents and categorizes them as session apps or regular apps.
 * Returns arrays of app names for both categories.
 *
 * @param {string[]} docIDs - Array of document IDs to process
 * @param {string} logPrefix - Prefix for log messages
 * @param {string} appState - Description of app state (e.g., 'active', 'loaded', 'in memory')
 * @returns {Promise<{appNames: string[], sessionAppNames: string[]}>} Object containing sorted arrays of app names
 */
export async function processAppDocuments(docIDs, logPrefix, appState) {
    const appNames = [];
    const sessionAppNames = [];

    /**
     * Stores a document ID in the appropriate array based on its type.
     *
     * @param {string} docID - The document ID to store
     * @returns {Promise<void>} Promise that resolves when the document ID has been processed
     */
    const storeDoc = (docID) => {
        return new Promise((resolve, _reject) => {
            if (docID.substring(0, sessionAppPrefix.length) === sessionAppPrefix) {
                // Session app
                globals.logger.debug(`${logPrefix}: Session app is ${appState}: ${docID}`);
                sessionAppNames.push(docID);
            } else {
                // Not session app
                const app = globals.appNames.find((element) => element.id === docID);

                if (app) {
                    globals.logger.debug(`${logPrefix}: App is ${appState}: ${app.name}`);
                    appNames.push(app.name);
                } else {
                    appNames.push(docID);
                }
            }

            resolve();
        });
    };

    const promises = docIDs.map(
        (docID) =>
            new Promise(async (resolve, _reject) => {
                await storeDoc(docID);
                resolve();
            })
    );

    await Promise.all(promises);

    appNames.sort();
    sessionAppNames.sort();

    return { appNames, sessionAppNames };
}

/**
 * Checks if InfluxDB is enabled and initialized.
 *
 * @returns {boolean} True if InfluxDB is enabled and initialized
 */
export function isInfluxDbEnabled() {
    if (!globals.influx) {
        globals.logger.warn(
            'INFLUXDB: Influxdb object not initialized. Data will not be sent to InfluxDB'
        );
        return false;
    }
    return true;
}

/**
 * Gets the InfluxDB version from configuration.
 *
 * @returns {number} The InfluxDB version (1, 2, or 3)
 */
export function getInfluxDbVersion() {
    return globals.config.get('Butler-SOS.influxdbConfig.version');
}

/**
 * Checks if the refactored InfluxDB code path should be used.
 *
 * @returns {boolean} True if refactored code should be used
 */
export function useRefactoredInfluxDb() {
    // Feature flag to enable/disable refactored code path
    // Default to false for backward compatibility
    return globals.config.get('Butler-SOS.influxdbConfig.useRefactoredCode') === true;
}

/**
 * Applies tags from a tags object to an InfluxDB Point3 object.
 * This is needed for v3 as it doesn't have automatic default tags like v2.
 *
 * @param {object} point - The Point3 object to apply tags to
 * @param {object} tags - Object containing tag key-value pairs
 * @returns {object} The Point3 object with tags applied (for chaining)
 */
export function applyTagsToPoint3(point, tags) {
    if (!tags || typeof tags !== 'object') {
        return point;
    }

    // Apply each tag to the point
    Object.entries(tags).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            point.setTag(key, String(value));
        }
    });

    return point;
}
