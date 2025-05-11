/**
 * Get metrics from Sense repository service
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Point } from '@influxdata/influxdb-client';

import globals from '../globals.js';
import { postProxySessionsToInfluxdb } from './post-to-influxdb.js';
import { postProxySessionsToNewRelic } from './post-to-new-relic.js';
import { postUserSessionsToMQTT } from './post-to-mqtt.js';
import { getServerTags } from './servertags.js';
import { saveUserSessionMetricsToPrometheus } from './prom-client.js';

function getCertificates(options) {
    const certificate = {};

    certificate.cert = fs.readFileSync(options.Certificate);
    certificate.key = fs.readFileSync(options.CertificateKey);
    certificate.ca = fs.readFileSync(options.CertificateCA);

    return certificate;
}

// Prepare user session metrics data pointfor posting to InfluxDB v1
function prepUserSessionMetrics(serverName, host, virtualProxy, body, tags) {
    return new Promise((resolve, reject) => {
        try {
            globals.logger.debug('PROXY SESSIONS: Prepping user sessions data structure');

            const userProxySessionsData = {};

            userProxySessionsData.serverName = serverName;
            userProxySessionsData.host = host;
            userProxySessionsData.virtualProxy = virtualProxy;

            // Build tags structure, adding tags for virtual proxy and host the session is associated with
            // Start with common/shared set of tags, then add user session specific tags
            userProxySessionsData.tags = { ...tags };

            userProxySessionsData.tags.user_session_virtual_proxy = virtualProxy;
            userProxySessionsData.tags.user_session_host = host;

            // Build comma separated list of all user IDs connected via the current virtual proxy
            const userArray = Array.prototype.map.call(
                body,
                (s) => `${s.UserDirectory}\\${s.UserId}`
            );
            userProxySessionsData.uniqueUserList = Array.from(new Set(userArray)).toString();

            userProxySessionsData.sessionCount = body.length;

            // InfluxDB specific.
            if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
                // Create data point for InfluxDB v1

                userProxySessionsData.datapointInfluxdb = [
                    {
                        measurement: 'user_session_summary',
                        tags: userProxySessionsData.tags,
                        fields: {
                            session_count: userProxySessionsData.sessionCount,
                            session_user_id_list: userProxySessionsData.uniqueUserList,
                        },
                    },
                    {
                        measurement: 'user_session_list',
                        tags: userProxySessionsData.tags,
                        fields: {
                            session_user_id_list: userProxySessionsData.uniqueUserList,
                        },
                    },
                ];
            } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
                // Create data point for InfluxDB v2

                userProxySessionsData.datapointInfluxdb = [
                    new Point('user_session_summary')
                        .tag(
                            'user_session_virtual_proxy',
                            userProxySessionsData.tags.user_session_virtual_proxy
                        )
                        .tag('user_session_host', userProxySessionsData.tags.user_session_host)
                        .uintField('session_count', userProxySessionsData.sessionCount)
                        .stringField('session_user_id_list', userProxySessionsData.uniqueUserList),

                    new Point('user_session_list')
                        .tag(
                            'user_session_virtual_proxy',
                            userProxySessionsData.tags.user_session_virtual_proxy
                        )
                        .tag('user_session_host', userProxySessionsData.tags.user_session_host)
                        .uintField('session_count', userProxySessionsData.sessionCount)
                        .stringField('session_user_id_list', userProxySessionsData.uniqueUserList),
                ];
            }

            // Prometheus specific.
            userProxySessionsData.datapointPrometheus = {};
            userProxySessionsData.datapointPrometheus.butlersos_user_session_summary_total = {
                value: userProxySessionsData.sessionCount,
                labels: userProxySessionsData.tags,
            };

            // New Relic specific
            userProxySessionsData.datapointNewRelic = {};
            userProxySessionsData.datapointNewRelic.butlersos_user_session_summary_total = {
                value: userProxySessionsData.sessionCount,
                attributes: userProxySessionsData.tags,
            };

            // Add details for each session
            // Discussion about forEach vs for...of: https://github.com/airbnb/javascript/issues/1271
            // https://gist.github.com/ljharb/58faf1cfcb4e6808f74aae4ef7944cff
            for (const bodyItem of body) {
                // Is user in blacklist?
                // If so just skip this user's session

                let includeUser = true;
                if (
                    globals.config.has('Butler-SOS.userSessions.excludeUser') &&
                    globals.config.get('Butler-SOS.userSessions.excludeUser') !== null &&
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
                            `PROXY SESSIONS: User ${bodyItem.UserDirectory}\\${bodyItem.UserId} in blacklist, not reporting session.`
                        );

                        includeUser = false;
                    }
                }

                if (includeUser === true) {
                    globals.logger.debug(
                        `PROXY SESSIONS: User session: Body item: ${JSON.stringify(bodyItem)}`
                    );

                    // InfluxDB specific.
                    // Add InfluxDB datapoints
                    const influxTags = { ...userProxySessionsData.tags };
                    // Add extra tags for this body item
                    influxTags.user_session_id = bodyItem.SessionId;
                    influxTags.user_session_user_directory = bodyItem.UserDirectory;
                    influxTags.user_session_user_id = bodyItem.UserId;

                    let sessionDatapoint;
                    if (globals.config.get('Butler-SOS.influxdbConfig.version') === 1) {
                        // Create data point for InfluxDB v1
                        sessionDatapoint = {
                            measurement: 'user_session_details',
                            tags: influxTags,
                            fields: {
                                // attributes: bodyItem.Attributes,
                                session_id: bodyItem.SessionId,
                                user_directory: bodyItem.UserDirectory,
                                user_id: bodyItem.UserId,
                            },
                        };
                    } else if (globals.config.get('Butler-SOS.influxdbConfig.version') === 2) {
                        // Create data point for InfluxDB v2
                        sessionDatapoint = new Point('user_session_details')
                            .tag('user_session_id', bodyItem.SessionId)
                            .tag('user_session_user_directory', bodyItem.UserDirectory)
                            .tag('user_session_user_id', bodyItem.UserId)
                            .tag(
                                'user_session_virtual_proxy',
                                userProxySessionsData.tags.user_session_virtual_proxy
                            )
                            .tag('user_session_host', userProxySessionsData.tags.user_session_host)
                            .stringField('session_id', bodyItem.SessionId)
                            .stringField('user_directory', bodyItem.UserDirectory)
                            .stringField('user_id', bodyItem.UserId);
                    }

                    userProxySessionsData.datapointInfluxdb.push(sessionDatapoint);
                }
            }

            resolve(userProxySessionsData);
        } catch (err) {
            globals.logger.error(`PROXY SESSIONS: ${err}`);
            reject();
        }
    });
}

export async function getProxySessionStatsFromSense(serverName, host, virtualProxy, influxTags) {
    // Current user sessions are retrived using this API:
    // https://help.qlik.com/en-US/sense-developer/February2021/Subsystems/ProxyServiceAPI/Content/Sense_ProxyServiceAPI/ProxyServiceAPI-Proxy-API.htm

    const options = {};

    options.Certificate = path.resolve(
        process.cwd(),
        globals.config.get('Butler-SOS.cert.clientCert')
    );
    options.CertificateKey = path.resolve(
        process.cwd(),
        globals.config.get('Butler-SOS.cert.clientCertKey')
    );
    options.CertificateCA = path.resolve(
        process.cwd(),
        globals.config.get('Butler-SOS.cert.clientCertCA')
    );

    if (
        globals.config.has('Butler-SOS.cert.clientCertPassphrase') === true &&
        globals.config.get('Butler-SOS.cert.clientCertPassphrase')?.length > 0
    ) {
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
        rejectUnauthorized: globals.config.get('Butler-SOS.serversToMonitor.rejectUnauthorized'),
    });

    const vP = virtualProxy === '/' ? '' : `${virtualProxy}`;
    const requestSettings = {
        url: `https://${host}/qps${vP}/session?Xrfkey=abcdefghij987654`,
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

    globals.logger.debug(`PROXY SESSIONS: Querying user sessions from ${requestSettings.url}`);

    try {
        const response = await axios.request(requestSettings);

        globals.logger.debug(`PROXY SESSIONS: User session response from: ${response.config.url}`);

        if (response.status === 200) {
            globals.logger.debug(
                `PROXY SESSIONS: Body from ${response.config.url}: ${JSON.stringify(
                    response.data,
                    null,
                    2
                )}`
            );

            // Post to MQTT
            if (globals.config.get('Butler-SOS.mqttConfig.enable') === true) {
                globals.logger.debug('PROXY SESSIONS: Calling user sessions MQTT posting method');

                postUserSessionsToMQTT(
                    host.split(':')[0],
                    // response.request._headers.xvirtualproxy,
                    virtualProxy,
                    JSON.stringify(response.data, null, 2)
                );
            }

            const userProxySessionsData = await prepUserSessionMetrics(
                serverName,
                host,
                virtualProxy,
                response.data,
                influxTags
            );

            // Post to Influxdb
            if (globals.config.get('Butler-SOS.influxdbConfig.enable') === true) {
                globals.logger.debug(
                    'PROXY SESSIONS: Calling user sessions Influxdb posting method'
                );

                postProxySessionsToInfluxdb(userProxySessionsData);
            }

            // Post to New Relic
            if (
                globals.config.get('Butler-SOS.newRelic.enable') === true &&
                globals.config.get('Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable') ===
                    true
            ) {
                globals.logger.debug(
                    'PROXY SESSIONS: Calling user sessions New Relic posting method'
                );

                postProxySessionsToNewRelic(userProxySessionsData);
            }

            // Save latest available data for Prometheus
            if (globals.config.get('Butler-SOS.prometheus.enable') === true) {
                globals.logger.debug('HEALTH: Calling SESSIONS metrics Prometheus method');
                saveUserSessionMetricsToPrometheus(userProxySessionsData);
            }
        }
    } catch (err) {
        globals.logger.error(`PROXY SESSIONS: Error when calling proxy session API: ${err}`);
    }
}

// Get info on what sessions currently exist
export function setupUserSessionsTimer() {
    globals.logger.debug(
        `PROXY SESSIONS: Monitor user sessions for these servers/virtual proxies: ${JSON.stringify(
            globals.serverList,
            null,
            2
        )}`
    );

    // Configure timer for getting user session data from Sense proxy API
    setInterval(async () => {
        globals.logger.verbose('PROXY SESSIONS: Event started: Poll user sessions');

        // Process servers sequentially to avoid overwhelming the Sense servers
        for (const server of globals.serverList) {
            if (server.userSessions.enable) {
                const tags = getServerTags(globals.logger, server);

                // Process virtual proxies sequentially
                for (const virtualProxy of server.userSessions.virtualProxies) {
                    globals.logger.debug(
                        `PROXY SESSIONS: Getting user sessions for host=${
                            server.userSessions.host
                        }, virtual proxy=${JSON.stringify(virtualProxy, null, 2)}`
                    );

                    try {
                        await getProxySessionStatsFromSense(
                            server.serverName,
                            server.userSessions.host,
                            virtualProxy.virtualProxy,
                            tags
                        );
                    } catch (err) {
                        globals.logger.error(`PROXY SESSIONS: Error getting session stats: ${err}`);
                    }
                }
            }
        }
    }, globals.config.get('Butler-SOS.userSessions.pollingInterval'));
}
