/* eslint-disable prefer-destructuring */
/* eslint-disable no-unused-vars */

const globals = require('../globals');

function postLogDbToMQTT(processHost, processName, entryLevel, message, _timestamp) {
    // Get base MQTT topic
    const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

    // Send to MQTT
    globals.mqttClient.publish(`${baseTopic + processHost}/${processName}/${entryLevel}`, message);
}

function postHealthToMQTT(_host, serverName, body) {
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

function postUserSessionsToMQTT(host, virtualProxy, body) {
    // Get base MQTT topic
    const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');

    // Send to MQTT
    globals.mqttClient.publish(`${baseTopic + host}/usersession${virtualProxy}`, body);
}

function postUserEventToMQTT(msg) {
    // Get MQTT topic
    const baseTopic = globals.config.get('Butler-SOS.mqttConfig.baseTopic');
    const topic = globals.config.get('Butler-SOS.userEvents.sendToMQTT.topic');

    // Format payload
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

    // Add custom tags from config file to payload
    if (
        globals.config.has('Butler-SOS.userEvents.tags') &&
        globals.config.get('Butler-SOS.userEvents.tags').length > 0
    ) {
        const configTags = globals.config.get('Butler-SOS.userEvents.tags');
        // eslint-disable-next-line no-restricted-syntax
        for (const item of configTags) {
            payload.tags[item.tag] = item.value;
        }
    }

    // Send to MQTT
    globals.mqttClient.publish(baseTopic + topic, JSON.stringify(payload));
}

function postLogEventToMQTT(msg) {
    try {
        // Get MQTT root topic
        let baseTopic = globals.config.get('Butler-SOS.logEvents.sendToMQTT.baseTopic');

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
                baseTopic += `${element}/`;
            });

            // Remove / at end of topic path
            baseTopic = baseTopic.substring(0, baseTopic.length - 1);

            globals.mqttClient.publish(baseTopic, JSON.stringify(msg));
        }
    } catch (err) {
        globals.logger.error(`LOG EVENT MQTT: Failed posting message to MQTT ${err}.`);
    }
}

module.exports = {
    postLogDbToMQTT,
    postHealthToMQTT,
    postUserSessionsToMQTT,
    postUserEventToMQTT,
    postLogEventToMQTT,
};
