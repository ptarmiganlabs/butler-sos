/**
 * Get metrics from the Sense health check API
 */

const path = require('path');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
const globals = require('../globals');
const postToInfluxdb = require('./post-to-influxdb');
const postToNewRelic = require('./post-to-new-relic');
const postToMQTT = require('./post-to-mqtt');
const serverTags = require('./servertags');
const serverHeaders = require('./serverheaders');
const prometheus = require('./prom-client');

function getCertificates(options) {
    const certificate = {};

    certificate.cert = fs.readFileSync(options.Certificate);
    certificate.key = fs.readFileSync(options.CertificateKey);
    certificate.ca = fs.readFileSync(options.CertificateCA);

    return certificate;
}

function getHealthStatsFromSense(host, tags, headers) {
    globals.logger.debug(`HEALTH: URL=https://${host}/engine/healthcheck/`);

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
        rejectUnauthorized: globals.config.get('Butler-SOS.serversToMonitor.rejectUnauthorized'),
    });

    const requestSettings = {
        url: `https://${host}/engine/healthcheck/`,
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
                if (
                    (globals.config.has('Butler-SOS.mqttConfig.enableMQTT') &&
                        globals.config.get('Butler-SOS.mqttConfig.enableMQTT') === true) ||
                    (globals.config.has('Butler-SOS.mqttConfig.enable') &&
                        globals.config.get('Butler-SOS.mqttConfig.enable') === true)
                ) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics MQTT posting method');
                    postToMQTT.postHealthToMQTT(host, tags.host, response.data);
                }

                // Post to Influxdb
                if (
                    (globals.config.has('Butler-SOS.influxdbConfig.enableInfluxdb') &&
                        globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb') === true) ||
                    (globals.config.has('Butler-SOS.influxdbConfig.enable') &&
                        globals.config.get('Butler-SOS.influxdbConfig.enable') === true)
                ) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics Influxdb posting method');
                    postToInfluxdb.postHealthMetricsToInfluxdb(host, response.data, tags);
                }

                // Post to New Relic
                if (
                    globals.config.has('Butler-SOS.newRelic.enable') &&
                    globals.config.get('Butler-SOS.newRelic.enable') === true
                ) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics New Relic posting method');
                    postToNewRelic.postHealthMetricsToNewRelic(host, response.data, tags);
                }

                // Save latest available data for Prometheus
                if (
                    globals.config.has('Butler-SOS.prometheus.enable') &&
                    globals.config.get('Butler-SOS.prometheus.enable') === true
                ) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics Prometheus method');
                    prometheus.saveHealthMetrics(host, response.data, tags);
                }
            }
        })
        .catch((err) => {
            globals.logger.error(`HEALTH: Error when calling health check API: ${err}`);
        });
}

function setupHealthMetricsTimer() {
    // Configure timer for getting healthcheck data
    setInterval(() => {
        globals.logger.verbose('HEALTH: Event started: Statistics collection');

        globals.serverList.forEach((server) => {
            globals.logger.verbose(`HEALTH: Getting stats for server: ${server.serverName}`);
            globals.logger.debug(`HEALTH: Server details: ${JSON.stringify(server)}`);

            const tags = serverTags.getServerTags(server);
            const headers = serverHeaders.getServerHeaders(server);

            getHealthStatsFromSense(server.host, tags, headers);
        });
    }, globals.config.get('Butler-SOS.serversToMonitor.pollingInterval'));
}

module.exports = {
    setupHealthMetricsTimer,
    getHealthStatsFromSense,
};
