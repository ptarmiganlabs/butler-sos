const globals = require('../globals');

function postLogDbToMQTT(process_host, process_name, entry_level, message, timestamp) {
  // Get base MQTT topic
  var baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

  // Send to MQTT
  globals.mqttClient.publish(
    baseTopic + process_host + '/' + process_name + '/' + entry_level,
    message,
  );
}

function postHealthToMQTT(host, serverName, body) {
  // Get base MQTT topic
  const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

  // Send to MQTT
  globals.mqttClient.publish(baseTopic + serverName + '/version', body.version);
  globals.mqttClient.publish(baseTopic + serverName + '/started', body.started);
  globals.mqttClient.publish(
    baseTopic + serverName + '/mem/comitted',
    body.mem.committed.toString(),
  );
  globals.mqttClient.publish(
    baseTopic + serverName + '/mem/allocated',
    body.mem.allocated.toString(),
  );
  globals.mqttClient.publish(baseTopic + serverName + '/mem/free', body.mem.free.toString());

  globals.mqttClient.publish(baseTopic + serverName + '/cpu/total', body.cpu.total.toString());

  globals.mqttClient.publish(
    baseTopic + serverName + '/session/active',
    body.session.active.toString(),
  );
  globals.mqttClient.publish(
    baseTopic + serverName + '/session/total',
    body.session.total.toString(),
  );

  globals.mqttClient.publish(
    baseTopic + serverName + '/apps/active_docs',
    body.apps.active_docs.toString(),
  );
  globals.mqttClient.publish(
    baseTopic + serverName + '/apps/loaded_docs',
    body.apps.loaded_docs.toString(),
  );
  globals.mqttClient.publish(
    baseTopic + serverName + '/apps/in_memory_docs',
    body.apps.in_memory_docs.toString(),
  );
  globals.mqttClient.publish(baseTopic + serverName + '/apps/calls', body.apps.calls.toString());
  globals.mqttClient.publish(
    baseTopic + serverName + '/apps/selections',
    body.apps.selections.toString(),
  );

  globals.mqttClient.publish(
    baseTopic + serverName + '/users/active',
    body.users.active.toString(),
  );
  globals.mqttClient.publish(baseTopic + serverName + '/users/total', body.users.total.toString());

  globals.mqttClient.publish(baseTopic + serverName + '/cache/hits', body.cache.hits.toString());
  globals.mqttClient.publish(
    baseTopic + serverName + '/cache/lookups',
    body.cache.lookups.toString(),
  );
  globals.mqttClient.publish(baseTopic + serverName + '/cache/added', body.cache.added.toString());
  globals.mqttClient.publish(
    baseTopic + serverName + '/cache/replaced',
    body.cache.replaced.toString(),
  );
  globals.mqttClient.publish(
    baseTopic + serverName + '/cache/bytes_added',
    body.cache.bytes_added.toString(),
  );
  if (body.cache.lookups > 0) {
    globals.mqttClient.publish(
      baseTopic + serverName + '/cache/hit_ratio',
      Math.floor((body.cache.hits / body.cache.lookups) * 100).toString(),
    );
  }

  globals.mqttClient.publish(baseTopic + serverName + '/saturated', body.saturated.toString());
}

function postUserSessionsToMQTT(host, virtualProxy, body) {
  // Get base MQTT topic
  const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

  // Send to MQTT
  globals.mqttClient.publish(baseTopic + host + '/usersession' + virtualProxy, body);
}

module.exports = {
  postLogDbToMQTT,
  postHealthToMQTT,
  postUserSessionsToMQTT,
};
