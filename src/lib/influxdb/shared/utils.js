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

/**
 * Writes data to InfluxDB (v1, v2, or v3) with retry logic and exponential backoff.
 *
 * This unified function handles writes to any InfluxDB version with configurable retry logic.
 * If a write fails due to timeout or network issues, it will retry up to maxRetries times
 * with exponential backoff between attempts.
 *
 * @param {Function} writeFn - Async function that performs the write operation
 * @param {string} context - Description of what's being written (for logging)
 * @param {string} version - InfluxDB version ('v1', 'v2', or 'v3')
 * @param {string} errorCategory - Error category for tracking (e.g., server name or component)
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelayMs - Initial delay before first retry in ms (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay between retries in ms (default: 10000)
 * @param {number} options.backoffMultiplier - Multiplier for exponential backoff (default: 2)
 *
 * @returns {Promise<void>} Promise that resolves when write succeeds or rejects after all retries fail
 *
 * @throws {Error} The last error encountered after all retries are exhausted
 */
export async function writeToInfluxWithRetry(
    writeFn,
    context,
    version,
    errorCategory = '',
    options = {}
) {
    const {
        maxRetries = 3,
        initialDelayMs = 1000,
        maxDelayMs = 10000,
        backoffMultiplier = 2,
    } = options;

    let lastError;
    let attempt = 0;
    const versionTag = version.toUpperCase();

    while (attempt <= maxRetries) {
        try {
            await writeFn();

            // Log success if this was a retry
            if (attempt > 0) {
                globals.logger.info(
                    `INFLUXDB ${versionTag} RETRY: ${context} - Write succeeded on attempt ${attempt + 1}/${maxRetries + 1}`
                );
            }

            return; // Success!
        } catch (err) {
            lastError = err;
            attempt++;

            // Check if this is a retryable error (timeout or network issue)
            const errorName = err.constructor?.name || err.name || '';
            const errorMessage = err.message || '';
            const isRetryableError =
                errorName === 'RequestTimedOutError' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('timed out') ||
                errorMessage.includes('ETIMEDOUT') ||
                errorMessage.includes('ECONNREFUSED') ||
                errorMessage.includes('ENOTFOUND') ||
                errorMessage.includes('ECONNRESET');

            // Log the error type for debugging
            globals.logger.debug(
                `INFLUXDB ${versionTag} RETRY: ${context} - Error caught: ${errorName}, message: ${errorMessage}, isRetryable: ${isRetryableError}`
            );

            // Don't retry on non-retryable errors - fail immediately
            if (!isRetryableError) {
                globals.logger.warn(
                    `INFLUXDB ${versionTag} WRITE: ${context} - Non-retryable error (${errorName}), not retrying: ${globals.getErrorMessage(err)}`
                );

                // Track error immediately for non-retryable errors
                await globals.errorTracker.incrementError(
                    `INFLUXDB_${versionTag}_WRITE`,
                    errorCategory
                );

                throw err;
            }

            // This is a retryable error - check if we have retries left
            if (attempt <= maxRetries) {
                // Calculate delay with exponential backoff
                const delayMs = Math.min(
                    initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
                    maxDelayMs
                );

                globals.logger.warn(
                    `INFLUXDB ${versionTag} RETRY: ${context} - Retryable error (${errorName}) on attempt ${attempt}/${maxRetries + 1}, retrying in ${delayMs}ms...`
                );

                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            } else {
                // All retries exhausted
                globals.logger.error(
                    `INFLUXDB ${versionTag} RETRY: ${context} - All ${maxRetries + 1} attempts failed. Last error: ${globals.getErrorMessage(err)}`
                );

                // Track error count (final failure after all retries)
                await globals.errorTracker.incrementError(
                    `INFLUXDB_${versionTag}_WRITE`,
                    errorCategory
                );
            }
        }
    }

    // All retries failed, throw the last error
    throw lastError;
}

/**
 * Splits an array into chunks of a specified size.
 *
 * @param {Array} array - The array to chunk
 * @param {number} chunkSize - The size of each chunk
 *
 * @returns {Array[]} Array of chunks
 */
