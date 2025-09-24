import later from '@breejs/later';
import axios from 'axios';
import globals from '../globals.js';

/**
 * Sends a heartbeat GET request to a remote URL.
 *
 * @param {string} remoteURL - The URL to send the heartbeat request to
 * @param {object} logger - Logger object for logging success or errors
 * @returns {void}
 */
const callRemoteURL = function callRemoteURL(remoteURL, logger) {
    axios
        .get(remoteURL)
        .then((response) => {
            // handle success
            logger.debug(`HEARTBEAT: Sent heartbeat to ${remoteURL}`);
        })
        .catch((error) => {
            // Heartbeat failed
            logger.error(`HEARTBEAT: Error sending heartbeat: ${globals.getErrorMessage(error)}`);
        });
};

/**
 * Sets up a scheduled timer for sending heartbeat requests to a remote URL.
 *
 * This function configures a scheduled timer based on the frequency specified in the
 * configuration. It also performs an initial heartbeat request immediately.
 *
 * @param {object} config - Configuration object with heartbeat settings
 * @param {object} logger - Logger object for logging debug info and errors
 * @returns {void}
 */
export function setupHeartbeatTimer(config, logger) {
    try {
        logger.debug(
            `HEARTBEAT: Setting up heartbeat to remote: ${config.get(
                'Butler-SOS.heartbeat.remoteURL'
            )}`
        );

        const sched = later.parse.text(config.get('Butler-SOS.heartbeat.frequency'));
        const t = later.setInterval(() => {
            callRemoteURL(config.get('Butler-SOS.heartbeat.remoteURL'), logger);
        }, sched);

        // Do an initial ping to the remote URL
        callRemoteURL(config.get('Butler-SOS.heartbeat.remoteURL'), logger);
    } catch (err) {
        logger.error(`HEARTBEAT: Error ${globals.getErrorMessage(err)}`);
    }
}
