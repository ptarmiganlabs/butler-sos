import { AsyncLocalStorage } from 'node:async_hooks';
import { Mutex } from 'async-mutex';

import globals from '../globals.js';
import { getInfluxDbVersion, isInfluxDbEnabled } from './influxdb/shared/utils.js';
import { getErrorMetadata } from './error-categorizer.js';

// Minimum time between two running-total summary lines in the log
const SUMMARY_LOG_INTERVAL_MS = 60 * 1000;

// Set while an error event is being written to InfluxDB. Lets incrementError() see that it
// was reached from inside such a write, even across the awaits and retry timers in between.
const errorEventWriteContext = new AsyncLocalStorage();

/**
 * Checks whether error summary logging is enabled in config.
 * Defaults to true if the config key is absent, to preserve existing behavior.
 *
 * @returns {boolean} True if enabled
 */
function isLogSummaryEnabled() {
    return globals.config?.has?.('Butler-SOS.errorTracking.logSummary.enable')
        ? globals.config.get('Butler-SOS.errorTracking.logSummary.enable')
        : true;
}

/**
 * Class for tracking counts of API errors in Butler SOS.
 *
 * This class provides thread-safe methods to track different types of API errors:
 * - Qlik Sense API errors (Health API, Proxy Sessions API, App Names Extract)
 * - Data destination errors (InfluxDB, New Relic, MQTT)
 *
 * Counters reset daily at midnight UTC.
 * If summary logging is enabled, the running totals are logged at most once a minute while
 * errors occur, and a final summary is logged at midnight UTC.
 * Optionally writes individual error events to InfluxDB if configured.
 */
export class ErrorTracker {
    /**
     * Creates a new ErrorTracker instance.
     *
     * @param {object} logger - Logger instance with error, debug, info, and verbose methods
     */
    constructor(logger) {
        this.logger = logger;

        // Array of objects with error counts
        // Each object has properties:
        // - apiType: string (e.g., 'HEALTH_API', 'INFLUXDB_V3_WRITE')
        // - serverName: string (name of the server, or empty string if not applicable)
        // - count: integer
        this.errorCounts = [];

        // Mutex for synchronizing access to the array
        this.errorMutex = new Mutex();

        // Track when counters were last reset
        this.lastResetDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC

        // Rate limiting of the running-total summary line
        this.lastSummaryLogTime = 0;
        this.summaryLogTimer = null;
    }

    /**
     * Increments the error count for a specific API type and server.
     * Optionally writes the error event to InfluxDB if configured.
     *
     * @param {string} apiType - The type of API that encountered an error (e.g., 'HEALTH_API', 'PROXY_API')
     * @param {string} serverName - The name of the server where the error occurred (empty string if not applicable)
     * @param {object} [metadata] - Optional metadata for InfluxDB tags (e.g., { host: '...', virtualProxy: '...', module: '...' })
     * @param {Error|null} [err] - Optional original error object, used to derive error_category for InfluxDB
     * @returns {Promise<void>}
     */
    async incrementError(apiType, serverName, metadata = {}, err = null) {
        // Respect the master switch - if error tracking is disabled, do nothing
        try {
            if (
                globals.config?.has?.('Butler-SOS.errorTracking.enable') &&
                globals.config.get('Butler-SOS.errorTracking.enable') === false
            ) {
                return;
            }
        } catch {
            // Config not yet available - continue with tracking
        }

        // Ensure the passed parameters are strings
        if (typeof apiType !== 'string') {
            this.logger.error(
                `ERROR TRACKER: apiType must be a string: ${JSON.stringify(apiType)}`
            );
            return;
        }

        if (typeof serverName !== 'string') {
            this.logger.error(
                `ERROR TRACKER: serverName must be a string: ${JSON.stringify(serverName)}`
            );
            return;
        }

        const release = await this.errorMutex.acquire();

        try {
            // Check if we need to reset counters (new day in UTC). This error can arrive before
            // the midnight timer has run, so it may be the one that closes the previous day.
            const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
            if (currentDate > this.lastResetDate) {
                this.logger.debug(
                    `ERROR TRACKER: Date changed from ${this.lastResetDate} to ${currentDate}, resetting counters`
                );
                await this._rollOverDay(currentDate);
            }

            const found = this.errorCounts.find((element) => {
                return element.apiType === apiType && element.serverName === serverName;
            });

            if (found) {
                found.count += 1;
                this.logger.debug(
                    `ERROR TRACKER: Incremented error count for ${apiType}/${serverName}, new count: ${found.count}`
                );
            } else {
                this.logger.debug(
                    `ERROR TRACKER: Adding first error count for ${apiType}/${serverName}`
                );

                this.errorCounts.push({
                    apiType,
                    serverName,
                    count: 1,
                });
            }

            // Log current error statistics only when enabled in config
            if (isLogSummaryEnabled()) {
                await this._logRunningSummary();
            }

            // Write individual error event to InfluxDB (non-blocking).
            // Never start an error-event write from inside another one. If that write's failure
            // were written too, the new write would fail the same way, and the writes would
            // multiply for as long as InfluxDB rejects them.
            if (this._isInfluxDbErrorTrackingEnabled()) {
                if (errorEventWriteContext.getStore()) {
                    this.logger.debug(
                        `ERROR TRACKER: Not writing error event ${apiType}/${serverName} to InfluxDB, as it was raised while writing another error event`
                    );
                } else {
                    const capturedErr = err;
                    setImmediate(() => {
                        errorEventWriteContext
                            .run(true, () =>
                                this._writeErrorToInfluxDB(
                                    apiType,
                                    serverName,
                                    metadata,
                                    capturedErr
                                )
                            )
                            .catch((writeErr) => {
                                this.logger.debug(
                                    `ERROR TRACKER: Error writing error event to InfluxDB: ${writeErr.message}`
                                );
                            });
                    });
                }
            }
        } finally {
            release();
        }
    }