export function chunkArray(array, chunkSize) {
    if (!Array.isArray(array) || array.length === 0) {
        return [];
    }

    if (!chunkSize || chunkSize <= 0) {
        return [array];
    }

    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Validates that a field value is non-negative (unsigned).
 * Logs a warning once per measurement if negative values are found and clamps to 0.
 *
 * @param {number} value - The value to validate
 * @param {string} measurement - Measurement name for logging
 * @param {string} field - Field name for logging
 * @param {string} serverContext - Server/context name for logging
 *
 * @returns {number} The validated value (clamped to 0 if negative)
 */
export function validateUnsignedField(value, measurement, field, serverContext) {
    // Convert to number if string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Handle null/undefined/NaN
    if (numValue == null || isNaN(numValue)) {
        return 0;
    }

    // Check if negative
    if (numValue < 0) {
        // Warn once per measurement (using a Set to track)
        if (!validateUnsignedField._warnedMeasurements) {
            validateUnsignedField._warnedMeasurements = new Set();
        }

        if (!validateUnsignedField._warnedMeasurements.has(measurement)) {
            globals.logger.warn(
                `Negative value detected for unsigned field: measurement=${measurement}, field=${field}, value=${numValue}, server=${serverContext}. Clamping to 0.`
            );
            validateUnsignedField._warnedMeasurements.add(measurement);
        }

        return 0;
    }

    return numValue;
}

/**
 * Writes data to InfluxDB v1 in batches with progressive retry strategy.
 * If a batch fails, it will automatically try smaller batch sizes.
 *
 * @param {Array} datapoints - Array of datapoint objects to write
 * @param {string} context - Description of what's being written
 * @param {string} errorCategory - Error category for tracking
 * @param {number} maxBatchSize - Maximum batch size from config
 *
 * @returns {Promise<void>}
 */
export async function writeBatchToInfluxV1(datapoints, context, errorCategory, maxBatchSize) {
    if (!Array.isArray(datapoints) || datapoints.length === 0) {
        globals.logger.verbose(`INFLUXDB V1 BATCH: ${context} - No points to write`);
        return;
    }

    const progressiveSizes = [maxBatchSize, 500, 250, 100, 10, 1].filter(
        (size) => size <= maxBatchSize
    );

    for (const batchSize of progressiveSizes) {
        const chunks = chunkArray(datapoints, batchSize);
        let allSucceeded = true;
        let failedChunks = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const startIdx = i * batchSize;
            const endIdx = Math.min(startIdx + chunk.length - 1, datapoints.length - 1);

            try {
                await writeToInfluxWithRetry(
                    async () => await globals.influx.writePoints(chunk),
                    `${context} (chunk ${i + 1}/${chunks.length}, points ${startIdx}-${endIdx})`,
                    'v1',
                    errorCategory
                );
            } catch (err) {
                allSucceeded = false;
                failedChunks.push({ index: i + 1, startIdx, endIdx, total: chunks.length });

                globals.logger.error(
                    `INFLUXDB V1 BATCH: ${context} - Chunk ${i + 1} of ${chunks.length} (points ${startIdx}-${endIdx}) failed: ${globals.getErrorMessage(err)}`
                );
            }
        }

        if (allSucceeded) {
            if (batchSize < maxBatchSize) {
                globals.logger.info(
                    `INFLUXDB V1 BATCH: ${context} - Successfully wrote all data using batch size ${batchSize} (reduced from ${maxBatchSize})`
                );
            }
            return;
        }

        // If this wasn't the last attempt, log that we're trying smaller batches
        if (batchSize !== progressiveSizes[progressiveSizes.length - 1]) {
            globals.logger.warn(
                `INFLUXDB V1 BATCH: ${context} - ${failedChunks.length} chunk(s) failed with batch size ${batchSize}, retrying with smaller batches`
            );
        } else {
            // Final attempt failed
            globals.logger.error(
                `INFLUXDB V1 BATCH: ${context} - Failed to write data even with batch size 1. ${failedChunks.length} point(s) could not be written.`
            );
            throw new Error(`Failed to write batch after trying all progressive sizes`);
        }
    }
}

/**
 * Writes data to InfluxDB v2 in batches with progressive retry strategy.
 * Handles writeApi lifecycle management.
 *
 * @param {Array} points - Array of Point objects to write
 * @param {string} org - InfluxDB organization
 * @param {string} bucketName - InfluxDB bucket name
 * @param {string} context - Description of what's being written
 * @param {string} errorCategory - Error category for tracking
 * @param {number} maxBatchSize - Maximum batch size from config
 *
 * @returns {Promise<void>}
 */
