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

    // User topics with a retained state on the broker. Compared with the current users on every
    // update, so a user who left while the broker was unreachable is still cleared afterwards.
    const published = new Set();
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
            const current = new Set();
            for (const u of result.users) {
                if (u.gone) continue;
                const topic = `user/${level(u.userDirectory)}/${level(u.userId)}`;
                const { key, timeline, ...state } = u;
                pub(topic, { at: result.at, ...state }, true);
                current.add(topic);
                published.add(topic);
            }
            for (const topic of published) {
                if (current.has(topic)) continue;
                pub(topic, '', true);
                published.delete(topic);
            }
        },
        close() {
            return new Promise((resolve) => client.end(false, {}, resolve));
        },
    };
}