    /**
     * Logs the running error totals, at most once per SUMMARY_LOG_INTERVAL_MS.
     *
     * The first error after a quiet interval is logged at once. Errors arriving within the
     * interval are not logged one by one; instead the totals are logged once when the interval
     * ends, so the last errors of a burst still show up in the log.
     *
     * @returns {Promise<void>}
     * @private
     */
    async _logRunningSummary() {
        const msSinceLastLog = Date.now() - this.lastSummaryLogTime;

        if (msSinceLastLog >= SUMMARY_LOG_INTERVAL_MS) {
            // A pending summary may be overdue without having run yet, for example when the
            // event loop is busy. This line covers its totals, so it must not log them again.
            clearTimeout(this.summaryLogTimer);
            this.summaryLogTimer = null;

            this.lastSummaryLogTime = Date.now();
            await this.logErrorSummary();
            return;
        }

        if (!this.summaryLogTimer) {
            this.summaryLogTimer = setTimeout(() => {
                this.summaryLogTimer = null;
                this.lastSummaryLogTime = Date.now();
                this.logErrorSummary().catch((logErr) => {
                    this.logger.debug(
                        `ERROR TRACKER: Error logging error summary: ${logErr.message}`
                    );
                });
            }, SUMMARY_LOG_INTERVAL_MS - msSinceLastLog);

            // Don't keep the process alive just to log a summary
            this.summaryLogTimer.unref?.();
        }
    }

    /**
     * Checks if InfluxDB error tracking is enabled in config.
     *
     * @returns {boolean} True if enabled
     * @private
     */
    _isInfluxDbErrorTrackingEnabled() {
        try {
            return (
                globals.config.has('Butler-SOS.errorTracking.enable') &&
                globals.config.get('Butler-SOS.errorTracking.enable') === true &&
                globals.config.has('Butler-SOS.errorTracking.influxdb.enable') &&
                globals.config.get('Butler-SOS.errorTracking.influxdb.enable') === true &&
                isInfluxDbEnabled()
            );
        } catch {
            return false;
        }
    }

