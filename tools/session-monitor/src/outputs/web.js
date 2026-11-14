import fs from 'node:fs';
import http from 'node:http';

// The page's files. Only these paths are served; they are small, so they are read on each request.
const dir = new URL('../web/', import.meta.url);
const FILES = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
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
            }).end(fs.readFileSync(new URL(file, dir)));
        } else if (path === '/api/state') {
            // The current state plus the recent events, for a page that has just (re)connected.
            if (!slim) res.writeHead(503, SECURITY_HEADERS).end();
            else json(res, { ...slim, recentEvents: [...important, ...activity] });
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

    server.on('error', (err) => {
        console.error(
            err.code === 'EADDRINUSE'
                ? `\nPort ${cfg.port} is already in use, probably by another copy of the monitor. Stop that one, or set outputs.web.port to another port.\n`
                : `\nThe web page can't start: ${err.message}\n`
        );
        process.exit(1);
    });
    server.listen(cfg.port, cfg.host, () => {
        const shown = cfg.host === '0.0.0.0' ? 'localhost' : cfg.host;
        console.log(`\n    Open http://${shown}:${cfg.port}/ in your browser.\n`);
    });
    return {
        name: 'web',
        handle(result) {
            for (const e of result.events) (IMPORTANT.has(e.type) ? important : activity).push(e);
            important.splice(0, Math.max(0, important.length - 200));
            activity.splice(0, Math.max(0, activity.length - 300));
            latest = result;
            slim = {
                ...result,
                users: result.users.map(({ timeline, ...u }) => u),
                site: cfg.title || site,
                pollSeconds,
            };
            // Each message carries the new state and only this poll's events.
            const msg = `data: ${JSON.stringify(slim)}\n\n`;
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
            for (const c of clients) c.end();
            return new Promise((resolve) => server.close(resolve));
        },
    };
}
