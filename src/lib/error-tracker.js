import { Mutex } from 'async-mutex';

import globals from '../globals.js';
import { getInfluxDbVersion, isInfluxDbEnabled } from './influxdb/shared/utils.js';
import { getErrorMetadata } from './error-categorizer.js';

/**
 * Class for tracking counts of API errors in Butler SOS.
 *
 * This class provides thread-safe methods to track different types of API errors:
 * - Qlik Sense API errors (Health API, Proxy Sessions API, App Names Extract)
 * - Data destination errors (InfluxDB, New Relic, MQTT)
 *
 * Counters reset daily at midnight UTC.
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
            // Check if we need to reset counters (new day in UTC)
            const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
            if (currentDate !== this.lastResetDate) {
                this.logger.debug(
                    `ERROR TRACKER: Date changed from ${this.lastResetDate} to ${currentDate}, resetting counters`
                );
                await this.resetCounters();
                this.lastResetDate = currentDate;
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

            // Log current error statistics only when enabled in config.
            // Default to true to preserve existing behavior if the config key is absent.
            const isLogSummaryEnabled = globals.config?.has?.(
                'Butler-SOS.errorTracking.logSummary.enable'
            )
                ? globals.config.get('Butler-SOS.errorTracking.logSummary.enable')
                : true;

            if (isLogSummaryEnabled) {
                await this.logErrorSummary();
            }

            // Write individual error event to InfluxDB (non-blocking)
            if (this._isInfluxDbErrorTrackingEnabled()) {
                const capturedErr = err;
                setImmediate(() => {
                    this._writeErrorToInfluxDB(apiType, serverName, metadata, capturedErr).catch(
                        (writeErr) => {
                            this.logger.debug(
                                `ERROR TRACKER: Error writing error event to InfluxDB: ${writeErr.message}`
                            );
                        }
                    );
                });
            }
        } finally {
            release();
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
                    `Error event: ${apiType}/${serverName}`,
                    serverName,
                    globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
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
                    `Error event: ${apiType}/${serverName}`,
                    serverName,
                    globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
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
                    `Error event: ${apiType}/${serverName}`,
                    serverName,
                    globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
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

        globals.logger.info(
            `ERROR TRACKER: Scheduled next error counter reset at ${nextMidnight.toISOString()} (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`
        );

        setTimeout(async () => {
            globals.logger.info('ERROR TRACKER: Midnight UTC reached, resetting error counters');

            // Log final daily summary before reset
            const release = await globals.errorTracker.errorMutex.acquire();
            try {
                await globals.errorTracker.logErrorSummary();
                await globals.errorTracker.resetCounters();
                globals.errorTracker.lastResetDate = new Date().toISOString().split('T')[0];
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
