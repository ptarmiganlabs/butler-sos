import http from 'node:http';
import { readWebFile } from '../assets.js';

// The page's files. Only these paths are served; they are small, so they are read on each request.
const FILES = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
    ...Object.fromEntries(
        [
            'ptarmigan-labs-lockup-on-light.svg',
            'ptarmigan-labs-lockup-on-dark.svg',
            'ptarmigan-labs-icon.svg',
            'ptarmigan-labs-icon-on-dark.svg',
        ].map((f) => [`/brand/${f}`, [`brand/${f}`, 'image/svg+xml']])
    ),
};
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

/**
 * Live web page: per-user licence slots with countdowns, session timelines, entry points, licence
 * totals and a live feed, pushed with Server-Sent Events. Binds to localhost by default; it has no
 * authentication, so put a reverse proxy with sign-in in front of it before exposing it further.
 *
 * @param {object} cfg The `outputs.web` section.
 * @param {string} site Shown in the page header (the Repository host).
 * @param {number} pollSeconds Poll interval, so the page can tell when data is stale.
 * @param {object} [actions] What the page may change. Present only with --allow-session-delete.
 * @param {(sessionId: string) => Promise<{ok: boolean, message: string}>} [actions.endSession]
 *     Ends one proxy session the monitor can see.
 * @returns {{name: string, handle: Function, close: Function}} Output.
 */
