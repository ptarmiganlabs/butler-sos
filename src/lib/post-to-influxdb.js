const globals = require('../globals');

function postMainMetricsToInfluxdb(host, body, influxTags) {
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
  var minutes = '0' + date.getMinutes();

  // Seconds part from the timestamp
  var seconds = '0' + date.getSeconds();

  // Will display time in 10:30:23 format
  var formattedTime =
    days + ' days, ' + hours + 'h ' + minutes.substr(-2) + 'm ' + seconds.substr(-2) + 's';

  // Build tags structure that will be passed to InfluxDB
  globals.logger.debug(`Health data: Tags sent to InfluxDB: ${JSON.stringify(influxTags)}`);

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
          comitted: body.mem.comitted,
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
          active_docs: globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
            ? body.apps.active_docs
            : '',
          loaded_docs: globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
            ? body.apps.loaded_docs
            : '',
          in_memory_docs: globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
            ? body.apps.in_memory_docs
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
    ],
    {
      retentionPolicy: globals.config.get('Butler-SOS.serversToMonitor.influxDbRetentionPolicy'),
    },
  )

    .then(() => {
      globals.logger.verbose(`Sent health data to Influxdb for server ${influxTags.server_name}`);
    })

    .catch(err => {
      globals.logger.error(`Error saving health data to InfluxDB! ${err.stack}`);
    });
}

function postUserSessionsToInfluxdb(host, virtualProxy, body, influxTags) {
  globals.logger.debug(`User sessions body received (VP=${virtualProxy}): ${JSON.stringify(body)}`);
  globals.logger.debug(`User session: Shared tags sent to InfluxDB (VP=${virtualProxy}): ${JSON.stringify(influxTags)}`);

  // TODO: Make sure the correct user_session_user_directory and user_session_user_id are written for user_session_details measurement
  // TODO: Create entire Influxdb structure before writing it to Influx, i.e. only call writePoints once

  // Build tags structure that will be passed to InfluxDB
  // Get local copy of tags, then add user session specific tags
  let tmpTags = influxTags;
  tmpTags.user_session_virtual_proxy = virtualProxy;
  tmpTags.user_session_host = host;

  // Build comma separated list of all user IDs connected via the current virtual proxy
  let userArray = Array.prototype.map.call(body, s => s.UserDirectory + '\\' + s.UserId);
  let uniqueUserList = Array.from(new Set(userArray)).toString();

  // Write a) # of user sessions and b) list of user IDs to InfluxDB
  globals.influx
    .writePoints(
      [
        {
          measurement: 'user_session_summary',
          tags: tmpTags,
          fields: {
            session_count: body.length,
          },
        },
        {
          measurement: 'user_session_list',
          tags: tmpTags,
          fields: {
            session_user_id_list: uniqueUserList,
          },
        },
      ],
      {
        retentionPolicy: globals.config.get('Butler-SOS.userSessions.influxDbRetentionPolicy'),
      },
    )

    .then(() => {
      globals.logger.verbose(
        `User session summary: Sent user session count to InfluxDB for server ${tmpTags.server_name}, virtual proxy ${tmpTags.user_session_virtual_proxy}: ${body.length}`,
      );
      globals.logger.verbose(
        `User session summary: List of users connected to server ${tmpTags.server_name}, virtual proxy ${tmpTags.user_session_virtual_proxy}: ${uniqueUserList}`,
      );
      globals.logger.verbose(
        `User session summary: AA ${influxTags.server_name}, virtual proxy ${influxTags.user_session_virtual_proxy}: ${uniqueUserList}`,
      );
    })

    .then(() => {
      // Write details about each session to InfluxDB
      body.forEach(bodyItem => {

        globals.logger.debug(`User session: Body item: ${JSON.stringify(bodyItem)}`);

        // Start over with fresh copy of shared tags
        tmpTags = influxTags;
        tmpTags.user_session_virtual_proxy = virtualProxy;
        tmpTags.user_session_host = host;

        // Add extra tags for this body item
        tmpTags.user_session_user_directory = bodyItem.UserDirectory;
        tmpTags.user_session_user_id = bodyItem.UserId;

        let tmpDatapoint = [
          {
            measurement: 'user_session_details',
            tags: tmpTags,
            fields: {
              // attributes: bodyItem.Attributes,
              session_id: bodyItem.SessionId,
              user_directory: bodyItem.UserDirectory,
              user_id: bodyItem.UserId,
            },
          },
        ];

        globals.influx
          .writePoints(tmpDatapoint, {
            retentionPolicy: globals.config.get('Butler-SOS.userSessions.influxDbRetentionPolicy'),
          })
          .then(() => {
            globals.logger.silly(
              `User session details for server ${tmpTags.server_name}: ${JSON.stringify(
                tmpDatapoint,
                null,
                2,
              )}`,
            );
          })
          .catch(err => {
            globals.logger.error(`Error saving user session data to InfluxDB! ${err.stack}`);
          });
      });
    })

    .catch(err => {
      globals.logger.error(`Error saving user session count to InfluxDB! ${err.stack}`);
    });

  // globals.logger.verbose(`Sent user session data to InfluxDB for server ${tmpTags.server_name}`);
}

module.exports = {
  postMainMetricsToInfluxdb,
  postUserSessionsToInfluxdb,
};