    /**
     * Writes a single error event to InfluxDB.
     *
     * A failure of this write is logged but not tracked as an error. Tracking it would start
     * another error-event write, which would fail the same way.
     *
     * The write gets a single attempt, without retries. Error events are best-effort: the error
     * is already logged and counted, and retrying matters least when InfluxDB is the thing that
     * is failing, which is when every retry would add more noise to the log.
     *
     * @param {string} apiType - The error type
     * @param {string} serverName - The server name
     * @param {object} metadata - Additional tags for InfluxDB
     * @param {Error|null} err - Original error object for category derivation
     * @returns {Promise<void>}
     * @private
     */
    async _writeErrorToInfluxDB(apiType, serverName, metadata, err) {
        const measurementName =
            globals.config.get('Butler-SOS.errorTracking.influxdb.measurementName') ||
            'butler_sos_errors';
        const version = getInfluxDbVersion();

        // Build common tags
        const tags = {
            error_type: apiType,
            server_name: serverName,
        };

        // Add metadata tags if provided
        if (metadata.host) {
            tags.host = metadata.host;
        }
        if (metadata.virtualProxy) {
            tags.virtual_proxy = metadata.virtualProxy;
        }
        if (metadata.destinationHost) {
            tags.destination_host = metadata.destinationHost;
        }
        if (metadata.module) {
            tags.module = metadata.module;
        }

        // Description of the write, for log messages. Some errors have no server name.
        const context = serverName
            ? `Error event: ${apiType}/${serverName}`
            : `Error event: ${apiType}`;
        const writeOptions = { maxRetries: 0 };

        // Derive error fields from the original error object
        const errMeta = getErrorMetadata(err);

        // String fields (written to all InfluxDB versions)
        const stringFields = { error_category: errMeta.error_category };
        if (errMeta.error_code) stringFields.error_code = errMeta.error_code;
        if (errMeta.request_url) stringFields.request_url = errMeta.request_url;
        if (errMeta.remote_address) stringFields.remote_address = errMeta.remote_address;
        if (errMeta.syscall) stringFields.syscall = errMeta.syscall;

        // Integer fields
        const intFields = { error_count: 1 };
        if (errMeta.request_timeout_ms != null)
            intFields.request_timeout_ms = errMeta.request_timeout_ms;
        if (errMeta.remote_port != null) intFields.remote_port = errMeta.remote_port;
        if (errMeta.http_status != null) intFields.http_status = errMeta.http_status;

        try {
            if (version === 3) {
                const { Point: Point3 } = await import('@influxdata/influxdb3-client');
                const point = new Point3(measurementName);
                Object.entries(tags).forEach(([key, value]) => {
                    point.setTag(key, value);
                });
                Object.entries(stringFields).forEach(([k, v]) => {
                    point.setStringField(k, v);
                });
                Object.entries(intFields).forEach(([k, v]) => {
                    point.setIntegerField(k, v);
                });

                const { writeBatchToInfluxV3 } = await import('./influxdb/shared/utils.js');
                const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');
                await writeBatchToInfluxV3(
                    [point],
                    database,
                    context,
                    serverName,
                    globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize'),
                    writeOptions
                );
            } else if (version === 2) {
                const { Point: Point2 } = await import('@influxdata/influxdb-client');
                const point = new Point2(measurementName);
                Object.entries(tags).forEach(([key, value]) => {
                    point.tag(key, value);
                });
                Object.entries(stringFields).forEach(([k, v]) => {
                    point.stringField(k, v);
                });
                Object.entries(intFields).forEach(([k, v]) => {
                    point.intField(k, v);
                });

                const { writeBatchToInfluxV2 } = await import('./influxdb/shared/utils.js');
                const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
                const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');
                await writeBatchToInfluxV2(
                    [point],
                    org,
                    bucketName,
                    context,
                    serverName,
                    globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize'),
                    writeOptions
                );
            } else if (version === 1) {
                const { writeBatchToInfluxV1 } = await import('./influxdb/shared/utils.js');
                const datapoint = [
                    {
                        measurement: measurementName,
                        tags,
                        fields: { ...stringFields, ...intFields },
                    },
                ];
                await writeBatchToInfluxV1(
                    datapoint,
                    context,
                    serverName,
                    globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize'),
                    writeOptions
                );
            }
        } catch (err) {
            this.logger.debug(`ERROR TRACKER: InfluxDB write failed: ${err.message}`);
        }
    }

    /**
     * Resets all error counters.
     * Should be called at midnight UTC or when starting fresh.
     *
     * @returns {Promise<void>}
     */
    async resetCounters() {
        // Note: Caller must hold the mutex before calling this method
        this.errorCounts = [];
        this.logger.info('ERROR TRACKER: Reset all error counters');
    }

