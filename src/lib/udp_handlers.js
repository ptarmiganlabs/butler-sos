/* eslint-disable no-unused-vars */
/* eslint strict: ["error", "global"] */

'use strict';

// Load global variables and functions
const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');
const postToMQTT = require('./post-to-mqtt');


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

            // Is user in blacklist? 
            // If so just skip this event
            if (globals.config.has('Butler-SOS.userEvents.excludeUser') && globals.config.get('Butler-SOS.userEvents.excludeUser').length > 0) {
                let excludeList = globals.config.get('Butler-SOS.userEvents.excludeUser');
                if (excludeList.findIndex(blacklistUser => blacklistUser.directory == msg[3] && blacklistUser.userId == msg[4]) >= 0) {
                    // The user associated with the event was found in the blacklist. Return with no further action.
                    return;
                }
            }


            /**
             * InfluxDB format
             * 
             * Measurements / tags | fields
             * - session_events
             *   / host
             *   / event_action: start
             *   / event_action: stop
             *   / userFull (dir + id)
             *   / userDirectory
             *   / userId
             *   / origin
             *   | userFull
             *   | userId
             * - connection_events
             *   / host
             *   / event_action: open
             *   / event_action: close
             *   / userFull (dir + id)
             *   / userDirectory
             *   / userId
             *   / origin
             *   | userFull
             *   | userId
             */

            // Post to MQTT (if enabled)
            if (globals.config.get('Butler-SOS.mqttConfig.enableMQTT')
            && globals.config.get('Butler-SOS.userEvents.sendToMQTT.enable')
            ) {
                globals.logger.debug(
                    'USER SESSIONS: Calling user sessions MQTT posting method',
                );

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

                postToMQTT.postUserEventToMQTT(
                    msg
                );
            }

            // Post to Influxdb (if enabled)
            if (globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb')
            && globals.config.get('Butler-SOS.userEvents.sendToInfluxdb.enable')
            ) {
                globals.logger.debug(
                    'USER SESSIONS: Calling user sessions Influxdb posting method',
                );

                postToInfluxdb.postUserEventToInfluxdb(
                    msg
                );
            }


        } catch (err) {
            globals.logger.error(`USER ACTIVITY: Error processing user activity event: ${err}`);
        }
    });
}

module.exports = {
    udpInitUserActivityServer
};

