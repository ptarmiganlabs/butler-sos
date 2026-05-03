import globals from '../globals.js';
import { logError } from './log-error.js';

/**
 * Wraps `mqttClient.publish()` in a Promise so that both synchronous argument
 * errors and asynchronous broker/network failures (reported via the publish
 * callback) are surfaced as Promise rejections.
 *
 * @param {string} topic - The MQTT topic to publish to
 * @param {string} message - The message payload
 * @returns {Promise<void>}
 */
function publishAsync(topic, message) {
    return new Promise((resolve, reject) => {
        globals.mqttClient.publish(topic, message, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Posts health metrics from Qlik Sense engine healthcheck API to MQTT.
 *
 * This function publishes various metrics (memory usage, CPU usage, sessions, cache, etc.)
 * to MQTT topics based on the configuration in Butler-SOS.mqttConfig.
 *
 * @param {string} _host - The host name or IP (not used)
 * @param {string} serverName - The name of the server, used in MQTT topic path
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @returns {Promise<void>}
 */
export async function postHealthToMQTT(_host, serverName, body) {
    // Get base MQTT topic
    const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');
    const brokerHost = globals.config.get('Butler-SOS.mqttConfig.brokerHost');

    // Build the list of publishes up-front so all calls to mqttClient.publish()
    // happen synchronously; broker-side failures are captured via the callback.
    const publishes = [
        publishAsync(`${baseTopic + serverName}/version`, body.version),
        publishAsync(`${baseTopic + serverName}/started`, body.started),
        publishAsync(`${baseTopic + serverName}/mem/comitted`, body.mem.committed.toString()),
        publishAsync(`${baseTopic + serverName}/mem/allocated`, body.mem.allocated.toString()),
        publishAsync(`${baseTopic + serverName}/mem/free`, body.mem.free.toString()),
        publishAsync(`${baseTopic + serverName}/cpu/total`, body.cpu.total.toString()),
        publishAsync(`${baseTopic + serverName}/session/active`, body.session.active.toString()),
        publishAsync(`${baseTopic + serverName}/session/total`, body.session.total.toString()),
        publishAsync(
            `${baseTopic + serverName}/apps/active_docs`,
            body.apps.active_docs.toString()
        ),
        publishAsync(
            `${baseTopic + serverName}/apps/loaded_docs`,
            body.apps.loaded_docs.toString()
        ),
        publishAsync(
            `${baseTopic + serverName}/apps/in_memory_docs`,
            body.apps.in_memory_docs.toString()
        ),
        publishAsync(`${baseTopic + serverName}/apps/calls`, body.apps.calls.toString()),
        publishAsync(`${baseTopic + serverName}/apps/selections`, body.apps.selections.toString()),
        publishAsync(`${baseTopic + serverName}/users/active`, body.users.active.toString()),
        publishAsync(`${baseTopic + serverName}/users/total`, body.users.total.toString()),
        publishAsync(`${baseTopic + serverName}/cache/hits`, body.cache.hits.toString()),
        publishAsync(`${baseTopic + serverName}/cache/lookups`, body.cache.lookups.toString()),
        publishAsync(`${baseTopic + serverName}/cache/added`, body.cache.added.toString()),
        publishAsync(`${baseTopic + serverName}/cache/replaced`, body.cache.replaced.toString()),
        publishAsync(
            `${baseTopic + serverName}/cache/bytes_added`,
            body.cache.bytes_added.toString()
        ),
        publishAsync(`${baseTopic + serverName}/saturated`, body.saturated.toString()),
    ];

    if (body.cache.lookups > 0) {
        publishes.push(
            publishAsync(
                `${baseTopic + serverName}/cache/hit_ratio`,
                Math.floor((body.cache.hits / body.cache.lookups) * 100).toString()
            )
        );
    }

    try {
        await Promise.all(publishes);
    } catch (err) {
        await globals.errorTracker.incrementError(
            'MQTT_PUBLISH',
            serverName,
            { host: brokerHost, module: 'HEALTH_METRICS_MQTT' },
            err
        );

        logError(
            `HEALTH METRICS MQTT: Failed publishing health metrics for server '${serverName}'`,
            err
        );
    }
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
 * @returns {Promise<void>}
 */
export async function postUserSessionsToMQTT(host, virtualProxy, body) {
    // Get base MQTT topic
    const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');
    const brokerHost = globals.config.get('Butler-SOS.mqttConfig.brokerHost');

    try {
        await publishAsync(`${baseTopic + host}/usersession${virtualProxy}`, body);
    } catch (err) {
        await globals.errorTracker.incrementError(
            'MQTT_PUBLISH',
            host,
            { host: brokerHost, virtualProxy, module: 'PROXY_SESSIONS_MQTT' },
            err
        );

        logError(
            `PROXY SESSIONS MQTT: Failed publishing session data for host '${host}', virtual proxy '${virtualProxy}'`,
            err
        );
    }
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
        // Collect all publish Promises so mqttClient.publish() is called
        // synchronously for each topic before we await completion.
        const publishes = [];

        if (
            globals.config.get('Butler-SOS.userEvents.sendToMQTT.postTo.everythingTopic.enable') ===
            true
        ) {
            const everythingTopic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.everythingTopic.topic'
            );
            publishes.push(publishAsync(everythingTopic, JSON.stringify(payload)));
        }

        if (
            globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStartTopic.enable'
            ) === true &&
            payload.command === 'Start session'
        ) {
            const sessionStartTopic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStartTopic.topic'
            );
            publishes.push(publishAsync(sessionStartTopic, JSON.stringify(payload)));
        }

        if (
            globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStopTopic.enable'
            ) === true &&
            payload.command === 'Stop session'
        ) {
            const sessionStopTopic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.sessionStopTopic.topic'
            );
            publishes.push(publishAsync(sessionStopTopic, JSON.stringify(payload)));
        }

        if (
            globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.connectionOpenTopic.enable'
            ) === true &&
            payload.command === 'Open connection'
        ) {
            const connectionOpenTopic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.connectionOpenTopic.topic'
            );
            publishes.push(publishAsync(connectionOpenTopic, JSON.stringify(payload)));
        }

        if (
            globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.connectionCloseTopic.enable'
            ) === true &&
            payload.command === 'Close connection'
        ) {
            const connectionCloseTopic = globals.config.get(
                'Butler-SOS.userEvents.sendToMQTT.postTo.connectionCloseTopic.topic'
            );
            publishes.push(publishAsync(connectionCloseTopic, JSON.stringify(payload)));
        }

        await Promise.all(publishes);
    } catch (err) {
        let brokerHost = '';
        try {
            brokerHost = globals.config.get('Butler-SOS.mqttConfig.brokerHost') ?? '';
        } catch (_) {
            /* ignore */
        }

        await globals.errorTracker.incrementError(
            'MQTT_PUBLISH',
            msg?.host || '',
            { host: brokerHost, module: 'USER_EVENTS_MQTT' },
            err
        );

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

        // Collect all publish Promises so mqttClient.publish() is called
        // synchronously for each topic before we await completion.
        const publishes = [];

        // Send to MQTT root topic
        if (globals.config.get('Butler-SOS.logEvents.sendToMQTT.postTo.baseTopic') === true) {
            publishes.push(publishAsync(baseTopic, JSON.stringify(msg)));
        }

        // Send to MQTT sub-topics
        if (globals.config.get('Butler-SOS.logEvents.sendToMQTT.postTo.subsystemTopics') === true) {
            // Build the subsystem topic path from the base topic
            let topicPath = baseTopic.slice(-1) !== '/' ? `${baseTopic}/` : baseTopic;

            const topicTree = msg.subsystem.split('.');

            topicTree.forEach((element) => {
                topicPath += `${element.toLowerCase()}/`;
            });

            // Remove / at end of topic path
            topicPath = topicPath.substring(0, topicPath.length - 1);

            publishes.push(publishAsync(topicPath, JSON.stringify(msg)));
        }

        await Promise.all(publishes);
    } catch (err) {
        let brokerHost = '';
        try {
            brokerHost = globals.config.get('Butler-SOS.mqttConfig.brokerHost') ?? '';
        } catch (_) {
            /* ignore */
        }

        await globals.errorTracker.incrementError(
            'MQTT_PUBLISH',
            msg?.hostname || '',
            { host: brokerHost, module: 'LOG_EVENTS_MQTT' },
            err
        );

        logError('LOG EVENT MQTT: Failed posting message to MQTT', err);
    }
}
