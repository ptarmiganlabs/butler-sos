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
