import globals from '../globals.js';

function configObfuscate(config) {
    try {
        const obfuscatedConfig = { ...config };

        // Obfuscate Butler-SOS.configVisualisation.host, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].configVisualisation.host =
            obfuscatedConfig['Butler-SOS'].configVisualisation.host.substring(0, 3) +
            '*'.repeat(10);

        // Keep first 10 chars of remote URL, mask the rest with *
        obfuscatedConfig['Butler-SOS'].heartbeat.remoteURL =
            obfuscatedConfig['Butler-SOS'].heartbeat.remoteURL.substring(0, 10) + '*'.repeat(10);

        // Update entries in the array obfuscatedConfig['Butler-SOS'].thirdPartyToolsCredentials.newRelic
        obfuscatedConfig['Butler-SOS'].thirdPartyToolsCredentials.newRelic = obfuscatedConfig[
            'Butler-SOS'
        ].thirdPartyToolsCredentials.newRelic?.map((element) => ({
            ...element,
            insertApiKey: element.insertApiKey.substring(0, 5) + '*'.repeat(10),
            accountId: element.accountId.toString().substring(0, 3) + '*'.repeat(10),
        }));

        // Obfuscate Butler-SOS.userEvents.udpServerConfig.serverHost, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].userEvents.udpServerConfig.serverHost =
            obfuscatedConfig['Butler-SOS'].userEvents.udpServerConfig.serverHost.substring(0, 3) +
            '*'.repeat(10);

        // Obfuscate Butler-SOS.logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].include[], which is an array of objects, each with the following properties:
        // - appId: keep first 5 chars, mask the rest with *
        // - appName: keep first 5 chars, mask the rest with *
        obfuscatedConfig[
            'Butler-SOS'
        ].logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app.forEach((element) => {
            element.include = element.include.map((includeElement) => {
                if (includeElement.appId) {
                    includeElement.appId = includeElement.appId.substring(0, 5) + '*'.repeat(10);
                }

                if (includeElement.appName) {
                    includeElement.appName =
                        includeElement.appName.substring(0, 5) + '*'.repeat(10);
                }

                return includeElement;
            });
        });

        // Obfuscate Butler-SOS.iuserEvents.sendToMQTT.postTo.everythingTopic.topic, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].userEvents.sendToMQTT.postTo.everythingTopic.topic =
            obfuscatedConfig[
                'Butler-SOS'
            ].userEvents.sendToMQTT.postTo.everythingTopic.topic.substring(0, 10) + '*'.repeat(10);

        // Obfuscate Butler-SOS.iuserEvents.sendToMQTT.postTo.sessionStartTopic.topic, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].userEvents.sendToMQTT.postTo.sessionStartTopic.topic =
            obfuscatedConfig[
                'Butler-SOS'
            ].userEvents.sendToMQTT.postTo.sessionStartTopic.topic.substring(0, 10) +
            '*'.repeat(10);

        // Obfuscate Butler-SOS.iuserEvents.sendToMQTT.postTo.sessionStopTopic.topic, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].userEvents.sendToMQTT.postTo.sessionStopTopic.topic =
            obfuscatedConfig[
                'Butler-SOS'
            ].userEvents.sendToMQTT.postTo.sessionStopTopic.topic.substring(0, 10) + '*'.repeat(10);

        // Obfuscate Butler-SOS.iuserEvents.sendToMQTT.postTo.connectionOpenTopic.topic, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].userEvents.sendToMQTT.postTo.connectionOpenTopic.topic =
            obfuscatedConfig[
                'Butler-SOS'
            ].userEvents.sendToMQTT.postTo.connectionOpenTopic.topic.substring(0, 10) +
            '*'.repeat(10);

        // Obfuscate Butler-SOS.iuserEvents.sendToMQTT.postTo.connectionCloseTopic.topic, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].userEvents.sendToMQTT.postTo.connectionCloseTopic.topic =
            obfuscatedConfig[
                'Butler-SOS'
            ].userEvents.sendToMQTT.postTo.connectionCloseTopic.topic.substring(0, 10) +
            '*'.repeat(10);

        // Obfuscate Butler-SOS.logEvents.udpServerConfig.serverHost, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].logEvents.udpServerConfig.serverHost =
            obfuscatedConfig['Butler-SOS'].logEvents.udpServerConfig.serverHost.substring(0, 3) +
            '*'.repeat(10);

        // Obfuscate Butler-SOS.logEvents.sendToMQTT.baseTopic, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].logEvents.sendToMQTT.baseTopic =
            obfuscatedConfig['Butler-SOS'].logEvents.sendToMQTT.baseTopic.substring(0, 10) +
            '*'.repeat(10);

        // Log db - may not be present in the config in future versions of Butler SOS
        if (obfuscatedConfig['Butler-SOS'].logdb) {
            // Obfuscate Butler-SOS.logdb.host, keep first 3 chars, mask the rest with *
            obfuscatedConfig['Butler-SOS'].logdb.host =
                obfuscatedConfig['Butler-SOS'].logdb.host.substring(0, 3) + '*'.repeat(10);

            // Obfuscate Butler-SOS.logdb.qlogsReaderUser, keep first 3 chars, mask the rest with *
            obfuscatedConfig['Butler-SOS'].logdb.qlogsReaderUser =
                obfuscatedConfig['Butler-SOS'].logdb.qlogsReaderUser.substring(0, 3) +
                '*'.repeat(10);

            // Obfuscate Butler-SOS.logdb.qlogsReaderPwdd, keep first 0 chars, mask the rest with *
            obfuscatedConfig['Butler-SOS'].logdb.qlogsReaderPwdd = '*'.repeat(10);
        }

        // Obfuscate Butler-SOS.cert.clientCert, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].cert.clientCert =
            obfuscatedConfig['Butler-SOS'].cert.clientCert.substring(0, 10) + '*'.repeat(10);

        // Obfuscate Butler-SOS.cert.clientCertKey, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].cert.clientCertKey =
            obfuscatedConfig['Butler-SOS'].cert.clientCertKey.substring(0, 10) + '*'.repeat(10);

        // Obfuscate Butler-SOS.cert.clientCertCA, keep first 10 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].cert.clientCertCA =
            obfuscatedConfig['Butler-SOS'].cert.clientCertCA.substring(0, 10) + '*'.repeat(10);

        // Obfuscate Butler-SOS.cert.clientCertPassphrase, keep first 0 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].cert.clientCertPassphrase = '*'.repeat(10);

        // Obfuscate Butler-SOS.mqttConfig.brokerHost, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].mqttConfig.brokerHost =
            obfuscatedConfig['Butler-SOS'].mqttConfig.brokerHost.substring(0, 3) + '*'.repeat(10);

        // Obfuscate Butler-SOS.prometheus.host, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].prometheus.host =
            obfuscatedConfig['Butler-SOS'].prometheus.host.substring(0, 3) + '*'.repeat(10);

        // Obfuscate Butler-SOS.influxdbConfig.host, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].influxdbConfig.host =
            obfuscatedConfig['Butler-SOS'].influxdbConfig.host.substring(0, 3) + '*'.repeat(10);

        // Obfuscate Butler-SOS.influxdbConfig.v2Config.org, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].influxdbConfig.v2Config.org =
            obfuscatedConfig['Butler-SOS'].influxdbConfig.v2Config.org.substring(0, 3) +
            '*'.repeat(10);

        // Obfuscate Butler-SOS.influxdbConfig.v2Config.bucket, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].influxdbConfig.v2Config.bucket =
            obfuscatedConfig['Butler-SOS'].influxdbConfig.v2Config.bucket.substring(0, 3) +
            '*'.repeat(10);

        // Obfuscate Butler-SOS.influxdbConfig.v2Config.token, keep first 0 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].influxdbConfig.v2Config.token = '*'.repeat(10);

        // Obfuscate Butler-SOS.influxdbConfig.v1Config.auth.username, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].influxdbConfig.v1Config.auth.username =
            obfuscatedConfig['Butler-SOS'].influxdbConfig.v1Config.auth.username.substring(0, 3) +
            '*'.repeat(10);

        // Obfuscate Butler-SOS.influxdbConfig.v1Config.auth.password, keep first 0 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].influxdbConfig.v1Config.auth.password = '*'.repeat(10);

        // Obfuscate Butler-SOS.appNames.hostIP, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].appNames.hostIP =
            obfuscatedConfig['Butler-SOS'].appNames.hostIP.substring(0, 3) + '*'.repeat(10);

        // Obfuscate Butler-SOS.serversToMonitor.servers[].host, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].serversToMonitor.servers = obfuscatedConfig[
            'Butler-SOS'
        ].serversToMonitor.servers?.map((element) => ({
            ...element,
            host: element.host.substring(0, 3) + '*'.repeat(10),
        }));

        // Obfuscate Butler-SOS.serversToMonitor.servers[].logDbHost, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].serversToMonitor.servers = obfuscatedConfig[
            'Butler-SOS'
        ].serversToMonitor.servers?.map((element) => ({
            ...element,
            logDbHost: element.logDbHost.substring(0, 3) + '*'.repeat(10),
        }));

        // Obfuscate Butler-SOS.serversToMonitor.servers[].userSessions.host, keep first 3 chars, mask the rest with *
        obfuscatedConfig['Butler-SOS'].serversToMonitor.servers = obfuscatedConfig[
            'Butler-SOS'
        ].serversToMonitor.servers?.map((element) => ({
            ...element,
            userSessions: element.userSessions.host.substring(0, 3) + '*'.repeat(10),
        }));

        // Obfuscate Butler-SOS.serversToMonitor.servers[].headers, keep first 5 chars, mask the rest with *
        // Butler-SOS.serversToMonitor.servers[].headers is an object, so we need to obfuscate each key-value pair
        // If the array Butler-SOS.serversToMonitor.servers[].headers is empty, no obfuscation should be done
        obfuscatedConfig['Butler-SOS'].serversToMonitor.servers = obfuscatedConfig[
            'Butler-SOS'
        ].serversToMonitor.servers?.map((element) => {
            const newHeaders = {};

            // Is elemnt.headers an object with more than 0 key-value pairs?
            if (element?.headers && Object.keys(element?.headers)?.length > 0) {
                Object.entries(element?.headers).forEach(([key, value]) => {
                    newHeaders[key] = value.substring(0, 5) + '*'.repeat(10);
                });
            }

            return {
                ...element,
                headers: newHeaders,
            };
        });

        return obfuscatedConfig;
    } catch (err) {
        globals.logger.error(`CONFIG OBFUSCATE: Error obfuscating config: ${err.message}`);
        if (err.stack) {
            globals.logger.error(`CONFIG OBFUSCATE: ${err.stack}`);
        }
        throw err;
    }
}

export default configObfuscate;
