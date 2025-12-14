import { Point } from '@influxdata/influxdb-client';
import { Point as Point3 } from '@influxdata/influxdb3-client';

import globals from '../globals.js';
import { logError } from './log-error.js';

const sessionAppPrefix = 'SessionApp';
const MIN_TIMESTAMP_LENGTH = 15;

/**
 * Calculates and formats the uptime of a Qlik Sense engine.
 *
 * This function takes the server start time from the engine healthcheck API
 * and calculates how long the server has been running, returning a formatted string.
 *
 * @param {string} serverStarted - The server start time in format "YYYYMMDDThhmmss"
 * @returns {string} A formatted string representing uptime (e.g. "5 days, 3h 45m 12s")
 */
export function getFormattedTime(serverStarted) {
    // Handle invalid or empty input
    if (
        !serverStarted ||
        typeof serverStarted !== 'string' ||
        serverStarted.length < MIN_TIMESTAMP_LENGTH
    ) {
        return '';
    }

    const dateTime = Date.now();
    const timestamp = Math.floor(dateTime);

    const str = serverStarted;
    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);
    const hour = str.substring(9, 11);
    const minute = str.substring(11, 13);
    const second = str.substring(13, 15);

    // Validate date components
    if (
        isNaN(year) ||
        isNaN(month) ||
        isNaN(day) ||
        isNaN(hour) ||
        isNaN(minute) ||
        isNaN(second)
    ) {
        return '';
    }

    const dateTimeStarted = new Date(year, month - 1, day, hour, minute, second);

    // Check if the date is valid
    if (isNaN(dateTimeStarted.getTime())) {
        return '';
    }

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

/**
 * Posts health metrics data from Qlik Sense to InfluxDB.
 *
 * This function processes health data from the Sense engine's healthcheck API and
 * formats it for storage in InfluxDB. It handles various metrics including:
 * - CPU usage
 * - Memory usage
 * - Cache metrics
 * - Active/loaded/in-memory apps
 * - Session counts
 * - User counts
 *
 * @param {string} serverName - The name of the Qlik Sense server
 * @param {string} host - The hostname or IP of the Qlik Sense server
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @param {object} serverTags - Tags to associate with the metrics
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
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

    /**
     * Stores a document ID in either the sessionAppNamesActive or appNamesActive arrays
     *
     * @param {string} docID - The ID of the document
     * @returns {Promise<void>} Promise that resolves when the document ID has been processed
     */
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

    /**
     * Stores a loaded app name in memory.
     *
     * @function storeLoadedDoc
     * @param {string} docID - The ID of the app to store.
     * @returns {Promise} - Resolves when the docID has been stored.
     */
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

    /**
     * Stores a document ID in either the sessionAppNamesInMemory or appNamesInMemory arrays.
     *
     * @function storeInMemoryDoc
     * @param {string} docID - The ID of the document to store.
     * @returns {Promise<void>} Promise that resolves when the document ID has been processed.
     */
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
                `HEALTH METRICS: Error saving health data to InfluxDB! ${globals.getErrorMessage(err)}`
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
                .intField('added', body.cache.added)
                .intField('replaced', body.cache.replaced)
                .intField('bytes_added', body.cache.bytes_added),

            new Point('saturated').booleanField('saturated', body.saturated),
        ];

        // Write to InfluxDB
        try {
            const res = await writeApi.writeAPI.writePoints(points);
            globals.logger.debug(`HEALTH METRICS: Wrote data to InfluxDB v2`);
        } catch (err) {
            globals.logger.error(
                `HEALTH METRICS: Error saving health data to InfluxDB v2! ${globals.getErrorMessage(err)}`
            );
        }
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
        // Only write to InfluxDB if the global influxWriteApi object has been initialized
        if (!globals.influxWriteApi) {
            globals.logger.warn(
                'HEALTH METRICS: Influxdb write API object not initialized. Data will not be sent to InfluxDB'
            );
            return;
        }

        // Find writeApi for the server specified by serverName
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

        // Get database from config
        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        // Create a new point with the data to be written to InfluxDB v3
        const points = [
            new Point3('sense_server')
                .setStringField('version', body.version)
                .setStringField('started', body.started)
                .setStringField('uptime', formattedTime),

            new Point3('mem')
                .setFloatField('comitted', body.mem.committed)
                .setFloatField('allocated', body.mem.allocated)
                .setFloatField('free', body.mem.free),

            new Point3('apps')
                .setIntegerField('active_docs_count', body.apps.active_docs.length)
                .setIntegerField('loaded_docs_count', body.apps.loaded_docs.length)
                .setIntegerField('in_memory_docs_count', body.apps.in_memory_docs.length)
                .setStringField(
                    'active_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? body.apps.active_docs
                        : ''
                )
                .setStringField(
                    'active_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? appNamesActive.toString()
                        : ''
                )
                .setStringField(
                    'active_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? sessionAppNamesActive.toString()
                        : ''
                )
                .setStringField(
                    'loaded_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? body.apps.loaded_docs
                        : ''
                )
                .setStringField(
                    'loaded_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? appNamesLoaded.toString()
                        : ''
                )
                .setStringField(
                    'loaded_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? sessionAppNamesLoaded.toString()
                        : ''
                )
                .setStringField(
                    'in_memory_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? body.apps.in_memory_docs
                        : ''
                )
                .setStringField(
                    'in_memory_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? appNamesInMemory.toString()
                        : ''
                )
                .setStringField(
                    'in_memory_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? sessionAppNamesInMemory.toString()
                        : ''
                )
                .setIntegerField('calls', body.apps.calls)
                .setIntegerField('selections', body.apps.selections),

            new Point3('cpu').setIntegerField('total', body.cpu.total),

            new Point3('session')
                .setIntegerField('active', body.session.active)
                .setIntegerField('total', body.session.total),

            new Point3('users')
                .setIntegerField('active', body.users.active)
                .setIntegerField('total', body.users.total),

            new Point3('cache')
                .setIntegerField('hits', body.cache.hits)
                .setIntegerField('lookups', body.cache.lookups)
                .setIntegerField('added', body.cache.added)
                .setIntegerField('replaced', body.cache.replaced)
                .setIntegerField('bytes_added', body.cache.bytes_added),

            new Point3('saturated').setBooleanField('saturated', body.saturated),
        ];

        // Write to InfluxDB
        try {
            for (const point of points) {
                await globals.influx.write(point.toLineProtocol(), database);
            }
            globals.logger.debug(`HEALTH METRICS: Wrote data to InfluxDB v3`);
        } catch (err) {
            globals.logger.error(
                `HEALTH METRICS: Error saving health data to InfluxDB v3! ${globals.getErrorMessage(err)}`
            );
        }
    }
}

