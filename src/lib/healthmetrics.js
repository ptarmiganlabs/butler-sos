/**
 * Get metrics from the Sense health check API
 */

import path from 'path';
import https from 'https';
import axios from 'axios';

import globals from '../globals.js';
import { postHealthMetricsToInfluxdb } from './post-to-influxdb.js';
import { postHealthMetricsToNewRelic } from './post-to-new-relic.js';
import { postHealthToMQTT } from './post-to-mqtt.js';
import { getServerHeaders } from './serverheaders.js';
import { getServerTags } from './servertags.js';
import { saveHealthMetricsToPrometheus } from './prom-client.js';
import { getCertificates, createCertificateOptions } from './cert-utils.js';

/**
 * Retrieves health statistics from Qlik Sense server via the engine healthcheck API.
 *
 * This function makes an HTTPS request to the Sense engine healthcheck API and
 * distributes the data to configured destinations (MQTT, InfluxDB, New Relic, Prometheus).
 *
 * @param {string} serverName - The name of the server as defined in the config.
 * @param {string} host - The hostname or IP address of the Sense server.
 * @param {object} tags - Tags/metadata to associate with the server metrics.
 * @param {object|null} headers - Additional headers to include in the request.
 * @returns {void}
 */
export function getHealthStatsFromSense(serverName, host, tags, headers) {
    globals.logger.debug(`HEALTH: URL=https://${host}/engine/healthcheck`);

    // Get certificate configuration options
    const options = createCertificateOptions();

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

    const requestSettings = {
        url: `https://${host}/engine/healthcheck`,
        method: 'get',
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
        },
        httpsAgent,
        timeout: 5000,
        maxRedirects: 5,
    };

    // Add any additional headers
    if (headers !== null) {
        // Loop over all headers defined for the current server
        Object.entries(headers).forEach(([key, value]) => {
            globals.logger.debug(`HEALTH: Found header: ${JSON.stringify([key, value])}`);

            requestSettings.headers[key] = value;
        });
    }

    axios
        .request(requestSettings)
        .then((response) => {
            if (response.status === 200) {
                globals.logger.verbose(`HEALTH: Received ok response from ${tags.host}`);
                globals.logger.debug(`HEALTH: ${JSON.stringify(response.data)}`);

                // Post to MQTT
                if (globals.config.get('Butler-SOS.mqttConfig.enable') === true) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics MQTT posting method');
                    postHealthToMQTT(host, tags.host, response.data);
                }

                // Post to Influxdb
                if (globals.config.get('Butler-SOS.influxdbConfig.enable') === true) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics Influxdb posting method');
                    postHealthMetricsToInfluxdb(serverName, host, response.data, tags);
                }

                // Post to New Relic
                if (globals.config.get('Butler-SOS.newRelic.enable') === true) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics New Relic posting method');
                    postHealthMetricsToNewRelic(host, response.data, tags);
                }

                // Save latest available data for Prometheus
                if (globals.config.get('Butler-SOS.prometheus.enable') === true) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics Prometheus method');
                    saveHealthMetricsToPrometheus(host, response.data, tags);
                }
            }
        })
        .catch((err) => {
            globals.logger.error(
                `HEALTH: Error when calling health check API for server '${serverName}' (${host}): ${globals.getErrorMessage(err)}`
            );
        });
}

/**
 * Sets up a timer that periodically collects health metrics from all configured Sense servers.
 *
 * This function creates an interval that runs every pollingInterval milliseconds (as defined in config)
 * and calls getHealthStatsFromSense for each server in the serverList global variable.
 *
 * @returns {void}
 */
export function setupHealthMetricsTimer() {
    // Configure timer for getting healthcheck data
    setInterval(() => {
        globals.logger.verbose('HEALTH: Event started: Statistics collection');

        globals.serverList.forEach((server) => {
            globals.logger.verbose(`HEALTH: Getting stats for server: ${server.serverName}`);
            globals.logger.debug(`HEALTH: Server details: ${JSON.stringify(server)}`);

            // Get per-server tags
            const tags = getServerTags(globals.logger, server);

            // Save tags to global variable.
            // Add a new object to the array, with properties host andd tags.
            // The tags property is an array with all the tags for the server.
            // Each tag object has a name and a value.
            // globals.serverTags.push({
            //     host: server.host,
            //     tags,
            // });

            // Get per-server headers
            const headers = getServerHeaders(server);

            getHealthStatsFromSense(server.serverName, server.host, tags, headers);
        });
    }, globals.config.get('Butler-SOS.serversToMonitor.pollingInterval'));
}
