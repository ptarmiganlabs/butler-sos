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

            // >> Message parts for log messages with Qix performance information
            // 0:  Message type. Always /qseow-qix-perf/
            // 1:  Row number. Ex: 14
            // 2:  ISO8601 formatted timestamp. Example: 20211109T193744.331+0100
            // 3:  Local timezone timestamp. Example: 2021-11-09 19:37:44,331
            // 4:  Log level. Possible values are: WARN, ERROR, FATAL
            // 5:  Hostname where the log event occured
            // 6:  QSEoW subsystem where log event occured. Example: System.Scheduler.Scheduler.Slave.Tasks.ReloadTask
            // 7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
            // 8:  Proxy session ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
            // 9:  User directory of the user associated with the event. Ex: LAB
            // 10: User ID of the user associated with the event. Ex: goran
            // 11: Engine timestamp. Example: 2021-11-09T19:37:44.331+01:00
            // 12: Session ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
            // 13: Document ID (=app ID). Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
            // 14: Request ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
            // 15: Method. Ex: Global::OpenApp, Doc::GetAppLayout, GenericObject::GetLayout
            // 16: Process time in milliseconds. Ex: 123
            // 17: Work time in milliseconds. Ex: 123
            // 18: Lock time in milliseconds. Ex: 123
            // 19: Validate time in milliseconds. Ex: 123
            // 20: Traverse time in milliseconds. Ex: 123
            // 21: Handle. Ex: -1, 123
            // 22: Object ID. Ex: df68e14d-1ed0-47c9-bcb6-b37a900441d8, <Unknown>, rwPjBk
            // 23: Net RAM. Ex: 123456 bytes
            // 24: Peak RAM. Ex: 123456 byets
            // 25: Object type. Ex: <Unknown>, AppPropsList, SheetList, StoryList, VariableList, linechart, barchart, map, listbox, CurrentSelection

            const msg = message.toString().split(';');
            globals.logger.debug(`LOG EVENT (raw): ${message.toString()}`);

            // Check if the message is a log event message we recognise
            // If not, log a warning and return
            // Take into account that msg[0] may be undefined, so check for that first
            if (
                msg[0] === undefined ||
                (msg[0].toLowerCase() !== '/qseow-engine/' &&
                    msg[0].toLowerCase() !== '/qseow-proxy/' &&
                    msg[0].toLowerCase() !== '/qseow-repository/' &&
                    msg[0].toLowerCase() !== '/qseow-scheduler/' &&
                    msg[0].toLowerCase() !== '/qseow-qix-perf/')
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
                    msg[0].toLowerCase() === '/qseow-scheduler/') ||
                (globals.config.get('Butler-SOS.logEvents.source.qixPerf.enable') === true &&
                    msg[0].toLowerCase() === '/qseow-qix-perf/')
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
                    globals.logger.verbose(
                        `LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, Msg: ${msg[8]}`
                    );

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
                    globals.logger.verbose(
                        `LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, Msg: ${msg[8]}`
                    );

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
                    globals.logger.verbose(
                        `LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, Msg: ${msg[8]}`
                    );

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
                    globals.logger.verbose(
                        `LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, Msg: ${msg[8]}`
                    );

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
                } else if (msg[0] === 'qseow-qix-perf') {
                    globals.logger.verbose(
                        `LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, ${msg[9]}\\${msg[10]}, ${msg[13]}, ${msg[15]}, Object type: ${msg[25]}`
                    );

                    // Determine if the message should be handled, based on settings in the config file
                    if (
                        globals.config.get('Butler-SOS.logEvents.appPerformanceMonitor.enable') ===
                        false
                    ) {
                        globals.logger.debug(
                            'LOG EVENT: Qix performance monitoring is disabled in the configuration. Skipping event.'
                        );
                        return;
                    }

                    // Does event match filters in the config file?
                    //
                    // There are two types of filters:
                    // - "All-apps" filters. Here we start with all apps and then exclude some based on filters
                    // - App specific filters. Here we start with an empty list of apps and then include some based on filters
                    //
                    // If an event matches any of the filters, it is accepted.

                    // Get the app performance monitor filter configuration from the config file,
                    // so we don't have to read it every time we need some part of it
                    const monitorFilterConfig = globals.config.get(
                        'Butler-SOS.logEvents.appPerformanceMonitor.monitorFilter'
                    );

                    let acceptEvent = false;
                    let acceptEventAppSpecific = true;

                    const eventAppId = msg[13];
                    let eventAppName = '';
                    const eventObjectId = msg[22];
                    const eventObjectType = msg[25];
                    const eventMethod = msg[15];

                    // Should we get app name from the app ID?
                    if (
                        globals.config.get(
                            'Butler-SOS.logEvents.appPerformanceMonitor.appNameLookup.enable'
                        ) === true
                    ) {
                        // Get app name from app ID
                        const eventApp = globals.appNames.find((app) => app.id === eventAppId);

                        if (eventApp?.name) {
                            eventAppName = eventApp.name;
                        } else {
                            eventAppName = '';
                        }
                    }

                    // --------------------------------------------------------
                    // Check if data in event matches the app specific filters in the config file
                    // --------------------------------------------------------
                    // monitorFilterConfig.appSpecific is an array of objects, each with following properties:
                    // - enable: boolean
                    // - app: Array of objects, each with following properties:
                    //   - include: Array of objects, each of which has one or more of the following properties:
                    //     - appId: string
                    //     - appName: string
                    //   - objectType: Object with following properties:
                    //     - allObjectTypes: boolean
                    //     - allObjectTypesExclude: array of strings
                    //     - someObjectTypesInclude: array of strings
                    //   - appObject: Object with following properties:
                    //     - allAppObjects: boolean
                    //     - allAppObjectsExclude: array of objects, each of which has one or more of the following properties:
                    //       - objectId: string
                    //     - someAppObjectsInclude: array of objects, each of which has one or more of the following properties:
                    //       - objectId: string
                    //   - method: Objects with following properties:
                    //     - allMethods: boolean
                    //     - allMethodsExclude: array of strings
                    //     - someMethodsInclude: array of strings
                    //
                    // If the include array is empty, no apps will be accepted.
                    //
                    // If allObjectTypes is true, all object types are included, unless they are in allObjectTypesExclude.
                    // someObjectTypesInclude is ignored in this case.
                    // If allObjectTypes is false, only events matching the object types in someObjectTypesInclude are accepted.
                    //
                    // If allAppObjects is true, all objects are included, unless they are in allAppObjectsExclude.
                    // someAppObjectsInclude is ignored in this case.
                    // If allAppObjects is false, only events matching the objects in someAppObjectsInclude are accepted.
                    //
                    // If allMethods is true, all methods are included, unless they are in allMethodsExclude.
                    // someMethodsInclude is ignored in this case.
                    // If allMethods is false, only events matching the methods in someMethodsInclude are accepted.
                    //

                    // Is app specific monitoring enabled?
                    if (monitorFilterConfig.appSpecific.enable === false) {
                        globals.logger.debug(
                            'LOG EVENT: App specific monitoring is disabled in the configuration. Skipping app specific filters for this event.'
                        );
                        acceptEventAppSpecific = false;
                    }

                    if (acceptEventAppSpecific === true) {
                        // Process all app specific filters
                        // If one or more filter matches, the event is accepted
                        // If no filter matches, the event is rejected
                        for (const appFilter of monitorFilterConfig.appSpecific.app) {
                            // Check if the app ID is in the list of apps to monitor
                            // If not, skip the event
                            // The include array consists of objects with one or more of the following properties:
                            // - appId: string
                            // - appName: string
                            // If both appId and appName are present, both must match for the app to be included
                            const monitoredAppConfig = appFilter?.include?.find(
                                (appInclude) =>
                                    (appInclude?.appId === undefined ||
                                        appInclude.appId === eventAppId) &&
                                    (appInclude?.appName === undefined ||
                                        appInclude.appName === eventAppName)
                            );

                            if (monitoredAppConfig === undefined) {
                                // Event app ID does not match any app specific INCLUDE filters in the config file
                                acceptEventAppSpecific = false;
                            } else {
                                // App ID matches an app in the config file
                                if (appFilter.objectType.allObjectTypes === true) {
                                    // Check if data in event matches the EXCLUDE object type filters in the config file
                                    const excludedObjectType =
                                        appFilter.objectType?.allObjectTypesExclude?.find(
                                            (objectTypeExclude) =>
                                                objectTypeExclude === eventObjectType
                                        );
                                    if (excludedObjectType !== undefined) {
                                        // Object type matches an EXCLUDE object type in the config file
                                        acceptEventAppSpecific = false;
                                    }
                                } else {
                                    // Check if data in event matches the INCLUDE object type filters in the config file
                                    const monitoredObjectType =
                                        appFilter.objectType?.someObjectTypesInclude?.find(
                                            (objectTypeInclude) =>
                                                objectTypeInclude === eventObjectType
                                        );
                                    if (monitoredObjectType === undefined) {
                                        // Object type does not match an INCLUDE object type in the config file
                                        acceptEventAppSpecific = false;
                                    } else {
                                        // Object type matches an INCLUDE object type in the config file
                                        globals.logger.debug(
                                            'LOG EVENT: Qix performance event matches object type filters in the configuration'
                                        );
                                    }
                                }

                                // Only check object ID if the event has not been rejected so far
                                if (acceptEventAppSpecific === true) {
                                    if (appFilter.appObject.allAppObjects === true) {
                                        // Check if data in event matches the EXCLUDE object ID filters in the config file
                                        const excludedAppObject =
                                            appFilter.appObject?.allAppObjectsExclude?.find(
                                                (appObjectExclude) =>
                                                    appObjectExclude?.objectId === eventObjectId
                                            );
                                        if (excludedAppObject !== undefined) {
                                            // Object ID matches an EXCLUDE object ID in the config file
                                            acceptEventAppSpecific = false;
                                        }
                                    } else {
                                        // Check if data in event matches the INCLUDE object ID filters in the config file
                                        const monitoredAppObject =
                                            appFilter.appObject?.someAppObjectsInclude?.find(
                                                (appObjectInclude) =>
                                                    appObjectInclude?.objectId === eventObjectId
                                            );
                                        if (monitoredAppObject === undefined) {
                                            // Object ID does not match an INCLUDE object ID in the config file
                                            acceptEventAppSpecific = false;
                                        }
                                    }
                                }

                                // Only check methods if the event has not been rejected so far
                                if (acceptEventAppSpecific === true) {
                                    if (appFilter.method.allMethods === true) {
                                        // Check if data in event matches the EXCLUDE method filters in the config file
                                        const excludedMethod =
                                            appFilter.method?.allMethodsExclude?.find(
                                                (methodExclude) => methodExclude === eventMethod
                                            );
                                        if (excludedMethod !== undefined) {
                                            // Method matches an EXCLUDE method in the config file
                                            acceptEventAppSpecific = false;
                                        }
                                    } else {
                                        // Check if data in event matches the INCLUDE method filters in the config file
                                        const monitoredMethod =
                                            appFilter.method?.someMethodsInclude?.find(
                                                (methodInclude) => methodInclude === eventMethod
                                            );
                                        if (monitoredMethod === undefined) {
                                            // Method does not match an INCLUDE method in the config file
                                            acceptEventAppSpecific = false;
                                        } else {
                                            // Method matches an INCLUDE method in the config file
                                            globals.logger.debug(
                                                'LOG EVENT: Qix performance event matches method filters in the configuration'
                                            );
                                        }
                                    }
                                }
                            }
                        }

                        // Done checking if event matches app-specific filters in the config file

                        // Match on app specific filters?
                        if (acceptEventAppSpecific === true) {
                            globals.logger.debug(
                                'LOG EVENT: Qix performance event matches app-specific filters in the configuration'
                            );
                        }
                    } else {
                        acceptEventAppSpecific = false;
                        globals.logger.debug(
                            'LOG EVENT: Qix performance event does not match app-specific filters in the configuration. Skipping app specific filters for this event.'
                        );
                    }

                    // --------------------------------------------------------
                    // Check if data in event matches the "all apps" filters in the config file
                    // Only do this if the event has not been accepted so far
                    // --------------------------------------------------------
                    // monitorFilterConfig.allApps is an array of objects, each with following properties:
                    // - enable: boolean
                    // - appExclude: array of objects, each of which has one or more of the following properties:
                    //   - appId: string
                    //   - appName: string
                    // - objectType: Objects with following properties:
                    //   - allObjectTypes: boolean
                    //   - allObjectTypesExclude: array of strings
                    //   - someObjectTypesInclude: array of strings
                    // - method: Objects with following properties:
                    //   - allMethods: boolean
                    //   - allMethodsExclude: array of strings
                    //   - someMethodsInclude: array of strings
                    //
                    // If appExclude is empty, all apps are included.
                    // If appExclude has objects, only apps not in appExclude are included.
                    // Matching is inclusive, i.e. if an object in the appExclude array has both appId and appName, both must match for the app to be excluded.
                    //
                    // If objectType.allObjectTypes is true, all object types are included, unless they are in allObjectTypesExclude.
                    // someObjectTypesInclude is ignored in this case.
                    // If objectType.allObjectTypes is false, only object types in someObjectTypesInclude are included.
                    //
                    // If method.allMethods is true, all methods are included, unless they are in allMethodsExclude.
                    // someMethodsInclude is ignored in this case.
                    // If method.allMethods is false, only methods in someMethodsInclude are included.
                    //

                    let acceptEventAllApps = true;

                    // Check if data in event matches the all-app filters in the config file
                    if (monitorFilterConfig.allApps.enable === false) {
                        globals.logger.debug(
                            'LOG EVENT: All-apps monitoring is disabled in the configuration. Skipping all-app filters for this event.'
                        );
                        acceptEventAllApps = false;
                    } else if (
                        acceptEventAppSpecific === false &&
                        monitorFilterConfig.allApps.enable === true
                    ) {
                        // Check if data in event matches the EXCLUDE app filters in the config file
                        if (monitorFilterConfig.allApps.appExclude?.length > 0) {
                            // Any matching appExclude object will cause the event to be rejected
                            // The appExclude array consists of objects with one or more of the following properties:
                            // - appId: string
                            // - appName: string
                            // If both appId and appName are present, both must match for the app to be excluded
                            const excludedApp = monitorFilterConfig.allApps?.appExclude.find(
                                (appExclude) =>
                                    (appExclude?.appId === undefined ||
                                        appExclude.appId === eventAppId) &&
                                    (appExclude?.appName === undefined ||
                                        appExclude.appName === eventAppName)
                            );
                            if (excludedApp !== undefined) {
                                // App ID matches an app in the config file
                                acceptEventAllApps = false;
                            }
                        }

                        // Only check object type if the event has not been rejected so far
                        if (acceptEventAllApps === true) {
                            if (monitorFilterConfig.allApps.objectType.allObjectTypes === true) {
                                // Check if data in event matches the EXCLUDE object type filters in the config file
                                const excludedObjectType =
                                    monitorFilterConfig.allApps.objectType?.allObjectTypesExclude?.find(
                                        (objectTypeExclude) => objectTypeExclude === eventObjectType
                                    );
                                if (excludedObjectType !== undefined) {
                                    // Object type matches an object type in the config file
                                    acceptEventAllApps = false;
                                }
                            } else {
                                // Check if data in event matches the INCLUDE object type filters in the config file
                                const monitoredObjectType =
                                    monitorFilterConfig.allApps.objectType?.someObjectTypesInclude?.find(
                                        (objectTypeInclude) => objectTypeInclude === eventObjectType
                                    );
                                if (monitoredObjectType === undefined) {
                                    // Object type does not match an object type in the config file
                                    acceptEventAllApps = false;
                                }
                            }
                        }

                        // Only check methods if the event has not been rejected so far
                        if (acceptEventAllApps === true) {
                            if (monitorFilterConfig.allApps.method.allMethods === true) {
                                // Check if data in event matches the EXCLUDE method filters in the config file
                                const excludedMethod =
                                    monitorFilterConfig.allApps.method?.allMethodsExclude?.find(
                                        (methodExclude) => methodExclude === eventMethod
                                    );
                                if (excludedMethod !== undefined) {
                                    // Method matches a method in the config file
                                    acceptEventAllApps = false;
                                }
                            } else {
                                // Check if data in event matches the INCLUDE method filters in the config file
                                const monitoredMethod =
                                    monitorFilterConfig.allApps.method?.someMethodsInclude?.find(
                                        (methodInclude) => methodInclude === eventMethod
                                    );
                                if (monitoredMethod === undefined) {
                                    // Method does not match a method in the config file
                                    acceptEventAllApps = false;
                                }
                            }
                        }

                        // Match on all-app filters?
                        if (acceptEventAllApps === true) {
                            acceptEvent = true; // Event matches global filters
                            globals.logger.debug(
                                'LOG EVENT: Qix performance event matches global filters in the configuration'
                            );
                        }
                    }

                    // Was event accepted?
                    if (acceptEventAppSpecific === false && acceptEventAllApps === false) {
                        acceptEvent === false;
                        globals.logger.debug(
                            'LOG EVENT: Qix performance event does not match filters in the configuration. Skipping event.'
                        );
                        return;
                    } else {
                        acceptEvent = true;
                    }

                    // Event matches filters in the configuration. Continue.
                    // Build the event object
                    msgObj = {
                        source: msg[0],
                        log_row: Number.isInteger(parseInt(msg[1], 10)) ? parseInt(msg[1], 10) : -1,
                        ts_iso: msg[2],
                        ts_local: msg[3],
                        // ts_iso: isoDateRegex.test(msg[2]) ? msg[2] : '',
                        // ts_local: isoDateRegex.test(msg[3]) ? msg[3] : '',
                        level: msg[4],
                        host: msg[5],
                        subsystem: msg[6],
                        windows_user: msg[7],
                        proxy_session_id: uuidRegex.test(msg[8]) ? msg[8] : '',
                        user_directory: msg[9],
                        user_id: msg[10],
                        engine_ts: msg[11],
                        session_id: uuidRegex.test(msg[12]) ? msg[12] : '',
                        app_id: uuidRegex.test(msg[13]) ? msg[13] : '',
                        app_name: eventAppName,
                        request_id: msg[14], // Request ID is an integer >= 0, set to -99 otherwise
                        method: msg[15],
                        // Processtime in float milliseconds
                        process_time: parseFloat(msg[16]),
                        work_time: parseFloat(msg[17]),
                        lock_time: parseFloat(msg[18]),
                        validate_time: parseFloat(msg[19]),
                        traverse_time: parseFloat(msg[20]),
                        // Handle is either -1 or a number. Set to -99 if not a number
                        handle: Number.isInteger(parseInt(msg[21], 10))
                            ? parseInt(msg[21], 10)
                            : -99,
                        object_id: msg[22],
                        // Positive integer, set to -1 if not am integer >= 0
                        net_ram:
                            Number.isInteger(parseInt(msg[23], 10)) && parseInt(msg[23], 10) >= 0
                                ? parseInt(msg[23], 10)
                                : -1,
                        peak_ram:
                            Number.isInteger(parseInt(msg[24], 10)) && parseInt(msg[24], 10) >= 0
                                ? parseInt(msg[24], 10)
                                : -1,
                        object_type: msg[25],
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
