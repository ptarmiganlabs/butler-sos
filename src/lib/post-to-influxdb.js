const globals = require('../globals');
var _ = require('lodash');

function postHealthMetricsToInfluxdb(host, body, influxTags) {
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
  globals.logger.debug(
    `HEALTH METRICS: Health data: Tags sent to InfluxDB: ${JSON.stringify(influxTags)}`,
  );

  // Get app names for active/loaded/inmemory docs
  var appNamesActive = [],
    appNamesLoaded = [],
    appNamesInMemory = [];

  body.apps.active_docs.forEach(function(docID) {
    appNamesActive.push(globals.appNames.find(element => element.id == docID).name);
  });

  body.apps.loaded_docs.forEach(function(docID) {
    appNamesLoaded.push(globals.appNames.find(element => element.id == docID).name);
  });

  body.apps.in_memory_docs.forEach(function(docID) {
    appNamesInMemory.push(globals.appNames.find(element => element.id == docID).name);
  });

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
          active_docs_names: globals.config.get('Butler-SOS.appNames.enableAppNameExtract')
            ? appNamesActive.toString()
            : '',
          loaded_docs: globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
            ? body.apps.loaded_docs
            : '',
          loaded_docs_names: globals.config.get('Butler-SOS.appNames.enableAppNameExtract')
            ? appNamesLoaded.toString()
            : '',
          in_memory_docs: globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
            ? body.apps.in_memory_docs
            : '',
          in_memory_docs_names: globals.config.get('Butler-SOS.appNames.enableAppNameExtract')
            ? appNamesInMemory.toString()
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
        `HEALTH METRICS: Sent health data to Influxdb for server ${influxTags.server_name}`,
      );
    })

    .catch(err => {
      globals.logger.error(`HEALTH METRICS: Error saving health data to InfluxDB! ${err.stack}`);
    });
}

function postUserSessionsToInfluxdb(host, virtualProxy, body, influxTags) {
  globals.logger.debug(
    `USER SESSIONS: User sessions body received (VP=${virtualProxy}): ${JSON.stringify(body)}`,
  );
  globals.logger.debug(
    `USER SESSIONS: User session: Shared tags sent to InfluxDB (VP=${virtualProxy}): ${JSON.stringify(
      influxTags,
    )}`,
  );

  // Build tags structure that will be passed to InfluxDB
  // Get local copy of tags, then add user session specific tags
  let tmpTags = _.cloneDeep(influxTags);
  tmpTags.user_session_virtual_proxy = virtualProxy;
  tmpTags.user_session_host = host;

  // Build comma separated list of all user IDs connected via the current virtual proxy
  let userArray = Array.prototype.map.call(body, s => s.UserDirectory + '\\' + s.UserId);
  let uniqueUserList = Array.from(new Set(userArray)).toString();

  let datapoint = [
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
  ];

  // Add details for each session
  body.forEach(bodyItem => {
    globals.logger.debug(`USER SESSIONS: User session: Body item: ${JSON.stringify(bodyItem)}`);

    // Start over with fresh copy of shared tags
    tmpTags = _.cloneDeep(influxTags);
    tmpTags.user_session_virtual_proxy = virtualProxy;
    tmpTags.user_session_host = host;

    // Add extra tags for this body item
    tmpTags.user_session_id = bodyItem.SessionId;
    tmpTags.user_session_user_directory = bodyItem.UserDirectory;
    tmpTags.user_session_user_id = bodyItem.UserId;

    let sessionDatapoint = {
      measurement: 'user_session_details',
      tags: tmpTags,
      fields: {
        // attributes: bodyItem.Attributes,
        session_id: bodyItem.SessionId,
        user_directory: bodyItem.UserDirectory,
        user_id: bodyItem.UserId,
      },
    };

    datapoint.push(sessionDatapoint);
  });

  globals.influx
    .writePoints(datapoint)
    .then(() => {
      globals.logger.silly(
        `USER SESSIONS: Influxdb datapoint for server "${host}", virtual proxy "${virtualProxy}"": ${JSON.stringify(
          datapoint,
          null,
          2,
        )}`,
      );

      globals.logger.debug(
        `USER SESSIONS: Session count for server "${host}", virtual proxy "${virtualProxy}"": ${body.length}`,
      );
      globals.logger.debug(
        `USER SESSIONS: User list for server "${host}", virtual proxy "${virtualProxy}"": ${uniqueUserList}`,
      );

      globals.logger.verbose(
        `USER SESSIONS: Sent user session data to InfluxDB for server "${host}", virtual proxy "${virtualProxy}"`,
      );
    })
    .catch(err => {
      globals.logger.error(
        `USER SESSIONS: Error saving user session data to InfluxDB! ${err.stack}`,
      );
    });
}

module.exports = {
  postHealthMetricsToInfluxdb,
  postUserSessionsToInfluxdb,
};
