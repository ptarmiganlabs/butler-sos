const axios = require('axios');
const https = require('https');
const urljoin = require('url-join');
const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');
const postToMQTT = require('./post-to-mqtt');
const serverTags = require('./servertags');

var fs = require('fs');
var path = require('path');

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
    setInterval(function () {
        globals.logger.verbose('USER SESSIONS: Event started: Poll user sessions');

        globals.serverList.forEach(function (server) {
            if (server.userSessions.enable) {
                const tags = serverTags.getServerTags(server);
                server.userSessions.virtualProxies.forEach(function (virtualProxy) {
                    globals.logger.debug(
                        `USER SESSIONS: Getting user sessions for host=${
                            server.userSessions.host
                        }, virtual proxy=${JSON.stringify(virtualProxy, null, 2)}`,
                    );

                    getSessionStatsFromSense(
                        server.userSessions.host,
                        virtualProxy.virtualProxy,
                        tags,
                    );
                });
            }
        });
    }, globals.config.get('Butler-SOS.userSessions.pollingInterval'));
}

function getCertificates(options) {
    var certificate = {};

    certificate.cert = fs.readFileSync(options.Certificate);
    certificate.key = fs.readFileSync(options.CertificateKey);
    certificate.ca = fs.readFileSync(options.CertificateCA);

    return certificate;
}

function getSessionStatsFromSense(host, virtualProxy, influxTags) {
    // Current user sessions are retrived using this API:
    // https://help.qlik.com/en-US/sense-developer/February2021/Subsystems/ProxyServiceAPI/Content/Sense_ProxyServiceAPI/ProxyServiceAPI-Proxy-API.htm

    var options = {};

    options.Certificate = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCert'))
    options.CertificateKey = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertKey'))
    options.CertificateCA = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertCA'));


    if (globals.config.has('Butler-SOS.cert.clientCertPassphrase')) {
        options.CertificatePassphrase = globals.config.get('Butler-SOS.cert.clientCertPassphrase');
    } else {
        options.CertificatePassphrase = null;
    }

    // Get certificates used to authenticate with Sense proxy service
    var cert = getCertificates(options);

    if (cert.cert === undefined || cert.key === undefined || cert.ca === undefined) {
        globals.logger.error('HEALTH: Client certificate or key was not found');
        return;
    }

    const httpsAgent = new https.Agent({
        cert: cert.cert,
        key: cert.key,
        ca: cert.ca,
        passphrase: options.CertificatePassphrase,
        rejectUnauthorized: false,
    });

    var requestSettings = {
        url: urljoin(
            'https://',
            host,
            'qps',
            virtualProxy == '/' ? '' : virtualProxy,
            'session',
            '?Xrfkey=abcdefghij987654',
        ),
        method: 'get',
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'X-Qlik-Xrfkey': 'abcdefghij987654',
            XVirtualProxy: virtualProxy,
        },
        httpsAgent: httpsAgent,
        timeout: 5000,
        maxRedirects: 5,
    };

    globals.logger.debug(`USER SESSIONS: Querying user sessions from ${requestSettings.url}`);

    axios
        .request(requestSettings)
        .then(response => {
            globals.logger.debug(
                `USER SESSIONS: User session response from: ${response.config.url}`,
            );

            if (response.status === 200) {
                globals.logger.debug(
                    `USER SESSIONS: Body from ${response.config.url}: ${JSON.stringify(
                        response.data,
                        null,
                        2,
                    )}`,
                );

                // Post to MQTT (if enabled)
                if (globals.config.get('Butler-SOS.mqttConfig.enableMQTT')) {
                    globals.logger.debug(
                        'USER SESSIONS: Calling user sessions MQTT posting method',
                    );

                    postToMQTT.postUserSessionsToMQTT(
                        host.split(':')[0],
                        // response.request._headers.xvirtualproxy,
                        virtualProxy,
                        JSON.stringify(response.data, null, 2),
                    );
                }

                // Post to Influxdb (if enabled)
                if (globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb')) {
                    globals.logger.debug(
                        'USER SESSIONS: Calling user sessions Influxdb posting method',
                    );

                    postToInfluxdb.postUserSessionsToInfluxdb(
                        host,
                        virtualProxy,
                        response.data,
                        influxTags,
                    );
                }
            }
        })
        .catch(err => {
            globals.logger.error(`USER SESSIONS: Error when calling proxy session API: ${err}`);

            return;
        });
}

module.exports = {
    setupUserSessionsTimer,
};
