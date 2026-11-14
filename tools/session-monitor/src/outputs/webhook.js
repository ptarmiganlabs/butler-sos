const QUEUE_MAX = 500;

/**
 * Webhook output: POSTs each alert and refusal as JSON. Sweep events are not sent.
 *
 * Delivery runs in the background, one request at a time, from a bounded queue, so a slow or
 * unreachable endpoint never holds up reading Sense or updating the page. When the queue is full the
 * oldest waiting events are dropped, and that is logged.
 *
 * @param {object} cfg The `outputs.webhook` section.
 * @returns {{name: string, handle: Function, close: Function}} Output.
 */
export function webhookOutput(cfg) {
    const token = cfg.tokenEnv ? process.env[cfg.tokenEnv] : undefined;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const queue = [];
    let dropped = 0;
    let sending = false;
    let closing = false;

    async function drain() {
        if (sending) return;
        sending = true;
        while (queue.length && !closing) {
            const e = queue.shift();
            try {
                const res = await fetch(cfg.url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ source: 'qseow-session-monitor', ...e }),
                    signal: AbortSignal.timeout(10000),
                });
                if (!res.ok)
                    console.error(
                        `${new Date().toISOString()} webhook: ${res.status} ${res.statusText}`
                    );
            } catch (err) {
                console.error(`${new Date().toISOString()} webhook: ${err.message}`);
            }
        }
        sending = false;
    }

    return {
        name: 'webhook',
        handle(result) {
            for (const e of result.events)
                if (e.type === 'alert' || e.type === 'refused') queue.push(e);
            if (queue.length > QUEUE_MAX) {
                const n = queue.length - QUEUE_MAX;
                queue.splice(0, n);
                dropped += n;
                console.error(
                    `${result.at} webhook: endpoint too slow, dropped ${n} waiting events (${dropped} in total)`
                );
            }
            drain();
        },
        // On shutdown, give waiting events up to 5 s to go out, then stop.
        async close() {
            const deadline = Date.now() + 5000;
            while ((queue.length || sending) && Date.now() < deadline) {
                drain();
                await new Promise((r) => setTimeout(r, 100));
            }
            closing = true;
            if (queue.length)
                console.error(
                    `${new Date().toISOString()} webhook: ${queue.length} events not sent at shutdown`
                );
        },
        get pending() {
            return queue.length;
        },
    };
}
