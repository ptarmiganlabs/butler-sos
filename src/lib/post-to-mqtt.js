import globals from '../globals.js';
import { logError } from './log-error.js';

/**
 * Posts health metrics from Qlik Sense engine healthcheck API to MQTT.
 *
 * This function publishes various metrics (memory usage, CPU usage, sessions, cache, etc.)
 * to MQTT topics based on the configuration in Butler-SOS.mqttConfig.
 *
 * @param {string} _host - The host name or IP (not used)
 * @param {string} serverName - The name of the server, used in MQTT topic path
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @returns {void}
 */
export function postHealthToMQTT(_host, serverName, body) {
    // Get base MQTT topic
    const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

    // Send to MQTT
    globals.mqttClient.publish(`${baseTopic + serverName}/version`, body.version);
    globals.mqttClient.publish(`${baseTopic + serverName}/started`, body.started);
    globals.mqttClient.publish(
        `${baseTopic + serverName}/mem/comitted`,
        body.mem.committed.toString()
    );
    globals.mqttClient.publish(
        `${baseTopic + serverName}/mem/allocated`,
        body.mem.allocated.toString()
    );
    globals.mqttClient.publish(`${baseTopic + serverName}/mem/free`, body.mem.free.toString());

    globals.mqttClient.publish(`${baseTopic + serverName}/cpu/total`, body.cpu.total.toString());

    globals.mqttClient.publish(
        `${baseTopic + serverName}/session/active`,
        body.session.active.toString()
    );
    globals.mqttClient.publish(
        `${baseTopic + serverName}/session/total`,
        body.session.total.toString()
    );

    globals.mqttClient.publish(
        `${baseTopic + serverName}/apps/active_docs`,
        body.apps.active_docs.toString()
    );
    globals.mqttClient.publish(
        `${baseTopic + serverName}/apps/loaded_docs`,
        body.apps.loaded_docs.toString()
    );
    globals.mqttClient.publish(
        `${baseTopic + serverName}/apps/in_memory_docs`,
        body.apps.in_memory_docs.toString()
    );
    globals.mqttClient.publish(`${baseTopic + serverName}/apps/calls`, body.apps.calls.toString());
    globals.mqttClient.publish(
        `${baseTopic + serverName}/apps/selections`,
        body.apps.selections.toString()
    );

    globals.mqttClient.publish(
        `${baseTopic + serverName}/users/active`,
        body.users.active.toString()
    );
    globals.mqttClient.publish(
        `${baseTopic + serverName}/users/total`,
        body.users.total.toString()
    );

    globals.mqttClient.publish(`${baseTopic + serverName}/cache/hits`, body.cache.hits.toString());
    globals.mqttClient.publish(
        `${baseTopic + serverName}/cache/lookups`,
        body.cache.lookups.toString()
    );
    globals.mqttClient.publish(
        `${baseTopic + serverName}/cache/added`,
        body.cache.added.toString()
    );
    globals.mqttClient.publish(
        `${baseTopic + serverName}/cache/replaced`,
        body.cache.replaced.toString()
    );
    globals.mqttClient.publish(
        `${baseTopic + serverName}/cache/bytes_added`,
        body.cache.bytes_added.toString()
    );
    if (body.cache.lookups > 0) {
        globals.mqttClient.publish(
            `${baseTopic + serverName}/cache/hit_ratio`,
            Math.floor((body.cache.hits / body.cache.lookups) * 100).toString()
        );
    }

    globals.mqttClient.publish(`${baseTopic + serverName}/saturated`, body.saturated.toString());
}

/**
 * Posts user session information to MQTT.
 *
 * This function publishes information about user sessions to MQTT topics
 * based on the configuration in Butler-SOS.mqttConfig.
 *
 * @param {string} host - The host name of the Qlik Sense server
 * @param {string} virtualProxy - The virtual proxy prefix
 * @param {string} body - JSON string containing user session information
 * @returns {void}
 */
export function postUserSessionsToMQTT(host, virtualProxy, body) {
    // Get base MQTT topic
    const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

    // Send to MQTT
    globals.mqttClient.publish(`${baseTopic + host}/usersession${virtualProxy}`, body);
}

/**
 * Posts user events from Qlik Sense to MQTT.
 *
 * This function processes user events (session start/stop, connection open/close)
 * and publishes them to configured MQTT topics. It supports both general event topics
 * and specific topics for different event types.
 *
 * @param {object} msg - The user event message object
 * @param {string} msg.messageType - The type of message
 * @param {string} msg.host - The host name of the Qlik Sense server
 * @param {string} msg.command - The command (Start session, Stop session, etc.)
 * @param {string} msg.user_directory - The user directory
 * @param {string} msg.user_id - The user ID
 * @param {string} msg.origin - The origin of the event
 * @param {string} msg.context - The context of the event
 * @param {string} msg.message - The message content
 * @param {string} [msg.appId] - Optional app ID
 * @param {string} [msg.appName] - Optional app name
 * @param {object} [msg.ua] - Optional user agent information
 * @returns {Promise<void>}
 */
