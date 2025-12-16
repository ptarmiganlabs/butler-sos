import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Posts proxy sessions data to InfluxDB v1.
 *
 * This function takes user session data from Qlik Sense proxy and formats it for storage
 * in InfluxDB v1. It writes three types of measurements:
 * - user_session_summary: Summary with count and user list
 * - user_session_list: List of users (for compatibility)
 * - user_session_details: Individual session details for each active session
 *
 * @param {object} userSessions - User session data containing information about active sessions
 * @param {string} userSessions.host - The hostname of the server
 * @param {string} userSessions.virtualProxy - The virtual proxy name
 * @param {string} userSessions.serverName - Server name
 * @param {number} userSessions.sessionCount - Number of sessions
 * @param {string} userSessions.uniqueUserList - Comma-separated list of unique users
 * @param {Array} userSessions.datapointInfluxdb - Array of datapoints (plain objects for v1)
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeSessionsV1(userSessions) {
    globals.logger.debug(`PROXY SESSIONS V1: User sessions: ${JSON.stringify(userSessions)}`);

    globals.logger.silly(
        `PROXY SESSIONS V1: Data for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
    );

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    try {
        globals.logger.silly(
            `PROXY SESSIONS V1: Influxdb datapoint for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}": ${JSON.stringify(
                userSessions.datapointInfluxdb,
                null,
                2
            )}`
        );

        // Validate datapoints exist
        if (!userSessions.datapointInfluxdb || userSessions.datapointInfluxdb.length === 0) {
            globals.logger.warn('PROXY SESSIONS V1: No datapoints to write to InfluxDB');
            return;
        }

        // Data points are already in InfluxDB v1 format (plain objects)
        // Write array of measurements with retry logic
        await writeToInfluxWithRetry(
            async () => await globals.influx.writePoints(userSessions.datapointInfluxdb),
            `Proxy sessions for ${userSessions.host}/${userSessions.virtualProxy}`,
            'v1',
            userSessions.serverName
        );

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
