// Watches one test user every 5 s, read-only: new licence records, renewals (with the time since the
// previous one), proxy sessions per virtual proxy, and the user's lines in the licence log.
//   node lab/watch-user.mjs <testuser> [minutes]          (default 45)
import { cfg, assertTestUser, ts, short, pause } from './lib/config.mjs';
import { userState } from './lib/state.mjs';
import { licenceLogFollower } from './lib/licence-log.mjs';

const user = assertTestUser(process.argv[2]);
const until = Date.now() + Number(process.argv[3] || 45) * 60000;
const log = licenceLogFollower(user);
const prev = new Map();
let lastSessions = '';
let t0 = null;
const el = () => (t0 ? `+${Math.round((Date.now() - t0) / 1000)}s` : '');
console.log(ts(), `watching ${cfg.headerProxy.userDirectory}\\${user}`);
while (Date.now() < until) {
    try {
        const st = await userState(cfg.headerProxy.userDirectory, user);
        for (const r of st.records) {
            const p = prev.get(r.sid);
            if (!p) {
                t0 ??= Date.parse(r.created);
                console.log(ts(), el(), `NEW RECORD ${short(r.sid)} created ${r.created}`);
            } else if (p !== r.latest)
                console.log(
                    ts(),
                    el(),
                    `RENEWED ${short(r.sid)} ${p} -> ${r.latest} (after ${Math.round((Date.parse(r.latest) - Date.parse(p)) / 1000)} s)`
                );
            prev.set(r.sid, r.latest);
        }
        const s = JSON.stringify(st.byVp);
        if (s !== lastSessions) console.log(ts(), el(), `proxy sessions: ${s}`);
        lastSessions = s;
        for (const l of log()) console.log(ts(), el(), `licence log: ${l}`);
    } catch (e) {
        console.log(ts(), 'error:', e.message);
    }
    await pause(5000);
}
