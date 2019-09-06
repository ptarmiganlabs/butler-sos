const globals = require('../globals');
const postToMQTT = require('./post-to-mqtt');

function setupLogDbTimer() {
  // Get query period from config file. If not specified there, use default value.
  var queryPeriod = '5 minutes';
  if (globals.config.has('Butler-SOS.logdb.queryPeriod')) {
    queryPeriod = globals.config.get('Butler-SOS.logdb.queryPeriod');
  }

  // Configure timer for getting log data from Postgres
  setInterval(function() {
    globals.logger.verbose('Event started: Query log db');

    // Create list of logging levels to include in query
    // extractErrors: true
    // extractWarnings: true
    // extractInfo: false

    let arrayincludeLogLevels = [];
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
      .then(pgClient => {
        return pgClient
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
          `,
          )
          .then(res => {
            pgClient.release();
            globals.logger.debug('Log db query got a response.');

            var rows = res.rows;
            rows.forEach(function(row) {
              globals.logger.silly(`Log db row: ${JSON.stringify(row)}`);

              // Post to Influxdb (if enabled)
              if (globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb')) {
                globals.logger.silly('Posting log db data to Influxdb...');

                // Make sure that the payload message exists - storing it to Influx would otherwise throw an error
                if (!row.payload.hasOwnProperty('Message')) {
                  row.payload.Message = '';
                }

                // Get all tags for the current server.
                // Some special logic is needed to match the host value returned from Postgres with the logDbHost property from
                // the YAML config file.
                // Once we have that match we can add all the tags for that server.
                serverItem = globals.serverList.find(item => {
                  globals.logger.silly(
                    `Matching logdb host "${row.process_host}" against config file logDbHost "${item.logDbHost}"`,
                  );
                  return item.logDbHost == row.process_host;
                });

                // If data row returned from log db is about a server which is not defined in the YAML config file, we need to be careful:
                // Simple solution: only store data into Influxdb for servers defined in YAML config file.

                if (serverItem == undefined) {
                  // group = '<no group>';
                  srvName = '<no server>';
                  srvDesc = '<no description>';
                } else {
                  // group = serverItem.serverTags.serverGroup;
                  srvName = serverItem.serverName;
                  srvDesc = serverItem.serverDescription;
                }

                let tagsForDbEntry = {
                  host: row.process_host,
                  server_name: srvName,
                  server_description: srvDesc,
                  source_process: row.process_name,
                  log_level: row.entry_level,
                };

                // Add all tags defined for this server in the config file
                if (serverItem.hasOwnProperty('serverTags')) {
                  // Loop over all tags defined for the current server, adding them to the data structure that will later be passed to Influxdb
                  Object.entries(serverItem.serverTags).forEach(entry => {
                    tagsForDbEntry = Object.assign(tagsForDbEntry, {
                      [entry[0]]: entry[1],
                    });
                  });

                  globals.logger.silly(
                    `Tags passed to Influxdb as part of logdb record: ${JSON.stringify(
                      tagsForDbEntry,
                    )}`,
                  );
                }

                // Write the whole reading to Influxdb
                // TODO: Use retention policy when writing to Influxdb
                globals.influx
                  .writePoints(
                    [
                      {
                        measurement: 'log_event',
                        tags: tagsForDbEntry,
                        fields: {
                          message: row.payload.Message,
                        },
                        timestamp: row.timestamp,
                      },
                    ],
                    {
                      retentionPolicy: globals.config.get(
                        'Butler-SOS.logdb.influxDbRetentionPolicy',
                      ),
                    },
                  )
                  .then(err => {
                    globals.logger.silly('Sent log db event to Influxdb');
                  })
                  .catch(err => {
                    globals.logger.error(`Error saving log event to InfluxDB! ${err.stack}`);
                    globals.logger.error(`  Full error: ${JSON.stringify(err)}`);
                  });
              }

              // Post to MQTT (if enabled)
              if (globals.config.get('Butler-SOS.mqttConfig.enableMQTT')) {
                globals.logger.silly('Posting log db data to MQTT...');
                postToMQTT.postLogDbToMQTT(
                  row.process_host,
                  row.process_name,
                  row.entry_level,
                  row.payload.Message,
                  row.timestamp,
                );
              }
            });
          })
          .then(res => {
            globals.logger.verbose('Sent log event to Influxdb');
          })
          .catch(err => {
            globals.logger.error(`Log db query error: ${err.stack}`);
            // pgClient.release();
          });
      })
      .catch(err => {
        globals.logger.error(`ERROR: Could not connect to Postgres log db: ${err.stack}`);
      });
  }, globals.config.get('Butler-SOS.logdb.pollingInterval'));
}

module.exports = {
  setupLogDbTimer,
};
