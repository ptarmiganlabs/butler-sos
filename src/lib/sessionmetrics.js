/** @format */

const axios = require('axios');
const https = require('https');
const urljoin = require('url-join');
const fs = require('fs');
const path = require('path');
const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');
const postToMQTT = require('./post-to-mqtt');
const serverTags = require('./servertags');
const prometheus = require('./prom-client');

function getCertificates(options) {
    const certificate = {};

    certificate.cert = fs.readFileSync(options.Certificate);
    certificate.key = fs.readFileSync(options.CertificateKey);
    certificate.ca = fs.readFileSync(options.CertificateCA);

    return certificate;
}

function getSessionStatsFromSense(host, virtualProxy, influxTags) {
    // Current user sessions are retrived using this API:
    // https://help.qlik.com/en-US/sense-developer/February2021/Subsystems/ProxyServiceAPI/Content/Sense_ProxyServiceAPI/ProxyServiceAPI-Proxy-API.htm

    const options = {};

    options.Certificate = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCert'));
    options.CertificateKey = path.resolve(
        __dirname,
        globals.config.get('Butler-SOS.cert.clientCertKey')
    );
    options.CertificateCA = path.resolve(
        __dirname,
        globals.config.get('Butler-SOS.cert.clientCertCA')
    );

    if (globals.config.has('Butler-SOS.cert.clientCertPassphrase')) {
        options.CertificatePassphrase = globals.config.get('Butler-SOS.cert.clientCertPassphrase');
    } else {
        options.CertificatePassphrase = null;
    }

    // Get certificates used to authenticate with Sense proxy service
    const cert = getCertificates(options);

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

    const requestSettings = {
        url: urljoin(
            'https://',
            host,
            'qps',
            virtualProxy === '/' ? '' : virtualProxy,
            'session',
            '?Xrfkey=abcdefghij987654'
        ),
        method: 'get',
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'X-Qlik-Xrfkey': 'abcdefghij987654',
            XVirtualProxy: virtualProxy,
        },
        httpsAgent,
        timeout: 5000,
        maxRedirects: 5,
    };

    globals.logger.debug(`USER SESSIONS: Querying user sessions from ${requestSettings.url}`);

    axios
        .request(requestSettings)
        .then(async (response) => {
            globals.logger.debug(
                `USER SESSIONS: User session response from: ${response.config.url}`
            );

            if (response.status === 200) {
                globals.logger.debug(
                    `USER SESSIONS: Body from ${response.config.url}: ${JSON.stringify(
                        response.data,
                        null,
                        2
                    )}`
                );

                // Post to MQTT (if enabled)
                if (
                    (globals.config.has('Butler-SOS.mqttConfig.enableMQTT') &&
                        globals.config.get('Butler-SOS.mqttConfig.enableMQTT') === true) ||
                    (globals.config.has('Butler-SOS.mqttConfig.enable') &&
                        globals.config.get('Butler-SOS.mqttConfig.enable') === true)
                ) {
                    globals.logger.debug(
                        'USER SESSIONS: Calling user sessions MQTT posting method'
                    );

                    postToMQTT.postUserSessionsToMQTT(
                        host.split(':')[0],
                        // response.request._headers.xvirtualproxy,
                        virtualProxy,
                        JSON.stringify(response.data, null, 2)
                    );
                }

                // eslint-disable-next-line no-use-before-define
                const userSessionsData = await prepUserSessionMetrics(
                    host,
                    virtualProxy,
                    response.data,
                    influxTags
                );

                // Post to Influxdb (if enabled)
                if (
                    (globals.config.has('Butler-SOS.influxdbConfig.enableInfluxdb') &&
                        globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb') === true) ||
                    (globals.config.has('Butler-SOS.influxdbConfig.enable') &&
                        globals.config.get('Butler-SOS.influxdbConfig.enable') === true)
                ) {
                    globals.logger.debug(
                        'USER SESSIONS: Calling user sessions Influxdb posting method'
                    );

                    postToInfluxdb.postUserSessionsToInfluxdb(userSessionsData);
                }

                // Save latest available data for Prometheus (if enabled)
                if (
                    globals.config.has('Butler-SOS.prometheus.enable') &&
                    globals.config.get('Butler-SOS.prometheus.enable') === true
                ) {
                    globals.logger.debug('HEALTH: Calling SESSIONS metrics Prometheus method');
                    prometheus.saveUserSessionMetrics(userSessionsData);
                }
            }
        })
        .catch((err) => {
            globals.logger.error(`USER SESSIONS: Error when calling proxy session API: ${err}`);
        });
}