export async function postUserEventToMQTT(msg) {
    try {
        // Create payload
        const payload = {
            messageType: msg.messageType,
            host: msg.host,
            command: msg.command,
            userDir: msg.user_directory,
            userId: msg.user_id,
            origin: msg.origin,
            context: msg.context,
            message: msg.message,
            tags: {},
        };

        // Add app id and name if they exist
        if (msg?.appId) payload.appId = msg.appId;
        if (msg?.appName) payload.appName = msg.appName;

        // Add user agent info if it exists
        if (msg?.ua?.browser?.name) payload.uaBrowserName = msg.ua.browser.name;
        if (msg?.ua?.browser?.major) payload.uaBrowserMajorVersion = msg.ua.browser.major;
        if (msg?.ua?.os?.name) payload.uaOsName = msg.ua.os.name;
        if (msg?.ua?.os?.version) payload.uaOsVersion = msg.ua.os.version;

        // Add custom tags from config file to payload
        if (
            globals.config.has('Butler-SOS.userEvents.tags') &&
            globals.config.get('Butler-SOS.userEvents.tags') !== null &&
            globals.config.get('Butler-SOS.userEvents.tags').length > 0
        ) {
            const configTags = globals.config.get('Butler-SOS.userEvents.tags');

            for (const item of configTags) {
                payload.tags[item.name] = item.value;
            }
        }

        // Send message to MQTT topics, as defined in the config file.
        let topic;
        if (
            globals.config.get('Butler-SOS.userEvents.sendToMQTT.postTo.everythingTopic.enable') ===
            true
        ) {
            topic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.everythingTopic.topic'
            );
            globals.mqttClient.publish(topic, JSON.stringify(payload));
        }

        if (
            globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStartTopic.enable'
            ) === true &&
            payload.command === 'Start session'
        ) {
            topic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStartTopic.topic'
            );
            globals.mqttClient.publish(topic, JSON.stringify(payload));
        }

        if (
            globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStopTopic.enable'
            ) === true &&
            payload.command === 'Stop session'
        ) {
            topic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStopTopic.topic'
            );
            globals.mqttClient.publish(topic, JSON.stringify(payload));
        }

        if (
            globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.connectionOpenTopic.enable'
            ) === true &&
            payload.command === 'Open connection'
        ) {
            topic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.connectionOpenTopic.topic'
            );
            globals.mqttClient.publish(topic, JSON.stringify(payload));
        }

        if (
            globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.connectionCloseTopic.enable'
            ) === true &&
            payload.command === 'Close connection'
        ) {
            topic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.connectionCloseTopic.topic'
            );
            globals.mqttClient.publish(topic, JSON.stringify(payload));
        }
    } catch (err) {
        // Track error count
        await globals.errorTracker.incrementError('MQTT_PUBLISH', '');

        logError('USER EVENT MQTT: Failed posting message to MQTT', err);
    }
}

/**
 * Posts log events from Qlik Sense to MQTT.
 *
 * This function processes log events from various Qlik Sense services
 * and publishes them to configured MQTT topics. It supports both generic
 * topics and specific topics for different log levels.
 *
 * @param {object} msg - The log event message object
 * @param {string} msg.source - The source of the log event
 * @param {string} msg.level - The log level (e.g., ERROR, WARN, FATAL)
 * @param {string} msg.message - The log message content
 * @param {string} [msg.timestamp] - The timestamp of the log event
 * @param {string} [msg.hostname] - The hostname where the log event occurred
 * @returns {Promise<void>}
 */
export async function postLogEventToMQTT(msg) {
    try {
        // Get MQTT root topic
        let baseTopic = globals.config.get('Butler-SOS.logEvents.sendToMQTT.baseTopic');

        const payload = msg;

        payload.tags = {};

        // Add custom tags from config file to payload
        if (
            globals.config.has('Butler-SOS.logEvents.tags') &&
            globals.config.get('Butler-SOS.logEvents.tags') !== null &&
            globals.config.get('Butler-SOS.logEvents.tags').length > 0
        ) {
            const configTags = globals.config.get('Butler-SOS.logEvents.tags');

            for (const item of configTags) {
                payload.tags[item.name] = item.value;
            }
        }

        // Send to MQTT root topic
        if (globals.config.get('Butler-SOS.logEvents.sendToMQTT.postTo.baseTopic') === true) {
            globals.mqttClient.publish(baseTopic, JSON.stringify(msg));
        }

        // Send to MQTT sub-topics
        if (globals.config.get('Butler-SOS.logEvents.sendToMQTT.postTo.subsystemTopics') === true) {
            // Add / to topic path if it's not already there
            if (baseTopic.slice(-1) !== '/') {
                baseTopic = `${baseTopic}/`;
            }

            const topicTree = msg.subsystem.split('.');

            topicTree.forEach((element) => {
                baseTopic += `${element.toLowerCase()}/`;
            });

            // Remove / at end of topic path
            baseTopic = baseTopic.substring(0, baseTopic.length - 1);

            globals.mqttClient.publish(baseTopic, JSON.stringify(msg));
        }
    } catch (err) {
        // Track error count
        await globals.errorTracker.incrementError('MQTT_PUBLISH', '');

        logError('LOG EVENT MQTT: Failed posting message to MQTT', err);
    }
}
