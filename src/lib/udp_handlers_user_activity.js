/* eslint-disable no-unused-vars */

// Load global variables and functions
const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');
const postToNewRelic = require('./post-to-new-relic');
const postToMQTT = require('./post-to-mqtt');

// --------------------------------------------------------
// Set up UDP server for acting on Sense user activity events
// --------------------------------------------------------
function udpInitUserActivityServer() {
    // Handler for UDP server startup event
    globals.udpServerUserActivity.socket.on('listening', (_message, _remote) => {
        const address = globals.udpServerUserActivity.socket.address();

        globals.logger.info(
            `USER EVENT: UDP server listening on ${address.address}:${address.port}`
        );
    });

    // Handler for UDP messages relating to user activity events
    globals.udpServerUserActivity.socket.on('message', async (message, _remote) => {
        try {
            // >> Message parts for user activity log messages from proxy service
            // 0: Message type. Possible values are /qseow-proxy-connection/, /qseow-proxy-session/
            // 1: Host
            // 2: Command
            // 3: User directory
            // 4: user ID
            // 5: Origin
            // 6: Context
            // 7: Message. Can contain single quotes and semicolon - handle with care

            // >> Parameter 2 (command):
            // Start session
            // Stop session
            // Open connection
            // Close connection

            globals.logger.debug(`USER EVENT (raw): ${message.toString()}`);

            const msgTmp1 = message.toString().split(';');
            const msg = msgTmp1.slice(0, 7);

            globals.logger.verbose(`USER EVENT: ${msg[0]} - ${msg[4]} - ${msg[6]}`);

            // console.log('--------------------------------------------------');
            // console.log(`USER: ${msg}`);
            // console.log(`${msg[0]} - ${msg[4]} - ${msg[6]}`);

            // Clean up the first message field (=message source)
            // Remove leading and trailing /
            msg[0] = msg[0].toLowerCase().replace('/', '');
            msg[0] = msg[0].replace('/', '');

            // Build object and convert to JSON
            let msgObj;
            if (msg[0] === 'qseow-proxy-connection' || msg[0] === 'qseow-proxy-session') {
                msgObj = {
                    messageType: msg[0],
                    host: msg[1],
                    command: msg[2],
                    user_directory: msg[3],
                    user_id: msg[4],
                    origin: msg[5],
                    context: msg[6],
                    message: msg[7],
                };

                // Different log events deliver QSEoW user directory/user differently.
                // Create fields that are consistent across all log events
                if (msgObj.user_directory !== '' && msgObj.user_id !== '') {
                    // User directory and user id available in separate fields.
                    // Combine them into a single field
                    msgObj.user_full = `${msgObj.user_directory}\\${msgObj.user_id}`;
                } else {
                    msgObj.user_full = '';
                }
            }

            globals.logger.debug(`USER EVENT (json): ${JSON.stringify(msgObj, null, 2)}`);

            // Is user in blacklist?
            // If so skip this event
            if (
                globals.config.has('Butler-SOS.userEvents.excludeUser') &&
                globals.config.get('Butler-SOS.userEvents.excludeUser') !== null &&
                globals.config.get('Butler-SOS.userEvents.excludeUser').length > 0
            ) {
                const excludeList = globals.config.get('Butler-SOS.userEvents.excludeUser');
                if (
                    excludeList.findIndex(
                        (blacklistUser) =>
                            blacklistUser.directory === msgObj.user_directory &&
                            blacklistUser.userId === msgObj.user_id
                    ) >= 0
                ) {
                    // The user associated with the event was found in the blacklist. Return with no further action.
                    return;
                }
            }

            // Post to MQTT
            if (
                ((globals.config.has('Butler-SOS.mqttConfig.enableMQTT') &&
                    globals.config.get('Butler-SOS.mqttConfig.enableMQTT') === true) ||
                    (globals.config.has('Butler-SOS.mqttConfig.enable') &&
                        globals.config.get('Butler-SOS.mqttConfig.enable') === true)) &&
                globals.config.get('Butler-SOS.userEvents.sendToMQTT.enable')
            ) {
                globals.logger.debug('USER EVENT: Calling user sessions MQTT posting method');
                postToMQTT.postUserEventToMQTT(msgObj);
            }

            // Post to Influxdb
            if (
                ((globals.config.has('Butler-SOS.influxdbConfig.enableInfluxdb') &&
                    globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb') === true) ||
                    (globals.config.has('Butler-SOS.influxdbConfig.enable') &&
                        globals.config.get('Butler-SOS.influxdbConfig.enable') === true)) &&
                globals.config.get('Butler-SOS.userEvents.sendToInfluxdb.enable')
            ) {
                globals.logger.debug('USER EVENT: Calling user sessions Influxdb posting method');
                postToInfluxdb.postUserEventToInfluxdb(msgObj);
            }

            // Post to New Relic
            if (
                globals.config.has('Butler-SOS.newRelic.enable') &&
                globals.config.get('Butler-SOS.newRelic.enable') === true &&
                globals.config.get('Butler-SOS.userEvents.sendToNewRelic.enable')
            ) {
                globals.logger.debug('USER EVENT: Calling user event New Relic posting method');
                postToNewRelic.postUserEventToNewRelic(msgObj);
            }
        } catch (err) {
            globals.logger.error(`USER EVENT: Error processing user activity event: ${err}`);
        }
    });
}

module.exports = {
    udpInitUserActivityServer,
};
