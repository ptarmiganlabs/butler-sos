// Add dependencies
var request = require("request");

// Load code from sub modules
var globals = require("./globals");

// Load certificates to use when connecting to healthcheck API
var fs = require("fs"),
  path = require("path"),
  certFile = path.resolve(
    __dirname,
    globals.config.get("Butler-SOS.cert.clientCert")
  ),
  keyFile = path.resolve(
    __dirname,
    globals.config.get("Butler-SOS.cert.clientCertKey")
  ),
  caFile = path.resolve(
    __dirname,
    globals.config.get("Butler-SOS.cert.clientCertCA")
  );
// certFile = path.resolve(__dirname, "ssl/client.pem"),
// keyFile = path.resolve(__dirname, "ssl/client_key.pem"),
// caFile = path.resolve(__dirname, "ssl/root.pem");

// Set specific log level (if/when needed)
// Possible values are { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
// globals.logger.transports.console.level = 'info';
// globals.logger.transports.console.level = 'verbose';
// globals.logger.transports.console.level = 'debug';
// Default is to use log level defined in config file
globals.logger.transports.console.level = globals.config.get(
  "Butler-SOS.logLevel"
);

globals.logger.info("Starting Butler SOS");
globals.logger.info("Log level is: " + globals.logger.transports.console.level);

function postToInfluxdb(host, serverName, body) {
  // Calculate server uptime

  var dateTime = Date.now();
  var timestamp = Math.floor(dateTime);

  var str = body.started;
  var year = str.substring(0, 4);
  var month = str.substring(4, 6);
  var day = str.substring(6, 8);
  var hour = str.substring(9, 11);
  var minute = str.substring(11, 13);
  var second = str.substring(13, 15);
  var dateTimeStarted = new Date(year, month - 1, day, hour, minute, second);
  var timestampStarted = Math.floor(dateTimeStarted);

  var diff = timestamp - timestampStarted;

  // Create a new JavaScript Date object based on the timestamp
  // multiplied by 1000 so that the argument is in milliseconds, not seconds.
  var date = new Date(diff);

  var days = Math.trunc(diff / (1000 * 60 * 60 * 24));

  // Hours part from the timestamp
  var hours = date.getHours();

  // Minutes part from the timestamp
  var minutes = "0" + date.getMinutes();

  // Seconds part from the timestamp
  var seconds = "0" + date.getSeconds();

  // Will display time in 10:30:23 format
  var formattedTime =
    days +
    " days, " +
    hours +
    "h " +
    minutes.substr(-2) +
    "m " +
    seconds.substr(-2) +
    "s";

  // Write the whole reading to Influxdb
  globals.influx
    .writePoints([
      {
        measurement: "sense_server",
        tags: {
          host: serverName
        },
        fields: {
          version: body.version,
          started: body.started,
          uptime: formattedTime
        }
      },
      {
        measurement: "mem",
        tags: {
          host: serverName
        },
        fields: {
          comitted: body.mem.comitted,
          allocated: body.mem.allocated,
          free: body.mem.free
        }
      },
      {
        measurement: "apps",
        tags: {
          host: serverName
        },
        fields: {
          active_docs_count: body.apps.active_docs.length,
          loaded_docs_count: body.apps.loaded_docs.length,
          in_memory_docs_count: body.apps.in_memory_docs.length,
          calls: body.apps.calls,
          selections: body.apps.selections
        }
      },
      {
        measurement: "cpu",
        tags: {
          host: serverName
        },
        fields: {
          total: body.cpu.total
        }
      },
      {
        measurement: "session",
        tags: {
          host: serverName
        },
        fields: {
          active: body.session.active,
          total: body.session.total
        }
      },
      {
        measurement: "users",
        tags: {
          host: serverName
        },
        fields: {
          active: body.users.active,
          total: body.users.total
        }
      },
      {
        measurement: "cache",
        tags: {
          host: serverName
        },
        fields: {
          hits: body.cache.hits,
          lookups: body.cache.lookups,
          added: body.cache.added,
          replaced: body.cache.replaced,
          bytes_added: body.cache.bytes_added
        }
      }
    ])
    .then(err => {
      globals.logger.verbose("Sent health Influxdb: " + serverName);
    })

    .catch(err => {
      console.error(`Error saving health data to InfluxDB! ${err.stack}`);
    });
}

function postLogDbToMQTT(process_host, process_name, entry_level, message, timestamp) {
  // Get base MQTT topic
  var baseTopic = globals.config.get("Butler-SOS.mqttConfig.baseTopic");

  // Send to MQTT
  globals.mqttClient.publish(
    baseTopic + process_host + "/" + process_name + "/" + entry_level,
    message
  );
}

