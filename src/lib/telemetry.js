import { PostHog } from 'posthog-node';

import globals from '../globals.js';

// Define variable to hold the PostHog client
let posthogClient;

/**
 * Safely gets a configuration value with a default fallback
 *
 * @param {string} path - Configuration path
 * @param {unknown} defaultValue - Default value to return if config doesn't exist or is invalid
 * @returns {unknown} Configuration value or default
 */
function safeGetConfig(path, defaultValue = false) {
    try {
        return globals.config.has(path) ? globals.config.get(path) : defaultValue;
    } catch (err) {
        globals.logger?.debug(`TELEMETRY: Error getting config ${path}: ${err.message}`);
        return defaultValue;
    }
}

/**
 * Safely accesses nested properties with a default fallback
 *
 * @param {object} obj - Object to access
 * @param {string} path - Dot-separated path (e.g., 'si.os.platform')
 * @param {unknown} defaultValue - Default value if path doesn't exist
 * @returns {unknown} Property value or default
 */
function safeGetProperty(obj, path, defaultValue = 'unknown') {
    try {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : defaultValue;
        }, obj);
    } catch (err) {
        return defaultValue;
    }
}

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
        // Check if telemetry is enabled before doing anything
        if (safeGetConfig('Butler-SOS.anonTelemetry') !== true) {
            globals.logger?.debug(
                'TELEMETRY: Anonymous telemetry is disabled, skipping data collection'
            );
            return;
        }

        // Check if hostInfo is available
        if (!globals.hostInfo) {
            globals.logger?.debug('TELEMETRY: Host info not available, using fallback values');
        }

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
        if (safeGetConfig('Butler-SOS.heartbeat.enable') === true) {
            heartbeat = true;
        }

        if (safeGetConfig('Butler-SOS.dockerHealthCheck.enable') === true) {
            dockerHealthCheck = true;
        }

        if (safeGetConfig('Butler-SOS.uptimeMonitor.enable') === true) {
            uptimeMonitor = true;
        }

        if (safeGetConfig('Butler-SOS.uptimeMonitor.storeNewRelic.enable') === true) {
            uptimeMonitorNewRelic = true;
        }

        if (safeGetConfig('Butler-SOS.qlikSenseEvents.eventCount.enable') === true) {
            eventCountEnable = true;
        }

        if (safeGetConfig('Butler-SOS.qlikSenseEvents.rejectedEventCount.enable') === true) {
            rejectedEventCountEnable = true;
        }

        if (safeGetConfig('Butler-SOS.userEvents.enable') === true) {
            userEventsEnable = true;
        }

        if (safeGetConfig('Butler-SOS.userEvents.sendToMQTT.enable') === true) {
            userEventsMQTTEnable = true;
        }

        if (safeGetConfig('Butler-SOS.userEvents.sendToInfluxdb.enable') === true) {
            userEventsInfluxDBEnable = true;
        }

        if (safeGetConfig('Butler-SOS.userEvents.sendToNewRelic.enable') === true) {
            userEventsNewRelicEnable = true;
        }

        if (safeGetConfig('Butler-SOS.logEvents.source.proxy.enable') === true) {
            logEventsProxyEnable = true;
        }

        if (safeGetConfig('Butler-SOS.logEvents.source.scheduler.enable') === true) {
            logEventsSchedulerEnable = true;
        }

        if (safeGetConfig('Butler-SOS.logEvents.source.repository.enable') === true) {
            logEventsRepositoryEnable = true;
        }

        if (safeGetConfig('Butler-SOS.logEvents.sendToMQTT.enable') === true) {
            logEventsMQTTEnable = true;
        }

        if (safeGetConfig('Butler-SOS.logEvents.sendToInfluxdb.enable') === true) {
            logEventsInfluxDBEnable = true;
        }

        if (safeGetConfig('Butler-SOS.logEvents.sendToNewRelic.enable') === true) {
            logEventsNewRelicEnable = true;
        }

        if (safeGetConfig('Butler-SOS.logEvents.categorise.enable') === true) {
            logEventCategoriseEnable = true;
        }

        // Get number of rules in the categorise rules array at Butler-SOS.logEvents.categorise.rules
        if (globals.config.has('Butler-SOS.logEvents.categorise.rules')) {
            const categoriseRules = globals.config.get('Butler-SOS.logEvents.categorise.rules');
            // Ensure the config value is an array before calling .length
            logEventCategoriseRuleCount = Array.isArray(categoriseRules)
                ? categoriseRules.length
                : 0;
        }

        if (safeGetConfig('Butler-SOS.logEvents.categorise.ruleDefault.enable') === true) {
            logEventCategoriseRuleDefaultEnable = true;
        }

        if (safeGetConfig('Butler-SOS.logEvents.enginePerformanceMonitor.enable') === true) {
            logEventEnginePerformanceMonitorEnable = true;
        }

        if (
            safeGetConfig('Butler-SOS.logEvents.enginePerformanceMonitor.appNameLookup.enable') ===
            true
        ) {
            logEventEnginePerformanceMonitorNameLookupEnable = true;
        }

        if (
            safeGetConfig(
                'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.enable'
            ) === true
        ) {
            logEventEnginePerformanceMonitorTrackRejectedEnable = true;
        }

        if (safeGetConfig('Butler-SOS.mqttConfig.enable') === true) {
            mqttEnable = true;
        }

        // Is New Relic enabled?
        if (safeGetConfig('Butler-SOS.newRelic.enable') === true) {
            newRelicEnable = true;
        }

        if (safeGetConfig('Butler-SOS.prometheus.enable') === true) {
            prometheusEnable = true;
        }

        if (safeGetConfig('Butler-SOS.influxdbConfig.enable') === true) {
            influxdbEnable = true;
        }

        if (safeGetConfig('Butler-SOS.appNames.enableAppNameExtract') === true) {
            appNamesExtractEnable = true;
        }

        if (safeGetConfig('Butler-SOS.userSessions.enableSessionExtract') === true) {
            userSessionsEnable = true;
        }

        // Build body that can be sent to PostHog
        const body = {
            distinctId: safeGetProperty(globals.hostInfo, 'id', 'unknown-host-id'),
            event: 'telemetry sent',

            properties: {
                service: 'butler-sos',
                serviceVersion: globals.appVersion || 'unknown',

                system_id: safeGetProperty(globals.hostInfo, 'id', 'unknown-host-id'),
                system_arch: safeGetProperty(globals.hostInfo, 'si.os.arch', 'unknown'),
                system_platform: safeGetProperty(globals.hostInfo, 'si.os.platform', 'unknown'),
                system_release: safeGetProperty(globals.hostInfo, 'si.os.release', 'unknown'),
                system_distro: safeGetProperty(globals.hostInfo, 'si.os.distro', 'unknown'),
                system_codename: safeGetProperty(globals.hostInfo, 'si.os.codename', 'unknown'),
                system_virtual: safeGetProperty(globals.hostInfo, 'si.system.virtual', false),
                system_isRunningInDocker: safeGetProperty(
                    globals.hostInfo,
                    'isRunningInDocker',
                    false
                ),
                system_nodeVersion: safeGetProperty(
                    globals.hostInfo,
                    'node.nodeVersion',
                    'unknown'
                ),

                feature_heartbeat: heartbeat,
                feature_dockerHealthCheck: dockerHealthCheck,
                feature_uptimeMonitor: uptimeMonitor,
                feature_uptimeMonitor_storeNewRelic: uptimeMonitorNewRelic,
                feature_udpServer: safeGetConfig('Butler-SOS.userEvents.enable', false),

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
                feature_influxdb_version: safeGetConfig(
                    'Butler-SOS.influxdbConfig.version',
                    'unknown'
                ),
                feature_appNames: appNamesExtractEnable,
                feature_userSessions: userSessionsEnable,

                telemetry_json: {
                    system: {
                        id: safeGetProperty(globals.hostInfo, 'id', 'unknown-host-id'),
                        arch: safeGetProperty(globals.hostInfo, 'si.os.arch', 'unknown'),
                        platform: safeGetProperty(globals.hostInfo, 'si.os.platform', 'unknown'),
                        release: safeGetProperty(globals.hostInfo, 'si.os.release', 'unknown'),
                        distro: safeGetProperty(globals.hostInfo, 'si.os.distro', 'unknown'),
                        codename: safeGetProperty(globals.hostInfo, 'si.os.codename', 'unknown'),
                        virtual: safeGetProperty(globals.hostInfo, 'si.system.virtual', false),
                        isRunningInDocker: safeGetProperty(
                            globals.hostInfo,
                            'isRunningInDocker',
                            false
                        ),
                        nodeVersion: safeGetProperty(
                            globals.hostInfo,
                            'node.nodeVersion',
                            'unknown'
                        ),
                    },
                    enabledFeatures: {
                        feature: {
                            heartbeat,
                            dockerHealthCheck,
                            uptimeMonitor,
                            uptimeMonitorNewRelic,
                            udpServer: safeGetConfig('Butler-SOS.userEvents.enable', false),
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
                            influxdbVersion: safeGetConfig(
                                'Butler-SOS.influxdbConfig.version',
                                'unknown'
                            ),
                            appNames: appNamesExtractEnable,
                            userSessions: userSessionsEnable,
                        },
                    },
                },
            },
        };

        // Send the telemetry to PostHog
        if (posthogClient) {
            posthogClient.capture(body);
            globals.logger?.debug(
                'TELEMETRY: Sent anonymous telemetry. Thanks for contributing to making Butler SOS better!'
            );
        } else {
            globals.logger?.warn('TELEMETRY: PostHog client not initialized, skipping telemetry');
        }
    } catch (err) {
        globals.logger?.error('TELEMETRY: Could not send anonymous telemetry.');
        globals.logger?.error(
            '     While not mandatory the telemetry data greatly helps the Butler SOS developers.'
        );
        globals.logger?.error(
            '     It provides insights into which features are used most and what hardware/OSs are most used out there.'
        );
        globals.logger?.error(
            '     This information makes it possible to focus development efforts where they will make most impact and be most valuable.'
        );
        globals.logger?.error(
            '     More info at https://butler.ptarmiganlabs.com/docs/about/telemetry/'
        );
        globals.logger?.error('❤️  Thank you for supporting Butler SOS by allowing telemetry! ❤️');
        globals.logger?.error('');
        if (err?.message) {
            globals.logger?.error(`TELEMETRY: ${err.message}`);
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
        if (logger) {
            logger.error(`TELEMETRY: ${err?.message || err}`);
        } else {
            // Fallback if logger is not available
            console.error(`TELEMETRY: ${err?.message || err}`);
        }
    }
}
