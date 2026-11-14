// How long until a user at the limit gets a slot back? Opens five sessions for a test user, then
// tries a new one every 10 s and reports when it is let in, counted from the oldest record.
//   node lab/window.mjs <testuser> [wait|delete|signout]
//   wait:    touch nothing.
//   delete:  end the oldest session through the Proxy API first.
//   signout: sign the oldest session out through the proxy first.
// Refused attempts are ended at once through the Proxy API, so they don't pile up. About 7 minutes.
import { cfg, assertTestUser, ts, short, pause } from './lib/config.mjs';
import { openHeaderSession, proxySignOut, deleteSession } from './lib/proxy.mjs';
import { userState } from './lib/state.mjs';

const user = assertTestUser(process.argv[2]);
const mode = process.argv[3] || 'wait';
const dir = cfg.headerProxy.userDirectory;
const vp = cfg.headerProxy.prefix;
const t0 = Date.now();
const rel = () => `+${Math.round((Date.now() - t0) / 1000)}s`;

const startSlots = (await userState(dir, user)).slots();
if (startSlots > 0)
    console.log(
        ts(),
        `note: ${user} already has ${startSlots} slot(s) in use; results are clearest from 0 (wait 6 minutes).`
    );

const opened = [];
for (let i = 1; opened.length < 5 && i <= 8; i++) {
    const o = await openHeaderSession(user);
    await pause(1200);
    const ok = !!(await userState(dir, user)).record(o.sid);
    console.log(ts(), rel(), `open #${i} ${short(o.sid)} licensed=${ok}`);
    if (ok) opened.push(o);
}
let st = await userState(dir, user);
const oldest = Math.min(...opened.map((o) => Date.parse(st.record(o.sid).latest)));

if (mode === 'delete')
    console.log(
        ts(),
        rel(),
        `Proxy API DELETE of the oldest: ${await deleteSession(vp, opened[0].sid)}`
    );
if (mode === 'signout')
    console.log(
        ts(),
        rel(),
        `proxy sign-out of the oldest: ${await proxySignOut(user, opened[0].cookie)}`
    );

for (let attempt = 1; attempt <= 60; attempt++) {
    const o = await openHeaderSession(user);
    await pause(1200);
    st = await userState(dir, user);
    const age = Math.round((Date.now() - oldest) / 1000);
    if (st.record(o.sid)) {
        console.log(ts(), rel(), `attempt ${attempt}: LET IN, ${age} s after the oldest record`);
        break;
    }
    await deleteSession(vp, o.sid);
    console.log(ts(), rel(), `attempt ${attempt}: refused, ${age} s after the oldest record`);
    await pause(8000);
}