function postHealthToMQTT(host, serverName, body) {
  // Get base MQTT topic
  var baseTopic = globals.config.get("Butler-SOS.mqttConfig.baseTopic");

  // Send to MQTT
  globals.mqttClient.publish(baseTopic + serverName + "/version", body.version);
  globals.mqttClient.publish(baseTopic + serverName + "/started", body.started);
  globals.mqttClient.publish(
    baseTopic + serverName + "/mem/comitted",
    body.mem.committed.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/mem/allocated",
    body.mem.allocated.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/mem/free",
    body.mem.free.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/cpu/total",
    body.cpu.total.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/session/active",
    body.session.active.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/session/total",
    body.session.total.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/apps/active_docs",
    body.apps.active_docs.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/apps/loaded_docs",
    body.apps.loaded_docs.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/apps/in_memory_docs",
    body.apps.in_memory_docs.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/apps/calls",
    body.apps.calls.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/apps/selections",
    body.apps.selections.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/users/active",
    body.users.active.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/users/total",
    body.users.total.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/cache/hits",
    body.cache.hits.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/cache/lookups",
    body.cache.lookups.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/cache/added",
    body.cache.added.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/cache/replaced",
    body.cache.replaced.toString()
  );
  globals.mqttClient.publish(
    baseTopic + serverName + "/cache/bytes_added",
    body.cache.bytes_added.toString()
  );

  if (body.cache.lookups > 0) {
    globals.mqttClient.publish(
      baseTopic + serverName + "/cache/hit_ratio",
      Math.floor(body.cache.hits / body.cache.lookups * 100).toString()
    );
  }
}

function getStatsFromSense(host, serverName) {
  globals.logger.log(
    "debug",
    "URL=" + "https://" + host + "/engine/healthcheck/"
  );

  request(
    {
      followAllRedirects: true,
      url: "https://" + host + "/engine/healthcheck/",
      headers: {
        "Cache-Control": "no-cache"
      },
      json: true,
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile),
      ca: fs.readFileSync(caFile)
    },
    function(error, response, body) {
      // Check for error
      if (error) {
        return globals.logger.error("Error:", error);
      }

      if (!error && response.statusCode === 200) {
        globals.logger.verbose("Received ok response from " + serverName);
        globals.logger.debug(body);

        // Post to MQTT (if enabled)
        if (globals.config.get("Butler-SOS.mqttConfig.enableMQTT")) {
          globals.logger.debug("Calling MQTT posting method");
          postHealthToMQTT(host, serverName, body);
        }

        // Post to Influxdb (if enabled)
        if (globals.config.get("Butler-SOS.influxdbConfig.enableInfluxdb")) {
          globals.logger.debug("Calling Influxdb posting method");
          postToInfluxdb(host, serverName, body);
        }
      }
    }
  );
}

// Configure timer for getting log data from Postgres
setInterval(function() {
  globals.logger.verbose("Event started: Query log db");

  // checkout a Postgres client from connection pool
  globals.pgPool.connect().then(pgClient => {
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
          entry_level in ('WARN', 'ERROR') and
          (entry_timestamp > now() - INTERVAL '2 minutes' )
        order by
          entry_timestamp desc
        `
      )
      .then(res => {
        pgClient.release();
        globals.logger.debug("Log db query got a response.");

        var rows = res.rows;
        rows.forEach(function(row) {
          globals.logger.silly("Log db row: " + JSON.stringify(row));

          // Post to Influxdb (if enabled)
          if (globals.config.get("Butler-SOS.influxdbConfig.enableInfluxdb")) {
            globals.logger.debug("Posting log db data to Influxdb...");

            // Write the whole reading to Influxdb
            globals.influx
              .writePoints([
                {
                  measurement: "log_entry",
                  tags: {
                    host: row.process_host,
                    source_process: row.process_name,
                    log_level: row.entry_level
                  },
                  fields: {
                    message: row.payload.Message
                  },
                  timestamp: row.timestamp
                }
              ])
              .then(err => {
                globals.logger.silly("Sent log db event to Influxdb. ");
              })
              .catch(err => {
                console.error(
                  `Error saving log event to InfluxDB! ${err.stack}`
                );
              });
          }

          // Post to MQTT (if enabled)
          if (globals.config.get("Butler-SOS.mqttConfig.enableMQTT")) {
            globals.logger.debug("Posting log db data to MQTT...");
            postLogDbToMQTT(
              row.process_host,
              row.process_name,
              row.entry_level,
              row.payload.Message,
              row.timestamp
            );
          }
        });
      })
      .then(res => {
        globals.logger.verbose("Sent log event to Influxdb. ");
      })
      .catch(e => {
        pgClient.release();
        globals.logger.error("Log db query error: " + err.stack);
      });
  });
}, globals.config.get("Butler-SOS.logdb.pollingInterval"));

// Configure timer for getting healthcheck data
setInterval(function() {
  globals.logger.verbose("Event started: Statistics collection");

  var serverList = globals.config.get("Butler-SOS.serversToMonitor.servers");
  serverList.forEach(function(server) {
    globals.logger.verbose("Getting stats for server: " + server.serverName);

    getStatsFromSense(server.host, server.serverName);
  });
}, globals.config.get("Butler-SOS.serversToMonitor.pollingInterval"));
