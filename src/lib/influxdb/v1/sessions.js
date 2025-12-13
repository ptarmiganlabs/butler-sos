import globals from '../../../globals.js';

/**
 * Store proxy session data to InfluxDB v1
 *
 * @param {object} userSessions - User session data including datapointInfluxdb array
 * @returns {Promise<void>}
 */
export async function storeSessionsV1(userSessions) {
    try {
        globals.logger.silly(
            `PROXY SESSIONS V1: Influxdb datapoint for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}": ${JSON.stringify(
                userSessions.datapointInfluxdb,
                null,
                2
            )}`
        );

        // Data points are already in InfluxDB v1 format (plain objects)
        // Write array of measurements: user_session_summary, user_session_list, user_session_details
        await globals.influx.writePoints(userSessions.datapointInfluxdb);

        globals.logger.debug(
            `PROXY SESSIONS V1: Session count for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}": ${userSessions.sessionCount}`
        );
        globals.logger.debug(
            `PROXY SESSIONS V1: User list for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}": ${userSessions.uniqueUserList}`
        );

        globals.logger.verbose(
            `PROXY SESSIONS V1: Sent user session data to InfluxDB for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
        );
    } catch (err) {
        globals.logger.error(
            `PROXY SESSIONS V1: Error saving user session data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