export function webOutput(cfg, site, pollSeconds, actions = {}) {
    let latest = null; // full result, timelines included
    let slim = null; // what every browser gets: the result without per-user timelines
    // Two event buffers, so sign-ins on a busy site can't push refusals and alerts out of the feed.
    const IMPORTANT = new Set(['refused', 'alert', 'sweep']);
    const important = [];
    const activity = [];
    const clients = new Set();
    // The current time on the data's clock (Sense's, when it differs from ours), for the page's countdowns.
    let handledAt = 0;
    const nowIso = () => new Date(Date.parse(latest.at) + (Date.now() - handledAt)).toISOString();
    const json = (res, body, status = 200) =>
        res
            .writeHead(status, { 'Content-Type': 'application/json', ...SECURITY_HEADERS })
            .end(JSON.stringify(body));
    const server = http.createServer((req, res) => {
        try {
            route(req, res);
        } catch (err) {
            // A bad request must never stop the monitor.
            if (!res.headersSent) res.writeHead(400, SECURITY_HEADERS);
            res.end();
        }
    });
    function route(req, res) {
        const url = new URL(req.url, 'http://x');
        const path = url.pathname;
        if (req.method === 'POST' && path === '/api/end-session') {
            endSession(req, res, url);
        } else if (req.method !== 'GET') {
            res.writeHead(405, SECURITY_HEADERS).end();
        } else if (FILES[path]) {
            const [file, type] = FILES[path];
            res.writeHead(200, {
                'Content-Type': type,
                'Cache-Control': 'no-cache',
                ...SECURITY_HEADERS,
            }).end(readWebFile(file));
        } else if (path === '/api/state') {
            // The current state plus the recent events, for a page that has just (re)connected.
            if (!slim) res.writeHead(503, SECURITY_HEADERS).end();
            else json(res, { ...slim, now: nowIso(), recentEvents: [...important, ...activity] });
        } else if (path === '/api/timeline') {
            // One user's session timeline, fetched by the page only for users whose row is open.
            const key = String(url.searchParams.get('user') || '').toLowerCase();
            const u = latest?.users.find((x) => x.key === key);
            if (!u)
                json(
                    res,
                    { at: latest?.at ?? null, timeline: [], timelineTotal: 0, openSessions: [] },
                    latest ? 404 : 503
                );
            else
                json(res, {
                    at: latest.at,
                    timeline: u.timeline,
                    timelineTotal: u.timelineTotal,
                    openSessions: u.openSessions,
                });
        } else if (path === '/events') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
                ...SECURITY_HEADERS,
            });
            res.write('retry: 3000\n\n');
            clients.add(res);
            req.on('close', () => clients.delete(res));
        } else {
            res.writeHead(404, SECURITY_HEADERS).end();
        }
    }

    /**
     * Ends a proxy session, when the monitor was started with --allow-session-delete. There is no
     * sign-in: anyone who can open the page can do this, which is why the flag refuses a page bound to
     * anything but this computer. What this does check is that the request comes from the page
     * itself, opened on this computer: a loopback Host header, a custom header (which a form or another site's script can't send without a
     * CORS preflight this server never approves) and, when the browser sends one, a matching Origin.
     */
    function endSession(req, res, url) {
        if (!actions.endSession)
            return json(res, { ok: false, message: 'Ending sessions is off.' }, 403);
        const origin = req.headers.origin;
        // The Host header must name this computer: a page on another domain that has rebound its
        // name to 127.0.0.1 (DNS rebinding) would otherwise pass as same-origin.
        const hostName = String(req.headers.host || '')
            .replace(/:\d+$/, '')
            .replace(/^\[|\]$/g, '');
        if (
            !['localhost', '127.0.0.1', '::1'].includes(hostName) ||
            req.headers['x-session-monitor'] !== 'end-session' ||
            (origin && origin !== `http://${req.headers.host}`)
        )
            return json(res, { ok: false, message: 'Refused: not sent by this page.' }, 403);
        const id = String(url.searchParams.get('id') || '');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
            return json(res, { ok: false, message: 'Not a session id.' }, 400);
        actions.endSession(id).then(
            (r) => json(res, r, r.ok ? 200 : 409),
            (err) => json(res, { ok: false, message: err.message }, 502)
        );
    }

    // The page's address. 127.0.0.1 stays as it is: localhost may resolve to ::1 first, where
    // nothing listens. Only an all-interfaces bind is shown as localhost.
    // IPv6 literals go in brackets in a URL; listen() still gets the bare address.
    const shown = ['0.0.0.0', '::'].includes(cfg.host)
        ? 'localhost'
        : String(cfg.host).includes(':')
          ? `[${cfg.host}]`
          : cfg.host;
    const url = `http://${shown}:${cfg.port}/`;
    let listening = false;
    // Rejects when the page can't start (a port in use, say), so the caller can report it as a
    // startup failure rather than this exiting on its own.
    const ready = new Promise((resolve, reject) => {
        server.on('error', (err) => {
            const msg =
                err.code === 'EADDRINUSE'
                    ? `Port ${cfg.port} is already in use, probably by another copy of the monitor. Stop that one, or start this one on another port with --port (or outputs.web.port in config.yaml).`
                    : `The web page can't start: ${err.message}`;
            if (!listening) return reject(new Error(msg));
            console.error(`\n${msg}\n`);
            process.exit(1);
        });
        server.listen(cfg.port, cfg.host, () => {
            listening = true;
            console.log(`\n    Open ${url} in your browser.\n`);
            resolve();
        });
    });
    return {
        name: 'web',
        url,
        ready,
        handle(result) {
            for (const e of result.events) (IMPORTANT.has(e.type) ? important : activity).push(e);
            important.splice(0, Math.max(0, important.length - 200));
            activity.splice(0, Math.max(0, activity.length - 300));
            latest = result;
            handledAt = Date.now();
            slim = {
                ...result,
                users: result.users.map(({ timeline, openSessions, ...u }) => u),
                site: cfg.title || site,
                pollSeconds,
                canEndSessions: Boolean(actions.endSession),
            };
            // Each message carries the new state and only this poll's events.
            const msg = `data: ${JSON.stringify({ ...slim, now: result.at })}\n\n`;
            for (const c of clients) {
                // A client that stops reading (a stalled browser or proxy) would otherwise buffer
                // every update in this process. Past a few updates' worth, drop it: the browser
                // reconnects and reloads the current state.
                if (c.writableLength > Math.max(4 * msg.length, 2 * 1024 * 1024)) {
                    clients.delete(c);
                    c.destroy();
                } else c.write(msg);
            }
        },
        close() {
            for (const c of clients) c.destroy();
            clients.clear();
            // server.close() alone waits for every open browser connection (live updates and
            // keep-alive), which an open page never ends: close them all.
            const done = new Promise((resolve) => server.close(resolve));
            server.closeAllConnections();
            return done;
        },
    };
}