/**
 * Posts proxy sessions data to InfluxDB.
 *
 * This function takes user session data from Qlik Sense proxy and formats it for storage
 * in InfluxDB. It handles different versions of InfluxDB (1.x and 2.x) and includes
 * error handling with detailed logging.
 *
 * @param {object} userSessions - User session data containing information about active sessions
 * @param {string} userSessions.host - The hostname of the server
 * @param {string} userSessions.virtualProxy - The virtual proxy name
 * @param {object[]} userSessions.datapointInfluxdb - Data points formatted for InfluxDB
 * @param {string} [userSessions.serverName] - Server name (for InfluxDB v2)
 * @param {number} [userSessions.sessionCount] - Number of sessions
 * @param {string[]} [userSessions.uniqueUserList] - List of unique users
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
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
                `PROXY SESSIONS: Error saving user session data to InfluxDB v1! ${globals.getErrorMessage(err)}`
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
                `PROXY SESSIONS: Error saving user session data to InfluxDB v2! ${globals.getErrorMessage(err)}`
            );
        }

        globals.logger.verbose(
            `PROXY SESSIONS: Sent user session data to InfluxDB for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"`
        );
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
        // Only write to InfluxDB if the global influxWriteApi object has been initialized
        if (!globals.influxWriteApi) {
            globals.logger.warn(
                'PROXY SESSIONS: Influxdb write API object not initialized. Data will not be sent to InfluxDB'
            );
            return;
        }

        // Find writeApi for the specified server
        const writeApi = globals.influxWriteApi.find(
            (element) => element.serverName === userSessions.serverName
        );

        // Ensure that the writeApi object was found
        if (!writeApi) {
            globals.logger.warn(
                `PROXY SESSIONS: Influxdb v3 write API object not found for host ${userSessions.host}. Data will not be sent to InfluxDB`
            );
            return;
        }

        // Get database from config
        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        // Create data points
        const point = new Point3('user_session_summary')
            .setIntegerField('session_count', userSessions.sessionCount)
            .setStringField('session_user_id_list', userSessions.uniqueUserList);

        // Write to InfluxDB
        try {
            await globals.influx.write(point.toLineProtocol(), database);
            globals.logger.debug(`PROXY SESSIONS: Wrote data to InfluxDB v3`);
        } catch (err) {
            globals.logger.error(
                `PROXY SESSIONS: Error saving user session data to InfluxDB v3! ${globals.getErrorMessage(err)}`
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
    }
}

/**
 * Posts Butler SOS memory usage metrics to InfluxDB.
 *
 * This function captures memory usage metrics from the Butler SOS process itself
 * and stores them in InfluxDB. It handles both InfluxDB v1 and v2 formats.
 *
 * @param {object} memory - Memory usage data object
 * @param {string} memory.instanceTag - Instance identifier tag
 * @param {number} memory.heapUsedMByte - Heap used in MB
 * @param {number} memory.heapTotalMByte - Total heap size in MB
 * @param {number} memory.externalMemoryMByte - External memory usage in MB
 * @param {number} memory.processMemoryMByte - Process memory usage in MB
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
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
                `MEMORY USAGE INFLUXDB: Error saving user session data to InfluxDB! ${globals.getErrorMessage(err)}`
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
                    `MEMORY USAGE INFLUXDB: Error saving health data to InfluxDB v2! ${globals.getErrorMessage(err)}`
                );
            }
        } catch (err) {
            globals.logger.error(
                `MEMORY USAGE INFLUXDB: Error getting write API: ${globals.getErrorMessage(err)}`
            );
        }

        globals.logger.verbose(
            'MEMORY USAGE INFLUXDB: Sent Butler SOS memory usage data to InfluxDB'
        );
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
        // Create new write API object
        // advanced write options
        const writeOptions = {
            /* maximum time in millis to keep points in an unflushed batch, 0 means don't periodically flush */
            flushInterval: 5000,

            /* the count of internally-scheduled retries upon write failure, the delays between write attempts follow an exponential backoff strategy if there is no Retry-After HTTP header */
            maxRetries: 2, // do not retry writes

            // ... there are more write options that can be customized, see
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeoptions.html and
            // https://influxdata.github.io/influxdb-client-js/influxdb-client.writeretryoptions.html
        };

        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        // v3 uses client.write() directly, not getWriteApi()
        const point = new Point3('butlersos_memory_usage')
            .setTag('butler_sos_instance', memory.instanceTag)
            .setTag('version', butlerVersion)
            .setFloatField('heap_used', memory.heapUsedMByte)
            .setFloatField('heap_total', memory.heapTotalMByte)
            .setFloatField('external', memory.externalMemoryMByte)
            .setFloatField('process_memory', memory.processMemoryMByte);

        try {
            // Convert point to line protocol and write directly
            await globals.influx.write(point.toLineProtocol(), database);
            globals.logger.debug(`MEMORY USAGE INFLUXDB: Wrote data to InfluxDB v3`);
        } catch (err) {
            globals.logger.error(
                `MEMORY USAGE INFLUXDB: Error saving user session data to InfluxDB v3! ${globals.getErrorMessage(err)}`
            );
        }

        globals.logger.verbose(
            'MEMORY USAGE INFLUXDB: Sent Butler SOS memory usage data to InfluxDB'
        );
    }
}

