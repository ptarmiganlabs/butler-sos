/**
 * Webhook output: POSTs each alert and refusal as JSON. Sweep events are not sent.
 *
 * @param {object} cfg The `outputs.webhook` section.
 * @returns {{name: string, handle: Function, close: Function}} Output.
 */
export function webhookOutput(cfg) {
    const token = cfg.tokenEnv ? process.env[cfg.tokenEnv] : undefined;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return {
        name: 'webhook',
        async handle(result) {
            for (const e of result.events.filter(
                (x) => x.type === 'alert' || x.type === 'refused'
            )) {
                try {
                    const res = await fetch(cfg.url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ source: 'qseow-session-monitor', ...e }),
                        signal: AbortSignal.timeout(10000),
                    });
                    if (!res.ok)
                        console.error(`${result.at} webhook: ${res.status} ${res.statusText}`);
                } catch (err) {
                    console.error(`${result.at} webhook: ${err.message}`);
                }
            }
        },
        close() {},
    };
}
