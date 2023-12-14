/* eslint-disable prefer-destructuring */
/* eslint-disable no-unused-vars */
const globals = require('../globals');

const sessionAppPrefix = 'SessionApp';

function getFormattedTime(serverStarted) {
    const dateTime = Date.now();
    const timestamp = Math.floor(dateTime);

    const str = serverStarted;
    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);
    const hour = str.substring(9, 11);
    const minute = str.substring(11, 13);
    const second = str.substring(13, 15);
    const dateTimeStarted = new Date(year, month - 1, day, hour, minute, second);
    const timestampStarted = Math.floor(dateTimeStarted);

    const diff = timestamp - timestampStarted;

    // Create a new JavaScript Date object based on the timestamp
    // multiplied by 1000 so that the argument is in milliseconds, not seconds.
    const date = new Date(diff);

    const days = Math.trunc(diff / (1000 * 60 * 60 * 24));

    // Hours part from the timestamp
    const hours = date.getHours();

    // Minutes part from the timestamp
    const minutes = `0${date.getMinutes()}`;

    // Seconds part from the timestamp
    const seconds = `0${date.getSeconds()}`;

    // Will display time in 10:30:23 format
    return `${days} days, ${hours}h ${minutes.substr(-2)}m ${seconds.substr(-2)}s`;
}