/**
 * Posts a user event to InfluxDB.
 *
 * @param {object} msg - The event to be posted to InfluxDB. The object should contain the following properties:
 *   - host: The hostname of the Qlik Sense server that the user event originated from.
 *   - command: The command (e.g. OpenApp, CreateApp, etc.) that the user event corresponds to.
 *   - user_directory: The user directory of the user who triggered the event.
 *   - user_id: The user ID of the user who triggered the event.
 *   - origin: The origin of the event (e.g. Qlik Sense, QlikView, etc.).
 *   - appId: The ID of the app that the event corresponds to (if applicable).
 *   - appName: The name of the app that the event corresponds to (if applicable).
 *   - ua: An object containing user agent information (if available). The object should contain the following properties:
 *     - browser: An object containing information about the user's browser (if available). The object should contain the following properties:
 *       - name: The name of the browser.
 *       - major: The major version of the browser.
 *     - os: An object containing information about the user's OS (if available). The object should contain the following properties:
 *       - name: The name of the OS.
 *       - version: The version of the OS.
 * @returns {Promise<void>} - A promise that resolves when the event has been posted to InfluxDB.
 */
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
                    `USER EVENT INFLUXDB: Error saving health data to InfluxDB v2! ${globals.getErrorMessage(err)}`
                );
            }

            globals.logger.verbose(
                'USER EVENT INFLUXDB: Sent Butler SOS user event data to InfluxDB'
            );
        } catch (err) {
            globals.logger.error(
                `USER EVENT INFLUXDB: Error getting write API: ${globals.getErrorMessage(err)}`
            );
        }
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        const point = new Point3('log_event')
            .setTag('host', msg.host)
            .setTag('level', msg.level)
            .setTag('source', msg.source)
            .setTag('log_row', msg.log_row)
            .setTag('subsystem', msg.subsystem ? msg.subsystem : 'n/a')
            .setStringField('message', msg.message)
            .setStringField('exception_message', msg.exception_message ? msg.exception_message : '')
            .setStringField('app_name', msg.appName ? msg.appName : '')
            .setStringField('app_id', msg.appId ? msg.appId : '')
            .setStringField('execution_id', msg.executionId ? msg.executionId : '')
            .setStringField('command', msg.command ? msg.command : '')
            .setStringField('result_code', msg.resultCode ? msg.resultCode : '')
            .setStringField('origin', msg.origin ? msg.origin : '')
            .setStringField('context', msg.context ? msg.context : '')
            .setStringField('session_id', msg.sessionId ? msg.sessionId : '')
            .setStringField('raw_event', msg.rawEvent ? msg.rawEvent : '');

        try {
            await globals.influx.write(point.toLineProtocol(), database);
            globals.logger.debug(`USER EVENT INFLUXDB: Wrote data to InfluxDB v3`);

            globals.logger.verbose(
                'USER EVENT INFLUXDB: Sent Butler SOS user event data to InfluxDB'
            );
        } catch (err) {
            globals.logger.error(
                `USER EVENT INFLUXDB: Error getting write API: ${globals.getErrorMessage(err)}`
            );
        }
    }
}

