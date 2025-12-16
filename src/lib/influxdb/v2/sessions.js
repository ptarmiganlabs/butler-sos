import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Store proxy session data to InfluxDB v2
 *
 * @description
 * Stores user session data from Qlik Sense proxy to InfluxDB v2. The function writes
 * pre-formatted session data points that have already been converted to InfluxDB Point objects.
 *
 * The userSessions.datapointInfluxdb array typically contains three types of measurements:
 * - user_session_summary: Summary with session count and user list
 * - user_session_list: List of users (for compatibility)
 * - user_session_details: Individual session details for each active session
 *
 * @param {object} userSessions - User session data object
 * @param {string} userSessions.serverName - Name of the Qlik Sense server
 * @param {string} userSessions.host - Hostname of the Qlik Sense server
 * @param {string} userSessions.virtualProxy - Virtual proxy name
 * @param {number} userSessions.sessionCount - Total number of active sessions
 * @param {string} userSessions.uniqueUserList - Comma-separated list of unique users
 * @param {Array<Point>} userSessions.datapointInfluxdb - Array of InfluxDB Point objects to write.
 *   Each Point object in the array is already formatted and ready to write.
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeSessionsV2(userSessions) {
    globals.logger.debug(`PROXY SESSIONS V2: User sessions: ${JSON.stringify(userSessions)}`);

    // Only write to InfluxDB if enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Validate input - ensure datapointInfluxdb is an array
    if (!Array.isArray(userSessions.datapointInfluxdb)) {
        globals.logger.warn(
            `PROXY SESSIONS V2: Invalid data format for host ${userSessions.host} - datapointInfluxdb must be an array`
        );
        return;
    }

    // Find writeApi for the server specified by serverName
    const writeApi = globals.influxWriteApi.find(
        (element) => element.serverName === userSessions.serverName
    );

    if (!writeApi) {
        globals.logger.warn(
            `PROXY SESSIONS V2: Influxdb write API object not found for host ${userSessions.host}`
        );
        return;
    }

    globals.logger.silly(
        `PROXY SESSIONS V2: Influxdb datapoint for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}": ${JSON.stringify(
            userSessions.datapointInfluxdb,
            null,
            2
        )}`
    );

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    // Write array of measurements using retry logic
    await writeToInfluxWithRetry(
        async () => {
            const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', {
                flushInterval: 5000,
                maxRetries: 0,
            });
            try {
                await writeApi.writePoints(userSessions.datapointInfluxdb);
                await writeApi.close();
            } catch (err) {
                try {
                    await writeApi.close();
                } catch (closeErr) {
                    // Ignore close errors
                }
                throw err;
            }
        },
        `Proxy sessions for ${userSessions.host}/${userSessions.virtualProxy}`,
        'v2',
        userSessions.serverName
    );

    globals.logger.verbose(
        `PROXY SESSIONS V2: Sent user session data to InfluxDB for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
    );
}
