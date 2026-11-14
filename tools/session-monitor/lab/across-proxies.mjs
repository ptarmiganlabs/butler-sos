// Is the limit counted per user across virtual proxies? Four sessions on the header proxy and one
// on the ticket proxy, then a sixth on each. Expected: the sixth is refused on both. Under a minute.
//   node lab/across-proxies.mjs <testuser>
import { cfg, assertTestUser, ts, short, pause } from './lib/config.mjs';
import { openHeaderSession, openTicketSession } from './lib/proxy.mjs';
import { userState } from './lib/state.mjs';

const user = assertTestUser(process.argv[2]);
const dir = cfg.headerProxy.userDirectory;
const show = async (label, o) => {
    await pause(1200);
    const st = await userState(dir, user);
    console.log(
        ts(),
        label.padEnd(24),
        `${o.vp} ${short(o.sid)} licensed=${!!st.record(o.sid)} | sessions ${JSON.stringify(st.byVp)}, slots ${st.slots()}`
    );
};
for (let i = 1; i <= 4; i++) await show(`header #${i}`, await openHeaderSession(user));
await show('ticket #5', await openTicketSession(user));
await show('header #6', await openHeaderSession(user));
await show('ticket #7', await openTicketSession(user));