/**
 * Posts a log event to InfluxDB
 *
 * @param {object} msg - Log event from Butler SOS
 */
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
                            `LOG EVENT INFLUXDB: Error saving health data to InfluxDB v2! ${globals.getErrorMessage(err)}`
                        );
                    }

                    globals.logger.verbose(
                        'LOG EVENT INFLUXDB: Sent Butler SOS log event data to InfluxDB'
                    );
                } catch (err) {
                    globals.logger.error(
                        `LOG EVENT INFLUXDB: Error getting write API: ${globals.getErrorMessage(err)}`
                    );
                }
            }
        } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
            if (
                msg.source === 'qseow-engine' ||
                msg.source === 'qseow-proxy' ||
                msg.source === 'qseow-scheduler' ||
                msg.source === 'qseow-repository' ||
                msg.source === 'qseow-qix-perf'
            ) {
                const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

                let point;

                // Handle each message type with its specific fields
                if (msg.source === 'qseow-engine') {
                    // Engine fields: message, exception_message, command, result_code, origin, context, session_id, raw_event
                    point = new Point3('log_event')
                        .setTag('host', msg.host)
                        .setTag('level', msg.level)
                        .setTag('source', msg.source)
                        .setTag('log_row', msg.log_row)
                        .setTag('subsystem', msg.subsystem ? msg.subsystem : 'n/a')
                        .setStringField('message', msg.message)
                        .setStringField(
                            'exception_message',
                            msg.exception_message ? msg.exception_message : ''
                        )
                        .setStringField('command', msg.command ? msg.command : '')
                        .setStringField('result_code', msg.result_code ? msg.result_code : '')
                        .setStringField('origin', msg.origin ? msg.origin : '')
                        .setStringField('context', msg.context ? msg.context : '')
                        .setStringField('session_id', msg.session_id ? msg.session_id : '')
                        .setStringField('raw_event', JSON.stringify(msg));

                    // Conditional tags
                    if (msg?.user_full?.length > 0) point.setTag('user_full', msg.user_full);
                    if (msg?.user_directory?.length > 0)
                        point.setTag('user_directory', msg.user_directory);
                    if (msg?.user_id?.length > 0) point.setTag('user_id', msg.user_id);
                    if (msg?.result_code?.length > 0) point.setTag('result_code', msg.result_code);
                    if (msg?.windows_user?.length > 0)
                        point.setTag('windows_user', msg.windows_user);
                    if (msg?.task_id?.length > 0) point.setTag('task_id', msg.task_id);
                    if (msg?.task_name?.length > 0) point.setTag('task_name', msg.task_name);
                    if (msg?.app_id?.length > 0) point.setTag('app_id', msg.app_id);
                    if (msg?.app_name?.length > 0) point.setTag('app_name', msg.app_name);
                    if (msg?.engine_exe_version?.length > 0)
                        point.setTag('engine_exe_version', msg.engine_exe_version);
                } else if (msg.source === 'qseow-proxy') {
                    // Proxy fields: message, exception_message, command, result_code, origin, context, raw_event (NO session_id)
                    point = new Point3('log_event')
                        .setTag('host', msg.host)
                        .setTag('level', msg.level)
                        .setTag('source', msg.source)
                        .setTag('log_row', msg.log_row)
                        .setTag('subsystem', msg.subsystem ? msg.subsystem : 'n/a')
                        .setStringField('message', msg.message)
                        .setStringField(
                            'exception_message',
                            msg.exception_message ? msg.exception_message : ''
                        )
                        .setStringField('command', msg.command ? msg.command : '')
                        .setStringField('result_code', msg.result_code ? msg.result_code : '')
                        .setStringField('origin', msg.origin ? msg.origin : '')
                        .setStringField('context', msg.context ? msg.context : '')
                        .setStringField('raw_event', JSON.stringify(msg));

                    // Conditional tags
                    if (msg?.user_full?.length > 0) point.setTag('user_full', msg.user_full);
                    if (msg?.user_directory?.length > 0)
                        point.setTag('user_directory', msg.user_directory);
                    if (msg?.user_id?.length > 0) point.setTag('user_id', msg.user_id);
                    if (msg?.result_code?.length > 0) point.setTag('result_code', msg.result_code);
                } else if (msg.source === 'qseow-scheduler') {
                    // Scheduler fields: message, exception_message, app_name, app_id, execution_id, raw_event
                    point = new Point3('log_event')
                        .setTag('host', msg.host)
                        .setTag('level', msg.level)
                        .setTag('source', msg.source)
                        .setTag('log_row', msg.log_row)
                        .setTag('subsystem', msg.subsystem ? msg.subsystem : 'n/a')
                        .setStringField('message', msg.message)
                        .setStringField(
                            'exception_message',
                            msg.exception_message ? msg.exception_message : ''
                        )
                        .setStringField('app_name', msg.app_name ? msg.app_name : '')
                        .setStringField('app_id', msg.app_id ? msg.app_id : '')
                        .setStringField('execution_id', msg.execution_id ? msg.execution_id : '')
                        .setStringField('raw_event', JSON.stringify(msg));

                    // Conditional tags
                    if (msg?.user_full?.length > 0) point.setTag('user_full', msg.user_full);
                    if (msg?.user_directory?.length > 0)
                        point.setTag('user_directory', msg.user_directory);
                    if (msg?.user_id?.length > 0) point.setTag('user_id', msg.user_id);
                    if (msg?.task_id?.length > 0) point.setTag('task_id', msg.task_id);
                    if (msg?.task_name?.length > 0) point.setTag('task_name', msg.task_name);
                } else if (msg.source === 'qseow-repository') {
                    // Repository fields: message, exception_message, command, result_code, origin, context, raw_event
                    point = new Point3('log_event')
                        .setTag('host', msg.host)
                        .setTag('level', msg.level)
                        .setTag('source', msg.source)
                        .setTag('log_row', msg.log_row)
                        .setTag('subsystem', msg.subsystem ? msg.subsystem : 'n/a')
                        .setStringField('message', msg.message)
                        .setStringField(
                            'exception_message',
                            msg.exception_message ? msg.exception_message : ''
                        )
                        .setStringField('command', msg.command ? msg.command : '')
                        .setStringField('result_code', msg.result_code ? msg.result_code : '')
                        .setStringField('origin', msg.origin ? msg.origin : '')
                        .setStringField('context', msg.context ? msg.context : '')
                        .setStringField('raw_event', JSON.stringify(msg));

                    // Conditional tags
                    if (msg?.user_full?.length > 0) point.setTag('user_full', msg.user_full);
                    if (msg?.user_directory?.length > 0)
                        point.setTag('user_directory', msg.user_directory);
                    if (msg?.user_id?.length > 0) point.setTag('user_id', msg.user_id);
                    if (msg?.result_code?.length > 0) point.setTag('result_code', msg.result_code);
                } else if (msg.source === 'qseow-qix-perf') {
                    // QIX Performance fields: app_id, process_time, work_time, lock_time, validate_time, traverse_time, handle, net_ram, peak_ram, raw_event
                    point = new Point3('log_event')
                        .setTag('host', msg.host ? msg.host : '<Unknown>')
                        .setTag('level', msg.level ? msg.level : '<Unknown>')
                        .setTag('source', msg.source ? msg.source : '<Unknown>')
                        .setTag('log_row', msg.log_row ? msg.log_row : '-1')
                        .setTag('subsystem', msg.subsystem ? msg.subsystem : '<Unknown>')
                        .setTag('method', msg.method ? msg.method : '<Unknown>')
                        .setTag('object_type', msg.object_type ? msg.object_type : '<Unknown>')
                        .setTag(
                            'proxy_session_id',
                            msg.proxy_session_id ? msg.proxy_session_id : '-1'
                        )
                        .setTag('session_id', msg.session_id ? msg.session_id : '-1')
                        .setTag(
                            'event_activity_source',
                            msg.event_activity_source ? msg.event_activity_source : '<Unknown>'
                        )
                        .setStringField('app_id', msg.app_id ? msg.app_id : '')
                        .setFloatField('process_time', msg.process_time)
                        .setFloatField('work_time', msg.work_time)
                        .setFloatField('lock_time', msg.lock_time)
                        .setFloatField('validate_time', msg.validate_time)
                        .setFloatField('traverse_time', msg.traverse_time)
                        .setIntegerField('handle', msg.handle)
                        .setIntegerField('net_ram', msg.net_ram)
                        .setIntegerField('peak_ram', msg.peak_ram)
                        .setStringField('raw_event', JSON.stringify(msg));

                    // Conditional tags
                    if (msg?.user_full?.length > 0) point.setTag('user_full', msg.user_full);
                    if (msg?.user_directory?.length > 0)
                        point.setTag('user_directory', msg.user_directory);
                    if (msg?.user_id?.length > 0) point.setTag('user_id', msg.user_id);
                    if (msg?.app_id?.length > 0) point.setTag('app_id', msg.app_id);
                    if (msg?.app_name?.length > 0) point.setTag('app_name', msg.app_name);
                    if (msg?.object_id?.length > 0) point.setTag('object_id', msg.object_id);
                }

                // Add log event categories to tags if available
                if (msg?.category?.length > 0) {
                    msg.category.forEach((category) => {
                        point.setTag(category.name, category.value);
                    });
                }

                // Add custom tags from config file
                if (
                    globals.config.has('Butler-SOS.logEvents.tags') &&
                    globals.config.get('Butler-SOS.logEvents.tags') !== null &&
                    globals.config.get('Butler-SOS.logEvents.tags').length > 0
                ) {
                    const configTags = globals.config.get('Butler-SOS.logEvents.tags');
                    for (const item of configTags) {
                        point.setTag(item.name, item.value);
                    }
                }

                try {
                    await globals.influx.write(point.toLineProtocol(), database);
                    globals.logger.debug(`LOG EVENT INFLUXDB: Wrote data to InfluxDB v3`);

                    globals.logger.verbose(
                        'LOG EVENT INFLUXDB: Sent Butler SOS log event data to InfluxDB'
                    );
                } catch (err) {
                    globals.logger.error(
                        `LOG EVENT INFLUXDB: Error getting write API: ${globals.getErrorMessage(err)}`
                    );
                }
            }
        }
    } catch (err) {
        globals.logger.error(
            `LOG EVENT INFLUXDB 2: Error saving log event to InfluxDB! ${globals.getErrorMessage(err)}`
        );
    }
}

