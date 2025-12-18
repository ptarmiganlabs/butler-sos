import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV3 } from '../shared/utils.js';

/**
 * Posts proxy sessions data to InfluxDB v3.
 *
 * This function takes user session data from Qlik Sense proxy and formats it for storage
 * in InfluxDB v3. It creates three measurements:
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
 * @param {Array} userSessions.datapointInfluxdb - Array of datapoints including individual sessions
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postProxySessionsToInfluxdbV3(userSessions) {
    globals.logger.debug(`PROXY SESSIONS V3: User sessions: ${JSON.stringify(userSessions)}`);

    globals.logger.silly(
        `PROXY SESSIONS V3: Data for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
    );

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Get database from config
    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    // Write all datapoints to InfluxDB
    // The datapointInfluxdb array contains summary points and individual session details
    try {
        if (userSessions.datapointInfluxdb && userSessions.datapointInfluxdb.length > 0) {
            await writeBatchToInfluxV3(
                userSessions.datapointInfluxdb,
                database,
                `Proxy sessions for ${userSessions.host}/${userSessions.virtualProxy}`,
                userSessions.host,
                globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
            );

            globals.logger.debug(
                `PROXY SESSIONS V3: Wrote ${userSessions.datapointInfluxdb.length} datapoints to InfluxDB v3`
            );
        } else {
            globals.logger.warn('PROXY SESSIONS V3: No datapoints to write to InfluxDB v3');
        }
    } catch (err) {
        // Track error count
        await globals.errorTracker.incrementError('INFLUXDB_V3_WRITE', userSessions.serverName);

        globals.logger.error(
            `PROXY SESSIONS V3: Error saving user session data to InfluxDB v3! ${globals.getErrorMessage(err)}`
        );
    }

    globals.logger.debug(
        `PROXY SESSIONS V3: Session count for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}": ${userSessions.sessionCount}`
    );
    globals.logger.debug(
        `PROXY SESSIONS V3: User list for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}": ${userSessions.uniqueUserList}`
    );

    globals.logger.verbose(
        `PROXY SESSIONS V3: Sent user session data to InfluxDB for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
    );
}
