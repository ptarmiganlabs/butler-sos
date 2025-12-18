import { Mutex } from 'async-mutex';

import globals from '../globals.js';
import { postErrorMetricsToInfluxdb } from './influxdb/error-metrics.js';

/**
 * Class for tracking counts of API errors in Butler SOS.
 *
 * This class provides thread-safe methods to track different types of API errors:
 * - Qlik Sense API errors (Health API, Proxy Sessions API)
 * - Data destination errors (InfluxDB, New Relic, MQTT)
 *
 * Counters reset daily at midnight UTC.
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
     *
     * @param {string} apiType - The type of API that encountered an error (e.g., 'HEALTH_API', 'PROXY_API')
     * @param {string} serverName - The name of the server where the error occurred (empty string if not applicable)
     * @returns {Promise<void>}
     */
    async incrementError(apiType, serverName) {
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

            // Log current error statistics
            await this.logErrorSummary();

            // Call placeholder function to store to InfluxDB (non-blocking)
            // This will be implemented later
            setImmediate(() => {
                postErrorMetricsToInfluxdb(this.getErrorStats()).catch((err) => {
                    this.logger.debug(
                        `ERROR TRACKER: Error calling placeholder InfluxDB function: ${err.message}`
                    );
                });
            });
        } finally {
            release();
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
