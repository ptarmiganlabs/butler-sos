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
 * @returns {{name: string, handle: Function, close: Function}} Output.
 */
export function webOutput(cfg, site, pollSeconds) {
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
        if (req.method !== 'GET') {
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
                    { at: latest?.at ?? null, timeline: [], timelineTotal: 0 },
                    latest ? 404 : 503
                );
            else json(res, { at: latest.at, timeline: u.timeline, timelineTotal: u.timelineTotal });
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

    // The page's address. 127.0.0.1 stays as it is: localhost may resolve to ::1 first, where
    // nothing listens. Only an all-interfaces bind is shown as localhost.
    const shown = ['0.0.0.0', '::'].includes(cfg.host) ? 'localhost' : cfg.host;
    const url = `http://${shown}:${cfg.port}/`;
    let listening = false;
    // Rejects when the page can't start (a port in use, say), so the caller can report it as a
    // startup failure rather than this exiting on its own.
    const ready = new Promise((resolve, reject) => {
        server.on('error', (err) => {
            const msg =
                err.code === 'EADDRINUSE'
                    ? `Port ${cfg.port} is already in use, probably by another copy of the monitor. Stop that one, or set outputs.web.port to another port.`
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
                users: result.users.map(({ timeline, ...u }) => u),
                site: cfg.title || site,
                pollSeconds,
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