export async function writeBatchToInfluxV2(
    points,
    org,
    bucketName,
    context,
    errorCategory,
    maxBatchSize
) {
    if (!Array.isArray(points) || points.length === 0) {
        return;
    }

    const progressiveSizes = [maxBatchSize, 500, 250, 100, 10, 1].filter(
        (size) => size <= maxBatchSize
    );

    for (const batchSize of progressiveSizes) {
        const chunks = chunkArray(points, batchSize);
        let allSucceeded = true;
        let failedChunks = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const startIdx = i * batchSize;
            const endIdx = Math.min(startIdx + chunk.length - 1, points.length - 1);

            try {
                await writeToInfluxWithRetry(
                    async () => {
                        const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', {
                            flushInterval: 5000,
                        });
                        try {
                            await writeApi.writePoints(chunk);
                            await writeApi.close();
                        } catch (err) {
                            try {
                                await writeApi.close();
                            } catch (closeErr) {
                                // Ignore close errors
                            }
                            throw err;
                        }
                    },
                    `${context} (chunk ${i + 1}/${chunks.length}, points ${startIdx}-${endIdx})`,
                    'v2',
                    errorCategory
                );
            } catch (err) {
                allSucceeded = false;
                failedChunks.push({ index: i + 1, startIdx, endIdx, total: chunks.length });

                globals.logger.error(
                    `INFLUXDB V2 BATCH: ${context} - Chunk ${i + 1} of ${chunks.length} (points ${startIdx}-${endIdx}) failed: ${globals.getErrorMessage(err)}`
                );
            }
        }

        if (allSucceeded) {
            if (batchSize < maxBatchSize) {
                globals.logger.info(
                    `INFLUXDB V2 BATCH: ${context} - Successfully wrote all data using batch size ${batchSize} (reduced from ${maxBatchSize})`
                );
            }
            return;
        }

        // If this wasn't the last attempt, log that we're trying smaller batches
        if (batchSize !== progressiveSizes[progressiveSizes.length - 1]) {
            globals.logger.warn(
                `INFLUXDB V2 BATCH: ${context} - ${failedChunks.length} chunk(s) failed with batch size ${batchSize}, retrying with smaller batches`
            );
        } else {
            // Final attempt failed
            globals.logger.error(
                `INFLUXDB V2 BATCH: ${context} - Failed to write data even with batch size 1. ${failedChunks.length} point(s) could not be written.`
            );
            throw new Error(`Failed to write batch after trying all progressive sizes`);
        }
    }
}

/**
 * Writes data to InfluxDB v3 in batches with progressive retry strategy.
 * Converts Point3 objects to line protocol and concatenates them.
 *
 * @param {Array} points - Array of Point3 objects to write
 * @param {string} database - InfluxDB database name
 * @param {string} context - Description of what's being written
 * @param {string} errorCategory - Error category for tracking
 * @param {number} maxBatchSize - Maximum batch size from config
 *
 * @returns {Promise<void>}
 */
export async function writeBatchToInfluxV3(points, database, context, errorCategory, maxBatchSize) {
    if (!Array.isArray(points) || points.length === 0) {
        return;
    }

    const progressiveSizes = [maxBatchSize, 500, 250, 100, 10, 1].filter(
        (size) => size <= maxBatchSize
    );

    for (const batchSize of progressiveSizes) {
        const chunks = chunkArray(points, batchSize);
        let allSucceeded = true;
        let failedChunks = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const startIdx = i * batchSize;
            const endIdx = Math.min(startIdx + chunk.length - 1, points.length - 1);

            try {
                // Convert Point3 objects to line protocol and concatenate
                const lineProtocol = chunk.map((p) => p.toLineProtocol()).join('\n');

                await writeToInfluxWithRetry(
                    async () => await globals.influx.write(lineProtocol, database),
                    `${context} (chunk ${i + 1}/${chunks.length}, points ${startIdx}-${endIdx})`,
                    'v3',
                    errorCategory
                );
            } catch (err) {
                allSucceeded = false;
                failedChunks.push({ index: i + 1, startIdx, endIdx, total: chunks.length });

                globals.logger.error(
                    `INFLUXDB V3 BATCH: ${context} - Chunk ${i + 1} of ${chunks.length} (points ${startIdx}-${endIdx}) failed: ${globals.getErrorMessage(err)}`
                );
            }
        }

        if (allSucceeded) {
            if (batchSize < maxBatchSize) {
                globals.logger.info(
                    `INFLUXDB V3 BATCH: ${context} - Successfully wrote all data using batch size ${batchSize} (reduced from ${maxBatchSize})`
                );
            }
            return;
        }

        // If this wasn't the last attempt, log that we're trying smaller batches
        if (batchSize !== progressiveSizes[progressiveSizes.length - 1]) {
            globals.logger.warn(
                `INFLUXDB V3 BATCH: ${context} - ${failedChunks.length} chunk(s) failed with batch size ${batchSize}, retrying with smaller batches`
            );
        } else {
            // Final attempt failed
            globals.logger.error(
                `INFLUXDB V3 BATCH: ${context} - Failed to write data even with batch size 1. ${failedChunks.length} point(s) could not be written.`
            );
            throw new Error(`Failed to write batch after trying all progressive sizes`);
        }
    }
}