/**
 * Stores event counts (log and user events) in InfluxDB.
 *
 * @description
 * This function retrieves arrays of log and user events, and stores the data in InfluxDB.
 * If the InfluxDB version is 1.x, it uses the v1 API to write data points for each event.
 * If the InfluxDB version is 2.x, it uses the v2 API to write data points for each event.
 * Static tags from the configuration file are added to each data point.
 * The function logs messages at various stages to provide debugging and status information.
 * No data is stored if there are no events present.
 *
 * @throws {Error} Logs an error message if unable to write data to InfluxDB.
 */
export async function storeEventCountInfluxDB() {
    // Get array of log events
    const logEvents = await globals.udpEvents.getLogEvents();
    const userEvents = await globals.udpEvents.getUserEvents();

    // Debug
    globals.logger.debug(`EVENT COUNT INFLUXDB: Log events: ${JSON.stringify(logEvents, null, 2)}`);
    globals.logger.debug(
        `EVENT COUNT INFLUXDB: User events: ${JSON.stringify(userEvents, null, 2)}`
    );

    // Are there any events to store?
    if (logEvents.length === 0 && userEvents.length === 0) {
        globals.logger.verbose('EVENT COUNT INFLUXDB: No events to store in InfluxDB');
        return;
    }

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
            logError('EVENT COUNT INFLUXDB: Error saving data to InfluxDB v1!', err);
            return;
        }

        globals.logger.verbose(
            'EVENT COUNT INFLUXDB: Sent Butler SOS event count data to InfluxDB'
        );
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
                    `EVENT COUNT INFLUXDB: Error saving health data to InfluxDB v2! ${err}`
                );
                return;
            }

            globals.logger.verbose(
                'EVENT COUNT INFLUXDB: Sent Butler SOS event count data to InfluxDB'
            );
        } catch (err) {
            logError('EVENT COUNT INFLUXDB: Error getting write API', err);
        }
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        try {
            // Store data for each log event
            for (const logEvent of logEvents) {
                const tags = {
                    butler_sos_instance: globals.options.instanceTag,
                    event_type: 'log',
                    source: logEvent.source,
                    host: logEvent.host,
                    subsystem: logEvent.subsystem,
                };

                // Add static tags defined in config file, if any
                if (
                    globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                    Array.isArray(
                        globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags')
                    )
                ) {
                    const configTags = globals.config.get(
                        'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                    );

                    configTags.forEach((tag) => {
                        tags[tag.name] = tag.value;
                    });
                }

                const point = new Point3(
                    globals.config.get(
                        'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName'
                    )
                )
                    .setTag('event_type', 'log')
                    .setTag('source', logEvent.source)
                    .setTag('host', logEvent.host)
                    .setTag('subsystem', logEvent.subsystem)
                    .setIntegerField('counter', logEvent.counter);

                // Add tags to point
                Object.keys(tags).forEach((key) => {
                    point.setTag(key, tags[key]);
                });

                await globals.influx.write(point.toLineProtocol(), database);
                globals.logger.debug(`EVENT COUNT INFLUXDB: Wrote data to InfluxDB v3`);
            }

            // Loop through data in user events and create datapoints.
            for (const event of userEvents) {
                const tags = {
                    butler_sos_instance: globals.options.instanceTag,
                    event_type: 'user',
                    source: event.source,
                    host: event.host,
                    subsystem: event.subsystem,
                };

                // Add static tags defined in config file, if any
                if (
                    globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                    Array.isArray(
                        globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags')
                    )
                ) {
                    const configTags = globals.config.get(
                        'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                    );

                    configTags.forEach((tag) => {
                        tags[tag.name] = tag.value;
                    });
                }

                const point = new Point3(
                    globals.config.get(
                        'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName'
                    )
                )
                    .setTag('event_type', 'user')
                    .setTag('source', event.source)
                    .setTag('host', event.host)
                    .setTag('subsystem', event.subsystem)
                    .setIntegerField('counter', event.counter);

                // Add tags to point
                Object.keys(tags).forEach((key) => {
                    point.setTag(key, tags[key]);
                });

                await globals.influx.write(point.toLineProtocol(), database);
                globals.logger.debug(`EVENT COUNT INFLUXDB: Wrote user event data to InfluxDB v3`);
            }

            globals.logger.verbose(
                'EVENT COUNT INFLUXDB: Sent Butler SOS event count data to InfluxDB'
            );
        } catch (err) {
            logError('EVENT COUNT INFLUXDB: Error getting write API', err);
        }
    }
}

