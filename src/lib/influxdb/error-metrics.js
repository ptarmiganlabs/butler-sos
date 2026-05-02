import globals from '../../globals.js';
import { getInfluxDbVersion } from './shared/utils.js';
import { postFailedPollToInfluxdbV1 } from './v1/failed-polls.js';
import { postFailedPollToInfluxdbV2 } from './v2/failed-polls.js';
import { postFailedPollToInfluxdbV3 } from './v3/failed-polls.js';

/**
 * Placeholder function for storing cumulative error metrics to InfluxDB.
 *
 * This function is called by the ErrorTracker class after each error increment
 * to store the current cumulative error statistics. The individual failed-poll
 * events are tracked separately via {@link postFailedPollToInfluxdb}.
 *
 * @param {object} errorStats - Error statistics object grouped by API type
 * @param {object} errorStats.apiType - Object containing total count and server breakdown
 * @param {number} errorStats.apiType.total - Total error count for this API type
 * @param {object} errorStats.apiType.servers - Object with server names as keys and error counts as values
 * @returns {Promise<void>}
 *
 * @example
 * const stats = {
 *   HEALTH_API: {
 *     total: 5,
 *     servers: {
 *       'sense1': 3,
 *       'sense2': 2
 *     }
 *   },
 *   INFLUXDB_V3_WRITE: {
 *     total: 2,
 *     servers: {
 *       '_no_server_context': 2
 *     }
 *   }
 * };
 * await postErrorMetricsToInfluxdb(stats);
 */
export async function postErrorMetricsToInfluxdb(errorStats) {
    // No-op: individual failed poll events are tracked via postFailedPollToInfluxdb.
    return Promise.resolve();
}

/**
 * Posts a single failed Qlik Sense poll event to InfluxDB.
 *
 * This function routes to the version-specific implementation (v1, v2, or v3)
 * based on the configured InfluxDB version. It is called each time a poll to a
 * Qlik Sense API fails (health check, proxy sessions, or app name extraction).
 *
 * If failed polls tracking is disabled in config, or if InfluxDB is not enabled,
 * this function returns without writing anything.
 *
 * @param {object} failedPollData - Data describing the failed poll event
 * @param {string} failedPollData.host - Hostname or IP of the Qlik Sense server
 * @param {string} failedPollData.serverName - Configured name of the server
 * @param {string} failedPollData.errorType - Type of poll that failed: 'HEALTH_API', 'PROXY_API', or 'APP_NAMES_EXTRACT'
 * @param {string} [failedPollData.virtualProxy] - Virtual proxy prefix (only for PROXY_API errors)
 *
 * @returns {Promise<void>} Promise that resolves when the event has been written (or skipped)
 */
export async function postFailedPollToInfluxdb(failedPollData) {
    // Guard: InfluxDB must be enabled globally
    if (globals.config.get('Butler-SOS.influxdbConfig.enable') !== true) {
        return;
    }

    const version = getInfluxDbVersion();

    if (version === 1) {
        return postFailedPollToInfluxdbV1(failedPollData);
    }
    if (version === 2) {
        return postFailedPollToInfluxdbV2(failedPollData);
    }
    if (version === 3) {
        return postFailedPollToInfluxdbV3(failedPollData);
    }

    globals.logger.debug(`FAILED POLLS: Unknown InfluxDB version: v${version}`);
}