async function postHealthMetricsToInfluxdb(_host, body, influxTags) {
    // Calculate server uptime
    const formattedTime = getFormattedTime(body.started);

    // Build tags structure that will be passed to InfluxDB
    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB: Health data: Tags sent to InfluxDB: ${JSON.stringify(
            influxTags
        )}`
    );

    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB: Number of apps active: ${body.apps.active_docs.length}`
    );
    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB: Number of apps loaded: ${body.apps.loaded_docs.length}`
    );
    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB: Number of apps in memory: ${body.apps.in_memory_docs.length}`
    );
    // Get app names

    let app;

    // -------------------------------
    // Get active app names
    const appNamesActive = [];
    const sessionAppNamesActive = [];

    const storeActivedDoc = function storeActivedDoc(docID) {
        // eslint-disable-next-line no-unused-vars
        return new Promise((resolve, _reject) => {
            if (docID.substring(0, sessionAppPrefix.length) === sessionAppPrefix) {
                // Session app
                globals.logger.debug(`HEALTH METRICS TO INFLUXDB: Session app is active: ${docID}`);
                sessionAppNamesActive.push(docID);
            } else {
                // Not session app
                app = globals.appNames.find((element) => element.id === docID);

                if (app) {
                    globals.logger.debug(`HEALTH METRICS TO INFLUXDB: App is active: ${app.name}`);

                    appNamesActive.push(app.name);
                } else {
                    appNamesActive.push(docID);
                }
            }

            resolve();
        });
    };

    // eslint-disable-next-line no-unused-vars
    const promisesActive = body.apps.active_docs.map(
        (docID, _idx) =>
            // eslint-disable-next-line no-unused-vars
            new Promise(async (resolve, _reject) => {
                await storeActivedDoc(docID);

                resolve();
            })
    );

    await Promise.all(promisesActive);

    appNamesActive.sort();
    sessionAppNamesActive.sort();

    // -------------------------------
    // Get loaded app names
    const appNamesLoaded = [];
    const sessionAppNamesLoaded = [];

    const storeLoadedDoc = function storeLoadedDoc(docID) {
        // eslint-disable-next-line no-unused-vars
        return new Promise((resolve, _reject) => {
            if (docID.substring(0, sessionAppPrefix.length) === sessionAppPrefix) {
                // Session app
                globals.logger.debug(`HEALTH METRICS TO INFLUXDB: Session app is loaded: ${docID}`);
                sessionAppNamesLoaded.push(docID);
            } else {
                // Not session app
                app = globals.appNames.find((element) => element.id === docID);

                if (app) {
                    globals.logger.debug(`HEALTH METRICS TO INFLUXDB: App is loaded: ${app.name}`);

                    appNamesLoaded.push(app.name);
                } else {
                    appNamesLoaded.push(docID);
                }
            }

            resolve();
        });
    };

    // eslint-disable-next-line no-unused-vars
    const promisesLoaded = body.apps.loaded_docs.map(
        (docID, _idx) =>
            // eslint-disable-next-line no-unused-vars
            new Promise(async (resolve, _reject) => {
                await storeLoadedDoc(docID);

                resolve();
            })
    );

    await Promise.all(promisesLoaded);

    appNamesLoaded.sort();
    sessionAppNamesLoaded.sort();

    // -------------------------------
    // Get in memory app names
    const appNamesInMemory = [];
    const sessionAppNamesInMemory = [];

    const storeInMemoryDoc = function storeInMemoryDoc(docID) {
        // eslint-disable-next-line no-unused-vars
        return new Promise((resolve, _reject) => {
            if (docID.substring(0, sessionAppPrefix.length) === sessionAppPrefix) {
                // Session app
                globals.logger.debug(
                    `HEALTH METRICS TO INFLUXDB: Session app is in memory: ${docID}`
                );
                sessionAppNamesInMemory.push(docID);
            } else {
                // Not session app
                app = globals.appNames.find((element) => element.id === docID);

                if (app) {
                    globals.logger.debug(
                        `HEALTH METRICS TO INFLUXDB: App is in memory: ${app.name}`
                    );

                    appNamesInMemory.push(app.name);
                } else {
                    appNamesInMemory.push(docID);
                }
            }

            resolve();
        });
    };

    // eslint-disable-next-line no-unused-vars
    const promisesInMemory = body.apps.in_memory_docs.map(
        (docID, _idx) =>
            // eslint-disable-next-line no-unused-vars
            new Promise(async (resolve, _reject) => {
                await storeInMemoryDoc(docID);

                resolve();
            })
    );

    await Promise.all(promisesInMemory);

    appNamesInMemory.sort();
    sessionAppNamesInMemory.sort();

    // Write the whole reading to Influxdb
    globals.influx
        .writePoints([
            {
                measurement: 'sense_server',
                tags: influxTags,
                fields: {
                    version: body.version,
                    started: body.started,
                    uptime: formattedTime,
                },
            },
            {
                measurement: 'mem',
                tags: influxTags,
                fields: {
                    comitted: body.mem.committed,
                    allocated: body.mem.allocated,
                    free: body.mem.free,
                },
            },
            {
                measurement: 'apps',
                tags: influxTags,
                fields: {
                    active_docs_count: body.apps.active_docs.length,
                    loaded_docs_count: body.apps.loaded_docs.length,
                    in_memory_docs_count: body.apps.in_memory_docs.length,

                    active_docs: globals.config.get(
                        'Butler-SOS.influxdbConfig.includeFields.activeDocs'
                    )
                        ? body.apps.active_docs
                        : '',
                    active_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                            ? appNamesActive.toString()
                            : '',
                    active_session_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                            ? sessionAppNamesActive.toString()
                            : '',

                    loaded_docs: globals.config.get(
                        'Butler-SOS.influxdbConfig.includeFields.loadedDocs'
                    )
                        ? body.apps.loaded_docs
                        : '',
                    loaded_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                            ? appNamesLoaded.toString()
                            : '',
                    loaded_session_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                            ? sessionAppNamesLoaded.toString()
                            : '',

                    in_memory_docs: globals.config.get(
                        'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs'
                    )
                        ? body.apps.in_memory_docs
                        : '',
                    in_memory_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                            ? appNamesInMemory.toString()
                            : '',
                    in_memory_session_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                            ? sessionAppNamesInMemory.toString()
                            : '',
                    calls: body.apps.calls,
                    selections: body.apps.selections,
                },
            },
            {
                measurement: 'cpu',
                tags: influxTags,
                fields: {
                    total: body.cpu.total,
                },
            },
            {
                measurement: 'session',
                tags: influxTags,
                fields: {
                    active: body.session.active,
                    total: body.session.total,
                },
            },
            {
                measurement: 'users',
                tags: influxTags,
                fields: {
                    active: body.users.active,
                    total: body.users.total,
                },
            },
            {
                measurement: 'cache',
                tags: influxTags,
                fields: {
                    hits: body.cache.hits,
                    lookups: body.cache.lookups,
                    added: body.cache.added,
                    replaced: body.cache.replaced,
                    bytes_added: body.cache.bytes_added,
                },
            },
            {
                measurement: 'saturated',
                tags: influxTags,
                fields: {
                    saturated: body.saturated,
                },
            },
        ])

        .then(() => {
            globals.logger.verbose(
                `HEALTH METRICS: Sent health data to Influxdb for server ${influxTags.server_name}`
            );
        })

        .catch((err) => {
            globals.logger.error(
                `HEALTH METRICS: Error saving health data to InfluxDB! ${err.stack}`
            );
        });
}