/**
 * Store rejected event count in InfluxDB
 *
 * @description
 * This function reads an array of rejected log events from the `rejectedEvents` object,
 * and stores the data in InfluxDB. The data is written to a measurement named after
 * the `Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName` config setting.
 * The function uses the InfluxDB v1 or v2 API depending on the `Butler-SOS.influxdbConfig.version`
 * config setting.
 *
 * @throws {Error} Error if unable to get write API or write data to InfluxDB
 */
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

    // Are there any events to store?
    if (rejectedLogEvents.length === 0) {
        globals.logger.verbose('REJECTED EVENT COUNT INFLUXDB: No events to store in InfluxDB');
        return;
    }

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
            return;
        }

        globals.logger.verbose(
            'REJECT LOG EVENT INFLUXDB: Sent Butler SOS rejected event count data to InfluxDB'
        );
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
                    `REJECTED LOG EVENT INFLUXDB: Error saving data to InfluxDB v2! ${err}`
                );
                return;
            }

            globals.logger.verbose(
                'REJECT LOG EVENT INFLUXDB: Sent Butler SOS rejected event count data to InfluxDB'
            );
        } catch (err) {
            logError('REJECTED LOG EVENT INFLUXDB: Error getting write API', err);
        }
    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

        try {
            const points = [];
            const measurementName = globals.config.get(
                'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
            );

            rejectedLogEvents.forEach((event) => {
                globals.logger.debug(`REJECTED LOG EVENT INFLUXDB 3: ${JSON.stringify(event)}`);

                if (event.source === 'qseow-qix-perf') {
                    let point = new Point3(measurementName)
                        .setTag('source', event.source)
                        .setTag('object_type', event.objectType)
                        .setTag('method', event.method)
                        .setIntegerField('counter', event.counter)
                        .setFloatField('process_time', event.processTime);

                    // Add app_id and app_name if available
                    if (event?.appId) {
                        point.setTag('app_id', event.appId);
                    }
                    if (event?.appName?.length > 0) {
                        point.setTag('app_name', event.appName);
                        point.setTag('app_name_set', 'true');
                    } else {
                        point.setTag('app_name_set', 'false');
                    }

                    // Add static tags defined in config file, if any
                    if (
                        globals.config.has(
                            'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                        ) &&
                        Array.isArray(
                            globals.config.get(
                                'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                            )
                        )
                    ) {
                        const configTags = globals.config.get(
                            'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                        );
                        for (const item of configTags) {
                            point.setTag(item.name, item.value);
                        }
                    }

                    points.push(point);
                } else {
                    let point = new Point3(measurementName)
                        .setTag('source', event.source)
                        .setIntegerField('counter', event.counter);

                    points.push(point);
                }
            });

            // Write to InfluxDB
            try {
                for (const point of points) {
                    await globals.influx.write(point.toLineProtocol(), database);
                }
                globals.logger.debug(`REJECT LOG EVENT INFLUXDB: Wrote data to InfluxDB v3`);
            } catch (err) {
                globals.logger.error(
                    `REJECTED LOG EVENT INFLUXDB: Error saving data to InfluxDB v3! ${err}`
                );
                return;
            }

            globals.logger.verbose(
                'REJECT LOG EVENT INFLUXDB: Sent Butler SOS rejected event count data to InfluxDB'
            );
        } catch (err) {
            logError('REJECTED LOG EVENT INFLUXDB: Error getting write API', err);
        }
    }
}

/**
 * Store user event queue metrics to InfluxDB
 *
 * This function retrieves metrics from the user event queue manager and stores them
 * in InfluxDB for monitoring queue health, backpressure, dropped messages, and
 * processing performance.
 *
 * @returns {Promise<void>} A promise that resolves when metrics are stored
 */
export async function postUserEventQueueMetricsToInfluxdb() {
    try {
        // Check if queue metrics are enabled
        if (
            !globals.config.get(
                'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.enable'
            )
        ) {
            return;
        }

        // Get metrics from queue manager
        const queueManager = globals.udpQueueManagerUserActivity;
        if (!queueManager) {
            globals.logger.warn('USER EVENT QUEUE METRICS INFLUXDB: Queue manager not initialized');
            return;
        }

        const metrics = await queueManager.getMetrics();

        // Get configuration
        const measurementName = globals.config.get(
            'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.measurementName'
        );
        const configTags = globals.config.get(
            'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.tags'
        );

        // InfluxDB 1.x
        if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
            const point = {
                measurement: measurementName,
                tags: {
                    queue_type: 'user_events',
                    host: globals.hostInfo.hostname,
                },
                fields: {
                    queue_size: metrics.queueSize,
                    queue_max_size: metrics.queueMaxSize,
                    queue_utilization_pct: metrics.queueUtilizationPct,
                    queue_pending: metrics.queuePending,
                    messages_received: metrics.messagesReceived,
                    messages_queued: metrics.messagesQueued,
                    messages_processed: metrics.messagesProcessed,
                    messages_failed: metrics.messagesFailed,
                    messages_dropped_total: metrics.messagesDroppedTotal,
                    messages_dropped_rate_limit: metrics.messagesDroppedRateLimit,
                    messages_dropped_queue_full: metrics.messagesDroppedQueueFull,
                    messages_dropped_size: metrics.messagesDroppedSize,
                    processing_time_avg_ms: metrics.processingTimeAvgMs,
                    processing_time_p95_ms: metrics.processingTimeP95Ms,
                    processing_time_max_ms: metrics.processingTimeMaxMs,
                    rate_limit_current: metrics.rateLimitCurrent,
                    backpressure_active: metrics.backpressureActive,
                },
            };

            // Add static tags from config file
            if (configTags && configTags.length > 0) {
                for (const item of configTags) {
                    point.tags[item.name] = item.value;
                }
            }

            try {
                await globals.influx.writePoints([point]);
                globals.logger.verbose(
                    'USER EVENT QUEUE METRICS INFLUXDB: Sent queue metrics data to InfluxDB v1'
                );
            } catch (err) {
                globals.logger.error(
                    `USER EVENT QUEUE METRICS INFLUXDB: Error saving data to InfluxDB v1! ${err}`
                );
                return;
            }
        } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
            // InfluxDB 2.x
            const writeOptions = {
                flushInterval: 5000,
                maxRetries: 2,
            };

            try {
                const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
                const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

                const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

                if (!writeApi) {
                    globals.logger.warn(
                        'USER EVENT QUEUE METRICS INFLUXDB: Influxdb write API object not found'
                    );
                    return;
                }

                const point = new Point(measurementName)
                    .tag('queue_type', 'user_events')
                    .tag('host', globals.hostInfo.hostname)
                    .intField('queue_size', metrics.queueSize)
                    .intField('queue_max_size', metrics.queueMaxSize)
                    .floatField('queue_utilization_pct', metrics.queueUtilizationPct)
                    .intField('queue_pending', metrics.queuePending)
                    .intField('messages_received', metrics.messagesReceived)
                    .intField('messages_queued', metrics.messagesQueued)
                    .intField('messages_processed', metrics.messagesProcessed)
                    .intField('messages_failed', metrics.messagesFailed)
                    .intField('messages_dropped_total', metrics.messagesDroppedTotal)
                    .intField('messages_dropped_rate_limit', metrics.messagesDroppedRateLimit)
                    .intField('messages_dropped_queue_full', metrics.messagesDroppedQueueFull)
                    .intField('messages_dropped_size', metrics.messagesDroppedSize)
                    .floatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
                    .floatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
                    .floatField('processing_time_max_ms', metrics.processingTimeMaxMs)
                    .intField('rate_limit_current', metrics.rateLimitCurrent)
                    .intField('backpressure_active', metrics.backpressureActive);

                // Add static tags from config file
                if (configTags && configTags.length > 0) {
                    for (const item of configTags) {
                        point.tag(item.name, item.value);
                    }
                }

                writeApi.writePoint(point);
                await writeApi.close();

                globals.logger.verbose(
                    'USER EVENT QUEUE METRICS INFLUXDB: Sent queue metrics data to InfluxDB v2'
                );
            } catch (err) {
                globals.logger.error(
                    `USER EVENT QUEUE METRICS INFLUXDB: Error saving data to InfluxDB v2! ${err}`
                );
                return;
            }
        } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
            // InfluxDB 3.x
            const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

            try {
                const point = new Point3(measurementName)
                    .setTag('queue_type', 'user_events')
                    .setTag('host', globals.hostInfo.hostname)
                    .setIntegerField('queue_size', metrics.queueSize)
                    .setIntegerField('queue_max_size', metrics.queueMaxSize)
                    .setFloatField('queue_utilization_pct', metrics.queueUtilizationPct)
                    .setIntegerField('queue_pending', metrics.queuePending)
                    .setIntegerField('messages_received', metrics.messagesReceived)
                    .setIntegerField('messages_queued', metrics.messagesQueued)
                    .setIntegerField('messages_processed', metrics.messagesProcessed)
                    .setIntegerField('messages_failed', metrics.messagesFailed)
                    .setIntegerField('messages_dropped_total', metrics.messagesDroppedTotal)
                    .setIntegerField(
                        'messages_dropped_rate_limit',
                        metrics.messagesDroppedRateLimit
                    )
                    .setIntegerField(
                        'messages_dropped_queue_full',
                        metrics.messagesDroppedQueueFull
                    )
                    .setIntegerField('messages_dropped_size', metrics.messagesDroppedSize)
                    .setFloatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
                    .setFloatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
                    .setFloatField('processing_time_max_ms', metrics.processingTimeMaxMs)
                    .setIntegerField('rate_limit_current', metrics.rateLimitCurrent)
                    .setIntegerField('backpressure_active', metrics.backpressureActive);

                // Add static tags from config file
                if (configTags && configTags.length > 0) {
                    for (const item of configTags) {
                        point.setTag(item.name, item.value);
                    }
                }

                await globals.influx.write(point.toLineProtocol(), database);

                globals.logger.verbose(
                    'USER EVENT QUEUE METRICS INFLUXDB: Sent queue metrics data to InfluxDB v3'
                );
            } catch (err) {
                globals.logger.error(
                    `USER EVENT QUEUE METRICS INFLUXDB: Error saving data to InfluxDB v3! ${err}`
                );
                return;
            }
        }

        // Clear metrics after writing
        await queueManager.clearMetrics();
    } catch (err) {
        globals.logger.error(
            `USER EVENT QUEUE METRICS INFLUXDB: Error posting queue metrics: ${err}`
        );
    }
}

