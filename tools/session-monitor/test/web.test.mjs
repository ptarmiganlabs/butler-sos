import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webOutput } from '../src/outputs/web.js';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

/** Starts the page on a free port with the given actions; returns its address and a closer. */
async function page(actions) {
    const port = 39000 + Math.floor(Math.random() * 900);
    const out = webOutput(
        { host: '127.0.0.1', port, timelineMinutes: 30, title: '' },
        'x',
        15,
        actions
    );
    await out.ready;
    return { base: `http://127.0.0.1:${port}`, close: () => out.close() };
}

const post = (base, headers = {}, id = ID) =>
    fetch(`${base}/api/end-session?id=${id}`, { method: 'POST', headers });

test('ending sessions is refused when the flag is off', async () => {
    const p = await page({});
    try {
        const r = await post(p.base, { 'X-Session-Monitor': 'end-session' });
        assert.equal(r.status, 403);
    } finally {
        await p.close();
    }
});

test('ending sessions: only from the page itself, only for a session id', async () => {
    const ended = [];
    const p = await page({
        endSession: async (id) => (ended.push(id), { ok: true, message: 'ok' }),
    });
    try {
        assert.equal((await post(p.base)).status, 403, 'no custom header: a form or another site');
        assert.equal(
            (
                await post(p.base, {
                    'X-Session-Monitor': 'end-session',
                    Origin: 'http://evil.example',
                })
            ).status,
            403,
            'another origin'
        );
        assert.equal(
            (await post(p.base, { 'X-Session-Monitor': 'end-session' }, '..%2Fx')).status,
            400,
            'not a session id'
        );
        assert.deepEqual(ended, []);
        const r = await post(p.base, { 'X-Session-Monitor': 'end-session' });
        assert.equal(r.status, 200);
        assert.deepEqual(ended, [ID]);
    } finally {
        await p.close();
    }
});

test('the diagram gets its own narrow policy; every other page file keeps the page policy', async () => {
    const p = await page({});
    try {
        const svg = await fetch(`${p.base}/how-it-works.svg`);
        assert.equal(svg.status, 200);
        assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
        assert.equal(
            svg.headers.get('content-security-policy'),
            "default-src 'none'; style-src 'unsafe-inline'"
        );
        assert.equal(svg.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(svg.headers.get('referrer-policy'), 'no-referrer');
        for (const path of ['/', '/app.js', '/style.css']) {
            const r = await fetch(`${p.base}${path}`);
            assert.equal(r.status, 200, path);
            const csp = r.headers.get('content-security-policy');
            assert.match(csp, /default-src 'self'/, path);
            assert.match(csp, /script-src 'self'/, path);
            assert.doesNotMatch(csp, /unsafe-inline/, path);
            assert.equal(r.headers.get('x-content-type-options'), 'nosniff', path);
            assert.equal(r.headers.get('referrer-policy'), 'no-referrer', path);
        }
    } finally {
        await p.close();
    }
});
