import Influx from 'influx';
import { InfluxDB as InfluxDB2, HttpError } from '@influxdata/influxdb-client';
import { OrgsAPI, BucketsAPI } from '@influxdata/influxdb-client-apis';
import {
    InfluxDBClient as InfluxDBClient3,
    setLogger as setInfluxV3Logger,
} from '@influxdata/influxdb3-client';
import { getServerTags } from '../servertags.js';

/**
 * Initializes the InfluxDB client based on configuration settings.
 *
 * @param {object} settings - The settings object to populate
 */
export async function initInfluxDBClient(settings) {
    // Get info on what servers to monitor
    settings.serverList = settings.config.get('Butler-SOS.serversToMonitor.servers');

    // Get list of standard and user configurable tags
    // ..begin with standard tags
    const tagValues = ['host', 'server_name', 'server_description'];

    // ..check if there are any extra tags for this Butler SOS instance that should be sent to InfluxDB
    if (
        settings.config.has('Butler-SOS.serversToMonitor.serverTagsDefinition') &&
        settings.config.get('Butler-SOS.serversToMonitor.serverTagsDefinition') !== null
    ) {
        // Loop over all tags defined for the current server, adding them to the data structure that will later be passed to Influxdb
        settings.config.get('Butler-SOS.serversToMonitor.serverTagsDefinition').forEach((entry) => {
            settings.logger.debug(
                `CONFIG: Setting up new Influx database: Found server tag : ${entry}`
            );

            tagValues.push(entry);
        });
    }

    // Add tags for log events
    const tagValuesLogEvent = tagValues.slice();
    tagValuesLogEvent.push('level');
    tagValuesLogEvent.push('source');
    tagValuesLogEvent.push('log_row');
    tagValuesLogEvent.push('subsystem');
    tagValuesLogEvent.push('user_full');
    tagValuesLogEvent.push('user_directory');
    tagValuesLogEvent.push('user_id');
    tagValuesLogEvent.push('task_id');
    tagValuesLogEvent.push('task_name');
    tagValuesLogEvent.push('app_id');
    tagValuesLogEvent.push('app_name');
    tagValuesLogEvent.push('result_code');
    tagValuesLogEvent.push('windows_user');
    tagValuesLogEvent.push('engine_exe_version');

    // Performance log event tags
    tagValuesLogEvent.push('method');
    tagValuesLogEvent.push('object_type');
    tagValuesLogEvent.push('proxy_session_id');
    tagValuesLogEvent.push('session_id');
    tagValuesLogEvent.push('event_activity_source');
    tagValuesLogEvent.push('object_id');

    // Check if there are any extra log event tags in the config file
    if (
        settings.config.has('Butler-SOS.logEvents.tags') &&
        settings.config.get('Butler-SOS.logEvents.tags') !== null
    ) {
        settings.config.get('Butler-SOS.logEvents.tags').forEach((entry) => {
            settings.logger.debug(
                `CONFIG: Setting up new Influx database: Found log event tag in config file: ${JSON.stringify(
                    entry
                )}`
            );

            tagValuesLogEvent.push(entry.name);
        });
    }

    // Add tags for log events categories, if enabled and configured
    if (
        settings.config.has('Butler-SOS.logEvents.categorise.enable') &&
        settings.config.get('Butler-SOS.logEvents.categorise.enable') === true &&
        settings.config.has('Butler-SOS.logEvents.categorise.rules')
    ) {
        // Add tags from Butler-SOS.logEvents.categorise.rules[].category[], where each object has properties 'name' and 'value'
        settings.config.get('Butler-SOS.logEvents.categorise.rules').forEach((rule) => {
            rule.category.forEach((category) => {
                tagValuesLogEvent.push(category.name);
            });
        });

        // Add default rule categories, if enabled
        if (
            settings.config.has('Butler-SOS.logEvents.categorise.ruleDefault.enable') &&
            settings.config.get('Butler-SOS.logEvents.categorise.ruleDefault.enable') === true &&
            settings.config.has('Butler-SOS.logEvents.categorise.ruleDefault.category')
        ) {
            settings.config
                .get('Butler-SOS.logEvents.categorise.ruleDefault.category')
                .forEach((category) => {
                    tagValuesLogEvent.push(category.name);
                });
        }
    }

    // Create tags for user sessions
    const tagValuesUserProxySessions = tagValues.slice();
    tagValuesUserProxySessions.push('user_session_virtual_proxy');
    tagValuesUserProxySessions.push('user_session_host');

    // Show Influxdb config
    if (settings.config.get('Butler-SOS.influxdbConfig.enable') === true) {
        settings.logger.info(`CONFIG: Influxdb enabled: true`);
        settings.logger.info(
            `CONFIG: Influxdb host IP: ${settings.config.get('Butler-SOS.influxdbConfig.host')}`
        );
        settings.logger.info(
            `CONFIG: Influxdb host port: ${settings.config.get('Butler-SOS.influxdbConfig.port')}`
        );
        settings.logger.info(
            `CONFIG: Influxdb version: ${settings.config.get('Butler-SOS.influxdbConfig.version')}`
        );

        // Version specific configs
        if (settings.config.get('Butler-SOS.influxdbConfig.version') === 1) {
            settings.logger.info(
                `CONFIG: Influxdb db name: ${settings.config.get('Butler-SOS.influxdbConfig.v1Config.dbName')}`
            );
            settings.logger.info(
                `CONFIG: Influxdb retention policy: ${settings.config.get('Butler-SOS.influxdbConfig.v1Config.retentionPolicy.name')}`
            );
        } else if (settings.config.get('Butler-SOS.influxdbConfig.version') === 2) {
            settings.logger.info(
                `CONFIG: Influxdb organisation: ${settings.config.get('Butler-SOS.influxdbConfig.v2Config.org')}`
            );
            settings.logger.info(
                `CONFIG: Influxdb bucket name: ${settings.config.get('Butler-SOS.influxdbConfig.v2Config.bucket')}`
            );
            settings.logger.info(
                `CONFIG: Influxdb retention policy duration: ${settings.config.get('Butler-SOS.influxdbConfig.v2Config.retentionDuration')}`
            );
        } else if (settings.config.get('Butler-SOS.influxdbConfig.version') === 3) {
            settings.logger.info(
                `CONFIG: Influxdb database name: ${settings.config.get('Butler-SOS.influxdbConfig.v3Config.database')}`
            );
            settings.logger.info(
                `CONFIG: Influxdb retention policy duration: ${settings.config.get('Butler-SOS.influxdbConfig.v3Config.retentionDuration')}`
            );
        } else {
            settings.logger.error(
                `CONFIG: Influxdb version ${settings.config.get('Butler-SOS.influxdbConfig.version')} is not supported!`
            );
        }
    } else {
        settings.logger.info(`CONFIG: Influxdb enabled: false`);
    }

    settings.influxWriteApi = [];
    if (settings.config.get('Butler-SOS.influxdbConfig.enable') === true) {
        if (settings.config.get('Butler-SOS.influxdbConfig.version') === 1) {
            // Set up Influxdb v1 client
            settings.influx = new Influx.InfluxDB({
                host: settings.config.get('Butler-SOS.influxdbConfig.host'),
                port: settings.config.get('Butler-SOS.influxdbConfig.port'),
                database: settings.config.get('Butler-SOS.influxdbConfig.v1Config.dbName'),
                username: `${
                    settings.config.get('Butler-SOS.influxdbConfig.v1Config.auth.enable')
                        ? settings.config.get('Butler-SOS.influxdbConfig.v1Config.auth.username')
                        : ''
                }`,
                password: `${
                    settings.config.get('Butler-SOS.influxdbConfig.v1Config.auth.enable')
                        ? settings.config.get('Butler-SOS.influxdbConfig.v1Config.auth.password')
                        : ''
                }`,
                schema: [
                    {
                        measurement: 'sense_server',
                        fields: {
                            version: Influx.FieldType.STRING,
                            started: Influx.FieldType.STRING,
                            uptime: Influx.FieldType.STRING,
                        },
                        tags: tagValues,
                    },
                    {
                        measurement: 'mem',
                        fields: {
                            comitted: Influx.FieldType.INTEGER,
                            allocated: Influx.FieldType.INTEGER,
                            free: Influx.FieldType.INTEGER,
                        },
                        tags: tagValues,
                    },
                    {
                        measurement: 'apps',
                        fields: {
                            active_docs_count: Influx.FieldType.INTEGER,
                            loaded_docs_count: Influx.FieldType.INTEGER,
                            in_memory_docs_count: Influx.FieldType.INTEGER,
                            active_docs: Influx.FieldType.STRING,
                            active_docs_names: Influx.FieldType.STRING,
                            active_session_docs_names: Influx.FieldType.STRING,
                            loaded_docs: Influx.FieldType.STRING,
                            loaded_docs_names: Influx.FieldType.STRING,
                            loaded_session_docs_names: Influx.FieldType.STRING,
                            in_memory_docs: Influx.FieldType.STRING,
                            in_memory_docs_names: Influx.FieldType.STRING,
                            in_memory_session_docs_names: Influx.FieldType.STRING,
                            calls: Influx.FieldType.INTEGER,
                            selections: Influx.FieldType.INTEGER,
                        },
                        tags: tagValues,
                    },
                    {
                        measurement: 'cpu',
                        fields: {
                            total: Influx.FieldType.INTEGER,
                        },
                        tags: tagValues,
                    },
                    {
                        measurement: 'session',
                        fields: {
                            active: Influx.FieldType.INTEGER,
                            total: Influx.FieldType.INTEGER,
                        },
                        tags: tagValues,
                    },
                    {
                        measurement: 'users',
                        fields: {
                            active: Influx.FieldType.INTEGER,
                            total: Influx.FieldType.INTEGER,
                        },
                        tags: tagValues,
                    },
                    {
                        measurement: 'cache',
                        fields: {
                            hits: Influx.FieldType.INTEGER,
                            lookups: Influx.FieldType.INTEGER,
                            added: Influx.FieldType.INTEGER,
                            replaced: Influx.FieldType.INTEGER,
                            bytes_added: Influx.FieldType.INTEGER,
                        },
                        tags: tagValues,
                    },
                    {
                        measurement: 'log_event',
                        fields: {
                            message: Influx.FieldType.STRING,
                            exception_message: Influx.FieldType.STRING,
                            app_name: Influx.FieldType.STRING,
                            app_id: Influx.FieldType.STRING,
                            execution_id: Influx.FieldType.STRING,
                            command: Influx.FieldType.STRING,
                            result_code: Influx.FieldType.STRING,
                            origin: Influx.FieldType.STRING,
                            context: Influx.FieldType.STRING,
                            session_id: Influx.FieldType.STRING,
                            raw_event: Influx.FieldType.STRING,

                            // engine performance fields
                            process_time: Influx.FieldType.FLOAT,
                            work_time: Influx.FieldType.FLOAT,
                            lock_time: Influx.FieldType.FLOAT,
                            validate_time: Influx.FieldType.FLOAT,
                            traverse_time: Influx.FieldType.FLOAT,
                            handle: Influx.FieldType.INTEGER,
                            net_ram: Influx.FieldType.INTEGER,
                            peak_ram: Influx.FieldType.INTEGER,
                        },
                        tags: tagValuesLogEvent,
                    },
                    {
                        measurement: 'butlersos_memory_usage',
                        fields: {
                            heap_used: Influx.FieldType.FLOAT,
                            heap_total: Influx.FieldType.FLOAT,
                            external: Influx.FieldType.FLOAT,
                            process_memory: Influx.FieldType.FLOAT,
                        },
                        tags: ['butler_sos_instance', 'version'],
                    },
                    {
                        measurement: 'user_session_summary',
                        fields: {
                            session_count: Influx.FieldType.INTEGER,
                            session_user_id_list: Influx.FieldType.STRING,
                        },
                        tags: tagValuesUserProxySessions,
                    },
                    {
                        measurement: 'user_session_list',
                        fields: {
                            session_user_id_list: Influx.FieldType.STRING,
                        },
                        tags: tagValuesUserProxySessions,
                    },
                ],
            });
        } else if (settings.config.get('Butler-SOS.influxdbConfig.version') === 2) {
            // Set up Influxdb v2 client
            const url = `http://${settings.config.get('Butler-SOS.influxdbConfig.host')}:${settings.config.get(
                'Butler-SOS.influxdbConfig.port'
            )}`;
            const token = settings.config.get('Butler-SOS.influxdbConfig.v2Config.token');

            try {
                settings.influx = new InfluxDB2({ url, token });
            } catch (err) {
                settings.logger.error(
                    `INFLUXDB2 METRICS INIT: Error creating InfluxDB 2 client: ${settings.getErrorMessage(err)}`
                );
                settings.logger.error(`INFLUXDB2 METRICS INIT: Exiting.`);
            }
        } else if (settings.config.get('Butler-SOS.influxdbConfig.version') === 3) {
            // Configure InfluxDB v3 client logger to suppress internal error messages
            setInfluxV3Logger({
                error: () => {},
                warn: () => {},
            });

            // Set up Influxdb v3 client
            const hostName = settings.config.get('Butler-SOS.influxdbConfig.host');
            const port = settings.config.get('Butler-SOS.influxdbConfig.port');
            const host = `http://${hostName}:${port}`;
            const token = settings.config.get('Butler-SOS.influxdbConfig.v3Config.token');
            const database = settings.config.get('Butler-SOS.influxdbConfig.v3Config.database');

            // Get timeout settings with defaults
            const writeTimeout = settings.config.has(
                'Butler-SOS.influxdbConfig.v3Config.writeTimeout'
            )
                ? settings.config.get('Butler-SOS.influxdbConfig.v3Config.writeTimeout')
                : 10000;

            const queryTimeout = settings.config.has(
                'Butler-SOS.influxdbConfig.v3Config.queryTimeout'
            )
                ? settings.config.get('Butler-SOS.influxdbConfig.v3Config.queryTimeout')
                : 60000;

            try {
                settings.influx = new InfluxDBClient3({
                    host,
                    token,
                    database,
                    timeout: writeTimeout,
                    queryTimeout,
                });

                // Test connection by executing a simple query
                settings.logger.info(
                    `INFLUXDB3 METRICS INIT: Testing connection to InfluxDB v3...`
                );
                try {
                    const testQuery = `SELECT 1 as test LIMIT 1`;
                    const queryResult = settings.influx.query(testQuery, database);

                    const iterator = queryResult[Symbol.asyncIterator]();
                    await iterator.next();

                    const tokenPreview = token.substring(0, 4) + '***';
                    settings.logger.info(`INFLUXDB3 METRICS INIT: Connection successful!`);
                    settings.logger.info(`INFLUXDB3 METRICS INIT:   Host: ${hostName}`);
                    settings.logger.info(`INFLUXDB3 METRICS INIT:   Port: ${port}`);
                    settings.logger.info(`INFLUXDB3 METRICS INIT:   Database: ${database}`);
                    settings.logger.info(`INFLUXDB3 METRICS INIT:   Token: ${tokenPreview}`);
                    settings.logger.info(
                        `INFLUXDB3 METRICS INIT:   Socket timeout: ${writeTimeout}ms`
                    );
                    settings.logger.info(
                        `INFLUXDB3 METRICS INIT:   Query timeout: ${queryTimeout}ms`
                    );
                } catch (testErr) {
                    settings.logger.warn(
                        `INFLUXDB3 METRICS INIT: Could not test connection (this may be normal): ${settings.getErrorMessage(testErr)}`
                    );
                    const tokenPreview = token.substring(0, 4) + '***';
                    settings.logger.info(`INFLUXDB3 METRICS INIT: Client created with:`);
                    settings.logger.info(`INFLUXDB3 METRICS INIT:   Host: ${hostName}`);
                    settings.logger.info(`INFLUXDB3 METRICS INIT:   Port: ${port}`);
                    settings.logger.info(`INFLUXDB3 METRICS INIT:   Database: ${database}`);
                    settings.logger.info(`INFLUXDB3 METRICS INIT:   Token: ${tokenPreview}`);
                    settings.logger.info(
                        `INFLUXDB3 METRICS INIT:   Socket timeout: ${writeTimeout}ms`
                    );
                    settings.logger.info(
                        `INFLUXDB3 METRICS INIT:   Query timeout: ${queryTimeout}ms`
                    );
                }
            } catch (err) {
                settings.logger.error(
                    `INFLUXDB3 METRICS INIT: Error creating InfluxDB 3 client: ${settings.getErrorMessage(err)}`
                );
                settings.logger.error(`INFLUXDB3 METRICS INIT: Exiting.`);
            }
        } else {
            settings.logger.error(
                `CONFIG: Influxdb version ${settings.config.get('Butler-SOS.influxdbConfig.version')} is not supported!`
            );
        }

        // Now initialise InfluxDB
        await initInfluxDB(settings);
    } else {
        settings.logger.info(`CONFIG: Influxdb not enabled, skipping setup of db.`);
    }
}

