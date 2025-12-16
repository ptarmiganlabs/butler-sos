import { getFormattedTime } from './shared/utils.js';
import * as factory from './factory.js';
import globals from '../../globals.js';

/**
 * Main facade that routes to version-specific implementations via factory.
 *
 * All InfluxDB versions (v1, v2, v3) now use refactored modular code.
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
 * @param {string} serverName - The name of the Qlik Sense server
 * @param {string} host - The hostname or IP of the Qlik Sense server
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @param {object} serverTags - Tags to associate with the metrics
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postHealthMetricsToInfluxdb(serverName, host, body, serverTags) {
    return await factory.postHealthMetricsToInfluxdb(serverName, host, body, serverTags);
}

/**
 * Posts proxy sessions data to InfluxDB.
 *
 * @param {object} userSessions - User session data
 * @returns {Promise<void>}
 */
export async function postProxySessionsToInfluxdb(userSessions) {
    return await factory.postProxySessionsToInfluxdb(userSessions);
}

/**
 * Posts Butler SOS's own memory usage to InfluxDB.
 *
 * @param {object} memory - Memory usage data object
 * @returns {Promise<void>}
 */
export async function postButlerSOSMemoryUsageToInfluxdb(memory) {
    return await factory.postButlerSOSMemoryUsageToInfluxdb(memory);
}

/**
 * Posts user events to InfluxDB.
 *
 * @param {object} msg - The user event message
 * @returns {Promise<void>}
 */
export async function postUserEventToInfluxdb(msg) {
    return await factory.postUserEventToInfluxdb(msg);
}

/**
 * Posts log events to InfluxDB.
 *
 * @param {object} msg - The log event message
 * @returns {Promise<void>}
 */
export async function postLogEventToInfluxdb(msg) {
    return await factory.postLogEventToInfluxdb(msg);
}

/**
 * Stores event counts to InfluxDB.
 *
 * @param {string} eventsSinceMidnight - Events since midnight data (unused, kept for compatibility)
 * @param {string} eventsLastHour - Events last hour data (unused, kept for compatibility)
 * @returns {Promise<void>}
 */
export async function storeEventCountInfluxDB(eventsSinceMidnight, eventsLastHour) {
    return await factory.storeEventCountInfluxDB();
}

/**
 * Stores rejected event counts to InfluxDB.
 *
 * @param {object} rejectedSinceMidnight - Rejected events since midnight (unused, kept for compatibility)
 * @param {object} rejectedLastHour - Rejected events last hour (unused, kept for compatibility)
 * @returns {Promise<void>}
 */
export async function storeRejectedEventCountInfluxDB(rejectedSinceMidnight, rejectedLastHour) {
    return await factory.storeRejectedEventCountInfluxDB();
}

/**
 * Stores user event queue metrics to InfluxDB.
 *
 * @param {object} queueMetrics - Queue metrics data (unused, kept for compatibility)
 * @returns {Promise<void>}
 */
export async function postUserEventQueueMetricsToInfluxdb(queueMetrics) {
    return await factory.postUserEventQueueMetricsToInfluxdb();
}

/**
 * Stores log event queue metrics to InfluxDB.
 *
 * @param {object} queueMetrics - Queue metrics data (unused, kept for compatibility)
 * @returns {Promise<void>}
 */
export async function postLogEventQueueMetricsToInfluxdb(queueMetrics) {
    return await factory.postLogEventQueueMetricsToInfluxdb();
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
