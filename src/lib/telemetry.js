import { PostHog } from 'posthog-node';

import globals from '../globals.js';

// Define variable to hold the PostHog client
let posthogClient;

/**
 * Sends anonymous telemetry data to PostHog.
 *
 * This function collects information about the Butler SOS instance, its environment,
 * and which features are enabled/disabled. This data helps the developers understand
 * how Butler SOS is being used and prioritize development efforts accordingly.
 *
 * The telemetry includes:
 * - System information (OS, architecture, Node.js version)
 * - Enabled/disabled features
 * - Configuration settings (without sensitive information)
 * - Whether the app is running in Docker
 *
 * No personally identifiable information or sensitive configuration data is collected.
 *
 * @returns {void}
 */
export const callRemoteURL = function reportTelemetry() {
    try {
        let heartbeat = false;
        let dockerHealthCheck = false;
        let uptimeMonitor = false;
        let uptimeMonitorNewRelic = false;
        let eventCountEnable = false;
        let rejectedEventCountEnable = false;
        let userEventsEnable = false;
        let userEventsMQTTEnable = false;
        let userEventsInfluxDBEnable = false;
        let userEventsNewRelicEnable = false;
        let logEventsProxyEnable = false;
        let logEventsSchedulerEnable = false;
        let logEventsRepositoryEnable = false;
        let logEventCategoriseEnable = false;
        let logEventCategoriseRuleCount = 0;
        let logEventCategoriseRuleDefaultEnable = false;
        let logEventEnginePerformanceMonitorEnable = false;
        let logEventEnginePerformanceMonitorNameLookupEnable = false;
        let logEventEnginePerformanceMonitorTrackRejectedEnable = false;
        let logEventsMQTTEnable = false;
        let logEventsInfluxDBEnable = false;
        let logEventsNewRelicEnable = false;
        let mqttEnable = false;
        let newRelicEnable = false;
        let prometheusEnable = false;
        let influxdbEnable = false;
        let appNamesExtractEnable = false;
        let userSessionsEnable = false;

        // Gather info on what features are enabled/disabled
        if (globals.config.get('Butler-SOS.heartbeat.enable') === true) {
            heartbeat = true;
        }

        if (globals.config.get('Butler-SOS.dockerHealthCheck.enable') === true) {
            dockerHealthCheck = true;
        }

        if (globals.config.get('Butler-SOS.uptimeMonitor.enable') === true) {
            uptimeMonitor = true;
        }

        if (globals.config.get('Butler-SOS.uptimeMonitor.storeNewRelic.enable') === true) {
            uptimeMonitorNewRelic = true;
        }

        if (globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.enable') === true) {
            eventCountEnable = true;
        }

        if (globals.config.get('Butler-SOS.qlikSenseEvents.rejectedEventCount.enable') === true) {
            rejectedEventCountEnable = true;
        }

        if (globals.config.get('Butler-SOS.userEvents.enable') === true) {
            userEventsEnable = true;
        }

        if (globals.config.get('Butler-SOS.userEvents.sendToMQTT.enable') === true) {
            userEventsMQTTEnable = true;
        }

        if (globals.config.get('Butler-SOS.userEvents.sendToInfluxdb.enable') === true) {
            userEventsInfluxDBEnable = true;
        }

        if (globals.config.get('Butler-SOS.userEvents.sendToNewRelic.enable') === true) {
            userEventsNewRelicEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.source.proxy.enable') === true) {
            logEventsProxyEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.source.scheduler.enable') === true) {
            logEventsSchedulerEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.source.repository.enable') === true) {
            logEventsRepositoryEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.sendToMQTT.enable') === true) {
            logEventsMQTTEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.sendToInfluxdb.enable') === true) {
            logEventsInfluxDBEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.sendToNewRelic.enable') === true) {
            logEventsNewRelicEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.categorise.enable') === true) {
            logEventCategoriseEnable = true;
        }

        // Get number of rules in the categorise rules array at Butler-SOS.logEvents.categorise.rules
        if (globals.config.has('Butler-SOS.logEvents.categorise.rules')) {
            logEventCategoriseRuleCount = globals.config.get(
                'Butler-SOS.logEvents.categorise.rules'
            ).length;
        }

        if (globals.config.get('Butler-SOS.logEvents.categorise.ruleDefault.enable') === true) {
            logEventCategoriseRuleDefaultEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.enginePerformanceMonitor.enable') === true) {
            logEventEnginePerformanceMonitorEnable = true;
        }

        if (
            globals.config.get(
                'Butler-SOS.logEvents.enginePerformanceMonitor.appNameLookup.enable'
            ) === true
        ) {
            logEventEnginePerformanceMonitorNameLookupEnable = true;
        }

        if (
            globals.config.get(
                'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.enable'
            ) === true
        ) {
            logEventEnginePerformanceMonitorTrackRejectedEnable = true;
        }

        if (globals.config.get('Butler-SOS.mqttConfig.enable') === true) {
            mqttEnable = true;
        }

        // Is New Relic enabled?
        if (globals.config.get('Butler-SOS.newRelic.enable') === true) {
            newRelicEnable = true;
        }

        if (globals.config.get('Butler-SOS.prometheus.enable') === true) {
            prometheusEnable = true;
        }

        if (globals.config.get('Butler-SOS.influxdbConfig.enable') === true) {
            influxdbEnable = true;
        }

        if (globals.config.get('Butler-SOS.appNames.enableAppNameExtract') === true) {
            appNamesExtractEnable = true;
        }

        if (globals.config.get('Butler-SOS.userSessions.enableSessionExtract') === true) {
            userSessionsEnable = true;
        }

        // Build body that can be sent to PostHog
        const body = {
            distinctId: globals.hostInfo.id,
            event: 'telemetry sent',

            properties: {
                service: 'butler-sos',
                serviceVersion: globals.appVersion,

                system_id: globals.hostInfo.id,
                system_arch: globals.hostInfo.si.os.arch,
                system_platform: globals.hostInfo.si.os.platform,
                system_release: globals.hostInfo.si.os.release,
                system_distro: globals.hostInfo.si.os.distro,
                system_codename: globals.hostInfo.si.os.codename,
                system_virtual: globals.hostInfo.si.system.virtual,
                system_isRunningInDocker: globals.hostInfo.isRunningInDocker,
                system_nodeVersion: globals.hostInfo.node.nodeVersion,

                feature_heartbeat: heartbeat,
                feature_dockerHealthCheck: dockerHealthCheck,
                feature_uptimeMonitor: uptimeMonitor,
                feature_uptimeMonitor_storeNewRelic: uptimeMonitorNewRelic,
                feature_udpServer: globals.config.get('Butler-SOS.userEvents.enable'),

                feature_eventCount: eventCountEnable,
                feature_rejectedEventCount: rejectedEventCountEnable,

                feature_userEvents: userEventsEnable,
                feature_userEventsMQTT: userEventsMQTTEnable,
                feature_userEventsInfluxdb: userEventsInfluxDBEnable,
                feature_userEventsNewRelic: userEventsNewRelicEnable,

                feature_logEventsProxy: logEventsProxyEnable,
                feature_logEventsScheduler: logEventsSchedulerEnable,
                feature_logEventsRepository: logEventsRepositoryEnable,
                feature_logEventCategorise: logEventCategoriseEnable,
                feature_logEventCategoriseRuleCount: logEventCategoriseRuleCount,
                feature_logEventCategoriseRuleDefault: logEventCategoriseRuleDefaultEnable,
                feature_logEventEnginePerformanceMonitor: logEventEnginePerformanceMonitorEnable,
                feature_logEventEnginePerformanceMonitorNameLookup:
                    logEventEnginePerformanceMonitorNameLookupEnable,
                feature_logEventEnginePerformanceMonitorTrackRejected:
                    logEventEnginePerformanceMonitorTrackRejectedEnable,
                feature_logEventsMQTT: logEventsMQTTEnable,
                feature_logEventsInfluxdb: logEventsInfluxDBEnable,
                feature_logEventsNewRelic: logEventsNewRelicEnable,

                feature_mqtt: mqttEnable,
                feature_newRelic: newRelicEnable,
                feature_prometheus: prometheusEnable,
                feature_influxdb: influxdbEnable,
                feature_influxdb_version: globals.config.get('Butler-SOS.influxdbConfig.version'),
                feature_appNames: appNamesExtractEnable,
                feature_userSessions: userSessionsEnable,

                telemetry_json: {
                    system: {
                        id: globals.hostInfo.id,
                        arch: globals.hostInfo.si.os.arch,
                        platform: globals.hostInfo.si.os.platform,
                        release: globals.hostInfo.si.os.release,
                        distro: globals.hostInfo.si.os.distro,
                        codename: globals.hostInfo.si.os.codename,
                        virtual: globals.hostInfo.si.system.virtual,
                        isRunningInDocker: globals.hostInfo.isRunningInDocker,
                        nodeVersion: globals.hostInfo.node.nodeVersion,
                    },
                    enabledFeatures: {
                        feature: {
                            heartbeat,
                            dockerHealthCheck,
                            uptimeMonitor,
                            uptimeMonitorNewRelic,
                            udpServer: globals.config.get('Butler-SOS.userEvents.enable'),
                            eventCount: eventCountEnable,
                            rejectedEventCount: rejectedEventCountEnable,
                            userEvents: userEventsEnable,
                            userEventsMQTT: userEventsMQTTEnable,
                            userEventsInfluxdb: userEventsInfluxDBEnable,
                            userEventsNewRelic: userEventsNewRelicEnable,
                            logEventsProxy: logEventsProxyEnable,
                            logEventsScheduler: logEventsSchedulerEnable,
                            logEventsRepository: logEventsRepositoryEnable,
                            logEventCategorise: logEventCategoriseEnable,
                            logEventCategoriseRuleCount,
                            logEventCategoriseRuleDefault: logEventCategoriseRuleDefaultEnable,
                            logEventEnginePerformanceMonitor:
                                logEventEnginePerformanceMonitorEnable,
                            logEventEnginePerformanceMonitorNameLookup:
                                logEventEnginePerformanceMonitorNameLookupEnable,
                            logEventEnginePerformanceMonitorTrackRejected:
                                logEventEnginePerformanceMonitorTrackRejectedEnable,
                            logEventsMQTT: logEventsMQTTEnable,
                            logEventsInfluxdb: logEventsInfluxDBEnable,
                            logEventsNewRelic: logEventsNewRelicEnable,
                            mqtt: mqttEnable,
                            newRelic: newRelicEnable,
                            prometheus: prometheusEnable,
                            influxdb: influxdbEnable,
                            influxdbVersion: globals.config.get(
                                'Butler-SOS.influxdbConfig.version'
                            ),
                            appNames: appNamesExtractEnable,
                            userSessions: userSessionsEnable,
                        },
                    },
                },
            },
        };

        // Send the telemetry to PostHog
        posthogClient.capture(body);

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
            '     More info at https://butler.ptarmiganlabs.com/docs/about/telemetry/'
        );
        globals.logger.error('❤️  Thank you for supporting Butler SOS by allowing telemetry! ❤️');
        globals.logger.error('');
        if (err.message) {
            globals.logger.error(`TELEMETRY: ${err.message}`);
        }
    }
};

