const axios = require('axios');
const globals = require('../globals');

// const telemetryBaseUrl = 'http://localhost:7071/';
const telemetryBaseUrl = 'https://ptarmiganlabs-telemetry.azurewebsites.net/';
const telemetryUrl = '/api/butlerTelemetry';

const callRemoteURL = async function reportTelemetry() {
    try {
        let heartbeat = false;
        let dockerHealthCheck = false;
        let uptimeMonitor = false;
        let userEventsEnable = false;
        let userEventsMQTTEnable = false;
        let userEventsInfluxDBEnable = false;
        let logEventsProxyEnable = false;
        let logEventsSchedulerEnable = false;
        let logEventsRepositoryEnable = false;
        let logEventsMQTTEnable = false;
        let logEventsInfluxDBEnable = false;
        let logdbEnable = false;
        let mqttEnable = false;
        let prometheusEnable = false;
        let influxdbEnable = false;
        let appNamesExtractEnable = false;
        let userSessionsEnable = false;

        // Gather info on what features are enabled/disabled
        if (
            (globals.config.has('Butler-SOS.heartbeat.enabled') &&
                globals.config.get('Butler-SOS.heartbeat.enabled') === true) ||
            (globals.config.has('Butler-SOS.heartbeat.enable') &&
                globals.config.get('Butler-SOS.heartbeat.enable') === true)
        ) {
            heartbeat = true;
        }

        if (
            (globals.config.has('Butler-SOS.dockerHealthCheck.enabled') &&
                globals.config.get('Butler-SOS.dockerHealthCheck.enabled') === true) ||
            (globals.config.has('Butler-SOS.dockerHealthCheck.enable') &&
                globals.config.get('Butler-SOS.dockerHealthCheck.enable') === true)
        ) {
            dockerHealthCheck = true;
        }

        if (
            (globals.config.has('Butler-SOS.uptimeMonitor.enabled') &&
                globals.config.get('Butler-SOS.uptimeMonitor.enabled') === true) ||
            (globals.config.has('Butler-SOS.uptimeMonitor.enable') &&
                globals.config.get('Butler-SOS.uptimeMonitor.enable') === true)
        ) {
            uptimeMonitor = true;
        }

        if (
            globals.config.has('Butler-SOS.userEvents.enable') &&
            globals.config.get('Butler-SOS.userEvents.enable') === true
        ) {
            userEventsEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.userEvents.sendToMQTT.enable') &&
            globals.config.get('Butler-SOS.userEvents.sendToMQTT.enable') === true
        ) {
            userEventsMQTTEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.userEvents.sendToInfluxdb.enable') &&
            globals.config.get('Butler-SOS.userEvents.sendToInfluxdb.enable') === true
        ) {
            userEventsInfluxDBEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.logEvents.source.proxy.enable') &&
            globals.config.get('Butler-SOS.logEvents.source.proxy.enable') === true
        ) {
            logEventsProxyEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.logEvents.source.scheduler.enable') &&
            globals.config.get('Butler-SOS.logEvents.source.scheduler.enable') === true
        ) {
            logEventsSchedulerEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.logEvents.source.repository.enable') &&
            globals.config.get('Butler-SOS.logEvents.source.repository.enable') === true
        ) {
            logEventsRepositoryEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.logEvents.sendToMQTT.enable') &&
            globals.config.get('Butler-SOS.logEvents.sendToMQTT.enable') === true
        ) {
            logEventsMQTTEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.logEvents.sendToInfluxdb.enable') &&
            globals.config.get('Butler-SOS.logEvents.sendToInfluxdb.enable') === true
        ) {
            logEventsInfluxDBEnable = true;
        }

        if (
            (globals.config.has('Butler-SOS.logdb.enableLogDb') &&
                globals.config.get('Butler-SOS.logdb.enableLogDb') === true) ||
            (globals.config.has('Butler-SOS.logdb.enable') &&
                globals.config.get('Butler-SOS.logdb.enable') === true)
        ) {
            logdbEnable = true;
        }

        if (
            (globals.config.has('Butler-SOS.mqttConfig.enableMQTT') &&
                globals.config.get('Butler-SOS.mqttConfig.enableMQTT') === true) ||
            (globals.config.has('Butler-SOS.mqttConfig.enable') &&
                globals.config.get('Butler-SOS.mqttConfig.enable') === true)
        ) {
            mqttEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.prometheus.enable') &&
            globals.config.get('Butler-SOS.prometheus.enable') === true
        ) {
            prometheusEnable = true;
        }

        if (
            (globals.config.has('Butler-SOS.influxdbConfig.enableInfluxdb') &&
                globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb') === true) ||
            (globals.config.has('Butler-SOS.influxdbConfig.enable') &&
                globals.config.get('Butler-SOS.influxdbConfig.enable') === true)
        ) {
            influxdbEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.appNames.enableAppNameExtract') &&
            globals.config.get('Butler-SOS.appNames.enableAppNameExtract') === true
        ) {
            appNamesExtractEnable = true;
        }

        if (
            globals.config.has('Butler-SOS.userSessions.enableSessionExtract') &&
            globals.config.get('Butler-SOS.userSessions.enableSessionExtract') === true
        ) {
            userSessionsEnable = true;
        }

        const body = {
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
                nodeVersion: globals.hostInfo.node.nodeVersion,
            },
            enabledFeatures: {
                feature: {
                    heartbeat,
                    dockerHealthCheck,
                    uptimeMonitor,
                    uptimeMonitor_storeInInfluxdb: globals.config.has(
                        'Butler-SOS.uptimeMonitor.storeInInfluxdb.butlerSOSMemoryUsage'
                    )
                        ? globals.config.get(
                              'Butler-SOS.uptimeMonitor.storeInInfluxdb.butlerSOSMemoryUsage'
                          )
                        : false,
                    udpServer: globals.config.has('Butler-SOS.userEvents.enable')
                        ? globals.config.get('Butler-SOS.userEvents.enable')
                        : false,
                    userEvents: userEventsEnable,
                    userEventsMQTT: userEventsMQTTEnable,
                    userEventsInfluxdb: userEventsInfluxDBEnable,
                    logEventsProxy: logEventsProxyEnable,
                    logEventsScheduler: logEventsSchedulerEnable,
                    logEventsRepository: logEventsRepositoryEnable,
                    logEventsMQTT: logEventsMQTTEnable,
                    logEventsInfluxdb: logEventsInfluxDBEnable,
                    logdb: logdbEnable,
                    mqtt: mqttEnable,
                    prometheus: prometheusEnable,
                    influxdb: influxdbEnable,
                    appNames: appNamesExtractEnable,
                    userSessions: userSessionsEnable,
                },
            },
        };

        const axiosConfig = {
            url: telemetryUrl,
            method: 'post',
            baseURL: telemetryBaseUrl,
            data: body,
            timeout: 5000,
            responseType: 'text',
        };

        await axios.request(axiosConfig);
        globals.logger.debug(
            'TELEMETRY: Sent anonymous telemetry. Thanks for contributing to making Butler SOS better!'
        );
    } catch (err) {
        globals.logger.error('TELEMETRY: Could not send anonymous telemetry.');
        globals.logger.error(
            '     While not mandatory the telemetry data greatly helps the Butler SOS developers.'
        );
        globals.logger.error(
            '     It provides insights into which features are used most and what hardware/OSs are most used out there.'
        );
        globals.logger.error(
            '     This information makes it possible to focus development efforts where they will make most impact and be most valuable.'
        );
        globals.logger.error(
            '❤️  Thank you for your supporting Butler SOS by allowing telemetry! ❤️'
        );
        globals.logger.error('');
        globals.logger.error(JSON.stringify(err, null, 2));
    }
};

function setupAnonUsageReportTimer(logger, hostInfo) {
    try {
        setInterval(() => {
            callRemoteURL(logger, hostInfo);
        }, 1000 * 60 * 60 * 12); // Report anon usage every 12 hours

        // Do an initial report to the remote URL
        callRemoteURL(logger, hostInfo);
    } catch (err) {
        logger.error(`TELEMETRY: ${err}`);
    }
}

module.exports = {
    setupAnonUsageReportTimer,
};