    /**
     * Ends the tracking day: logs the day's final totals (if summary logging is enabled), then
     * resets the counters and starts the new day.
     *
     * Both the midnight timer and the first error of a new day can get here, in either order,
     * so callers check lastResetDate first. That way each day's totals are logged once, and an
     * error from the new day is never logged or reset as part of the old one.
     *
     * @param {string} newDate - The UTC date (YYYY-MM-DD) of the day that is starting
     * @returns {Promise<void>}
     */
    async _rollOverDay(newDate) {
        // Note: Caller must hold the mutex before calling this method
        if (isLogSummaryEnabled()) {
            await this.logErrorSummary();
        }

        // The final summary covers any running summary still waiting to be logged. Dropping it
        // also keeps it from logging the new day's totals on the old day's schedule.
        clearTimeout(this.summaryLogTimer);
        this.summaryLogTimer = null;
        this.lastSummaryLogTime = 0;

        await this.resetCounters();
        this.lastResetDate = newDate;
    }

    /**
     * Gets current error statistics grouped by API type.
     *
     * @returns {object} Object with API types as keys, each containing total count and server breakdown
     */
    getErrorStats() {
        const stats = {};

        for (const error of this.errorCounts) {
            if (!stats[error.apiType]) {
                stats[error.apiType] = {
                    total: 0,
                    servers: {},
                };
            }

            stats[error.apiType].total += error.count;

            if (error.serverName) {
                stats[error.apiType].servers[error.serverName] = error.count;
            } else {
                // For errors without server context, use a placeholder
                if (!stats[error.apiType].servers['_no_server_context']) {
                    stats[error.apiType].servers['_no_server_context'] = 0;
                }
                stats[error.apiType].servers['_no_server_context'] += error.count;
            }
        }

        return stats;
    }

    /**
     * Logs a summary of current error counts at INFO level.
     *
     * @returns {Promise<void>}
     */
    async logErrorSummary() {
        const stats = this.getErrorStats();

        if (Object.keys(stats).length === 0) {
            return; // No errors to log
        }

        // Calculate grand total
        let grandTotal = 0;
        for (const apiType in stats) {
            grandTotal += stats[apiType].total;
        }

        this.logger.info(
            `ERROR TRACKER: Error counts today (UTC): Total=${grandTotal}, Details=${JSON.stringify(stats)}`
        );
    }

    /**
     * Gets all error counts (for testing purposes).
     *
     * @returns {Promise<Array>} Array of error count objects
     */
    async getErrorCounts() {
        const release = await this.errorMutex.acquire();

        try {
            return this.errorCounts;
        } finally {
            release();
        }
    }
}

/**
 * Sets up a timer that resets error counters at midnight UTC.
 *
 * This function calculates the time until next midnight UTC and schedules
 * a reset, then reschedules itself for the following midnight.
 *
 * @returns {void}
 */
export function setupErrorCounterReset() {
    /**
     * Schedules the next reset at midnight UTC.
     */
    const scheduleNextReset = () => {
        // Calculate milliseconds until next midnight UTC
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setUTCHours(24, 0, 0, 0);
        const msUntilMidnight = nextMidnight - now;
        const newDate = nextMidnight.toISOString().split('T')[0]; // YYYY-MM-DD in UTC

        globals.logger.info(
            `ERROR TRACKER: Scheduled next error counter reset at ${nextMidnight.toISOString()} (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`
        );

        setTimeout(async () => {
            globals.logger.info('ERROR TRACKER: Midnight UTC reached, resetting error counters');

            // Log final daily summary before reset
            const release = await globals.errorTracker.errorMutex.acquire();
            try {
                // An error that arrived just after midnight, before this timer ran, has already
                // logged the final summary and reset the counters for the new day
                if (newDate > globals.errorTracker.lastResetDate) {
                    await globals.errorTracker._rollOverDay(newDate);
                } else {
                    globals.logger.debug(
                        `ERROR TRACKER: Error counters already reset for ${newDate}, nothing to do`
                    );
                }
            } finally {
                release();
            }

            // Schedule next reset
            scheduleNextReset();
        }, msUntilMidnight);
    };

    // Start the reset cycle
    scheduleNextReset();
}
