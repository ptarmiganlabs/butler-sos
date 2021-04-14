/* eslint-disable no-unused-vars */
/* eslint strict: ["error", "global"] */

'use strict';

// Load global variables and functions
var globals = require('../globals');


// --------------------------------------------------------
// Set up UDP server for acting on Sense user activity events
// --------------------------------------------------------
function udpInitUserActivityServer () {
    // Handler for UDP server startup event
    globals.udpServer.userActivitySocket.on('listening', function (message, remote) {
        var address = globals.udpServer.userActivitySocket.address();

        globals.logger.info(`USER ACTIVITY: UDP server listening on ${address.address}:${address.port}`);
    });

    // Handler for UDP messages relating to user activity events
    globals.udpServer.userActivitySocket.on('message', async function (message, remote) {
        try {
            // >> Message parts
            // 0: Message type. Possible values are /proxy-connection/, /proxy-session/
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

            var msgTmp1 = message.toString().split(';'),
                msg = msgTmp1.slice(0, 7);

            globals.logger.verbose(`USER ACTIVITY: ${msg[1]}: ${msg[2]} for user ${msg[3]}/${msg[4]}`);
            globals.logger.debug(`USER ACTIVITY details: ${msg}`);

            // // Send MQTT messages
            // if (msg[2] == 'Start session') {
            //     globals.mqttClient.publish(globals.config.get('Butler-SOS.mqttConfig.sessionStartTopic'), msg[1] + ': ' + msg[3] + '/' + msg[4]);
            // } else if (msg[2] == 'Stop session') {
            //     globals.mqttClient.publish(globals.config.get('Butler-SOS.mqttConfig.sessionStopTopic'), msg[1] + ': ' + msg[3] + '/' + msg[4]);
            // } else if (msg[2] == 'Open connection') {
            //     globals.mqttClient.publish(globals.config.get('Butler-SOS.mqttConfig.connectionOpenTopic'), msg[1] + ': ' + msg[3] + '/' + msg[4]);
            // } else  if (msg[2] == 'Close connection') {
            //     globals.mqttClient.publish(globals.config.get('Butler-SOS.mqttConfig.connectionCloseTopic'), msg[1] + ': ' + msg[3] + '/' + msg[4]);
            // }
        } catch (err) {
            globals.logger.error(`USER ACTIVITY: Error processing user activity event: ${err}`);
        }
    });
}

module.exports = {
    udpInitUserActivityServer
};

