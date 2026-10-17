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
 * Validates that all required fields are present and truthy in a message object.
 * Logs a warning listing any missing fields when validation fails.
 *
 * @param {object} msg - The message object to validate
 * @param {string[]} requiredFields - Array of field names that must be present and truthy
 * @param {string} logPrefix - Prefix for the warning log message (e.g. 'USER EVENT V1')
 * @returns {boolean} True if all required fields are present, false otherwise
 */
export function validateRequiredFields(msg, requiredFields, logPrefix) {
    const missing = requiredFields.filter((f) => !msg[f]);
    if (missing.length > 0) {
        globals.logger.warn(
            `${logPrefix}: Missing required fields [${missing.join(', ')}]: ${JSON.stringify(msg)}`
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
 * Sanitizes a tag value for use with the InfluxDB line protocol.
 *
 * Removes characters that are not supported or cause parsing issues:
 * - Angle brackets (`<`, `>`) and backslashes (`\`) are stripped entirely.
 * - Newlines (`\n`) and carriage returns (`\r`) break the line protocol format and are removed.
 *
 * Commas, equals signs, and spaces in tag values are handled automatically by the
 * InfluxDB v3 Point client and do not need to be modified here.
 *
 * @param {string|number|boolean} value - The tag value to sanitize. Numbers and booleans are coerced to strings via `String()`.
 *
 * @returns {string|null|undefined} The sanitized string value, or the original value unchanged if it is null or undefined
 */
export function sanitizeInfluxTagValue(value) {
    if (value === null || value === undefined) {
        return value;
    }
    return String(value)
        .replace(/[<>\\]/g, '') // Strip angle brackets and backslashes
        .replace(/[\n\r]/g, ''); // Remove newlines and carriage returns
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
 * Counts a failed InfluxDB write in the error tracker, unless error tracking is skipped.
 *
 * @param {string} versionTag - InfluxDB version in upper case ('V1', 'V2' or 'V3')
 * @param {string} errorCategory - Error category for tracking (e.g., server name or component)
 * @param {object} metadata - Additional context passed through to the error tracker
 * @param {Error} err - The error the write failed with
 * @param {boolean} skipErrorTracking - When true, do not count the failure
 *
 * @returns {Promise<void>}
 */
async function trackFailedInfluxWrite(versionTag, errorCategory, metadata, err, skipErrorTracking) {
    if (skipErrorTracking) {
        return;
    }

    await globals.errorTracker.incrementError(
        `INFLUXDB_${versionTag}_WRITE`,
        errorCategory,
        metadata,
        err
    );
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
 * @param {object} metadata - Additional context passed through to the error tracker
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelayMs - Initial delay before first retry in ms (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay between retries in ms (default: 10000)
 * @param {number} options.backoffMultiplier - Multiplier for exponential backoff (default: 2)
 * @param {boolean} options.skipErrorTracking - When true, a failed write is logged and thrown but
 *   not counted by the error tracker (default: false). The batch writers set this for every
 *   chunk, as their callers count a failed batch once. It also keeps the error tracker's own
 *   error-event writes from being tracked: tracking their failures would schedule another
 *   error-event write, which fails the same way, and the writes would multiply.
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
    metadata = {},
    options = {}
) {
    const {
        maxRetries = 3,
        initialDelayMs = 1000,
        maxDelayMs = 10000,
        backoffMultiplier = 2,
        skipErrorTracking = false,
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
            } else {
                globals.logger.verbose(
                    `INFLUXDB ${versionTag} WRITE: ${context} - Write succeeded`
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
                break;
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
            }
        }
    }

    // The write failed with a non-retryable error, or all retries were used up: track it once
    await trackFailedInfluxWrite(versionTag, errorCategory, metadata, lastError, skipErrorTracking);

    // Throw the last error
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

// The millisecond the last point timestamp was taken in, and how many were taken in it
let lastTimestampMs = 0;
let timestampsInLastMs = 0;

/**
 * Returns a timestamp for a new point: the current time in nanoseconds since the epoch, as a
 * string of digits, which is how all three InfluxDB clients accept nanosecond timestamps.
 *
 * Every call returns a different value. The clock only has millisecond resolution, so calls in
 * the same millisecond are told apart by a counter in the nanosecond digits. Without it, two
 * points with the same measurement and tags created in the same millisecond, such as two
 * identical user events, would share a timestamp, and InfluxDB would keep only the last.
 *
 * The value always lies within the current millisecond, so it follows the clock, including
 * when the clock is adjusted.
 *
 * @returns {string} Nanoseconds since the epoch
 */
export function nextPointTimestamp() {
    const nowMs = Date.now();
    if (nowMs === lastTimestampMs) {
        timestampsInLastMs += 1;
    } else {
        lastTimestampMs = nowMs;
        timestampsInLastMs = 0;
    }

    return (BigInt(nowMs) * 1_000_000n + BigInt(timestampsInLastMs)).toString();
}

/**
 * Gives every point that has no timestamp yet one from nextPointTimestamp, so it keeps the
 * same time through all retries of its write. Points that already have a timestamp keep it.
 *
 * Without this, a point gets its time when it is written: the v2 and v3 clients stamp it each
 * time it is serialised, which happens on every write attempt, and InfluxDB v1 uses the time
 * the server receives it. A write that reached InfluxDB but was retried anyway, after a
 * timeout for example, then stored every point a second time.
 *
 * The timestamps are in nanoseconds, the precision all writes use: the v1 client's default,
 * the 'ns' the v2 write API is created with, and the v3 client's default.
 *
 * Anything that is not a point of the expected kind is left as it is and written without a
 * timestamp, as before, rather than making the write fail.
 *
 * @param {Array} points - Points to stamp: plain datapoint objects for v1, Point objects for v2
 *   and v3
 * @param {string} version - InfluxDB version ('v1', 'v2' or 'v3')
 *
 * @returns {void}
 */
export function stampPointsOnce(points, version) {
    for (const point of points) {
        if (point === null || typeof point !== 'object') {
            continue;
        }

        if (version === 'v1') {
            if (point.timestamp === undefined) {
                point.timestamp = nextPointTimestamp();
            }
        } else if (version === 'v2') {
            // The v2 Point has no getter for its timestamp; it keeps it in its `time` field
            if (typeof point.timestamp === 'function' && point.time === undefined) {
                point.timestamp(nextPointTimestamp());
            }
        } else if (
            typeof point.setTimestamp === 'function' &&
            typeof point.getTimestamp === 'function' &&
            point.getTimestamp() === undefined
        ) {
            point.setTimestamp(nextPointTimestamp());
        }
    }
}

// Error codes meaning the InfluxDB server could not be reached at all
const UNREACHABLE_ERROR_CODES = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'ENETUNREACH',
];

/**
 * Checks whether an error means the InfluxDB server could not be reached at all, as opposed to
 * the server rejecting a write or not finishing it in time.
 *
 * The error code is looked for on the error, on its cause and on the errors it aggregates, as
 * clients wrap network errors differently, and in the message, where some clients only keep it.
 * The v1 client reports that none of its hosts can be reached as "No host available".
 *
 * @param {Error} err - The error a write failed with
 *
 * @returns {boolean} True if the server could not be reached
 */
export function isInfluxUnreachableError(err) {
    if (!err) {
        return false;
    }

    const codes = [err, err.cause, ...(err.errors ?? []), ...(err.cause?.errors ?? [])].map(
        (e) => e?.code
    );
    if (codes.some((code) => UNREACHABLE_ERROR_CODES.includes(code))) {
        return true;
    }

    const message = err.message || '';
    return (
        message.includes('No host available') ||
        UNREACHABLE_ERROR_CODES.some((code) => message.includes(code))
    );
}

/**
 * Builds the error a batch write throws when some of its points could not be written.
 *
 * The last write error becomes its cause, and its code is copied over, so the error tracker can
 * still tell a refused connection from a rejected write.
 *
 * The message takes only the last error's message, not globals.getErrorMessage(), which returns
 * the whole stack trace when Butler SOS runs from source. Whoever logs this error decides
 * whether to show a stack trace; the message itself stays one line.
 *
 * @param {number} notWritten - Number of points that were not written
 * @param {number} total - Number of points in the batch
 * @param {Error} [lastError] - The last error a write failed with
 *
 * @returns {Error} The error to throw
 */
function batchWriteError(notWritten, total, lastError) {
    const lastMessage = lastError?.message || (lastError ? String(lastError) : '');
    const reason = lastMessage ? `: ${lastMessage}` : '';
    const err = new Error(`Failed to write ${notWritten} of ${total} point(s)${reason}`, {
        cause: lastError,
    });

    const code = lastError?.code ?? lastError?.cause?.code;
    if (code) {
        err.code = code;
    }

    return err;
}

/**
 * Writes points in chunks of chunkSize, each once (with retries), and collects the points of the
 * chunks that failed. One pass of writeInProgressiveBatches.
 *
 * @param {Array} pending - The points to write
 * @param {number} chunkSize - Number of points per chunk
 * @param {(chunk: Array) => Promise<void>} writeChunk - Writes one chunk of points
 * @param {object} pass - What the pass needs to know
 * @param {string} pass.version - InfluxDB version ('v1', 'v2' or 'v3')
 * @param {string} pass.context - Description of what's being written, for log messages
 * @param {string} pass.logPrefix - Prefix for log messages
 * @param {number} pass.total - Number of points in the whole batch, for log messages
 * @param {object} pass.retryOptions - Retry options for writeToInfluxWithRetry
 *
 * @returns {Promise<{ failed: Array, lastError: (Error|undefined) }>} The points in failed
 *   chunks, and the error the last of them failed with
 *
 * @throws {Error} When InfluxDB cannot be reached, which ends the pass. See batchWriteError.
 */
async function writeChunksOnce(
    pending,
    chunkSize,
    writeChunk,
    { version, context, logPrefix, total, retryOptions }
) {
    const chunks = chunkArray(pending, chunkSize);
    const failed = [];
    let lastError;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const startIdx = i * chunkSize;
        const endIdx = startIdx + chunk.length - 1;

        try {
            await writeToInfluxWithRetry(
                () => writeChunk(chunk),
                `${context} (chunk ${i + 1}/${chunks.length}, points ${startIdx}-${endIdx})`,
                version,
                '',
                {},
                { ...retryOptions, skipErrorTracking: true }
            );
        } catch (err) {
            if (isInfluxUnreachableError(err)) {
                // This chunk, the chunks after it and those that already failed are all lost
                const notWritten = failed.length + pending.length - startIdx;
                globals.logger.error(
                    `${logPrefix} - InfluxDB could not be reached, so ${notWritten} of ${total} point(s) were not written. Smaller batches are not tried, as they cannot help: ${globals.getErrorMessage(err)}`
                );
                throw batchWriteError(notWritten, total, err);
            }

            lastError = err;
            failed.push(...chunk);
            globals.logger.error(
                `${logPrefix} - Chunk ${i + 1} of ${chunks.length} (points ${startIdx}-${endIdx}) failed: ${globals.getErrorMessage(err)}`
            );
        }
    }

    return { failed, lastError };
}

/**
 * Writes points to InfluxDB in chunks of at most maxBatchSize points. When chunks fail, the
 * points in those chunks, and only those, are written again in smaller chunks, down to one
 * point at a time, so that a single bad point costs as little of the batch as possible.
 *
 * - A batch size is skipped when it would not make the chunks any smaller, as that would only
 *   repeat the write that just failed. A single point is written once (with retries), not once
 *   per batch size.
 * - When InfluxDB cannot be reached at all, the write stops there. Smaller chunks cannot fix
 *   that, and every remaining chunk would fail the same way after its own retries.
 * - Failures are not counted in the error tracker here. Every caller counts a failed batch
 *   once, where it catches the error thrown.
 * - Every point gets its timestamp before the first attempt, so whatever reaches InfluxDB more
 *   than once overwrites itself instead of being stored twice. See stampPointsOnce.
 *
 * @param {Array} points - The points to write. Points without a timestamp are given one.
 * @param {(chunk: Array) => Promise<void>} writeChunk - Writes one chunk of points
 * @param {object} options - Write options
 * @param {string} options.version - InfluxDB version ('v1', 'v2' or 'v3')
 * @param {string} options.context - Description of what's being written, for log messages
 * @param {number} options.maxBatchSize - Largest number of points to write in one request
 * @param {number} [options.maxRetries] - Retries per chunk (default: as writeToInfluxWithRetry)
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} When any points could not be written. See batchWriteError.
 */
async function writeInProgressiveBatches(
    points,
    writeChunk,
    { version, context, maxBatchSize, maxRetries }
) {
    const logPrefix = `INFLUXDB ${version.toUpperCase()} BATCH: ${context}`;
    const batchSizes = [maxBatchSize, 500, 250, 100, 10, 1].filter((size) => size <= maxBatchSize);
    const retryOptions = maxRetries === undefined ? {} : { maxRetries };

    stampPointsOnce(points, version);

    let pending = points;
    let previousChunkSize = Infinity;
    let lastError;

    for (const batchSize of batchSizes) {
        const chunkSize = Math.min(batchSize, pending.length);
        if (chunkSize >= previousChunkSize) {
            continue;
        }

        const isRetryPass = previousChunkSize !== Infinity;
        if (isRetryPass) {
            globals.logger.warn(
                `${logPrefix} - Writing the ${pending.length} point(s) that failed with batch size ${previousChunkSize} again, with batch size ${chunkSize}`
            );
        }
        previousChunkSize = chunkSize;

        const { failed, lastError: passError } = await writeChunksOnce(
            pending,
            chunkSize,
            writeChunk,
            { version, context, logPrefix, total: points.length, retryOptions }
        );

        if (failed.length === 0) {
            if (isRetryPass) {
                globals.logger.info(
                    `${logPrefix} - Wrote the remaining ${pending.length} point(s) using batch size ${chunkSize} (reduced from ${maxBatchSize})`
                );
            }
            return;
        }

        pending = failed;
        lastError = passError;
    }

    globals.logger.error(
        `${logPrefix} - Failed to write ${pending.length} of ${points.length} point(s), even with batch size ${previousChunkSize}`
    );
    throw batchWriteError(pending.length, points.length, lastError);
}

/**
 * Writes data to InfluxDB v1 in batches with progressive retry strategy.
 * If a batch fails, the points that failed are written again in smaller batches.
 * See writeInProgressiveBatches.
 *
 * @param {Array} datapoints - Array of datapoint objects to write
 * @param {string} context - Description of what's being written
 * @param {string} errorCategory - Not used. Failures are counted by the caller, which catches
 *   the error thrown.
 * @param {number} maxBatchSize - Maximum batch size from config
 * @param {object} [options] - Write options
 * @param {number} [options.maxRetries] - Retries per chunk (default: as writeToInfluxWithRetry)
 *
 * @returns {Promise<void>}
 */
export async function writeBatchToInfluxV1(
    datapoints,
    context,
    errorCategory,
    maxBatchSize,
    options = {}
) {
    if (!Array.isArray(datapoints) || datapoints.length === 0) {
        globals.logger.verbose(`INFLUXDB V1 BATCH: ${context} - No points to write`);
        return;
    }

    await writeInProgressiveBatches(datapoints, (chunk) => globals.influx.writePoints(chunk), {
        version: 'v1',
        context,
        maxBatchSize,
        maxRetries: options.maxRetries,
    });
}

/**
 * Writes one or more InfluxDB v2 Points using a short-lived write API.
 *
 * Creates a write API with standard options (`flushInterval: 5000`, `maxRetries: 0`),
 * writes the supplied points, and closes the API on success. If writing fails,
 * `close()` is also attempted in the error handler to release resources before
 * re-throwing the original error; any error from that cleanup close is suppressed.
 *
 * @param {object} influxClient - InfluxDB v2 client instance (e.g. `globals.influx`)
 * @param {string} org - InfluxDB organisation name
 * @param {string} bucket - InfluxDB bucket name
 * @param {import('@influxdata/influxdb-client').Point|import('@influxdata/influxdb-client').Point[]} points - Point(s) to write
 *
 * @returns {Promise<void>}
 */
export async function writePointsToInfluxV2(influxClient, org, bucket, points) {
    const writeApi = influxClient.getWriteApi(org, bucket, 'ns', {
        flushInterval: 5000,
        maxRetries: 0,
    });
    try {
        const pointsArray = Array.isArray(points) ? points : [points];
        await writeApi.writePoints(pointsArray);
        await writeApi.close();
    } catch (err) {
        try {
            await writeApi.close();
        } catch {
            // Ignore close errors
        }
        throw err;
    }
}

/**
 * Writes data to InfluxDB v2 in batches with progressive retry strategy.
 * If a batch fails, the points that failed are written again in smaller batches.
 * See writeInProgressiveBatches.
 *
 * Each chunk is written with writePointsToInfluxV2, which turns off the v2 client's own
 * retries. Retrying is left to writeToInfluxWithRetry, so a write is not retried twice over.
 *
 * @param {Array} points - Array of Point objects to write
 * @param {string} org - InfluxDB organization
 * @param {string} bucketName - InfluxDB bucket name
 * @param {string} context - Description of what's being written
 * @param {string} errorCategory - Not used. Failures are counted by the caller, which catches
 *   the error thrown.
 * @param {number} maxBatchSize - Maximum batch size from config
 * @param {object} [options] - Write options
 * @param {number} [options.maxRetries] - Retries per chunk (default: as writeToInfluxWithRetry)
 *
 * @returns {Promise<void>}
 */
export async function writeBatchToInfluxV2(
    points,
    org,
    bucketName,
    context,
    errorCategory,
    maxBatchSize,
    options = {}
) {
    if (!Array.isArray(points) || points.length === 0) {
        return;
    }

    await writeInProgressiveBatches(
        points,
        (chunk) => writePointsToInfluxV2(globals.influx, org, bucketName, chunk),
        { version: 'v2', context, maxBatchSize, maxRetries: options.maxRetries }
    );
}

/**
 * Writes data to InfluxDB v3 in batches with progressive retry strategy.
 * Converts Point3 objects to line protocol and concatenates them.
 * If a batch fails, the points that failed are written again in smaller batches.
 * See writeInProgressiveBatches.
 *
 * @param {Array} points - Array of Point3 objects to write
 * @param {string} database - InfluxDB database name
 * @param {string} context - Description of what's being written
 * @param {string} errorCategory - Not used. Failures are counted by the caller, which catches
 *   the error thrown.
 * @param {number} maxBatchSize - Maximum batch size from config
 * @param {object} [options] - Write options
 * @param {number} [options.maxRetries] - Retries per chunk (default: as writeToInfluxWithRetry)
 *
 * @returns {Promise<void>}
 */
export async function writeBatchToInfluxV3(
    points,
    database,
    context,
    errorCategory,
    maxBatchSize,
    options = {}
) {
    if (!Array.isArray(points) || points.length === 0) {
        return;
    }

    await writeInProgressiveBatches(
        points,
        // Convert Point3 objects to line protocol and concatenate
        (chunk) => globals.influx.write(chunk.map((p) => p.toLineProtocol()).join('\n'), database),
        { version: 'v3', context, maxBatchSize, maxRetries: options.maxRetries }
    );
}
