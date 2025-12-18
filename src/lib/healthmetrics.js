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
 * Implements retry logic with exponential backoff for transient network failures.
 *
 * @param {string} serverName - The name of the server as defined in the config.
 * @param {string} host - The hostname or IP address of the Sense server.
 * @param {object} tags - Tags/metadata to associate with the server metrics.
 * @param {object|null} headers - Additional headers to include in the request.
 * @param {number} retryCount - Current retry attempt number (used internally for recursion). Defaults to 0.
 * @returns {Promise<void>}
 */
export async function getHealthStatsFromSense(serverName, host, tags, headers, retryCount = 0) {
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

    // Get timeout and retry settings from config with fallback defaults
    const timeout = globals.config.has('Butler-SOS.serversToMonitor.timeoutMilliseconds')
        ? globals.config.get('Butler-SOS.serversToMonitor.timeoutMilliseconds')
        : 30000;
    const maxRetries = globals.config.has('Butler-SOS.serversToMonitor.maxRetries')
        ? globals.config.get('Butler-SOS.serversToMonitor.maxRetries')
        : 3;
    const retryDelay = globals.config.has('Butler-SOS.serversToMonitor.retryDelayMilliseconds')
        ? globals.config.get('Butler-SOS.serversToMonitor.retryDelayMilliseconds')
        : 1000;

    const requestSettings = {
        url: `https://${host}/engine/healthcheck`,
        method: 'get',
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
        },
        httpsAgent,
        timeout,
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

    try {
        const response = await axios.request(requestSettings);

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
    } catch (err) {
        // Check if we should retry based on error type and retry count
        const shouldRetry =
            retryCount < maxRetries &&
            (err.code === 'ECONNABORTED' || // Timeout
                err.code === 'ECONNRESET' || // Connection reset
                err.code === 'ETIMEDOUT' || // Network timeout
                err.code === 'ENOTFOUND' || // DNS lookup failed
                err.code === 'ENETUNREACH'); // Network unreachable

        if (shouldRetry) {
            // Calculate exponential backoff delay
            const delay = retryDelay * Math.pow(2, retryCount);
            globals.logger.warn(
                `HEALTH: Error calling health check API for server '${serverName}' (${host}): ${globals.getErrorMessage(err)}. Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})...`
            );

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Recursive retry
            return getHealthStatsFromSense(serverName, host, tags, headers, retryCount + 1);
        }

        // Final error after all retries exhausted or non-retryable error
        globals.logger.error(
            `HEALTH: Error when calling health check API for server '${serverName}' (${host}): ${globals.getErrorMessage(err)}`
        );
        if (retryCount > 0) {
            globals.logger.error(
                `HEALTH: Failed after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'}`
            );
        }
    }
}

/**
 * Sets up a timer that periodically collects health metrics from all configured Sense servers.
 *
 * This function creates an interval that runs every pollingInterval milliseconds (as defined in config)
 * and calls getHealthStatsFromSense for each server in the serverList global variable.
 * Uses a flag to prevent overlapping executions if health checks take longer than the polling interval.
 *
 * @returns {void}
 */
export function setupHealthMetricsTimer() {
    let isCollecting = false;

    // Configure timer for getting healthcheck data
    setInterval(async () => {
        // Prevent overlapping executions
        if (isCollecting) {
            globals.logger.warn(
                'HEALTH: Previous health check collection still in progress, skipping this interval'
            );
            return;
        }

        isCollecting = true;
        try {
            globals.logger.verbose('HEALTH: Event started: Statistics collection');

            // Process servers sequentially to avoid overwhelming the Sense servers
            for (const server of globals.serverList) {
                try {
                    globals.logger.verbose(
                        `HEALTH: Getting stats for server: ${server.serverName}`
                    );
                    globals.logger.debug(`HEALTH: Server details: ${JSON.stringify(server)}`);

                    // Get per-server tags
                    const tags = getServerTags(globals.logger, server);

                    // Get per-server headers
                    const headers = getServerHeaders(server);

                    await getHealthStatsFromSense(server.serverName, server.host, tags, headers);
                } catch (err) {
                    globals.logger.error(
                        `HEALTH: Unexpected error processing health stats for server '${server.serverName}': ${globals.getErrorMessage(err)}`
                    );
                }
            }
        } finally {
            isCollecting = false;
        }
    }, globals.config.get('Butler-SOS.serversToMonitor.pollingInterval'));
}
