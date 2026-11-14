// Headless Chrome for experiments that need a real browser, driven over the Chrome DevTools
// Protocol with Node's built-in WebSocket. Each launch gets a fresh, temporary profile.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cfg, assertTestUser, pause } from './config.mjs';

async function connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(new Error('DevTools connection failed')), {
            once: true,
        });
    });
    let id = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.addEventListener('message', (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
        } else if (msg.method) for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    });
    const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
            const i = ++id;
            pending.set(i, { resolve, reject });
            ws.send(JSON.stringify({ id: i, method, params }));
        });
    const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });
        if (r.exceptionDetails)
            throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
    };
    const until = async (expression, timeoutMs = 30000) => {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            if (await evaluate(`!!(${expression})`).catch(() => false)) return;
            if (Date.now() > deadline) throw new Error(`timed out waiting for: ${expression}`);
            await pause(250);
        }
    };
    const on = (method, fn) => listeners.set(method, [...(listeners.get(method) || []), fn]);
    return { send, evaluate, until, on, close: () => ws.close() };
}

/**
 * Starts headless Chrome as a test user on the header proxy (the header is added to every request).
 *
 * @param {object} o Options.
 * @param {string} o.user The test user.
 * @returns {Promise<{page: object, close: Function}>} The page and a function that stops Chrome.
 */
export async function launch({ user }) {
    assertTestUser(user);
    const port = 9300 + Math.floor(Math.random() * 500);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'session-monitor-lab-'));
    const proc = spawn(
        cfg.chrome,
        [
            '--headless=new',
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${profile}`,
            '--no-first-run',
            '--no-default-browser-check',
            'about:blank',
        ],
        { stdio: 'ignore' }
    );
    let target;
    for (let i = 0; i < 60 && !target; i++) {
        await pause(250);
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            target = list.find((t) => t.type === 'page');
        } catch {
            /* Chrome still starting */
        }
    }
    if (!target) throw new Error(`Chrome didn't start (${cfg.chrome})`);
    const page = await connect(target.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Network.enable');
    await page.send('Network.setExtraHTTPHeaders', { headers: { [cfg.headerProxy.header]: user } });
    const close = async () => {
        page.close();
        proc.kill('SIGTERM');
        await pause(500);
        fs.rmSync(profile, { recursive: true, force: true });
    };
    return { page, close };
}

/** Reads the proxy session id from the browser's session cookie for the header proxy. */
export async function sessionId(page) {
    const { cookies } = await page.send('Network.getCookies', {
        urls: [`https://${cfg.sense.entryHost}/${cfg.headerProxy.prefix}/`],
    });
    const c = cookies.find((x) => x.name.startsWith('X-Qlik-Session'));
    return c?.value.includes(':') ? c.value.slice(c.value.lastIndexOf(':') + 1) : c?.value;
}
