/* eslint-disable no-unused-vars */

// Load global variables and functions
import globals from '../globals.js';
import { postLogEventToInfluxdb } from './post-to-influxdb.js';
import { postLogEventToNewRelic } from './post-to-new-relic.js';
import { postLogEventToMQTT } from './post-to-mqtt.js';
import { categoriseLogEvent } from './log-event-categorise.js';

// --------------------------------------------------------
// Set up UDP server for acting on Sense log events
// --------------------------------------------------------
export function udpInitLogEventServer() {
    // Handler for UDP server startup event
    globals.udpServerLogEvents.socket.on('listening', (_message, _remote) => {
        const address = globals.udpServerLogEvents.socket.address();

        globals.logger.info(
            `LOG EVENT: UDP server listening on ${address.address}:${address.port}`
        );
    });

    // Handler for UDP messages relating to log events
    globals.udpServerLogEvents.socket.on('message', async (message, _remote) => {
        try {
            // >> Message parts for log messages from engine service, for Qix engine performance
            // TODO

            // >> Message parts for log messages from proxy service
            // 0:  Message type. Always /qseow-proxy/
            // 1:  Row number
            // 2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
            // 3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
            // 4:  Log level. Possible values are: WARN, ERROR, FATAL
            // 5:  Hostname where the log event occured
            // 6:  QSEoW subsystem where log event occured. Example: Service.Repository.Repository.Core.Status.ServiceStatusWorker
            // 7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
            // 8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Method: 'SendRimQrsStatusRequest'. Failed to retrieve service status from 'http://pro2-win2.lab.ptarmiganlabs.net:4444/status/'. Server host 'pro2-win2.lab.ptarmiganlabs.net'. Error message: 'Unable to connect to the remote server'
            // 9:  Exception message. Empty unless an exception/fault occured in QSEoW.
            // 10: QSEoW user directory associated with the event: Ex: TODO
            // 11: QSEoW user id associated with the event: Ex: TODO
            // 12: Command carried out when log event occured. Ex: TODO
            // 13: Result code for command. Ex: TODO
            // 14: Origin of log event. Ex: TODO
            // 15: Context where the log event occured. Ex: TODO

            // >> Message parts for log messages from repository service
            // 0:  Message type. Always /qseow-repository/
            // 1:  Row number
            // 2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
            // 3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
            // 4:  Log level. Possible values are: WARN, ERROR, FATAL
            // 5:  Hostname where the log event occured
            // 6:  QSEoW subsystem where log event occured. Example: Service.Repository.Repository.Core.Status.ServiceStatusWorker
            // 7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
            // 8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Method: 'SendRimQrsStatusRequest'. Failed to retrieve service status from 'http://pro2-win2.lab.ptarmiganlabs.net:4444/status/'. Server host 'pro2-win2.lab.ptarmiganlabs.net'. Error message: 'Unable to connect to the remote server'
            // 9:  Exception message. Empty unless an exception/fault occured in QSEoW.
            // 10: QSEoW user directory associated with the event: Ex: INTERNAL
            // 11: QSEoW user id associated with the event: Ex: System
            // 12: Command carried out when log event occured. Ex: Check service status
            // 13: Result code for command. Ex: 500
            // 14: Origin of log event. Ex: Not available
            // 15: Context where the log event occured. Ex: /qps/servicestatusworker

            // >> Message parts for log messages from scheduler service
            // 0:  Message type. Always /qseow-scheduler/
            // 1:  Row number. Ex: 14
            // 2:  ISO8601 formatted timestamp. Example: 20211109T193744.331+0100
            // 3:  Local timezone timestamp. Example: 2021-11-09 19:37:44,331
            // 4:  Log level. Possible values are: WARN, ERROR, FATAL
            // 5:  Hostname where the log event occured
            // 6:  QSEoW subsystem where log event occured. Example: System.Scheduler.Scheduler.Slave.Tasks.ReloadTask
            // 7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
            // 8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Message from ReloadProvider: Reload failed in Engine. Check engine or script logs.
            // 9:  Exception message. Empty unless an exception/fault occured in QSEoW.
            // 10: QSEoW user directory of the user associated with the event. Note: For some log events this field is empty. Field #14 is then populated instead. Ex: LAB
            // 11: QSEoW user id of the user associated with the event. Note: For some log events this field is empty. Field #14 is then populated instead. Ex: goran
            // 12: QSEoW directory and userID associated with the event. Note: For some log events this field is empty. Fields #12 and #13 are then populated instead. Ex: LAB\goran
            // 13: Task name associated with the event. Ex: Manually triggered reload of Test failing reloads 2
            // 14: App name associated with the event. Ex: Test failing reloads 2
            // 15: Task ID associated with the event. Ex: dec2a02a-1680-44ef-8dc2-e2bfb180af87
            // 16: App ID associated with the event. Ex: e7af59a0-c243-480d-9571-08727551a66f
            // 17: Execution ID associated with the event. Ex: 4831c6a5-34f6-45bb-9d40-73a6e6992670

            const msg = message.toString().split(';');
            globals.logger.debug(`LOG EVENT (raw): ${message.toString()}`);

            globals.logger.verbose(
                `LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}: ${msg[8]}`
            );

            // Check if the message is a log event message we recognise
            // If not, log a warning and return
            // Take into account that msg[0] may be undefined, so check for that first
            if (
                msg[0] === undefined ||
                (msg[0].toLowerCase() !== '/qseow-engine/' &&
                    msg[0].toLowerCase() !== '/qseow-proxy/' &&
                    msg[0].toLowerCase() !== '/qseow-repository/' &&
                    msg[0].toLowerCase() !== '/qseow-scheduler/')
            ) {
                // Show warning, include first 512 characters of the message
                const msgShort = message.toString().substring(0, 512);
                globals.logger.warn(
                    `LOG EVENT: Received message that is not a recognised log event: ${msgShort}`
                );
                return;
            }

            // Check if any of the log event sources are enabled in the configuration
            if (
                (globals.config.get('Butler-SOS.logEvents.source.engine.enable') === true &&
                    msg[0].toLowerCase() === '/qseow-engine/') ||
                (globals.config.get('Butler-SOS.logEvents.source.proxy.enable') === true &&
                    msg[0].toLowerCase() === '/qseow-proxy/') ||
                (globals.config.get('Butler-SOS.logEvents.source.repository.enable') === true &&
                    msg[0].toLowerCase() === '/qseow-repository/') ||
                (globals.config.get('Butler-SOS.logEvents.source.scheduler.enable') === true &&
                    msg[0].toLowerCase() === '/qseow-scheduler/')
            ) {
                // Clean up the first message field (=message source)
                // Remove leading and trailing /
                msg[0] = msg[0].toLowerCase().replace('/', '');
                msg[0] = msg[0].replace('/', '');

                // Build object and convert to JSON
                // Data types to be verified (set to empty string if not matching types below):
                let msgObj = {};

                // Deifne a regex for ISO8601 date format
                const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}\+\d{4}$/;

                // Define a regex for UUId format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

                if (msg[0] === 'qseow-engine') {
                    // log_row: numeric
                    // ts_iso: ISO8601 date
                    // ts_local: ISO8601 date
                    // level: string
                    // host: string
                    // subsystem: string
                    // windows_user: string
                    // message: string
                    // proxy_session_id: uuid
                    // user_directory: string
                    // user_id: string
                    // engine_ts: ISO8601 date
                    // process_id: uuid
                    // engine_exe_version: string
                    // server_started: ISO8601 date
                    // entry_type: string
                    // session_id: uuid
                    // app_id: uuid
                    msgObj = {
                        source: msg[0],
                        log_row:
                            Number.isInteger(parseInt(msg[1], 10)) && parseInt(msg[1], 10) > 0
                                ? parseInt(msg[1], 10)
                                : -1,
                        ts_iso: isoDateRegex.test(msg[2]) ? msg[2] : '',
                        ts_local: isoDateRegex.test(msg[3]) ? msg[3] : '',
                        level: msg[4],
                        host: msg[5],
                        subsystem: msg[6],
                        windows_user: msg[7],
                        message: msg[8],
                        proxy_session_id: uuidRegex.test(msg[9]) ? msg[9] : '',
                        user_directory: msg[10],
                        user_id: msg[11],
                        engine_ts: msg[12],
                        process_id: uuidRegex.test(msg[13]) ? msg[13] : '',
                        engine_exe_version: msg[14],
                        server_started: msg[15],
                        entry_type: msg[16],
                        session_id: uuidRegex.test(msg[17]) ? msg[17] : '',
                        app_id: uuidRegex.test(msg[18]) ? msg[18] : '',
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
                } else if (msg[0] === 'qseow-proxy') {
                    msgObj = {
                        source: msg[0],
                        log_row: Number.isInteger(parseInt(msg[1], 10)) ? parseInt(msg[1], 10) : -1,
                        ts_iso: isoDateRegex.test(msg[2]) ? msg[2] : '',
                        ts_local: isoDateRegex.test(msg[3]) ? msg[3] : '',
                        level: msg[4],
                        host: msg[5],
                        subsystem: msg[6],
                        windows_user: msg[7],
                        message: msg[8],
                        exception_message: msg[9],
                        user_directory: msg[10],
                        user_id: msg[11],
                        command: msg[12],
                        result_code: msg[13],
                        origin: msg[14],
                        context: msg[15],
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
                } else if (msg[0] === 'qseow-scheduler') {
                    msgObj = {
                        source: msg[0],
                        log_row: Number.isInteger(parseInt(msg[1], 10)) ? parseInt(msg[1], 10) : -1,
                        ts_iso: isoDateRegex.test(msg[2]) ? msg[2] : '',
                        ts_local: isoDateRegex.test(msg[3]) ? msg[3] : '',
                        level: msg[4],
                        host: msg[5],
                        subsystem: msg[6],
                        windows_user: msg[7],
                        message: msg[8],
                        exception_message: msg[9],
                        user_directory: msg[10],
                        user_id: msg[11],
                        user_full: msg[12],
                        task_name: msg[13],
                        app_name: msg[14],
                        task_id: uuidRegex.test(msg[15]) ? msg[15] : '',
                        app_id: uuidRegex.test(msg[16]) ? msg[16] : '',
                        execution_id: uuidRegex.test(msg[17]) ? msg[17] : '',
                    };

                    // Different log events deliver QSEoW user directory/user differently.
                    // Create fields that are consistent across all log events
                    if (
                        msgObj.user_full === '' &&
                        msgObj.user_directory !== '' &&
                        msgObj.user_id !== ''
                    ) {
                        // User directory and user id available in separate fields.
                        // Combine them into a single field
                        msgObj.user_full = `${msgObj.user_directory}\\${msgObj.user_id}`;
                    } else if (
                        msgObj.user_full !== '' &&
                        msgObj.user_directory === '' &&
                        msgObj.user_id === ''
                    ) {
                        // Combined user directory/id field is available.
                        // Split it into separamte fields
                        msgObj.user_directory = msgObj.user_full.split('\\')[0];
                        msgObj.user_id = msgObj.user_full.split('\\')[1];
                    }
                } else if (msg[0] === 'qseow-repository') {
                    msgObj = {
                        source: msg[0],
                        log_row: Number.isInteger(parseInt(msg[1], 10)) ? parseInt(msg[1], 10) : -1,
                        ts_iso: isoDateRegex.test(msg[2]) ? msg[2] : '',
                        ts_local: isoDateRegex.test(msg[3]) ? msg[3] : '',
                        level: msg[4],
                        host: msg[5],
                        subsystem: msg[6],
                        windows_user: msg[7],
                        message: msg[8],
                        exception_message: msg[9],
                        user_directory: msg[10],
                        user_id: msg[11],
                        command: msg[12],
                        result_code: msg[13],
                        origin: msg[14],
                        context: msg[15],
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

                // If message parsing was done and categorisation is enabled, categorise the log event
                if (
                    Object.keys(msgObj).length !== 0 &&
                    globals.config.get('Butler-SOS.logEvents.categorise.enable') === true
                ) {
                    // Categorise the log event based on the message content, according to rules in the config file
                    const categoryResult = categoriseLogEvent(msgObj.level, msgObj.message);
                    globals.logger.debug(
                        `LOG EVENT: Categorised log event as ${JSON.stringify(categoryResult)}`
                    );

                    // Add the categories to the log event object
                    msgObj.category = categoryResult.category;
                }

                globals.logger.debug(`LOG EVENT (json): ${JSON.stringify(msgObj, null, 2)}`);

                // Post to MQTT (if enabled)
                if (
                    globals.config.get('Butler-SOS.mqttConfig.enable') === true &&
                    globals.config.get('Butler-SOS.logEvents.sendToMQTT.enable')
                ) {
                    globals.logger.debug('LOG EVENT: Calling log event MQTT posting method');
                    postLogEventToMQTT(msgObj);
                }

                // Post to Influxdb (if enabled)
                if (
                    globals.config.get('Butler-SOS.influxdbConfig.enable') === true &&
                    globals.config.get('Butler-SOS.logEvents.sendToInfluxdb.enable')
                ) {
                    globals.logger.debug('LOG EVENT: Calling log event Influxdb posting method');
                    postLogEventToInfluxdb(msgObj);
                }

                // Post to New Relic (if enabled)
                if (
                    globals.config.get('Butler-SOS.newRelic.enable') === true &&
                    globals.config.get('Butler-SOS.logEvents.sendToNewRelic.enable')
                ) {
                    globals.logger.debug('LOG EVENT: Calling log event New Relic posting method');
                    postLogEventToNewRelic(msgObj);
                }
            }
        } catch (err) {
            globals.logger.error(`LOG EVENT: Error processing log event: ${err}`);
        }
    });
}
