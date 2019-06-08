const globals = require('../globals');


function postToInfluxdb(host, body, influxTags) {
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

  // Build tags structure that will be passed to InfluxDB
  globals.logger.debug(`Tags sent to InfluxDB: ${JSON.stringify(influxTags)}`);

  // Write the whole reading to Influxdb
  globals.influx
    .writePoints([{
        measurement: "sense_server",
        tags: influxTags,
        fields: {
          version: body.version,
          started: body.started,
          uptime: formattedTime
        }
      },
      {
        measurement: "mem",
        tags: influxTags,
        fields: {
          comitted: body.mem.comitted,
          allocated: body.mem.allocated,
          free: body.mem.free
        }
      },
      {
        measurement: "apps",
        tags: influxTags,
        fields: {
          active_docs_count: body.apps.active_docs.length,
          loaded_docs_count: body.apps.loaded_docs.length,
          in_memory_docs_count: body.apps.in_memory_docs.length,
          active_docs: (globals.config.get("Butler-SOS.influxdbConfig.includeFields.activeDocs") ? body.apps.active_docs : ''),
          loaded_docs: (globals.config.get("Butler-SOS.influxdbConfig.includeFields.loadedDocs") ? body.apps.loaded_docs : ''),
          in_memory_docs: (globals.config.get("Butler-SOS.influxdbConfig.includeFields.inMemoryDocs") ? body.apps.in_memory_docs : ''),
          calls: body.apps.calls,
          selections: body.apps.selections
        }
      },
      {
        measurement: "cpu",
        tags: influxTags,
        fields: {
          total: body.cpu.total
        }
      },
      {
        measurement: "session",
        tags: influxTags,
        fields: {
          active: body.session.active,
          total: body.session.total
        }
      },
      {
        measurement: "users",
        tags: influxTags,
        fields: {
          active: body.users.active,
          total: body.users.total
        }
      },
      {
        measurement: "cache",
        tags: influxTags,
        fields: {
          hits: body.cache.hits,
          lookups: body.cache.lookups,
          added: body.cache.added,
          replaced: body.cache.replaced,
          bytes_added: body.cache.bytes_added
        }
      },
      {
        measurement: "saturated",
        tags: influxTags,
        fields: {
          saturated: body.saturated
        }
      }
    ])
    .then(() => {
      globals.logger.verbose(`Sent health data to Influxdb for server ${influxTags.server_name}`);
    })

    .catch(err => {
      console.error(`Error saving health data to InfluxDB! ${err.stack}`);
    });
}


module.exports = {
  postToInfluxdb
};