/**
 * Store log event queue metrics to InfluxDB
 *
 * This function retrieves metrics from the log event queue manager and stores them
 * in InfluxDB for monitoring queue health, backpressure, dropped messages, and
 * processing performance.
 *
 * @returns {Promise<void>} A promise that resolves when metrics are stored
 */
export async function postLogEventQueueMetricsToInfluxdb() {
    try {
        // Check if queue metrics are enabled
        if (
            !globals.config.get('Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.enable')
        ) {
            return;
        }

        // Get metrics from queue manager
        const queueManager = globals.udpQueueManagerLogEvents;
        if (!queueManager) {
            globals.logger.warn('LOG EVENT QUEUE METRICS INFLUXDB: Queue manager not initialized');
            return;
        }

        const metrics = await queueManager.getMetrics();

        // Get configuration
        const measurementName = globals.config.get(
            'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.measurementName'
        );
        const configTags = globals.config.get(
            'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.tags'
        );

        // InfluxDB 1.x
        if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
            const point = {
                measurement: measurementName,
                tags: {
                    queue_type: 'log_events',
                    host: globals.hostInfo.hostname,
                },
                fields: {
                    queue_size: metrics.queueSize,
                    queue_max_size: metrics.queueMaxSize,
                    queue_utilization_pct: metrics.queueUtilizationPct,
                    queue_pending: metrics.queuePending,
                    messages_received: metrics.messagesReceived,
                    messages_queued: metrics.messagesQueued,
                    messages_processed: metrics.messagesProcessed,
                    messages_failed: metrics.messagesFailed,
                    messages_dropped_total: metrics.messagesDroppedTotal,
                    messages_dropped_rate_limit: metrics.messagesDroppedRateLimit,
                    messages_dropped_queue_full: metrics.messagesDroppedQueueFull,
                    messages_dropped_size: metrics.messagesDroppedSize,
                    processing_time_avg_ms: metrics.processingTimeAvgMs,
                    processing_time_p95_ms: metrics.processingTimeP95Ms,
                    processing_time_max_ms: metrics.processingTimeMaxMs,
                    rate_limit_current: metrics.rateLimitCurrent,
                    backpressure_active: metrics.backpressureActive,
                },
            };

            // Add static tags from config file
            if (configTags && configTags.length > 0) {
                for (const item of configTags) {
                    point.tags[item.name] = item.value;
                }
            }

            try {
                await globals.influx.writePoints([point]);
                globals.logger.verbose(
                    'LOG EVENT QUEUE METRICS INFLUXDB: Sent queue metrics data to InfluxDB v1'
                );
            } catch (err) {
                globals.logger.error(
                    `LOG EVENT QUEUE METRICS INFLUXDB: Error saving data to InfluxDB v1! ${err}`
                );
                return;
            }
        } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
            // InfluxDB 2.x
            const writeOptions = {
                flushInterval: 5000,
                maxRetries: 2,
            };

            try {
                const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
                const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

                const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

                if (!writeApi) {
                    globals.logger.warn(
                        'LOG EVENT QUEUE METRICS INFLUXDB: Influxdb write API object not found'
                    );
                    return;
                }

                const point = new Point(measurementName)
                    .tag('queue_type', 'log_events')
                    .tag('host', globals.hostInfo.hostname)
                    .intField('queue_size', metrics.queueSize)
                    .intField('queue_max_size', metrics.queueMaxSize)
                    .floatField('queue_utilization_pct', metrics.queueUtilizationPct)
                    .intField('queue_pending', metrics.queuePending)
                    .intField('messages_received', metrics.messagesReceived)
                    .intField('messages_queued', metrics.messagesQueued)
                    .intField('messages_processed', metrics.messagesProcessed)
                    .intField('messages_failed', metrics.messagesFailed)
                    .intField('messages_dropped_total', metrics.messagesDroppedTotal)
                    .intField('messages_dropped_rate_limit', metrics.messagesDroppedRateLimit)
                    .intField('messages_dropped_queue_full', metrics.messagesDroppedQueueFull)
                    .intField('messages_dropped_size', metrics.messagesDroppedSize)
                    .floatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
                    .floatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
                    .floatField('processing_time_max_ms', metrics.processingTimeMaxMs)
                    .intField('rate_limit_current', metrics.rateLimitCurrent)
                    .intField('backpressure_active', metrics.backpressureActive);

                // Add static tags from config file
                if (configTags && configTags.length > 0) {
                    for (const item of configTags) {
                        point.tag(item.name, item.value);
                    }
                }

                writeApi.writePoint(point);
                await writeApi.close();

                globals.logger.verbose(
                    'LOG EVENT QUEUE METRICS INFLUXDB: Sent queue metrics data to InfluxDB v2'
                );
            } catch (err) {
                globals.logger.error(
                    `LOG EVENT QUEUE METRICS INFLUXDB: Error saving data to InfluxDB v2! ${err}`
                );
                return;
            }
        } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 3) {
            // InfluxDB 3.x
            const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

            try {
                const point = new Point3(measurementName)
                    .setTag('queue_type', 'log_events')
                    .setTag('host', globals.hostInfo.hostname)
                    .setIntegerField('queue_size', metrics.queueSize)
                    .setIntegerField('queue_max_size', metrics.queueMaxSize)
                    .setFloatField('queue_utilization_pct', metrics.queueUtilizationPct)
                    .setIntegerField('queue_pending', metrics.queuePending)
                    .setIntegerField('messages_received', metrics.messagesReceived)
                    .setIntegerField('messages_queued', metrics.messagesQueued)
                    .setIntegerField('messages_processed', metrics.messagesProcessed)
                    .setIntegerField('messages_failed', metrics.messagesFailed)
                    .setIntegerField('messages_dropped_total', metrics.messagesDroppedTotal)
                    .setIntegerField(
                        'messages_dropped_rate_limit',
                        metrics.messagesDroppedRateLimit
                    )
                    .setIntegerField(
                        'messages_dropped_queue_full',
                        metrics.messagesDroppedQueueFull
                    )
                    .setIntegerField('messages_dropped_size', metrics.messagesDroppedSize)
                    .setFloatField('processing_time_avg_ms', metrics.processingTimeAvgMs)
                    .setFloatField('processing_time_p95_ms', metrics.processingTimeP95Ms)
                    .setFloatField('processing_time_max_ms', metrics.processingTimeMaxMs)
                    .setIntegerField('rate_limit_current', metrics.rateLimitCurrent)
                    .setIntegerField('backpressure_active', metrics.backpressureActive);

                // Add static tags from config file
                if (configTags && configTags.length > 0) {
                    for (const item of configTags) {
                        point.setTag(item.name, item.value);
                    }
                }

                await globals.influx.write(point.toLineProtocol(), database);

                globals.logger.verbose(
                    'LOG EVENT QUEUE METRICS INFLUXDB: Sent queue metrics data to InfluxDB v3'
                );
            } catch (err) {
                globals.logger.error(
                    `LOG EVENT QUEUE METRICS INFLUXDB: Error saving data to InfluxDB v3! ${err}`
                );
                return;
            }
        }

        // Clear metrics after writing
        await queueManager.clearMetrics();
    } catch (err) {
        globals.logger.error(
            `LOG EVENT QUEUE METRICS INFLUXDB: Error posting queue metrics: ${err}`
        );
    }
}

