// Get metrics from the Sense health check API

const request = require('request');
const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');
const postToMQTT = require('./post-to-mqtt');
const serverTags = require('./servertags');

var fs = require('fs');
var path = require('path'),
  certFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCert')),
  keyFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertKey')),
  caFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertCA'));

function setupHealthMetricsTimer() {
  // Configure timer for getting healthcheck data
  setInterval(function() {
    globals.logger.verbose('HEALTH: Event started: Statistics collection');

    globals.serverList.forEach(function(server) {
      globals.logger.verbose(`HEALTH: Getting stats for server: ${server.serverName}`);
      globals.logger.debug(`HEALTH: Server details: ${JSON.stringify(server)}`);

      const tags = serverTags.getServerTags(server);

      getHealthStatsFromSense(server.host, tags);
    });
  }, globals.config.get('Butler-SOS.serversToMonitor.pollingInterval'));
}

function getHealthStatsFromSense(host, influxTags) {
  globals.logger.debug(`HEALTH: URL=https://${host}/engine/healthcheck/`);

  request(
    {
      followRedirect: true,
      url: 'https://' + host + '/engine/healthcheck/',
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
      json: true,
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile),
      ca: fs.readFileSync(caFile),
      rejectUnauthorized: false,
      requestCert: true,
      agent: false,
    },
    function(error, response, body) {
      // Check for error
      if (error) {
        globals.logger.error(`HEALTH: Error when calling health check API: ${error}`);
        globals.logger.error(`HEALTH: Response: ${response}`);
        globals.logger.error(`HEALTH: Body: ${body}`);
        return;
      }

      if (!error && response.statusCode === 200) {
        globals.logger.verbose('HEALTH: Received ok response from ' + influxTags.host);
        globals.logger.debug(`HEALTH: ${JSON.stringify(body)}`);

        // Post to MQTT (if enabled)
        if (globals.config.get('Butler-SOS.mqttConfig.enableMQTT')) {
          globals.logger.debug('HEALTH: Calling HEALTH metrics MQTT posting method');
          postToMQTT.postHealthToMQTT(host, influxTags.host, body);
        }

        // Post to Influxdb (if enabled)
        if (globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb')) {
          globals.logger.debug('HEALTH: Calling HEALTH metrics Influxdb posting method');
          postToInfluxdb.postHealthMetricsToInfluxdb(host, body, influxTags);
        }
      }
    },
  );
}

module.exports = {
  setupHealthMetricsTimer,
  getHealthStatsFromSense,
};
