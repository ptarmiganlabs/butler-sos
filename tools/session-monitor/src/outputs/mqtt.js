import crypto from 'node:crypto';
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
        // Unique per run: two monitors with the same id would keep disconnecting each other.
        clientId: `qseow-session-monitor-${crypto.randomBytes(6).toString('hex')}`,
    });
    client.on('error', (err) => console.error(`${new Date().toISOString()} mqtt: ${err.message}`));
    // Resolves on the first connection, or after 5 s so a missing broker doesn't block the monitor.
    const ready = new Promise((resolve) => {
        client.once('connect', resolve);
        setTimeout(resolve, 5000).unref();
    });
    const root = cfg.topicRoot.replace(/\/+$/, '');
    // User topics with a retained state on the broker. Compared with the current users on every
    // update, so a user who left while the broker was unreachable is still cleared afterwards.
    const published = new Set();
    // On every connection, read the user topics the broker still holds as retained (from an earlier
    // run, say), so users who left while the monitor wasn't running are cleared too.
    client.on('connect', () => {
        if (!cfg.publishUserState) return;
        const filter = `${root}/user/#`;
        client.subscribe(filter, { qos: 0 });
        setTimeout(() => client.unsubscribe(filter), 3000).unref();
    });
    client.on('message', (topic, payload, packet) => {
        if (packet.retain && payload.length && topic.startsWith(`${root}/user/`))
            published.add(topic.slice(root.length + 1));
    });
    // MQTT topic levels must not contain + or #, and a slash would add a level. Percent-encode them
    // (and % itself), so different user names never map to the same topic.
    const level = (s) =>
        String(s).replace(/[%+#/]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
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
