/* eslint-disable no-unused-vars */

const globals = require('../globals');
const postToMQTT = require('./post-to-mqtt');

function setupLogDbTimer() {
    // Get query period from config file. If not specified there, use default value.
    let queryPeriod = '5 minutes';
    if (globals.config.has('Butler-SOS.logdb.queryPeriod')) {
        queryPeriod = globals.config.get('Butler-SOS.logdb.queryPeriod');
    }

    // Configure timer for getting log data from Postgres
    setInterval(() => {
        globals.logger.verbose('LOGDB: Event started: Query log db');

        // Create list of logging levels to include in query
        const arrayincludeLogLevels = [];
        if (globals.config.get('Butler-SOS.logdb.extractErrors')) {
            arrayincludeLogLevels.push("'ERROR'");
        }
        if (globals.config.get('Butler-SOS.logdb.extractWarnings')) {
            arrayincludeLogLevels.push("'WARN'");
        }
        if (globals.config.get('Butler-SOS.logdb.extractInfo')) {
            arrayincludeLogLevels.push("'INFO'");
        }
        const includeLogLevels = arrayincludeLogLevels.join();

        // checkout a Postgres client from connection pool
        globals.pgPool
            .connect()
            .then((pgClient) =>
                pgClient
                    .query(
                        `select
            id,
            entry_timestamp as timestamp,
            entry_level,
            process_host,
            process_name,
            payload
          from public.log_entries
          where
            entry_level in (${includeLogLevels}) and
            (entry_timestamp > now() - INTERVAL '${queryPeriod}' )
          order by
            entry_timestamp desc
          `
                    )
                    .then((res) => {
                        pgClient.release();
                        globals.logger.debug('LOGDB: Got query response.');

                        const { rows } = res;
                        rows.forEach((row) => {
                            globals.logger.silly(`LOGDB: Row: ${JSON.stringify(row)}`);

                            // Post to Influxdb (if enabled)
                            if (
                                (globals.config.has('Butler-SOS.influxdbConfig.enableInfluxdb') &&
                                    globals.config.get(
                                        'Butler-SOS.influxdbConfig.enableInfluxdb'
                                    ) === true) ||
                                (globals.config.has('Butler-SOS.influxdbConfig.enable') &&
                                    globals.config.get('Butler-SOS.influxdbConfig.enable') === true)
                            ) {
                                globals.logger.silly(`LOGDB: Posting log db data to Influxdb...`);

                                // Make sure that the payload message exists - storing it to Influx would otherwise throw an error
                                // if (!row.payload.hasOwnProperty('Message')) {
                                // Suggested by GitHub Copilot:
                                if (!Object.prototype.hasOwnProperty.call(row.payload, 'Message')) {
                                    // eslint-disable-next-line no-param-reassign
                                    row.payload.Message = '';
                                }

                                // Get all tags for the current server.
                                // Some special logic is needed to match the host value returned from Postgres with the logDbHost property from
                                // the YAML config file.
                                // Once we have that match we can add all the tags for that server.
                                const serverItem = globals.serverList.find((item) => {
                                    globals.logger.silly(
                                        `LOGDB: Matching logdb host "${row.process_host}" against config file logDbHost "${item.logDbHost}"`
                                    );
                                    return item.logDbHost === row.process_host;
                                });

                                // NOTE: If no match is found above, i.e. serverItem == undefined, this means that a Sense host name was returned,
                                // but no server in the YAML config file had a matching logDbHost setting.
                                // This is an error and should be sent to the log.
                                // Also, only store data into Influxdb for servers defined in YAML config file.

                                if (serverItem === undefined) {
                                    globals.logger.verbose(
                                        `LOGDB: No logDbHost config file entries matching host name received from Sense: ${row.process_host}`
                                    );
                                    globals.logger.verbose(
                                        `LOGDB:    Hint: Consider adding "${row.process_host}" as a logDbHost entry in the config file...`
                                    );
                                } else {
                                    // group = serverItem.serverTags.serverGroup;
                                    const srvName = serverItem.serverName;
                                    const srvDesc = serverItem.serverDescription;

                                    let tagsForDbEntry = {
                                        host: row.process_host,
                                        server_name: srvName,
                                        server_description: srvDesc,
                                        source_process: row.process_name,
                                        log_level: row.entry_level,
                                    };

                                    // Add all tags defined for this server in the config file
                                    if (
                                        // serverItem.hasOwnProperty('serverTags') &&
                                        // Suggestions by GitHub Copilot:
                                        Object.prototype.hasOwnProperty.call(
                                            serverItem,
                                            'serverTags'
                                        ) &&
                                        serverItem.serverTags !== null
                                    ) {
                                        // Loop over all tags defined for the current server, adding them to the data structure that will later be passed to Influxdb
                                        Object.entries(serverItem.serverTags).forEach((entry) => {
                                            tagsForDbEntry = Object.assign(tagsForDbEntry, {
                                                [entry[0]]: entry[1],
                                            });
                                        });

                                        globals.logger.silly(
                                            `LOGDB: Tags passed to Influxdb as part of logdb record: ${JSON.stringify(
                                                tagsForDbEntry
                                            )}`
                                        );
                                    }

                                    // Write the whole reading to Influxdb
                                    globals.influx
                                        .writePoints([
                                            {
                                                measurement: 'log_event_logdb',
                                                tags: tagsForDbEntry,
                                                fields: {
                                                    message: row.payload.Message,
                                                },
                                                timestamp: row.timestamp,
                                            },
                                        ])
                                        .then((_err) => {
                                            globals.logger.silly(
                                                'LOGDB: Sent log db event to Influxdb'
                                            );
                                        })
                                        .catch((err) => {
                                            globals.logger.error(
                                                `LOGDB: Error saving log event to InfluxDB! ${err.stack}`
                                            );
                                            globals.logger.error(
                                                `LOGDB:   Full error: ${JSON.stringify(err)}`
                                            );
                                        });
                                }

                                // Post to MQTT (if enabled)
                                if (
                                    (globals.config.has('Butler-SOS.mqttConfig.enableMQTT') &&
                                        globals.config.get('Butler-SOS.mqttConfig.enableMQTT') ===
                                            true) ||
                                    (globals.config.has('Butler-SOS.mqttConfig.enable') &&
                                        globals.config.get('Butler-SOS.mqttConfig.enable') === true)
                                ) {
                                    globals.logger.silly('LOGDB: Posting log db data to MQTT...');
                                    postToMQTT.postLogDbToMQTT(
                                        row.process_host,
                                        row.process_name,
                                        row.entry_level,
                                        row.payload.Message,
                                        row.timestamp
                                    );
                                }
                            }
                        });
                    })
                    .then((_res) => {
                        globals.logger.verbose('LOGDB: Sent log event to Influxdb');
                    })
                    .catch((err) => {
                        globals.logger.error(`LOGDB: Log db query error: ${err.stack}`);
                        // pgClient.release();
                    })
            )
            .catch((err) => {
                globals.logger.error(
                    `LOGDB: ERROR: Could not connect to Postgres log db: ${err.stack}`
                );
            });
    }, globals.config.get('Butler-SOS.logdb.pollingInterval'));
}

module.exports = {
    setupLogDbTimer,
};
