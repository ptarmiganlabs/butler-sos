import { useRefactoredInfluxDb, getFormattedTime } from './shared/utils.js';
import * as factory from './factory.js';
import globals from '../../globals.js';

// Import original implementation for fallback
import * as original from '../post-to-influxdb.js';

/**
 * Main facade that routes to either refactored or original implementation based on feature flag.
 *
 * This allows for safe migration by testing refactored code alongside original implementation.
 */

/**
 * Calculates and formats the uptime of a Qlik Sense engine.
 * This function is version-agnostic and always uses the shared implementation.
 *
 * @param {string} serverStarted - The server start time in format "YYYYMMDDThhmmss"
 * @returns {string} A formatted string representing uptime (e.g. "5 days, 3h 45m 12s")
 */
export { getFormattedTime };

/**
 * Posts health metrics data from Qlik Sense to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {string} serverName - The name of the Qlik Sense server
 * @param {string} host - The hostname or IP of the Qlik Sense server
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @param {object} serverTags - Tags to associate with the metrics
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postHealthMetricsToInfluxdb(serverName, host, body, serverTags) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.postHealthMetricsToInfluxdb(serverName, host, body, serverTags);
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original
            return await original.postHealthMetricsToInfluxdb(serverName, host, body, serverTags);
        }
    }
    return await original.postHealthMetricsToInfluxdb(serverName, host, body, serverTags);
}

/**
 * Posts proxy sessions data to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {object} userSessions - User session data
 * @returns {Promise<void>}
 */
export async function postProxySessionsToInfluxdb(userSessions) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.postProxySessionsToInfluxdb(userSessions);
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original
            return await original.postProxySessionsToInfluxdb(userSessions);
        }
    }
    return await original.postProxySessionsToInfluxdb(userSessions);
}

/**
 * Posts Butler SOS's own memory usage to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {object} memory - Memory usage data object
 * @returns {Promise<void>}
 */
export async function postButlerSOSMemoryUsageToInfluxdb(memory) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.postButlerSOSMemoryUsageToInfluxdb(memory);
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original
            return await original.postButlerSOSMemoryUsageToInfluxdb(memory);
        }
    }
    return await original.postButlerSOSMemoryUsageToInfluxdb(memory);
}

/**
 * Posts user events to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {object} msg - The user event message
 * @returns {Promise<void>}
 */
export async function postUserEventToInfluxdb(msg) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.postUserEventToInfluxdb(msg);
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original            globals.logger.error(`INFLUXDB ROUTING: User event - falling back to legacy code due to error: ${err.message}`);
            globals.logger.debug(`INFLUXDB ROUTING: User event - error stack: ${err.stack}`);
            return await original.postUserEventToInfluxdb(msg);
        }
    }
    return await original.postUserEventToInfluxdb(msg);
}

/**
 * Posts log events to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {object} msg - The log event message
 * @returns {Promise<void>}
 */
export async function postLogEventToInfluxdb(msg) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.postLogEventToInfluxdb(msg);
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original            globals.logger.error(`INFLUXDB ROUTING: Log event - falling back to legacy code due to error: ${err.message}`);
            globals.logger.debug(`INFLUXDB ROUTING: Log event - error stack: ${err.stack}`);
            return await original.postLogEventToInfluxdb(msg);
        }
    }
    return await original.postLogEventToInfluxdb(msg);
}

/**
 * Stores event counts to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {string} eventsSinceMidnight - Events since midnight data
 * @param {string} eventsLastHour - Events last hour data
 * @returns {Promise<void>}
 */
export async function storeEventCountInfluxDB(eventsSinceMidnight, eventsLastHour) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.storeEventCountInfluxDB();
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original
            return await original.storeEventCountInfluxDB(eventsSinceMidnight, eventsLastHour);
        }
    }
    return await original.storeEventCountInfluxDB(eventsSinceMidnight, eventsLastHour);
}

/**
 * Stores rejected event counts to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {object} rejectedSinceMidnight - Rejected events since midnight
 * @param {object} rejectedLastHour - Rejected events last hour
 * @returns {Promise<void>}
 */
export async function storeRejectedEventCountInfluxDB(rejectedSinceMidnight, rejectedLastHour) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.storeRejectedEventCountInfluxDB();
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original
            return await original.storeRejectedEventCountInfluxDB(
                rejectedSinceMidnight,
                rejectedLastHour
            );
        }
    }
    return await original.storeRejectedEventCountInfluxDB(rejectedSinceMidnight, rejectedLastHour);
}

