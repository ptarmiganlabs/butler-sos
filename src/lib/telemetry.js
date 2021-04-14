/*eslint strict: ["error", "global"]*/
/*eslint no-invalid-this: "error"*/

'use strict';

const axios = require('axios');
var globals = require('../globals');

// const telemetryBaseUrl = 'http://localhost:7071/';
const telemetryBaseUrl = 'https://ptarmiganlabs-telemetry.azurewebsites.net/';
const telemetryUrl = '/api/butlerTelemetry';

var callRemoteURL = async function () {
    try {
        let body = {
            service: 'butler-sos',
            serviceVersion: globals.appVersion,
            system: {
                id: globals.hostInfo.id,
                arch: globals.hostInfo.si.os.arch,
                platform: globals.hostInfo.si.os.platform,
                release: globals.hostInfo.si.os.release,
                distro: globals.hostInfo.si.os.distro,
                codename: globals.hostInfo.si.os.codename,
                virtual: globals.hostInfo.si.system.virtual,
                hypervisor: globals.hostInfo.si.os.hypervizor,
                nodeVersion: globals.hostInfo.node.nodeVersion
            },
            enabledFeatures: {
                feature: {
                    heartbeat: globals.config.has('Butler-SOS.heartbeat.enabled') ? globals.config.get('Butler-SOS.heartbeat.enabled') : false,
                    dockerHealthCheck: globals.config.has('Butler-SOS.dockerHealthCheck.enabled') ? globals.config.get('Butler-SOS.dockerHealthCheck.enabled') : false,
                    uptimeMonitor: globals.config.has('Butler-SOS.uptimeMonitor.enabled') ? globals.config.get('Butler-SOS.uptimeMonitor.enabled') : false,
                    uptimeMonitor_storeInInfluxdb: globals.config.has('Butler-SOS.uptimeMonitor.storeInInfluxdb.butlerSOSMemoryUsage') ? globals.config.get('Butler-SOS.uptimeMonitor.storeInInfluxdb.butlerSOSMemoryUsage') : false,
                    udpServer: globals.config.has('Butler-SOS.udpServerConfig.enable') ? globals.config.get('Butler-SOS.udpServerConfig.enable') : false,
                    logdb: globals.config.has('Butler-SOS.logdb.enableLogDb') ? globals.config.get('Butler-SOS.logdb.enableLogDb') : false,
                    mqtt: globals.config.has('Butler-SOS.mqttConfig.enableMQTT') ? globals.config.get('Butler-SOS.mqttConfig.enableMQTT') : false,
                    influxdb: globals.config.has('Butler-SOS.influxdbConfig.enableInfluxdb') ? globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb') : false,

                    appNames: globals.config.has('Butler-SOS.appNames.enableAppNameExtract') ? globals.config.get('Butler-SOS.appNames.enableAppNameExtract') : false,
                    userSessions: globals.config.has('Butler-SOS.userSessions.enableSessionExtract') ? globals.config.get('Butler-SOS.userSessions.enableSessionExtract') : false,
                }
            }
        };

        let axiosConfig = {
            url: telemetryUrl,
            method: 'post',
            baseURL: telemetryBaseUrl,
            data: body,
            timeout: 5000,
            responseType: 'text',
        };

        await axios.request(axiosConfig);
        globals.logger.debug('TELEMETRY: Sent anonymous telemetry. Thanks for contributing to making Butler SOS better!');
    } catch (err) {
        globals.logger.error('TELEMETRY: Could not send anonymous telemetry.');
        globals.logger.error('     While not mandatory the telemetry data greatly helps the Butler SOS developers.');
        globals.logger.error('     It provides insights into which features are used most and what hardware/OSs are most used out there.');
        globals.logger.error('     This information makes it possible to focus development efforts where they will make most impact and be most valuable.');
        globals.logger.error('❤️  Thank you for your supporting Butler SOS by allowing telemetry! ❤️');
    }  
};

function setupAnonUsageReportTimer(logger, hostInfo) {
    try {
        setInterval(function () {
            callRemoteURL(logger, hostInfo);
        }, 1000 * 60 * 60 * 6);         // Report anon usage every 6 hours

        // Do an initial report to the remote URL
        callRemoteURL(logger, hostInfo);
    } catch (err) {
        logger.error(`TELEMETRY: ${err}`);
    }
}

module.exports = {
    setupAnonUsageReportTimer,
};
