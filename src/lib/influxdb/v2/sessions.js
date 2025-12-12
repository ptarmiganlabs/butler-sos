import globals from '../../../globals.js';

/**
 * Store proxy session data to InfluxDB v2
 *
 * @param {object} userSessions - User session data including datapointInfluxdb array
 * @returns {Promise<void>}
 */
export async function storeSessionsV2(userSessions) {
    try {
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

        // Data points are already in InfluxDB v2 format (Point objects)
        // Write array of measurements: user_session_summary, user_session_list, user_session_details
        await writeApi.writeAPI.writePoints(userSessions.datapointInfluxdb);

        globals.logger.verbose(
            `PROXY SESSIONS V2: Sent user session data to InfluxDB for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
        );
    } catch (err) {
        globals.logger.error(
            `PROXY SESSIONS V2: Error saving user session data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
