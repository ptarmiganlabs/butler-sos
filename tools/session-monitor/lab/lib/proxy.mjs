// Opens sessions for test users through the public entry point, the way a browser would, but
// without one: header authentication, or a proxy ticket. Cookies stay in memory and are never printed.
import https from 'node:https';
import { cfg, assertTestUser, pause } from './config.mjs';
import { qps } from './sense.mjs';

export function http(method, path, { headers = {}, cookie } = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                host: cfg.sense.entryHost,
                port: 443,
                method,
                path,
                timeout: 20000,
                headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
            },
            (res) => {
                let body = '';
                res.on('data', (c) => (body += c));
                res.on('error', reject);
                res.on('end', () =>
                    resolve({ status: res.statusCode, headers: res.headers, body })
                );
            }
        );
        req.on('timeout', () => req.destroy(new Error(`${method} ${path} timed out`)));
        req.on('error', reject);
        req.end();
    });
}

export function mergeCookies(existing, setCookie = []) {
    const jar = new Map(
        (existing || '')
            .split('; ')
            .filter(Boolean)
            .map((p) => [p.split('=')[0], p])
    );
    for (const sc of setCookie) {
        const pair = sc.split(';')[0];
        jar.set(pair.split('=')[0], pair);
    }
    return [...jar.values()].join('; ');
}

/** The session cookie's value is "{GUID}:{proxy session id}" (Sense May 2026); returns the session id. */
export function sessionIdFromCookie(cookie) {
    const v = (cookie || '')
        .split('; ')
        .map((p) => p.split('='))
        .find(([n]) => n.startsWith('X-Qlik-Session'))?.[1];
    return v && v.includes(':') ? v.slice(v.lastIndexOf(':') + 1) : v;
}

export const headerFor = (user) => ({ [cfg.headerProxy.header]: assertTestUser(user) });

/** A new session on the header proxy: load the hub with the header and no cookie. */
export async function openHeaderSession(user) {
    const r = await http('GET', `/${cfg.headerProxy.prefix}/hub/`, { headers: headerFor(user) });
    const cookie = mergeCookies('', r.headers['set-cookie']);
    return {
        vp: cfg.headerProxy.prefix,
        status: r.status,
        cookie,
        sid: sessionIdFromCookie(cookie),
    };
}

/** A proxy ticket for a test user on the ticket proxy (valid for one minute, single use). */
export async function ticketFor(user) {
    assertTestUser(user);
    const t = await qps('POST', `/${cfg.ticketProxy.prefix}/ticket`, {
        body: { UserDirectory: cfg.headerProxy.userDirectory, UserId: user, Attributes: [] },
    });
    if (!t.body?.Ticket)
        throw new Error(`no ticket: ${t.status} ${JSON.stringify(t.body).slice(0, 120)}`);
    return t.body.Ticket;
}

/** A new session on the ticket proxy: redeem a ticket at the hub, like a browser. */
export async function openTicketSession(user) {
    const vp = cfg.ticketProxy.prefix;
    let r = await http(
        'GET',
        `/${vp}/hub/?qlikTicket=${encodeURIComponent(await ticketFor(user))}`
    );
    let cookie = mergeCookies('', r.headers['set-cookie']);
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
        const loc = new URL(r.headers.location, `https://${cfg.sense.entryHost}`);
        r = await http('GET', loc.pathname + loc.search.replace(/qlikTicket=[^&]*&?/, ''), {
            cookie,
        });
        cookie = mergeCookies(cookie, r.headers['set-cookie']);
    }
    return { vp, status: r.status, cookie, sid: sessionIdFromCookie(cookie) };
}

/** Signs a session out through the proxy (its logout address), with the auth header. */
export async function proxySignOut(user, cookie) {
    const r = await http('DELETE', `/${cfg.headerProxy.prefix}/qps/user`, {
        headers: headerFor(user),
        cookie,
    });
    return r.status;
}

/** Ends a proxy session through the Proxy API. */
export async function deleteSession(vp, sid) {
    return (await qps('DELETE', `/${vp}/session/${sid}`)).status;
}

export { pause };
