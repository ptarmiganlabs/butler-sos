import { Point } from '@influxdata/influxdb-client';

import globals from '../globals.js';

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

export async function postHealthMetricsToInfluxdb(serverName, host, body, serverTags) {
    // Calculate server uptime
    const formattedTime = getFormattedTime(body.started);

    // Build tags structure that will be passed to InfluxDB
    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB: Health data: Tags sent to InfluxDB: ${JSON.stringify(
            serverTags
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

    const promisesActive = body.apps.active_docs.map(
        (docID, _idx) =>
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

    const promisesLoaded = body.apps.loaded_docs.map(
        (docID, _idx) =>
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

    const promisesInMemory = body.apps.in_memory_docs.map(
        (docID, _idx) =>
            new Promise(async (resolve, _reject) => {
                await storeInMemoryDoc(docID);

                resolve();
            })
    );

    await Promise.all(promisesInMemory);

    appNamesInMemory.sort();
    sessionAppNamesInMemory.sort();

    // Only write to influuxdb if the global influx object has been initialized
    if (!globals.influx) {
        globals.logger.warn(
            'HEALTH METRICS: Influxdb object not initialized. Data will not be sent to InfluxDB'
        );
        return;
    }

    // Write the whole reading to Influxdb
    // InfluxDB 1.x
    if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
        try {
            // Write data to InfluxDB
            // Make sure to double quote app names before they are concatenated into a string
            const res = await globals.influx.writePoints([
                {
                    measurement: 'sense_server',
                    tags: serverTags,
                    fields: {
                        version: body.version,
                        started: body.started,
                        uptime: formattedTime,
                    },
                },
                {
                    measurement: 'mem',
                    tags: serverTags,
                    fields: {
                        comitted: body.mem.committed,
                        allocated: body.mem.allocated,
                        free: body.mem.free,
                    },
                },
                {
                    measurement: 'apps',
                    tags: serverTags,
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
                                ? appNamesActive.map((name) => `"${name}"`).join(',')
                                : '',
                        active_session_docs_names:
                            globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                            globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                                ? sessionAppNamesActive.map((name) => `"${name}"`).join(',')
                                : '',

                        loaded_docs: globals.config.get(
                            'Butler-SOS.influxdbConfig.includeFields.loadedDocs'
                        )
                            ? body.apps.loaded_docs
                            : '',
                        loaded_docs_names:
                            globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                            globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                                ? appNamesLoaded.map((name) => `"${name}"`).join(',')
                                : '',
                        loaded_session_docs_names:
                            globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                            globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                                ? sessionAppNamesLoaded.map((name) => `"${name}"`).join(',')
                                : '',

                        in_memory_docs: globals.config.get(
                            'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs'
                        )
                            ? body.apps.in_memory_docs
                            : '',
                        in_memory_docs_names:
                            globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                            globals.config.get(
                                'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs'
                            )
                                ? appNamesInMemory.map((name) => `"${name}"`).join(',')
                                : '',
                        in_memory_session_docs_names:
                            globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                            globals.config.get(
                                'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs'
                            )
                                ? sessionAppNamesInMemory.map((name) => `"${name}"`).join(',')
                                : '',
                        calls: body.apps.calls,
                        selections: body.apps.selections,
                    },
                },
                {
                    measurement: 'cpu',
                    tags: serverTags,
                    fields: {
                        total: body.cpu.total,
                    },
                },
                {
                    measurement: 'session',
                    tags: serverTags,
                    fields: {
                        active: body.session.active,
                        total: body.session.total,
                    },
                },
                {
                    measurement: 'users',
                    tags: serverTags,
                    fields: {
                        active: body.users.active,
                        total: body.users.total,
                    },
                },
                {
                    measurement: 'cache',
                    tags: serverTags,
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
                    tags: serverTags,
                    fields: {
                        saturated: body.saturated,
                    },
                },
            ]);
        } catch (err) {
            globals.logger.error(
                `HEALTH METRICS: Error saving health data to InfluxDB! ${err.stack}`
            );
        }

        globals.logger.verbose(
            `HEALTH METRICS: Sent health data to Influxdb for server ${serverTags.server_name}`
        );
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Only write to influuxdb if the global influxWriteApi object has been initialized
        if (!globals.influxWriteApi) {
            globals.logger.warn(
                'HEALTH METRICS: Influxdb write API object not initialized. Data will not be sent to InfluxDB'
            );
            return;
        }

        // Find writeApi for the server specified by host
        const writeApi = globals.influxWriteApi.find(
            (element) => element.serverName === serverName
        );

        // Ensure that the writeApi object was found
        if (!writeApi) {
            globals.logger.warn(
                `HEALTH METRICS: Influxdb write API object not found for host ${host}. Data will not be sent to InfluxDB`
            );
            return;
        }

        // Create a new point with the data to be written to InfluxDB
        const points = [
            new Point('sense_server')
                .stringField('version', body.version)
                .stringField('started', body.started)
                .stringField('uptime', formattedTime),

            new Point('mem')
                .floatField('comitted', body.mem.committed)
                .floatField('allocated', body.mem.allocated)
                .floatField('free', body.mem.free),

            new Point('apps')
                .intField('active_docs_count', body.apps.active_docs.length)
                .intField('loaded_docs_count', body.apps.loaded_docs.length)
                .intField('in_memory_docs_count', body.apps.in_memory_docs.length)
                .stringField(
                    'active_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? body.apps.active_docs
                        : ''
                )
                .stringField(
                    'active_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? appNamesActive.toString()
                        : ''
                )
                .stringField(
                    'active_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? sessionAppNamesActive.toString()
                        : ''
                )
                .stringField(
                    'loaded_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? body.apps.loaded_docs
                        : ''
                )
                .stringField(
                    'loaded_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? appNamesLoaded.toString()
                        : ''
                )
                .stringField(
                    'loaded_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? sessionAppNamesLoaded.toString()
                        : ''
                )
                .stringField(
                    'in_memory_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? body.apps.in_memory_docs
                        : ''
                )
                .stringField(
                    'in_memory_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? appNamesInMemory.toString()
                        : ''
                )
                .stringField(
                    'in_memory_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? sessionAppNamesInMemory.toString()
                        : ''
                )
                .uintField('calls', body.apps.calls)
                .uintField('selections', body.apps.selections),

            new Point('cpu').floatField('total', body.cpu.total),

            new Point('session')
                .uintField('active', body.session.active)
                .uintField('total', body.session.total),

            new Point('users')
                .uintField('active', body.users.active)
                .uintField('total', body.users.total),

            new Point('cache')
                .uintField('hits', body.cache.hits)
                .uintField('lookups', body.cache.lookups)
                .uintField('added', body.cache.added)
                .uintField('replaced', body.cache.replaced)
                .uintField('bytes_added', body.cache.bytes_added),

            new Point('saturated').booleanField('saturated', body.saturated),
        ];

        // Write to InfluxDB
        try {
            const res = await writeApi.writeAPI.writePoints(points);
            globals.logger.debug(`HEALTH METRICS: Wrote data to InfluxDB v2`);
        } catch (err) {
            globals.logger.error(
                `HEALTH METRICS: Error saving health data to InfluxDB v2! ${err.stack}`
            );
        }
    }
}

export async function postProxySessionsToInfluxdb(userSessions) {
    globals.logger.debug(`PROXY SESSIONS: User sessions: ${JSON.stringify(userSessions)}`);

    globals.logger.silly(
        `PROXY SESSIONS: Influxdb datapoint for server "${
            userSessions.host
        }", virtual proxy "${userSessions.virtualProxy}"": ${JSON.stringify(
            userSessions.datapointInfluxdb,
            null,
            2
        )}`
    );

    // Only write to influuxdb if the global influx object has been initialized
    if (!globals.influx) {
        globals.logger.warn(
            'PROXY SESSIONS: Influxdb object not initialized. Data will not be sent to InfluxDB'
        );
        return;
    }

    // InfluxDB 1.x
    if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
        try {
            // Data points are already in InfluxDB v1 format
            const res = await globals.influx.writePoints(userSessions.datapointInfluxdb);
        } catch (err) {
            globals.logger.error(
                `PROXY SESSIONS: Error saving user session data to InfluxDB v1! ${err.stack}`
            );
        }

        globals.logger.debug(
            `PROXY SESSIONS: Session count for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"": ${userSessions.sessionCount}`
        );
        globals.logger.debug(
            `PROXY SESSIONS: User list for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"": ${userSessions.uniqueUserList}`
        );

        globals.logger.verbose(
            `PROXY SESSIONS: Sent user session data to InfluxDB for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
        );
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Only write to influuxdb if the global influxWriteApi object has been initialized
        if (!globals.influxWriteApi) {
            globals.logger.warn(
                'HEALTH METRICS: Influxdb write API object not initialized. Data will not be sent to InfluxDB'
            );
            return;
        }

        // Find writeApi for the server specified by host
        // Separate writeApi objects are created for each server, as each server may have different tags
        const writeApi = globals.influxWriteApi.find(
            (element) => element.serverName === userSessions.serverName
        );

        // Ensure that the writeApi object was found
        if (!writeApi) {
            globals.logger.warn(
                `PROXY SESSIONS: Influxdb v2 write API object not found for host ${userSessions.host}. Data will not be sent to InfluxDB`
            );
            return;
        }

        // Write the datapoint to InfluxDB
        try {
            // Data points are already in InfluxDB v2 format
            const res = await writeApi.writeAPI.writePoints(userSessions.datapointInfluxdb);
        } catch (err) {
            globals.logger.error(
                `PROXY SESSIONS: Error saving user session data to InfluxDB v2! ${err.stack}`
            );
        }
    }
}

export async function postButlerSOSMemoryUsageToInfluxdb(memory) {
    globals.logger.debug(`MEMORY USAGE: Memory usage ${JSON.stringify(memory, null, 2)})`);

    // Get Butler version
    const butlerVersion = globals.appVersion;

    // Only write to influuxdb if the global influx object has been initialized
    if (!globals.influx) {
        globals.logger.warn(
            'MEMORY USAGE INFLUXDB: Influxdb object not initialized. Data will not be sent to InfluxDB'
        );
        return;
    }

    // InfluxDB 1.x
    if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
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

        globals.logger.silly(
            `MEMORY USAGE INFLUXDB: Influxdb datapoint for Butler SOS memory usage: ${JSON.stringify(
                datapoint,
                null,
                2
            )}`
        );

        try {
            const res = await globals.influx.writePoints(datapoint);
        } catch (err) {
            globals.logger.error(
                `MEMORY USAGE INFLUXDB: Error saving user session data to InfluxDB! ${err.stack}`
            );
        }

        globals.logger.verbose(
            'MEMORY USAGE INFLUXDB: Sent Butler SOS memory usage data to InfluxDB'
        );
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Create new write API object
        // advanced write options
        const writeOptions = {
            /* the maximum points/lines to send in a single batch to InfluxDB server */
            // batchSize: flushBatchSize + 1, // don't let automatically flush data

            /* default tags to add to every point */
            // defaultTags: {
            //     butler_sos_instance: memory.instanceTag,
            //     version: butlerVersion,
            // },

            /* maximum time in millis to keep points in an unflushed batch, 0 means don't periodically flush */
            flushInterval: 5000,

            /* maximum size of the retry buffer - it contains items that could not be sent for the first time */
            // maxBufferLines: 30_000,

            /* the count of internally-scheduled retries upon write failure, the delays between write attempts follow an exponential backoff strategy if there is no Retry-After HTTP header */
            maxRetries: 2, // do not retry writes

            // ... there are more write options that can be customized, see
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeoptions.html and
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeretryoptions.html
        };

        try {
            const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
            const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

            const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

            // Ensure that the writeApi object was found
            if (!writeApi) {
                globals.logger.warn(
                    `MEMORY USAGE INFLUXDB: Influxdb write API object not found. Data will not be sent to InfluxDB`
                );
                return;
            }

            // Create a new point with the data to be written to InfluxDB
            const point = new Point('butlersos_memory_usage')
                .tag('butler_sos_instance', memory.instanceTag)
                .tag('version', butlerVersion)
                .floatField('heap_used', memory.heapUsedMByte)
                .floatField('heap_total', memory.heapTotalMByte)
                .floatField('external', memory.externalMemoryMByte)
                .floatField('process_memory', memory.processMemoryMByte);

            // Write to InfluxDB
            try {
                const res = await writeApi.writePoint(point);
                globals.logger.debug(`MEMORY USAGE INFLUXDB: Wrote data to InfluxDB v2`);
            } catch (err) {
                globals.logger.error(
                    `MEMORY USAGE INFLUXDB: Error saving health data to InfluxDB v2! ${err.stack}`
                );
            }
        } catch (err) {
            globals.logger.error(`MEMORY USAGE INFLUXDB: Error getting write API: ${err}`);
        }
    }
}

export async function postUserEventToInfluxdb(msg) {
    globals.logger.debug(`USER EVENT INFLUXDB: ${msg})`);

    // Only write to influuxdb if the global influx object has been initialized
    if (!globals.influx) {
        globals.logger.warn(
            'USER EVENT INFLUXDB: Influxdb object not initialized. Data will not be sent to InfluxDB'
        );
        return;
    }

    let datapoint;

    // InfluxDB 1.x
    if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
        // Build datapoint for InfluxDB v1
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
                for (const item of configTags) {
                    tags[item.name] = item.value;
                }
            }

            datapoint = [
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

            globals.logger.silly(
                `USER EVENT INFLUXDB: Influxdb datapoint for Butler SOS user event: ${JSON.stringify(
                    datapoint,
                    null,
                    2
                )}`
            );
        } catch (err) {
            globals.logger.error(
                `USER EVENT INFLUXDB: Error saving user event to InfluxDB! ${err}`
            );
        }

        try {
            const res = await globals.influx.writePoints(datapoint);
        } catch (err) {
            globals.logger.error(
                `USER EVENT INFLUXDB: Error saving user event to InfluxDB! ${err}`
            );
        }

        globals.logger.verbose('USER EVENT INFLUXDB: Sent Butler SOS user event data to InfluxDB');
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Create new write API object
        // Advanced write options
        const writeOptions = {
            /* the maximum points/lines to send in a single batch to InfluxDB server */
            // batchSize: flushBatchSize + 1, // don't let automatically flush data

            /* default tags to add to every point */
            // defaultTags: {
            //     butler_sos_instance: memory.instanceTag,
            //     version: butlerVersion,
            // },

            /* maximum time in millis to keep points in an unflushed batch, 0 means don't periodically flush */
            flushInterval: 5000,

            /* maximum size of the retry buffer - it contains items that could not be sent for the first time */
            // maxBufferLines: 30_000,

            /* the count of internally-scheduled retries upon write failure, the delays between write attempts follow an exponential backoff strategy if there is no Retry-After HTTP header */
            maxRetries: 2, // do not retry writes

            // ... there are more write options that can be customized, see
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeoptions.html and
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeretryoptions.html
        };

        try {
            const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
            const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

            const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

            // Ensure that the writeApi object was found
            if (!writeApi) {
                globals.logger.warn(
                    `USER EVENT INFLUXDB: Influxdb write API object not found. Data will not be sent to InfluxDB`
                );
                return;
            }

            // Create a new point with the data to be written to InfluxDB
            const point = new Point('user_events')
                .tag('host', msg.host)
                .tag('event_action', msg.command)
                .tag('userFull', `${msg.user_directory}\\${msg.user_id}`)
                .tag('userDirectory', msg.user_directory)
                .tag('userId', msg.user_id)
                .tag('origin', msg.origin)
                .stringField('userFull', `${msg.user_directory}\\${msg.user_id}`)
                .stringField('userId', msg.user_id);

            // Add app id and name to tags if available
            if (msg?.appId) point.tag('appId', msg.appId);
            if (msg?.appName) point.tag('appName', msg.appName);

            // Add user agent info to tags if available
            if (msg?.ua?.browser?.name) point.tag('uaBrowserName', msg?.ua?.browser?.name);
            if (msg?.ua?.browser?.major)
                point.tag('uaBrowserMajorVersion', msg?.ua?.browser?.major);
            if (msg?.ua?.os?.name) point.tag('uaOsName', msg?.ua?.os?.name);
            if (msg?.ua?.os?.version) point.tag('uaOsVersion', msg?.ua?.os?.version);

            // Add custom tags from config file to payload
            if (
                globals.config.has('Butler-SOS.userEvents.tags') &&
                globals.config.get('Butler-SOS.userEvents.tags') !== null &&
                globals.config.get('Butler-SOS.userEvents.tags').length > 0
            ) {
                const configTags = globals.config.get('Butler-SOS.userEvents.tags');
                for (const item of configTags) {
                    point.tag(item.name, item.value);
                }
            }

            // Add app id and name to fields if available
            if (msg?.appId) point.stringField('appId', msg.appId);
            if (msg?.appName) point.stringField('appName', msg.appName);

            globals.logger.silly(
                `USER EVENT INFLUXDB: Influxdb datapoint for Butler SOS user event: ${JSON.stringify(
                    point,
                    null,
                    2
                )}`
            );

            // Write to InfluxDB
            try {
                const res = await writeApi.writePoint(point);
                globals.logger.debug(`USER EVENT INFLUXDB: Wrote data to InfluxDB v2`);
            } catch (err) {
                globals.logger.error(
                    `USER EVENT INFLUXDB: Error saving health data to InfluxDB v2! ${err.stack}`
                );
            }

            globals.logger.verbose(
                'USER EVENT INFLUXDB: Sent Butler SOS user event data to InfluxDB'
            );
        } catch (err) {
            globals.logger.error(`USER EVENT INFLUXDB: Error getting write API: ${err}`);
        }
    }
}

export async function postLogEventToInfluxdb(msg) {
    globals.logger.debug(`LOG EVENT INFLUXDB: ${msg})`);

    try {
        // Only write to influuxdb if the global influx object has been initialized
        if (!globals.influx) {
            globals.logger.warn(
                'LOG EVENT INFLUXDB: Influxdb object not initialized. Data will not be sent to InfluxDB'
            );
            return;
        }

        let datapoint;

        // InfluxDB 1.x
        if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
            // First prepare tags relating to the actual log event, then add tags defined in the config file
            // The config file tags can for example be used to separate data from DEV/TEST/PROD environments
            let tags;
            let fields;

            if (
                msg.source === 'qseow-engine' ||
                msg.source === 'qseow-proxy' ||
                msg.source === 'qseow-scheduler' ||
                msg.source === 'qseow-repository' ||
                msg.source === 'qseow-qix-perf'
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
                } else if (msg.source === 'qseow-qix-perf') {
                    tags = {
                        host: msg.host?.length > 0 ? msg.host : '<Unknown>',
                        level: msg.level?.length > 0 ? msg.level : '<Unknown>',
                        source: msg.source?.length > 0 ? msg.source : '<Unknown>',
                        log_row: msg.log_row?.length > 0 ? msg.log_row : '-1',
                        subsystem: msg.subsystem?.length > 0 ? msg.subsystem : '<Unknown>',
                        method: msg.method?.length > 0 ? msg.method : '<Unknown>',
                        object_type: msg.object_type?.length > 0 ? msg.object_type : '<Unknown>',
                        proxy_session_id:
                            msg.proxy_session_id?.length > 0 ? msg.proxy_session_id : '-1',
                        session_id: msg.session_id?.length > 0 ? msg.session_id : '-1',
                        event_activity_source:
                            msg.event_activity_source?.length > 0
                                ? msg.event_activity_source
                                : '<Unknown>',
                    };

                    // Tags that are empty in some cases. Only add if they are non-empty
                    if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
                    if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
                    if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
                    if (msg?.app_id?.length > 0) tags.app_id = msg.app_id;
                    if (msg?.app_name?.length > 0) tags.app_name = msg.app_name;
                    if (msg?.object_id?.length > 0) tags.object_id = msg.object_id;

                    fields = {
                        app_id: msg.app_id,
                        process_time: msg.process_time,
                        work_time: msg.work_time,
                        lock_time: msg.lock_time,
                        validate_time: msg.validate_time,
                        traverse_time: msg.traverse_time,
                        handle: msg.handle,
                        net_ram: msg.net_ram,
                        peak_ram: msg.peak_ram,
                        raw_event: JSON.stringify(msg),
                    };
                }

                // Add log event categories to tags if available
                // The msg.category array contains objects with properties 'name' and 'value'
                if (msg?.category?.length > 0) {
                    msg.category.forEach((category) => {
                        tags[category.name] = category.value;
                    });
                }

                // Add custom tags from config file to payload
                if (
                    globals.config.has('Butler-SOS.logEvents.tags') &&
                    globals.config.get('Butler-SOS.logEvents.tags') !== null &&
                    globals.config.get('Butler-SOS.logEvents.tags').length > 0
                ) {
                    const configTags = globals.config.get('Butler-SOS.logEvents.tags');
                    for (const item of configTags) {
                        tags[item.name] = item.value;
                    }
                }

                datapoint = [
                    {
                        measurement: 'log_event',
                        tags,
                        fields,
                    },
                ];

                globals.logger.silly(
                    `LOG EVENT INFLUXDB: Influxdb datapoint for Butler SOS log event: ${JSON.stringify(
                        datapoint,
                        null,
                        2
                    )}`
                );

                try {
                    globals.influx.writePoints(datapoint);
                } catch (err) {
                    globals.logger.error(
                        `LOG EVENT INFLUXDB 1: Error saving log event to InfluxDB! ${err}`
                    );
                }

                globals.logger.verbose(
                    'LOG EVENT INFLUXDB: Sent Butler SOS log event data to InfluxDB'
                );
            }
        } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
            if (
                msg.source === 'qseow-engine' ||
                msg.source === 'qseow-proxy' ||
                msg.source === 'qseow-scheduler' ||
                msg.source === 'qseow-repository' ||
                msg.source === 'qseow-qix-perf'
            ) {
                // Create new write API object
                // Advanced write options
                const writeOptions = {
                    /* the maximum points/lines to send in a single batch to InfluxDB server */
                    // batchSize: flushBatchSize + 1, // don't let automatically flush data

                    /* default tags to add to every point */
                    // defaultTags: {
                    //     butler_sos_instance: memory.instanceTag,
                    //     version: butlerVersion,
                    // },

                    /* maximum time in millis to keep points in an unflushed batch, 0 means don't periodically flush */
                    flushInterval: 5000,

                    /* maximum size of the retry buffer - it contains items that could not be sent for the first time */
                    // maxBufferLines: 30_000,

                    /* the count of internally-scheduled retries upon write failure, the delays between write attempts follow an exponential backoff strategy if there is no Retry-After HTTP header */
                    maxRetries: 2, // do not retry writes

                    // ... there are more write options that can be customized, see
                    // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeoptions.html and
                    // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeretryoptions.html
                };

                // Create new datapoint object
                let point;

                try {
                    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
                    const bucketName = globals.config.get(
                        'Butler-SOS.influxdbConfig.v2Config.bucket'
                    );

                    const writeApi = globals.influx.getWriteApi(
                        org,
                        bucketName,
                        'ns',
                        writeOptions
                    );

                    // Ensure that the writeApi object was found
                    if (!writeApi) {
                        globals.logger.warn(
                            `LOG EVENT INFLUXDB: Influxdb write API object not found. Data will not be sent to InfluxDB`
                        );
                        return;
                    }

                    if (msg.source === 'qseow-engine') {
                        // Create a new point with the data to be written to InfluxDB
                        point = new Point('log_event')
                            .tag('host', msg.host)
                            .tag('level', msg.level)
                            .tag('source', msg.source)
                            .tag('log_row', msg.log_row)
                            .tag('subsystem', msg.subsystem)
                            .stringField('message', msg.message)
                            .stringField('exception_message', msg.exception_message)
                            .stringField('command', msg.command)
                            .stringField('result_code', msg.result_code)
                            .stringField('origin', msg.origin)
                            .stringField('context', msg.context)
                            .stringField('session_id', msg.session_id)
                            .stringField('raw_event', JSON.stringify(msg));

                        // Tags that are empty in some cases. Only add if they are non-empty
                        if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
                        if (msg?.user_directory?.length > 0)
                            point.tag('user_directory', msg.user_directory);
                        if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
                        if (msg?.result_code?.length > 0) point.tag('result_code', msg.result_code);
                        if (msg?.windows_user?.length > 0)
                            point.tag('windows_user', msg.windows_user);
                        if (msg?.task_id?.length > 0) point.tag('task_id', msg.task_id);
                        if (msg?.task_name?.length > 0) point.tag('task_name', msg.task_name);
                        if (msg?.app_id?.length > 0) point.tag('app_id', msg.app_id);
                        if (msg?.app_name?.length > 0) point.tag('app_name', msg.app_name);
                        if (msg?.engine_exe_version?.length > 0)
                            point.tag('engine_exe_version', msg.engine_exe_version);
                    } else if (msg.source === 'qseow-proxy') {
                        // Create a new point with the data to be written to InfluxDB
                        point = new Point('log_event')
                            .tag('host', msg.host)
                            .tag('level', msg.level)
                            .tag('source', msg.source)
                            .tag('log_row', msg.log_row)
                            .tag('subsystem', msg.subsystem)
                            .stringField('message', msg.message)
                            .stringField('exception_message', msg.exception_message)
                            .stringField('command', msg.command)
                            .stringField('result_code', msg.result_code)
                            .stringField('origin', msg.origin)
                            .stringField('context', msg.context)
                            .stringField('raw_event', JSON.stringify(msg));

                        // Tags that are empty in some cases. Only add if they are non-empty
                        if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
                        if (msg?.user_directory?.length > 0)
                            point.tag('user_directory', msg.user_directory);
                        if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
                        if (msg?.result_code?.length > 0) point.tag('result_code', msg.result_code);
                    } else if (msg.source === 'qseow-scheduler') {
                        // Create a new point with the data to be written to InfluxDB
                        point = new Point('log_event')
                            .tag('host', msg.host)
                            .tag('level', msg.level)
                            .tag('source', msg.source)
                            .tag('log_row', msg.log_row)
                            .tag('subsystem', msg.subsystem)
                            .stringField('message', msg.message)
                            .stringField('exception_message', msg.exception_message)
                            .stringField('app_name', msg.app_name)
                            .stringField('app_id', msg.app_id)
                            .stringField('execution_id', msg.execution_id)
                            .stringField('raw_event', JSON.stringify(msg));

                        // Tags that are empty in some cases. Only add if they are non-empty
                        if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
                        if (msg?.user_directory?.length > 0)
                            point.tag('user_directory', msg.user_directory);
                        if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
                        if (msg?.task_id?.length > 0) point.tag('task_id', msg.task_id);
                        if (msg?.task_name?.length > 0) point.tag('task_name', msg.task_name);
                    } else if (msg.source === 'qseow-repository') {
                        // Create a new point with the data to be written to InfluxDB
                        point = new Point('log_event')
                            .tag('host', msg.host)
                            .tag('level', msg.level)
                            .tag('source', msg.source)
                            .tag('log_row', msg.log_row)
                            .tag('subsystem', msg.subsystem)
                            .stringField('message', msg.message)
                            .stringField('exception_message', msg.exception_message)
                            .stringField('command', msg.command)
                            .stringField('result_code', msg.result_code)
                            .stringField('origin', msg.origin)
                            .stringField('context', msg.context)
                            .stringField('raw_event', JSON.stringify(msg));

                        // Tags that are empty in some cases. Only add if they are non-empty
                        if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
                        if (msg?.user_directory?.length > 0)
                            point.tag('user_directory', msg.user_directory);
                        if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
                        if (msg?.result_code?.length > 0) point.tag('result_code', msg.result_code);
                    } else if (msg.source === 'qseow-qix-perf') {
                        // Create a new point with the data to be written to InfluxDB
                        point = new Point('log_event')
                            .tag('host', msg.host)
                            .tag('level', msg.level)
                            .tag('source', msg.source)
                            .tag('log_row', msg.log_row)
                            .tag('subsystem', msg.subsystem)
                            .tag('method', msg.method)
                            .tag('object_type', msg.object_type)
                            .tag('proxy_session_id', msg.proxy_session_id)
                            .tag('session_id', msg.session_id)
                            .tag('event_activity_source', msg.event_activity_source)
                            .stringField('app_id', msg.app_id)
                            .floatField('process_time', parseFloat(msg.process_time))
                            .floatField('work_time', parseFloat(msg.work_time))
                            .floatField('lock_time', parseFloat(msg.lock_time))
                            .floatField('validate_time', parseFloat(msg.validate_time))
                            .floatField('traverse_time', parseFloat(msg.traverse_time))
                            .stringField('handle', msg.handle)
                            .intField('net_ram', parseInt(msg.net_ram))
                            .intField('peak_ram', parseInt(msg.peak_ram))
                            .stringField('raw_event', JSON.stringify(msg));

                        // Tags that are empty in some cases. Only add if they are non-empty
                        if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
                        if (msg?.user_directory?.length > 0)
                            point.tag('user_directory', msg.user_directory);
                        if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
                        if (msg?.app_id?.length > 0) point.tag('app_id', msg.app_id);
                        if (msg?.app_name?.length > 0) point.tag('app_name', msg.app_name);
                        if (msg?.object_id?.length > 0) point.tag('object_id', msg.object_id);
                    }

                    // Add log event categories to tags if available
                    // The msg.category array contains objects with properties 'name' and 'value'
                    if (msg?.category?.length > 0) {
                        msg.category.forEach((category) => {
                            point.tag(category.name, category.value);
                        });
                    }

                    // Add custom tags from config file to payload
                    if (
                        globals.config.has('Butler-SOS.logEvents.tags') &&
                        globals.config.get('Butler-SOS.logEvents.tags') !== null &&
                        globals.config.get('Butler-SOS.logEvents.tags').length > 0
                    ) {
                        const configTags = globals.config.get('Butler-SOS.logEvents.tags');
                        for (const item of configTags) {
                            point.tag(item.name, item.value);
                        }
                    }

                    globals.logger.silly(
                        `LOG EVENT INFLUXDB: Influxdb datapoint for Butler SOS log event: ${JSON.stringify(
                            point,
                            null,
                            2
                        )}`
                    );

                    // Write to InfluxDB
                    try {
                        const res = await writeApi.writePoint(point);
                        globals.logger.debug(`LOG EVENT INFLUXDB: Wrote data to InfluxDB v2`);
                    } catch (err) {
                        globals.logger.error(
                            `LOG EVENT INFLUXDB: Error saving health data to InfluxDB v2! ${err.stack}`
                        );
                    }

                    globals.logger.verbose(
                        'LOG EVENT INFLUXDB: Sent Butler SOS log event data to InfluxDB'
                    );
                } catch (err) {
                    globals.logger.error(`LOG EVENT INFLUXDB: Error getting write API: ${err}`);
                }
            }
        }
    } catch (err) {
        globals.logger.error(`LOG EVENT INFLUXDB 2: Error saving log event to InfluxDB! ${err}`);
    }
}

// Store event count for all kinds of events in InfluxDB
export async function storeEventCountInfluxDB() {
    // Get array of log events
    const logEvents = await globals.udpEvents.getLogEvents();
    const userEvents = await globals.udpEvents.getUserEvents();

    // Debug
    globals.logger.debug(`EVENT COUNT INFLUXDB: Log events: ${JSON.stringify(logEvents, null, 2)}`);

    globals.logger.debug(
        `EVENT COUNT INFLUXDB: User events: ${JSON.stringify(userEvents, null, 2)}`
    );

    // InfluxDB 1.x
    if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
        const points = [];

        // Get measurement name to use for event counts
        const measurementName = globals.config.get(
            'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName'
        );

        // Loop through data in log events and create datapoints.
        // Add the created data points to the points array
        for (const event of logEvents) {
            const point = {
                measurement: measurementName,
                tags: {
                    event_type: 'log',
                    source: event.source,
                    host: event.host,
                    subsystem: event.subsystem,
                },
                fields: {
                    counter: event.counter,
                },
            };

            // Add static tags from config file
            if (
                globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') !==
                    null &&
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags').length > 0
            ) {
                const configTags = globals.config.get(
                    'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                );
                for (const item of configTags) {
                    point.tags[item.name] = item.value;
                }
            }

            points.push(point);
        }

        // Loop through data in user events and create datapoints.
        // Add the created data points to the points array
        for (const event of userEvents) {
            const point = {
                measurement: measurementName,
                tags: {
                    event_type: 'user',
                    source: event.source,
                    host: event.host,
                    subsystem: event.subsystem,
                },
                fields: {
                    counter: event.counter,
                },
            };

            // Add static tags from config file
            if (
                globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') !==
                    null &&
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags').length > 0
            ) {
                const configTags = globals.config.get(
                    'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                );
                for (const item of configTags) {
                    point.tags[item.name] = item.value;
                }
            }

            points.push(point);
        }

        try {
            globals.influx.writePoints(points);
        } catch (err) {
            globals.logger.error(`EVENT COUNT INFLUXDB: Error saving data to InfluxDB v1! ${err}`);
        }
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Create new write API object
        // Advanced write options
        const writeOptions = {
            /* the maximum points/lines to send in a single batch to InfluxDB server */
            // batchSize: flushBatchSize + 1, // don't let automatically flush data

            /* maximum time in millis to keep points in an unflushed batch, 0 means don't periodically flush */
            flushInterval: 5000,

            /* maximum size of the retry buffer - it contains items that could not be sent for the first time */
            // maxBufferLines: 30_000,

            /* the count of internally-scheduled retries upon write failure, the delays between write attempts follow an exponential backoff strategy if there is no Retry-After HTTP header */
            maxRetries: 2, // do not retry writes

            // ... there are more write options that can be customized, see
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeoptions.html and
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeretryoptions.html
        };

        // Create new datapoints object
        const points = [];

        try {
            const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
            const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

            const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

            // Ensure that the writeApi object was found
            if (!writeApi) {
                globals.logger.warn(
                    `EVENT COUNT INFLUXDB: Influxdb write API object not found. Data will not be sent to InfluxDB`
                );
                return;
            }

            // Get measurement name to use for event counts
            const measurementName = globals.config.get(
                'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName'
            );

            // Loop through data in log events and create datapoints.
            // Add the created data points to the points array
            for (const event of logEvents) {
                const point = new Point(measurementName)
                    .tag('event_type', 'log')
                    .tag('source', event.source)
                    .tag('host', event.host)
                    .tag('subsystem', event.subsystem)
                    .intField('counter', event.counter);

                // Add static tags from config file
                if (
                    globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                    globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') !==
                        null &&
                    globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags')
                        .length > 0
                ) {
                    const configTags = globals.config.get(
                        'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                    );
                    for (const item of configTags) {
                        point.tag(item.name, item.value);
                    }
                }

                points.push(point);
            }

            // Loop through data in user events and create datapoints.
            // Add the created data points to the points array
            for (const event of userEvents) {
                const point = new Point(measurementName)
                    .tag('event_type', 'user')
                    .tag('source', event.source)
                    .tag('host', event.host)
                    .tag('subsystem', event.subsystem)
                    .intField('counter', event.counter);

                // Add static tags from config file
                if (
                    globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                    globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') !==
                        null &&
                    globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags')
                        .length > 0
                ) {
                    const configTags = globals.config.get(
                        'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                    );
                    for (const item of configTags) {
                        point.tag(item.name, item.value);
                    }
                }

                points.push(point);
            }

            try {
                const res = await writeApi.writePoints(points);
                globals.logger.debug(`EVENT COUNT INFLUXDB: Wrote data to InfluxDB v2`);
            } catch (err) {
                globals.logger.error(
                    `EVENT COUNT INFLUXDB: Error saving health data to InfluxDB v2! ${err.stack}`
                );
            }

            globals.logger.verbose(
                'EVENT COUNT INFLUXDB: Sent Butler SOS event count data to InfluxDB'
            );
        } catch (err) {
            globals.logger.error(`EVENT COUNT INFLUXDB: Error getting write API: ${err}`);
        }
    }
}

// Store rejected event count in InfluxDB
export async function storeRejectedEventCountInfluxDB() {
    // Get array of rejected log events
    const rejectedLogEvents = await globals.rejectedEvents.getRejectedLogEvents();

    // Debug
    globals.logger.debug(
        `REJECTED EVENT COUNT INFLUXDB: Rejected log events: ${JSON.stringify(
            rejectedLogEvents,
            null,
            2
        )}`
    );

    // InfluxDB 1.x
    if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
        const points = [];

        // Get measurement name to use for rejected events
        const measurementName = globals.config.get(
            'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
        );

        // Loop through data in rejected log events and create datapoints.
        // Add the created data points to the points array
        //
        // Use counter and process_time as fields
        for (const event of rejectedLogEvents) {
            if (event.source === 'qseow-qix-perf') {
                // For each unique combination of source, appId, appName, .method and objectType,
                // write the counter and processTime properties to InfluxDB
                //
                // Use source, appId,appName,  method and objectType as tags

                const tags = {
                    source: event.source,
                    app_id: event.appId,
                    method: event.method,
                    object_type: event.objectType,
                };

                // Tags that are empty in some cases. Only add if they are non-empty
                if (event?.appName?.length > 0) {
                    tags.app_name = event.appName;
                    tags.app_name_set = 'true';
                } else {
                    tags.app_name_set = 'false';
                }

                // Add static tags from config file
                if (
                    globals.config.has(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    ) &&
                    globals.config.get(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    ) !== null &&
                    globals.config.get(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    ).length > 0
                ) {
                    const configTags = globals.config.get(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    );
                    for (const item of configTags) {
                        tags[item.name] = item.value;
                    }
                }

                const fields = {
                    counter: event.counter,
                    process_time: event.processTime,
                };

                const point = {
                    measurement: measurementName,
                    tags,
                    fields,
                };

                points.push(point);
            } else {
                const point = {
                    measurement: measurementName,
                    tags: {
                        source: event.source,
                    },
                    fields: {
                        counter: event.counter,
                    },
                };

                points.push(point);
            }
        }

        try {
            globals.influx.writePoints(points);
        } catch (err) {
            globals.logger.error(
                `REJECT LOG EVENT INFLUXDB: Error saving data to InfluxDB v1! ${err}`
            );
        }
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Create new write API object
        // Advanced write options
        const writeOptions = {
            /* the maximum points/lines to send in a single batch to InfluxDB server */
            // batchSize: flushBatchSize + 1, // don't let automatically flush data

            /* maximum time in millis to keep points in an unflushed batch, 0 means don't periodically flush */
            flushInterval: 5000,

            /* maximum size of the retry buffer - it contains items that could not be sent for the first time */
            // maxBufferLines: 30_000,

            /* the count of internally-scheduled retries upon write failure, the delays between write attempts follow an exponential backoff strategy if there is no Retry-After HTTP header */
            maxRetries: 2, // do not retry writes

            // ... there are more write options that can be customized, see
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeoptions.html and
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeretryoptions.html
        };

        // Create new datapoints object
        const points = [];

        try {
            const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
            const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

            const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

            // Ensure that the writeApi object was found
            if (!writeApi) {
                globals.logger.warn(
                    `LOG EVENT INFLUXDB: Influxdb write API object not found. Data will not be sent to InfluxDB`
                );
                return;
            }

            // Get measurement name to use for rejected events
            const measurementName = globals.config.get(
                'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
            );

            // Loop through data in rejected log events and create datapoints.
            // Add the created data points to the points array
            //
            // Use counter and process_time as fields
            for (const event of rejectedLogEvents) {
                if (event.source === 'qseow-qix-perf') {
                    // For each unique combination of source, appId, appName, .method and objectType,
                    // write the counter and processTime properties to InfluxDB
                    //
                    // Use source, appId,appName,  method and objectType as tags
                    let point = new Point(measurementName)
                        .tag('source', event.source)
                        .tag('app_id', event.appId)
                        .tag('method', event.method)
                        .tag('object_type', event.objectType)
                        .intField('counter', event.counter)
                        .floatField('process_time', event.processTime);

                    if (event?.appName?.length > 0) {
                        point.tag('app_name', event.appName).tag('app_name_set', 'true');
                    } else {
                        point.tag('app_name_set', 'false');
                    }

                    // Add static tags from config file
                    if (
                        globals.config.has(
                            'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                        ) &&
                        globals.config.get(
                            'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                        ) !== null &&
                        globals.config.get(
                            'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                        ).length > 0
                    ) {
                        const configTags = globals.config.get(
                            'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                        );
                        for (const item of configTags) {
                            point.tag(item.name, item.value);
                        }
                    }

                    points.push(point);
                } else {
                    let point = new Point(measurementName)
                        .tag('source', event.source)
                        .intField('counter', event.counter);

                    points.push(point);
                }
            }

            // Write to InfluxDB
            try {
                const res = await writeApi.writePoints(points);
                globals.logger.debug(`REJECT LOG EVENT INFLUXDB: Wrote data to InfluxDB v2`);
            } catch (err) {
                globals.logger.error(
                    `REJECTED LOG EVENT INFLUXDB: Error saving data to InfluxDB v2! ${err.stack}`
                );
            }
        } catch (err) {
            globals.logger.error(`REJECTED LOG EVENT INFLUXDB: Error getting write API: ${err}`);
        }
    }
}
