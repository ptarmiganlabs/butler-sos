/* eslint-disable no-unused-vars */
import { validate } from 'uuid';
import parser from 'ua-parser-js';

// Load global variables and functions
import globals from '../globals.js';
import { postUserEventToInfluxdb } from './post-to-influxdb.js';
import { postUserEventToNewRelic } from './post-to-new-relic.js';
import { postUserEventToMQTT } from './post-to-mqtt.js';

// --------------------------------------------------------
// Set up UDP server for acting on Sense user activity events
// --------------------------------------------------------
export function udpInitUserActivityServer() {
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

            // First 7 fields are separated by ;
            // 8th field (message) can contain ; and single quotes. Handle with care
            const msgTmp1 = message.toString().split(';');

            // Get first 7 fields
            const msg = msgTmp1.slice(0, 7);

            // Get field 8
            // Get all text after the 7th ;
            const msgTmp2 = msgTmp1.slice(7, msgTmp1.length);
            const msgTmp3 = msgTmp2.join(';');

            // Add field 8 to the message array
            msg.push(msgTmp3);

            globals.logger.verbose(`USER EVENT: ${msg[0]} - ${msg[4]} - ${msg[6]}`);

            // Clean up the first message field (=message source)
            // Remove leading and trailing /
            msg[0] = msg[0].toLowerCase().replace('/', '');
            msg[0] = msg[0].replace('/', '');

            // Check if the message is a user event message we recognise
            // If not, log a warning and return
            // Take into account that msg[0] may be undefined, so check for that first
            if (
                msg[0] === undefined ||
                (msg[0].toLowerCase() !== 'qseow-proxy-connection' &&
                    msg[0].toLowerCase() !== 'qseow-proxy-session')
            ) {
                // Show warning, include first 512 characters of the message
                const msgShort = message.toString().substring(0, 512);
                globals.logger.warn(
                    `USER EVENT: Received message that is not a recognised user event: ${msgShort}`
                );
                return;
            }

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

            // Do we have an app id in the msgObj.context field?
            // If that field starts with /app/<guid>?... then we have an app id
            // Get that app ID and verify its a valid GUID
            if (msgObj?.context.startsWith('/app/')) {
                const appIdTmp = msgObj.context.split('?')[0];
                const appIdTmp2 = appIdTmp.split('/app/')[1];

                // Use uuid lib to verify that we have a valid GUID
                if (validate(appIdTmp2)) {
                    msgObj.appId = appIdTmp2;
                }
            }

            // Do we have an app id to app name lookup table?
            // If so, get the app name from the app id
            if (msgObj?.appId?.length > 0) {
                const app = globals?.appNames.find((element) => element.id === msgObj.appId);
                if (app?.name === undefined) {
                    msgObj.appName = '<unknown app name>';
                } else {
                    msgObj.appName = app?.name;
                }
            }

            // Is there a user agent (browser etc) in the message?
            // The user starts with UserAgent: and uses rest of the message
            if (msgObj?.message?.includes('UserAgent:')) {
                let userAgent = msgObj.message.split('UserAgent:')[1];

                // Remove leading and trailing spaces and single quotes
                userAgent = userAgent.trim();
                userAgent = userAgent.replace(/'/g, '');

                // Parse the user agent string
                const ua = parser(userAgent);

                msgObj.ua = {};
                msgObj.ua.browser = ua.browser;
                msgObj.ua.cpu = ua.cpu;
                msgObj.ua.device = ua.device;
                msgObj.ua.engine = ua.engine;
                msgObj.ua.os = ua.os;
                msgObj.ua.ua = ua.ua;
            }

            // Post to MQTT
            if (
                globals.config.get('Butler-SOS.mqttConfig.enable') === true &&
                globals.config.get('Butler-SOS.userEvents.sendToMQTT.enable')
            ) {
                globals.logger.debug('USER EVENT: Calling user sessions MQTT posting method');
                postUserEventToMQTT(msgObj);
            }

            // Post to Influxdb
            if (
                globals.config.get('Butler-SOS.influxdbConfig.enable') === true &&
                globals.config.get('Butler-SOS.userEvents.sendToInfluxdb.enable')
            ) {
                globals.logger.debug('USER EVENT: Calling user sessions Influxdb posting method');
                postUserEventToInfluxdb(msgObj);
            }

            // Post to New Relic
            if (
                globals.config.get('Butler-SOS.newRelic.enable') === true &&
                globals.config.get('Butler-SOS.userEvents.sendToNewRelic.enable')
            ) {
                globals.logger.debug('USER EVENT: Calling user event New Relic posting method');
                postUserEventToNewRelic(msgObj);
            }
        } catch (err) {
            globals.logger.error(`USER EVENT: Error processing user activity event: ${err}`);
        }
    });
}
