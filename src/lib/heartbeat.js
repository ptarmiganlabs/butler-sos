/* eslint-disable no-unused-vars */

const later = require('@breejs/later');
const axios = require('axios');

const callRemoteURL = function callRemoteURL(remoteURL, logger) {
    axios
        .get(remoteURL)
        .then((response) => {
            // handle success
            logger.debug(`HEARTBEAT: Sent heartbeat to ${remoteURL}`);
        })
        .catch((error) => {
            // handle error
            logger.error(`HEARTBEAT: Error sending heartbeat: ${error}`);
        });
};

function setupHeartbeatTimer(config, logger) {
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
        logger.error(`HEARTBEAT: Error ${err}`);
    }
}

module.exports = {
    setupHeartbeatTimer,
};
