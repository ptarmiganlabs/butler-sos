import { useRefactoredInfluxDb, getFormattedTime } from './shared/utils.js';
import * as factory from './factory.js';

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
            // If refactored code not yet implemented for this version, fall back to original
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
            // If refactored code not yet implemented for this version, fall back to original
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
            return await original.postUserEventQueueMetricsToInfluxdb(queueMetrics);
        }
    }
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
    // This is version-agnostic, always use original
    return original.setupUdpQueueMetricsStorage();
}
