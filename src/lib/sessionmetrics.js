const request = require('request');
const urljoin = require('url-join');
const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');
const postToMQTT = require('./post-to-mqtt');
const serverTags = require('./servertags');

var fs = require('fs');
var path = require('path'),
  certFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCert')),
  keyFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertKey')),
  caFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertCA'));

// Get info on what sessions currently exist
function setupUserSessionsTimer() {
  globals.logger.debug(
    `Monitor user sessions for these servers/virtual proxies: ${JSON.stringify(
      globals.serverList,
      null,
      2,
    )}`,
  );

  // Configure timer for getting user session data from Sense proxy API
  setInterval(function() {
    globals.logger.verbose('Event started: Poll user sessions');

    globals.serverList.forEach(function(server) {
      if (server.userSessions.enable) {
        const tags = serverTags.getServerTags(server);
        server.userSessions.virtualProxies.forEach(function(virtualProxy) {
          globals.logger.debug(
            `Getting user sessions for host=${
              server.userSessions.host
            }, virtual proxy=${JSON.stringify(virtualProxy, null, 2)}`,
          );

          getSessionStatsFromSense(server.userSessions.host, virtualProxy.virtualProxy, tags);
        });
      }
    });
  }, globals.config.get('Butler-SOS.userSessions.pollingInterval'));
}

function getSessionStatsFromSense(host, virtualProxy, influxTags) {
  // Current user sessions are retrived using this API:
  // http://help.qlik.com/en-US/sense-developer/June2019/Subsystems/ProxyServiceAPI/Content/Sense_ProxyServiceAPI/ProxyServiceAPI-Session-Module-API.htm

  const fullUrl = urljoin(
    'https://',
    host,
    'qps',
    virtualProxy == '/' ? '' : virtualProxy,
    'session',
    '?Xrfkey=abcdefghij987654',
  );
  globals.logger.debug(`Querying user sessions from ${fullUrl}`);

  request(
    {
      followRedirect: true,
      url: fullUrl,
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'X-Qlik-Xrfkey': 'abcdefghij987654',
        XVirtualProxy: virtualProxy,
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
      globals.logger.debug(`User session response from: ${response.request.href}`);

      if (error) {
        globals.logger.error(`Error when calling proxy session API: ${error}`);
        globals.logger.error(`Response: ${response}`);
        globals.logger.error(`Body: ${body}`);
        return;
      }

      if (!error && response.statusCode === 200) {
        // globals.logger.verbose('Received ok response from ' + influxTags.host);
        globals.logger.debug(
          `Body from ${response.request.href}: ${JSON.stringify(body, null, 2)}`,
        );

        // Post to MQTT (if enabled)
        if (globals.config.get('Butler-SOS.mqttConfig.enableMQTT')) {
          globals.logger.debug('Calling user sessions MQTT posting method');
          postToMQTT.postUserSessionsToMQTT(
            response.request.uri.hostname,
            response.request.headers.XVirtualProxy,
            JSON.stringify(body, null, 2),
          );
        }

        // Post to Influxdb (if enabled)
        if (globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb')) {
          globals.logger.debug('Calling user sessions Influxdb posting method');
          postToInfluxdb.postUserSessionsToInfluxdb(host, virtualProxy, body, influxTags);
        }
      }
    },
  );
}

module.exports = {
  setupUserSessionsTimer,
};