/**
 * Initializes the InfluxDB connection based on configuration settings.
 * Sets up databases, retention policies, and write APIs depending on InfluxDB version.
 *
 * @param {object} settings - The settings object
 */
export async function initInfluxDB(settings) {
    let enableInfluxdb = false;

    // Handle InfluxDB v1
    if (settings.config.get('Butler-SOS.influxdbConfig.version') === 1) {
        const dbName = settings.config.get('Butler-SOS.influxdbConfig.v1Config.dbName');

        if (
            settings.influx &&
            settings.config.get('Butler-SOS.influxdbConfig.enable') === true &&
            dbName?.length > 0
        ) {
            enableInfluxdb = true;
        }

        if (enableInfluxdb) {
            try {
                const names = await settings.influx.getDatabaseNames();
                if (!names.includes(dbName)) {
                    // Create new database
                    try {
                        await settings.influx.createDatabase(dbName);
                        settings.logger.info(`CONFIG: Created new InfluxDB v1 database: ${dbName}`);

                        const newPolicy = settings.config.get(
                            'Butler-SOS.influxdbConfig.v1Config.retentionPolicy'
                        );

                        // Create new default retention policy
                        try {
                            await settings.influx.createRetentionPolicy(newPolicy.name, {
                                database: dbName,
                                duration: newPolicy.duration,
                                replication: 1,
                                isDefault: true,
                            });

                            settings.logger.info(
                                `CONFIG: Created new InfluxDB v1 retention policy: ${newPolicy.name}`
                            );
                        } catch (err) {
                            settings.logger.error(
                                `CONFIG: Error creating new InfluxDB v1 retention policy "${newPolicy.name}"! ${settings.getErrorMessage(err)}`
                            );
                        }
                    } catch (err) {
                        settings.logger.error(
                            `CONFIG: Error creating new InfluxDB v1 database "${dbName}"! ${settings.getErrorMessage(err)}`
                        );
                    }
                } else {
                    settings.logger.info(`CONFIG: Found InfluxDB v1 database: ${dbName}`);
                }
            } catch (err) {
                settings.logger.error(
                    `CONFIG: Error getting list of InfluxDB v1 databases. ${settings.getErrorMessage(err)}`
                );
            }
        }
    } else if (settings.config.get('Butler-SOS.influxdbConfig.version') === 2) {
        // Get config
        const org = settings.config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = settings.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');
        const description = settings.config.get('Butler-SOS.influxdbConfig.v2Config.description');
        const token = settings.config.get('Butler-SOS.influxdbConfig.v2Config.token');
        const retentionDuration = settings.config.get(
            'Butler-SOS.influxdbConfig.v2Config.retentionDuration'
        );

        if (
            settings.influx &&
            settings.config.get('Butler-SOS.influxdbConfig.enable') === true &&
            org?.length > 0 &&
            bucketName?.length > 0 &&
            token?.length > 0 &&
            retentionDuration?.length > 0
        ) {
            enableInfluxdb = true;
        }

        if (enableInfluxdb) {
            let orgID;

            try {
                // Get organisation by name
                const orgsAPI = new OrgsAPI(settings.influx);
                const organizations = await orgsAPI.getOrgs({ org });
                if (!organizations || !organizations.orgs || !organizations.orgs.length) {
                    settings.logger.error(`INFLUXDB2: No organization named "${org}" found!`);
                }
                orgID = organizations.orgs[0].id;
                settings.logger.info(
                    `INFLUXDB2: Using organization "${org}" identified by "${orgID}"`
                );
            } catch (err) {
                settings.logger.error(
                    `INFLUXDB2: Error getting organisation: ${settings.getErrorMessage(err)}`
                );
            }

            try {
                // Get buckets by name
                const bucketsAPI = new BucketsAPI(settings.influx);
                try {
                    const buckets = await bucketsAPI.getBuckets({ orgID, name: bucketName });
                    if (buckets && buckets.buckets && buckets.buckets.length > 0) {
                        const bucketID = buckets.buckets[0].id;
                        settings.logger.info(
                            `INFLUXDB2: Bucket named "${bucketName}" already exists, bucket ID="${bucketID}"`
                        );
                    }
                } catch (e) {
                    if (e instanceof HttpError && e.statusCode === 404) {
                        // Bucket not found. Let's create it
                        settings.logger.info(
                            `INFLUXDB2: Bucket named "${bucketName}" not found, creating it...`
                        );

                        const newBucket = await bucketsAPI.postBuckets({
                            body: {
                                orgID,
                                name: bucketName,
                                description,
                                rp: retentionDuration,
                            },
                        });

                        settings.logger.verbose(
                            `INFLUXDB2: New bucket: ${JSON.stringify(
                                newBucket,
                                (key, value) => (key === 'links' ? undefined : value),
                                2
                            )}`
                        );
                    } else {
                        throw e;
                    }
                }
            } catch (err) {
                settings.logger.error(
                    `INFLUXDB2: Error getting bucket: ${settings.getErrorMessage(err)}`
                );
            }

            // Create array of per-server writeAPI objects
            settings.serverList.forEach((server) => {
                const tags = getServerTags(settings.logger, server);

                const writeOptions = {
                    defaultTags: tags,
                    flushInterval: 5000,
                    maxRetries: 2,
                };

                try {
                    const serverWriteApi = settings.influx.getWriteApi(
                        org,
                        bucketName,
                        'ns',
                        writeOptions
                    );

                    settings.influxWriteApi.push({
                        serverName: server.serverName,
                        writeAPI: serverWriteApi,
                    });
                } catch (err) {
                    settings.logger.error(
                        `INFLUXDB2: Error getting write API: ${settings.getErrorMessage(err)}`
                    );
                }
            });
        }
    } else if (settings.config.get('Butler-SOS.influxdbConfig.version') === 3) {
        // Get config
        const databaseName = settings.config.get('Butler-SOS.influxdbConfig.v3Config.database');
        const token = settings.config.get('Butler-SOS.influxdbConfig.v3Config.token');
        const retentionDuration = settings.config.get(
            'Butler-SOS.influxdbConfig.v3Config.retentionDuration'
        );

        if (
            settings.influx &&
            settings.config.get('Butler-SOS.influxdbConfig.enable') === true &&
            databaseName?.length > 0 &&
            token?.length > 0 &&
            retentionDuration?.length > 0
        ) {
            enableInfluxdb = true;
        }

        if (enableInfluxdb) {
            settings.logger.info(`INFLUXDB3: Using database "${databaseName}"`);

            settings.serverList.forEach((server) => {
                const tags = getServerTags(settings.logger, server);

                settings.influxWriteApi.push({
                    serverName: server.serverName,
                    writeAPI: settings.influx,
                    database: databaseName,
                    defaultTags: tags,
                });
            });
        }
    }
}
