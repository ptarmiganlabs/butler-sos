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
    `USER SESSIONS: Monitor user sessions for these servers/virtual proxies: ${JSON.stringify(
      globals.serverList,
      null,
      2,
    )}`,
  );

  // Configure timer for getting user session data from Sense proxy API
  setInterval(function() {
    globals.logger.verbose('USER SESSIONS: Event started: Poll user sessions');

    globals.serverList.forEach(function(server) {
      if (server.userSessions.enable) {
        const tags = serverTags.getServerTags(server);
        server.userSessions.virtualProxies.forEach(function(virtualProxy) {
          globals.logger.debug(
            `USER SESSIONS: Getting user sessions for host=${
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
  globals.logger.debug(`USER SESSIONS: Querying user sessions from ${fullUrl}`);

  try {
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
        if (error) {
          globals.logger.error(`USER SESSIONS: Error when calling proxy session API: ${error}`);
          globals.logger.error(`USER SESSIONS: Response: ${response}`);
          globals.logger.error(`USER SESSIONS: Body: ${body}`);
          return;
        }
        globals.logger.debug(`USER SESSIONS: User session response from: ${response.request.href}`);

        if (!error && response.statusCode === 200) {
          // globals.logger.verbose('Received ok response from ' + influxTags.host);
          globals.logger.debug(
            `USER SESSIONS: Body from ${response.request.href}: ${JSON.stringify(body, null, 2)}`,
          );

          // Post to MQTT (if enabled)
          if (globals.config.get('Butler-SOS.mqttConfig.enableMQTT')) {
            globals.logger.debug('USER SESSIONS: Calling user sessions MQTT posting method');

            postToMQTT.postUserSessionsToMQTT(
              response.request.uri.hostname,
              response.request.headers.XVirtualProxy,
              JSON.stringify(body, null, 2),
            );
          }

          // Post to Influxdb (if enabled)
          if (globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb')) {
            globals.logger.debug('USER SESSIONS: Calling user sessions Influxdb posting method');

            postToInfluxdb.postUserSessionsToInfluxdb(host, virtualProxy, body, influxTags);
          }
        }
      },
    );
  } catch (err) {
    globals.logger.error(
      `USER SESSIONS: Error reading user sessions from host:${host}, virtual proxy:${virtualProxy}: ${err}`,
    );
  }
}

module.exports = {
  setupUserSessionsTimer,
};
