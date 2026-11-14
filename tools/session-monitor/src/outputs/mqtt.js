import mqtt from 'mqtt';

/**
 * MQTT output.
 *
 * Topics (below `topicRoot`):
 *   alert                          each alert raised, changed or cleared (JSON)
 *   refused                        each refused session (JSON)
 *   summary                        totals every poll (JSON, retained)
 *   user/<directory>/<userid>      per-user state every poll (JSON, retained; empty payload clears it)
 *
 * @param {object} cfg The `outputs.mqtt` section.
 * @returns {{name: string, handle: Function, close: Function}} Output.
 */
export function mqttOutput(cfg) {
    const client = mqtt.connect(cfg.url, {
        username: cfg.usernameEnv ? process.env[cfg.usernameEnv] : undefined,
        password: cfg.passwordEnv ? process.env[cfg.passwordEnv] : undefined,
        reconnectPeriod: 5000,
        clientId: `qseow-session-monitor-${process.pid}`,
    });
    client.on('error', (err) => console.error(`${new Date().toISOString()} mqtt: ${err.message}`));
    // Resolves on the first connection, or after 5 s so a missing broker doesn't block the monitor.
    const ready = new Promise((resolve) => {
        client.once('connect', resolve);
        setTimeout(resolve, 5000).unref();
    });
    const root = cfg.topicRoot.replace(/\/+$/, '');
    // MQTT topic levels must not contain + or #; slashes would add levels.
    const level = (s) => String(s).replace(/[+#/]/g, '_');
    const pub = (topic, payload, retain = false) =>
        client.publish(`${root}/${topic}`, payload === '' ? '' : JSON.stringify(payload), {
            qos: 0,
            retain,
        });

    return {
        name: 'mqtt',
        ready,
        handle(result) {
            if (!client.connected) return;
            for (const e of result.events) {
                if (e.type === 'alert') pub('alert', e);
                else if (e.type === 'refused') pub('refused', e);
            }
            pub('summary', { at: result.at, ...result.summary }, true);
            if (!cfg.publishUserState) return;
            for (const u of result.users) {
                const topic = `user/${level(u.userDirectory)}/${level(u.userId)}`;
                if (u.gone) pub(topic, '', true);
                else {
                    const { key, ...state } = u;
                    pub(topic, { at: result.at, ...state }, true);
                }
            }
        },
        close() {
            return new Promise((resolve) => client.end(false, {}, resolve));
        },
    };
}
