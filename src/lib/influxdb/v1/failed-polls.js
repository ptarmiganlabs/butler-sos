import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV1 } from '../shared/utils.js';

/**
 * Posts a failed Qlik Sense poll event to InfluxDB v1.
 *
 * This function writes a single data point to InfluxDB v1 when a Qlik Sense
 * API poll fails (health check, proxy sessions, or app name extraction).
 * Each call represents one failed poll event.
 *
 * @param {object} failedPollData - Data describing the failed poll event
 * @param {string} failedPollData.host - Hostname or IP of the Qlik Sense server
 * @param {string} failedPollData.serverName - Configured name of the server
 * @param {string} failedPollData.errorType - Type of poll that failed: 'HEALTH_API', 'PROXY_API', or 'APP_NAMES_EXTRACT'
 * @param {string} [failedPollData.virtualProxy] - Virtual proxy prefix (only for PROXY_API errors)
 *
 * @returns {Promise<void>} Promise that resolves when the data point has been written
 */
export async function postFailedPollToInfluxdbV1(failedPollData) {
    // Only write to InfluxDB if enabled and initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Check if failed polls tracking is enabled
    if (
        !globals.config.has('Butler-SOS.influxdbConfig.failedPollsTracking.enable') ||
        globals.config.get('Butler-SOS.influxdbConfig.failedPollsTracking.enable') !== true
    ) {
        return;
    }

    const measurementName = globals.config.get(
        'Butler-SOS.influxdbConfig.failedPollsTracking.measurementName'
    );

    const tags = {
        host: failedPollData.host,
        server_name: failedPollData.serverName,
        error_type: failedPollData.errorType,
    };

    if (failedPollData.virtualProxy !== undefined && failedPollData.virtualProxy !== null) {
        tags.virtual_proxy = failedPollData.virtualProxy;
    }

    const datapoint = [
        {
            measurement: measurementName,
            tags,
            fields: {
                error_count: 1,
            },
        },
    ];

    globals.logger.debug(
        `FAILED POLLS V1: Writing failed poll datapoint for server '${failedPollData.serverName}' (${failedPollData.host}), error type '${failedPollData.errorType}'`
    );

    try {
        await writeBatchToInfluxV1(
            datapoint,
            `Failed poll for ${failedPollData.serverName}/${failedPollData.errorType}`,
            failedPollData.serverName,
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose(
            `FAILED POLLS V1: Wrote failed poll event to InfluxDB for server '${failedPollData.serverName}' (${failedPollData.host}), error type '${failedPollData.errorType}'`
        );
    } catch (err) {
        globals.logger.error(
            `FAILED POLLS V1: Error writing failed poll event to InfluxDB for server '${failedPollData.serverName}': ${globals.getErrorMessage(err)}`
        );
    }
}