// function postProxySessionsToInfluxdb(host, virtualProxy, body, influxTags) {
function postProxySessionsToInfluxdb(userSessions) {
    globals.logger.debug(`PROXY SESSIONS: User sessions: ${JSON.stringify(userSessions)}`);

    globals.influx
        .writePoints(userSessions.datapointInfluxdb)
        .then(() => {
            globals.logger.silly(
                `PROXY SESSIONS: Influxdb datapoint for server "${
                    userSessions.host
                }", virtual proxy "${userSessions.virtualProxy}"": ${JSON.stringify(
                    userSessions.datapointInfluxdb,
                    null,
                    2
                )}`
            );

            globals.logger.debug(
                `PROXY SESSIONS: Session count for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"": ${userSessions.sessionCount}`
            );
            globals.logger.debug(
                `PROXY SESSIONS: User list for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"": ${userSessions.uniqueUserList}`
            );

            globals.logger.verbose(
                `PROXY SESSIONS: Sent user session data to InfluxDB for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
            );
        })
        .catch((err) => {
            globals.logger.error(
                `PROXY SESSIONS: Error saving user session data to InfluxDB! ${err.stack}`
            );
        });
}

function postButlerSOSMemoryUsageToInfluxdb(memory) {
    globals.logger.debug(`MEMORY USAGE: Memory usage ${JSON.stringify(memory, null, 2)})`);

    // Get Butler version
    const butlerVersion = globals.appVersion;

    const datapoint = [
        {
            measurement: 'butlersos_memory_usage',
            tags: {
                butler_sos_instance: memory.instanceTag,
                version: butlerVersion,
            },
            fields: {
                heap_used: memory.heapUsedMByte,
                heap_total: memory.heapTotalMByte,
                external: memory.externalMemoryMByte,
                process_memory: memory.processMemoryMByte,
            },
        },
    ];

    globals.influx
        .writePoints(datapoint)
        .then(() => {
            globals.logger.silly(
                `MEMORY USAGE INFLUXDB: Influxdb datapoint for Butler SOS memory usage: ${JSON.stringify(
                    datapoint,
                    null,
                    2
                )}`
            );

            globals.logger.verbose(
                'MEMORY USAGE INFLUXDB: Sent Butler SOS memory usage data to InfluxDB'
            );
        })
        .catch((err) => {
            globals.logger.error(
                `MEMORY USAGE INFLUXDB: Error saving user session data to InfluxDB! ${err.stack}`
            );
        });
}

function postUserEventToInfluxdb(msg) {
    globals.logger.debug(`USER EVENT INFLUXDB: ${msg})`);

    try {
        // First prepare tags relating to the actual user event, then add tags defined in the config file
        // The config file tags can for example be used to separate data from DEV/TEST/PROD environments
        const tags = {
            host: msg.host,
            event_action: msg.command,
            userFull: `${msg.user_directory}\\${msg.user_id}`,
            userDirectory: msg.user_directory,
            userId: msg.user_id,
            origin: msg.origin,
        };

        // Add app id and name to tags if available
        if (msg?.appId) tags.appId = msg.appId;
        if (msg?.appName) tags.appName = msg.appName;

        // Add user agent info to tags if available
        if (msg?.ua?.browser?.name) tags.uaBrowserName = msg?.ua?.browser?.name;
        if (msg?.ua?.browser?.major) tags.uaBrowserMajorVersion = msg?.ua?.browser?.major;
        if (msg?.ua?.os?.name) tags.uaOsName = msg?.ua?.os?.name;
        if (msg?.ua?.os?.version) tags.uaOsVersion = msg?.ua?.os?.version;

        // Add custom tags from config file to payload
        if (
            globals.config.has('Butler-SOS.userEvents.tags') &&
            globals.config.get('Butler-SOS.userEvents.tags') !== null &&
            globals.config.get('Butler-SOS.userEvents.tags').length > 0
        ) {
            const configTags = globals.config.get('Butler-SOS.userEvents.tags');
            // eslint-disable-next-line no-restricted-syntax
            for (const item of configTags) {
                tags[item.tag] = item.value;
            }
        }

        const datapoint = [
            {
                measurement: 'user_events',
                tags,
                fields: {
                    userFull: tags.userFull,
                    userId: tags.userId,
                },
            },
        ];

        // Add app id and name to fields if available
        if (msg?.appId) datapoint[0].fields.appId = msg.appId;
        if (msg?.appName) datapoint[0].fields.appName = msg.appName;

        globals.influx
            .writePoints(datapoint)
            .then(() => {
                globals.logger.silly(
                    `USER EVENT INFLUXDB: Influxdb datapoint for Butler SOS user event: ${JSON.stringify(
                        datapoint,
                        null,
                        2
                    )}`
                );

                globals.logger.verbose(
                    'USER EVENT INFLUXDB: Sent Butler SOS user event data to InfluxDB'
                );
            })
            .catch((err) => {
                globals.logger.error(
                    `USER EVENT INFLUXDB: Error saving user event to InfluxDB! ${err}`
                );
            });
    } catch (err) {
        globals.logger.error(`USER EVENT INFLUXDB: Error saving user event to InfluxDB! ${err}`);
    }
}

function postLogEventToInfluxdb(msg) {
    globals.logger.debug(`LOG EVENT INFLUXDB: ${msg})`);

    try {
        // First prepare tags relating to the actual log event, then add tags defined in the config file
        // The config file tags can for example be used to separate data from DEV/TEST/PROD environments
        let tags;
        let fields;

        if (
            msg.source === 'qseow-engine' ||
            msg.source === 'qseow-proxy' ||
            msg.source === 'qseow-scheduler' ||
            msg.source === 'qseow-repository'
        ) {
            if (msg.source === 'qseow-engine') {
                tags = {
                    host: msg.host,
                    level: msg.level,
                    source: msg.source,
                    log_row: msg.log_row,
                    subsystem: msg.subsystem,
                };
                // Tags that are empty in some cases. Only add if they are non-empty
                if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
                if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
                if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
                if (msg?.result_code?.length > 0) tags.result_code = msg.result_code;
                if (msg?.windows_user?.length > 0) tags.windows_user = msg.windows_user;
                if (msg?.task_id?.length > 0) tags.task_id = msg.task_id;
                if (msg?.task_name?.length > 0) tags.task_name = msg.task_name;
                if (msg?.app_id?.length > 0) tags.app_id = msg.app_id;
                if (msg?.app_name?.length > 0) tags.app_name = msg.app_name;
                if (msg?.engine_exe_version?.length > 0)
                    tags.engine_exe_version = msg.engine_exe_version;

                fields = {
                    message: msg.message,
                    exception_message: msg.exception_message,
                    command: msg.command,
                    result_code: msg.result_code,
                    origin: msg.origin,
                    context: msg.context,
                    session_id: msg.session_id,
                    raw_event: JSON.stringify(msg),
                };
            } else if (msg.source === 'qseow-proxy') {
                tags = {
                    host: msg.host,
                    level: msg.level,
                    source: msg.source,
                    log_row: msg.log_row,
                    subsystem: msg.subsystem,
                };
                // Tags that are empty in some cases. Only add if they are non-empty
                if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
                if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
                if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
                if (msg?.result_code?.length > 0) tags.result_code = msg.result_code;

                fields = {
                    message: msg.message,
                    exception_message: msg.exception_message,
                    command: msg.command,
                    result_code: msg.result_code,
                    origin: msg.origin,
                    context: msg.context,
                    raw_event: JSON.stringify(msg),
                };
            } else if (msg.source === 'qseow-scheduler') {
                tags = {
                    host: msg.host,
                    level: msg.level,
                    source: msg.source,
                    log_row: msg.log_row,
                    subsystem: msg.subsystem,
                };
                // Tags that are empty in some cases. Only add if they are non-empty
                if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
                if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
                if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
                if (msg?.task_id?.length > 0) tags.task_id = msg.task_id;
                if (msg?.task_name?.length > 0) tags.task_name = msg.task_name;

                fields = {
                    message: msg.message,
                    exception_message: msg.exception_message,
                    app_name: msg.app_name,
                    app_id: msg.app_id,
                    execution_id: msg.execution_id,
                    raw_event: JSON.stringify(msg),
                };
            } else if (msg.source === 'qseow-repository') {
                tags = {
                    host: msg.host,
                    level: msg.level,
                    source: msg.source,
                    log_row: msg.log_row,
                    subsystem: msg.subsystem,
                };
                // Tags that are empty in some cases. Only add if they are non-empty
                if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
                if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
                if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
                if (msg?.result_code?.length > 0) tags.result_code = msg.result_code;

                fields = {
                    message: msg.message,
                    exception_message: msg.exception_message,
                    command: msg.command,
                    result_code: msg.result_code,
                    origin: msg.origin,
                    context: msg.context,
                    raw_event: JSON.stringify(msg),
                };
            }

            if (
                globals.config.has('Butler-SOS.logEvents.tags') &&
                globals.config.get('Butler-SOS.logEvents.tags') !== null &&
                globals.config.get('Butler-SOS.logEvents.tags').length > 0
            ) {
                const configTags = globals.config.get('Butler-SOS.logEvents.tags');
                // eslint-disable-next-line no-restricted-syntax
                for (const item of configTags) {
                    tags[item.tag] = item.value;
                }
            }

            const datapoint = [
                {
                    measurement: 'log_event',
                    tags,
                    fields,
                },
            ];

            globals.influx
                .writePoints(datapoint)
                .then(() => {
                    globals.logger.silly(
                        `LOG EVENT INFLUXDB: Influxdb datapoint for Butler SOS log event: ${JSON.stringify(
                            datapoint,
                            null,
                            2
                        )}`
                    );

                    globals.logger.verbose(
                        'LOG EVENT INFLUXDB: Sent Butler SOS log event data to InfluxDB'
                    );
                })
                .catch((err) => {
                    globals.logger.error(
                        `LOG EVENT INFLUXDB 1: Error saving log event to InfluxDB! ${err}`
                    );
                });
        }
    } catch (err) {
        globals.logger.error(`LOG EVENT INFLUXDB 2: Error saving log event to InfluxDB! ${err}`);
    }
}

module.exports = {
    postHealthMetricsToInfluxdb,
    postProxySessionsToInfluxdb,
    postButlerSOSMemoryUsageToInfluxdb,
    postUserEventToInfluxdb,
    postLogEventToInfluxdb,
};
