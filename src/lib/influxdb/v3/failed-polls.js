import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV3 } from '../shared/utils.js';

/**
 * Posts a failed Qlik Sense poll event to InfluxDB v3.
 *
 * This function writes a single data point to InfluxDB v3 when a Qlik Sense
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
export async function postFailedPollToInfluxdbV3(failedPollData) {
    // Only write to InfluxDB if the global influx object has been initialized
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

    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    // Build the Point3 with tags and fields
    const point = new Point3(measurementName)
        .setTag('host', failedPollData.host)
        .setTag('server_name', failedPollData.serverName)
        .setTag('error_type', failedPollData.errorType)
        .setIntegerField('error_count', 1);

    if (failedPollData.virtualProxy !== undefined && failedPollData.virtualProxy !== null) {
        point.setTag('virtual_proxy', failedPollData.virtualProxy);
    }

    globals.logger.debug(
        `FAILED POLLS V3: Writing failed poll datapoint for server '${failedPollData.serverName}' (${failedPollData.host}), error type '${failedPollData.errorType}'`
    );

    try {
        await writeBatchToInfluxV3(
            [point],
            database,
            `Failed poll for ${failedPollData.serverName}/${failedPollData.errorType}`,
            failedPollData.serverName,
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose(
            `FAILED POLLS V3: Wrote failed poll event to InfluxDB for server '${failedPollData.serverName}' (${failedPollData.host}), error type '${failedPollData.errorType}'`
        );
    } catch (err) {
        globals.logger.error(
            `FAILED POLLS V3: Error writing failed poll event to InfluxDB for server '${failedPollData.serverName}': ${globals.getErrorMessage(err)}`
        );
    }
}
