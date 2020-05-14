

// Get metrics from the Sense health check API

const axios = require('axios');
const https = require('https');
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

function getCertificates(options) {
    var certificate = {};

    certificate.cert = fs.readFileSync(options.Certificate);
    certificate.key = fs.readFileSync(options.CertificateKey);
    certificate.ca = fs.readFileSync(options.CertificateCA);

    return certificate;
}

function getHealthStatsFromSense(host, influxTags) {
    globals.logger.debug(`HEALTH: URL=https://${host}/engine/healthcheck/`);

    var options = {};

    options.Certificate = globals.config.get('Butler-SOS.cert.clientCert');
    options.CertificateKey = globals.config.get('Butler-SOS.cert.clientCertKey');
    options.CertificateCA = globals.config.get('Butler-SOS.cert.clientCertCA');
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
        url: 'https://' + host + '/engine/healthcheck/',
        method: 'get',
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
        },
        httpsAgent: httpsAgent,
        timeout: 5000,
        maxRedirects: 5,
    };

    axios
        .request(requestSettings)
        .then(response => {
            if (response.status === 200) {
                globals.logger.verbose('HEALTH: Received ok response from ' + influxTags.host);
                globals.logger.debug(`HEALTH: ${JSON.stringify(response.data)}`);

                // Post to MQTT (if enabled)
                if (globals.config.get('Butler-SOS.mqttConfig.enableMQTT')) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics MQTT posting method');
                    postToMQTT.postHealthToMQTT(host, influxTags.host, response.data);
                }

                // Post to Influxdb (if enabled)
                if (globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb')) {
                    globals.logger.debug('HEALTH: Calling HEALTH metrics Influxdb posting method');
                    postToInfluxdb.postHealthMetricsToInfluxdb(host, response.data, influxTags);
                }
            }
        })
        .catch(err => {
            globals.logger.error(`HEALTH: Error when calling health check API: ${err}`);

            return;
        });
}

module.exports = {
    setupHealthMetricsTimer,
    getHealthStatsFromSense,
};