/**
 * Sets up a timer to periodically send anonymous usage telemetry.
 *
 * This function initializes the PostHog client and configures a timer to send
 * anonymous telemetry data every 12 hours. It also sends an initial telemetry
 * report immediately upon setup.
 *
 * @param {object} [logger] - Optional logger object (not used in the function)
 * @param {object} [hostInfo] - Optional host information (not used in the function)
 * @returns {void}
 */
export function setupAnonUsageReportTimer(logger, hostInfo) {
    try {
        // Setup PostHog client
        posthogClient = new PostHog('phc_5cmKiX9OubQjsSfOZuaolWaxo2z7WXqd295eB0uOtTb', {
            host: 'https://eu.posthog.com',
            flushAt: 1, // Flush events to PostHog as soon as they are captured
            flushInterval: 60 * 1000, // Flush every 60 seconds
            requestTimeout: 30 * 1000, // 30 secpnds timeout
            disableGeoip: false, // Enable geoip lookups
        });

        setInterval(
            () => {
                callRemoteURL();
            },
            1000 * 60 * 60 * 12
        ); // Report anon usage every 12 hours
        // }, 1000 * 60 * 15); // Report anon usage every 15 monutes for testing

        // Do an initial telemetry report
        callRemoteURL();
    } catch (err) {
        logger.error(`TELEMETRY: ${err}`);
    }
}