// Get info on what sessions currently exist
function setupUserSessionsTimer() {
    globals.logger.debug(
        `USER SESSIONS: Monitor user sessions for these servers/virtual proxies: ${JSON.stringify(
            globals.serverList,
            null,
            2
        )}`
    );

    // Configure timer for getting user session data from Sense proxy API
    setInterval(() => {
        globals.logger.verbose('USER SESSIONS: Event started: Poll user sessions');

        globals.serverList.forEach((server) => {
            if (server.userSessions.enable) {
                const tags = serverTags.getServerTags(server);
                server.userSessions.virtualProxies.forEach((virtualProxy) => {
                    globals.logger.debug(
                        `USER SESSIONS: Getting user sessions for host=${
                            server.userSessions.host
                        }, virtual proxy=${JSON.stringify(virtualProxy, null, 2)}`
                    );

                    getSessionStatsFromSense(
                        server.userSessions.host,
                        virtualProxy.virtualProxy,
                        tags
                    );
                });
            }
        });
    }, globals.config.get('Butler-SOS.userSessions.pollingInterval'));
}

function prepUserSessionMetrics(host, virtualProxy, body, tags) {
    return new Promise((resolve, reject) => {
        try {
            globals.logger.debug('USER SESSIONS: Prepping user sessions data structure');

            const userSessionsData = {};

            userSessionsData.host = host;
            userSessionsData.virtualProxy = virtualProxy;

            // Build tags structure, adding tags for virtual proxy and host the session is associated with
            // Start with common/shared set of tags, then add user session specific tags
            userSessionsData.tags = { ...tags };
            userSessionsData.tags.user_session_virtual_proxy = virtualProxy;
            userSessionsData.tags.user_session_host = host;

            // Build comma separated list of all user IDs connected via the current virtual proxy
            const userArray = Array.prototype.map.call(
                body,
                (s) => `${s.UserDirectory}\\${s.UserId}`
            );
            userSessionsData.uniqueUserList = Array.from(new Set(userArray)).toString();

            userSessionsData.sessionCount = body.length;

            // InfluxDB specific.
            userSessionsData.datapointInfluxdb = [
                {
                    measurement: 'user_session_summary',
                    tags: userSessionsData.tags,
                    fields: {
                        session_count: userSessionsData.sessionCount,
                        session_user_id_list: userSessionsData.uniqueUserList,
                    },
                },
                {
                    measurement: 'user_session_list',
                    tags: userSessionsData.tags,
                    fields: {
                        session_user_id_list: userSessionsData.uniqueUserList,
                    },
                },
            ];

            // Prometheus specific.
            userSessionsData.datapointPrometheus = {};
            userSessionsData.datapointPrometheus.butlersos_user_session_summary_total = {
                value: userSessionsData.sessionCount,
                labels: userSessionsData.tags,
            };

            // Add details for each session
            // Discussion about forEach vs for...of: https://github.com/airbnb/javascript/issues/1271
            // https://gist.github.com/ljharb/58faf1cfcb4e6808f74aae4ef7944cff
            // eslint-disable-next-line no-restricted-syntax
            for (const bodyItem of body) {
                // Is user in blacklist?
                // If so just skip this user's session

                let includeUser = true;
                if (
                    globals.config.has('Butler-SOS.userSessions.excludeUser') &&
                    globals.config.get('Butler-SOS.userSessions.excludeUser').length > 0
                ) {
                    const excludeList = globals.config.get('Butler-SOS.userSessions.excludeUser');
                    if (
                        excludeList.findIndex(
                            (blacklistUser) =>
                                blacklistUser.directory === bodyItem.UserDirectory &&
                                blacklistUser.userId === bodyItem.UserId
                        ) >= 0
                    ) {
                        // The user associated with the session was found in the blacklist. Return with no further action.
                        globals.logger.debug(
                            `USER SESSIONS: User ${bodyItem.UserDirectory}\\${bodyItem.UserId} in blacklist, not reporting session.`
                        );

                        includeUser = false;
                    }
                }

                if (includeUser === true) {
                    globals.logger.debug(
                        `USER SESSIONS: User session: Body item: ${JSON.stringify(bodyItem)}`
                    );

                    // InfluxDB specific.
                    // Add InfluxDB datapoints
                    const influxTags = { ...userSessionsData.tags };
                    // Add extra tags for this body item
                    influxTags.user_session_id = bodyItem.SessionId;
                    influxTags.user_session_user_directory = bodyItem.UserDirectory;
                    influxTags.user_session_user_id = bodyItem.UserId;

                    const sessionDatapoint = {
                        measurement: 'user_session_details',
                        tags: influxTags,
                        fields: {
                            // attributes: bodyItem.Attributes,
                            session_id: bodyItem.SessionId,
                            user_directory: bodyItem.UserDirectory,
                            user_id: bodyItem.UserId,
                        },
                    };
                    userSessionsData.datapointInfluxdb.push(sessionDatapoint);

                    // Prometehus specific
                }
            }

            resolve(userSessionsData);
        } catch (err) {
            globals.logger.error(`USER SESSIONS: ${err}`);
            reject();
        }
    });
}

module.exports = {
    setupUserSessionsTimer,
};
