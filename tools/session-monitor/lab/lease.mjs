// Does working inside an open app renew the session's licence record, and when? Opens the first app
// in headless Chrome as a test user, then makes and clears selections every 45 s over the app's own
// engine connection (the requests the UI sends when a user clicks), and reports the record.
// Expected (Sense May 2026): no change for six minutes, then a renewal at the first action after.
//   node lab/lease.mjs <testuser> [minutes]          (default 9)
import { cfg, assertTestUser, ts, short, pause } from './lib/config.mjs';
import { launch, sessionId } from './lib/chrome.mjs';
import { userState } from './lib/state.mjs';
import { licenceLogFollower } from './lib/licence-log.mjs';

const user = assertTestUser(process.argv[2]);
const minutes = Number(process.argv[3] || 9);
const dir = cfg.headerProxy.userDirectory;
const log = licenceLogFollower(user);
const b = await launch({ user });
try {
    // Keep a handle on the page's WebSockets, to talk to the engine on the app's own connection.
    await b.page.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `(() => { const W = window.WebSocket; window.__ws = [];
          window.WebSocket = function (...a) { const s = new W(...a); window.__ws.push(s); return s; };
          window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, W); })();`,
    });
    await b.page.send('Page.navigate', {
        url: `https://${cfg.sense.entryHost}/${cfg.headerProxy.prefix}/sense/app/${cfg.apps.first}`,
    });
    await b.page.until(
        `(window.__ws || []).some((s) => /\\/app\\//.test(s.url) && s.readyState === 1)`,
        45000
    );
    await pause(6000);
    const sid = await sessionId(b.page);
    const first = (await userState(dir, user)).record(sid);
    if (!first)
        throw new Error('the session got no licence record: refused, or the app did not load');
    console.log(
        ts(),
        `app open: session ${short(sid)}, record created ${first.created}, latest activity ${first.latest}`
    );

    await b.page.evaluate(`(() => {
        const s = window.__ws.find((x) => /\\/app\\//.test(x.url) && x.readyState === 1);
        let id = 900000; const pending = new Map();
        s.addEventListener('message', (m) => { try { const j = JSON.parse(m.data); if (pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); } } catch {} });
        window.__rpc = (handle, method, params = []) => new Promise((res) => { const i = ++id; pending.set(i, res);
            s.send(JSON.stringify({ jsonrpc: '2.0', id: i, handle, method, params })); setTimeout(() => res({ timeout: true }), 10000); });
    })()`);
    await b.page.evaluate(`(async () => {
        const d = await window.__rpc(-1, 'GetActiveDoc'); window.__h = d.result.qReturn.qHandle;
        const fl = await window.__rpc(window.__h, 'CreateSessionObject', [{ qInfo: { qType: 'FieldList' }, qFieldListDef: {} }]);
        const lay = await window.__rpc(fl.result.qReturn.qHandle, 'GetLayout');
        const name = lay.result.qLayout.qFieldList.qItems.find((f) => !f.qIsSystem).qName;
        window.__fh = (await window.__rpc(window.__h, 'GetField', [name])).result.qReturn.qHandle;
    })()`);

    const t0 = Date.parse(first.latest);
    let latest = first.latest;
    for (let n = 0; Date.now() - t0 < minutes * 60000; n++) {
        await pause(45000);
        const ok = await b.page.evaluate(`(async () => {
            const a = await window.__rpc(window.__fh, ${n % 2 ? "'Clear'" : "'SelectPossible'"});
            return !!(await window.__rpc(window.__h, 'GetAppLayout')).result && !!a.result;
        })()`);
        const r = (await userState(dir, user)).record(sid);
        const moved = r && r.latest !== latest;
        console.log(
            ts(),
            `+${Math.round((Date.now() - t0) / 1000)}s ${n % 2 ? 'clear' : 'select'} ok=${ok} | latest activity ${r?.latest ?? '(record gone)'}${moved ? `  <-- RENEWED after ${Math.round((Date.parse(r.latest) - Date.parse(latest)) / 1000)} s` : ''}`
        );
        if (moved) latest = r.latest;
        for (const l of log()) console.log(ts(), `licence log: ${l}`);
    }
} finally {
    await b.close();
}