/**
 * Stores user event queue metrics to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {object} queueMetrics - Queue metrics data
 * @returns {Promise<void>}
 */
export async function postUserEventQueueMetricsToInfluxdb(queueMetrics) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.postUserEventQueueMetricsToInfluxdb();
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original
            globals.logger.error(
                `INFLUXDB ROUTING: User event queue metrics - falling back to legacy code due to error: ${err.message}`
            );
            globals.logger.debug(
                `INFLUXDB ROUTING: User event queue metrics - error stack: ${err.stack}`
            );
            return await original.postUserEventQueueMetricsToInfluxdb(queueMetrics);
        }
    }

    globals.logger.verbose(
        'INFLUXDB ROUTING: User event queue metrics - using original implementation'
    );
    return await original.postUserEventQueueMetricsToInfluxdb(queueMetrics);
}

/**
 * Stores log event queue metrics to InfluxDB.
 *
 * Routes to refactored or original implementation based on feature flag.
 *
 * @param {object} queueMetrics - Queue metrics data
 * @returns {Promise<void>}
 */
export async function postLogEventQueueMetricsToInfluxdb(queueMetrics) {
    if (useRefactoredInfluxDb()) {
        try {
            return await factory.postLogEventQueueMetricsToInfluxdb();
        } catch (err) {
            // If refactored code not yet implemented for this version, fall back to original
            globals.logger.error(
                `INFLUXDB ROUTING: Log event queue metrics - falling back to legacy code due to error: ${err.message}`
            );
            globals.logger.debug(
                `INFLUXDB ROUTING: Log event queue metrics - error stack: ${err.stack}`
            );
            return await original.postLogEventQueueMetricsToInfluxdb(queueMetrics);
        }
    }
    return await original.postLogEventQueueMetricsToInfluxdb(queueMetrics);
}

/**
 * Sets up timers for queue metrics storage.
 *
 * @returns {object} Object containing interval IDs for cleanup
 */
export function setupUdpQueueMetricsStorage() {
    const intervalIds = {
        userEvents: null,
        logEvents: null,
    };

    // Check if InfluxDB is enabled
    if (globals.config.get('Butler-SOS.influxdbConfig.enable') !== true) {
        globals.logger.info(
            'UDP QUEUE METRICS: InfluxDB is disabled. Skipping setup of queue metrics storage'
        );
        return intervalIds;
    }

    // Set up user events queue metrics storage
    if (
        globals.config.get('Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.enable') ===
        true
    ) {
        const writeFrequency = globals.config.get(
            'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.writeFrequency'
        );

        intervalIds.userEvents = setInterval(async () => {
            try {
                globals.logger.verbose(
                    'UDP QUEUE METRICS: Timer for storing user event queue metrics to InfluxDB triggered'
                );
                await postUserEventQueueMetricsToInfluxdb();
            } catch (err) {
                globals.logger.error(
                    `UDP QUEUE METRICS: Error storing user event queue metrics to InfluxDB: ${
                        err && err.stack ? err.stack : err
                    }`
                );
            }
        }, writeFrequency);

        globals.logger.info(
            `UDP QUEUE METRICS: Set up timer for storing user event queue metrics to InfluxDB (interval: ${writeFrequency}ms)`
        );
    } else {
        globals.logger.info(
            'UDP QUEUE METRICS: User event queue metrics storage to InfluxDB is disabled'
        );
    }

    // Set up log events queue metrics storage
    if (
        globals.config.get('Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.enable') ===
        true
    ) {
        const writeFrequency = globals.config.get(
            'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.writeFrequency'
        );

        intervalIds.logEvents = setInterval(async () => {
            try {
                globals.logger.verbose(
                    'UDP QUEUE METRICS: Timer for storing log event queue metrics to InfluxDB triggered'
                );
                await postLogEventQueueMetricsToInfluxdb();
            } catch (err) {
                globals.logger.error(
                    `UDP QUEUE METRICS: Error storing log event queue metrics to InfluxDB: ${
                        err && err.stack ? err.stack : err
                    }`
                );
            }
        }, writeFrequency);

        globals.logger.info(
            `UDP QUEUE METRICS: Set up timer for storing log event queue metrics to InfluxDB (interval: ${writeFrequency}ms)`
        );
    } else {
        globals.logger.info(
            'UDP QUEUE METRICS: Log event queue metrics storage to InfluxDB is disabled'
        );
    }

    return intervalIds;
}