/**
 * Set up timers for storing UDP queue metrics to InfluxDB
 *
 * This function sets up separate intervals for user events and log events queue metrics
 * based on their individual configurations. Each queue can have its own write frequency.
 *
 * @returns {object} Object containing interval IDs for both queues
 */
export function setupUdpQueueMetricsStorage() {
    const intervalIds = {
        userEvents: null,
        logEvents: null,
    };

    // Check if InfluxDB is enabled
    if (globals.config.get('Butler-SOS.influxdbConfig.enable') !== true) {
        globals.logger.info(
            'UDP QUEUE METRICS: InfluxDB is disabled. Skipping setup of queue metrics storage'
        );
        return intervalIds;
    }

    // Set up user events queue metrics storage
    if (
        globals.config.get('Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.enable') ===
        true
    ) {
        const writeFrequency = globals.config.get(
            'Butler-SOS.userEvents.udpServerConfig.queueMetrics.influxdb.writeFrequency'
        );

        intervalIds.userEvents = setInterval(async () => {
            try {
                globals.logger.verbose(
                    'UDP QUEUE METRICS: Timer for storing user event queue metrics to InfluxDB triggered'
                );
                await postUserEventQueueMetricsToInfluxdb();
            } catch (err) {
                globals.logger.error(
                    `UDP QUEUE METRICS: Error storing user event queue metrics to InfluxDB: ${err && err.stack ? err.stack : err}`
                );
            }
        }, writeFrequency);

        globals.logger.info(
            `UDP QUEUE METRICS: Set up timer for storing user event queue metrics to InfluxDB (interval: ${writeFrequency}ms)`
        );
    } else {
        globals.logger.info(
            'UDP QUEUE METRICS: User event queue metrics storage to InfluxDB is disabled'
        );
    }

    // Set up log events queue metrics storage
    if (
        globals.config.get('Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.enable') ===
        true
    ) {
        const writeFrequency = globals.config.get(
            'Butler-SOS.logEvents.udpServerConfig.queueMetrics.influxdb.writeFrequency'
        );

        intervalIds.logEvents = setInterval(async () => {
            try {
                globals.logger.verbose(
                    'UDP QUEUE METRICS: Timer for storing log event queue metrics to InfluxDB triggered'
                );
                await postLogEventQueueMetricsToInfluxdb();
            } catch (err) {
                globals.logger.error(
                    `UDP QUEUE METRICS: Error storing log event queue metrics to InfluxDB: ${err && err.stack ? err.stack : err}`
                );
            }
        }, writeFrequency);

        globals.logger.info(
            `UDP QUEUE METRICS: Set up timer for storing log event queue metrics to InfluxDB (interval: ${writeFrequency}ms)`
        );
    } else {
        globals.logger.info(
            'UDP QUEUE METRICS: Log event queue metrics storage to InfluxDB is disabled'
        );
    }

    return intervalIds;
}
