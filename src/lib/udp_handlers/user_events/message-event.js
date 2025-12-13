import { validate } from 'uuid';
import { UAParser } from 'ua-parser-js';

// Load global variables and functions
import globals from '../../../globals.js';
import { sanitizeField } from '../../udp-queue-manager.js';
import { postUserEventToInfluxdb } from '../../influxdb/index.js';
import { postUserEventToNewRelic } from '../../post-to-new-relic.js';
import { postUserEventToMQTT } from '../../post-to-mqtt.js';

/**
 * Handler for UDP messages relating to user events from Qlik Sense Proxy service.
 *
 * This function processes incoming UDP messages containing user activity information,
 * parses the message format, extracts relevant information such as user, app, browser details,
 * and forwards the processed data to configured destinations (MQTT, InfluxDB, New Relic).
 *
 * Message format expected:
 * - Field 0: Message type (/qseow-proxy-connection/ or /qseow-proxy-session/)
 * - Field 1: Host
 * - Field 2: Command (Start session, Stop session, Open connection, Close connection)
 * - Field 3: User directory
 * - Field 4: User ID
 * - Field 5: Origin
 * - Field 6: Context
 * - Field 7: Message (may contain UserAgent information)
 *
 * @param {Buffer} message - The raw UDP message buffer
 * @param {object} _remote - Information about the remote sender (unused)
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export async function messageEventHandler(message, _remote) {
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

        globals.logger.silly(`USER EVENT (raw): ${message.toString()}`);

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

            // Is logging of event counts enabled?
            if (globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.enable') === true) {
                // Increase counter for log events
                await globals.udpEvents.addUserEvent({
                    source: 'Unknown',
                    host: 'Unknown',
                    subsystem: 'Unknown',
                });
            }

            return;
        }

        // Add counter for received user events
        // Is logging of event counts enabled?
        if (globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.enable') === true) {
            globals.logger.debug(
                `USER EVENT: Received message that is a recognised user event: ${msg[0]}`
            );

            // Increase counter for user events
            // Make source lower case, also remove leading and trailing /
            let source = msg[0].toLowerCase().replace('/', '');
            source = source.replace('/', '');

            await globals.udpEvents.addUserEvent({
                source,
                host: msg[1],
                subsystem: msg[5],
            });
        }

        // Build object and convert to JSON
        let msgObj;
        if (msg[0] === 'qseow-proxy-connection' || msg[0] === 'qseow-proxy-session') {
            msgObj = {
                messageType: sanitizeField(msg[0], 100),
                host: sanitizeField(msg[1], 100),
                command: sanitizeField(msg[2], 100),
                user_directory: sanitizeField(msg[3], 100),
                user_id: sanitizeField(msg[4], 100),
                origin: sanitizeField(msg[5], 200),
                context: sanitizeField(msg[6], 500),
                message: sanitizeField(msg[7], 1000),
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

        // Log the user event object for debugging and testing
        globals.logger.debug('USER EVENT (json):', msgObj);

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
            const ua = UAParser(userAgent);

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
            // Ensure we call the postUserEventToMQTT function
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
        globals.logger.error(
            `USER EVENT: Error processing user activity event: ${globals.getErrorMessage(err)}`
        );
    }
}
