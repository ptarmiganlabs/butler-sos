// Is a session that is already in ever refused? Session A opens the first app and goes idle until its
// record runs out (about 6.5 minutes). Then five new sessions fill the user's slots, and A opens the
// app again. Expected (Sense May 2026): A is let in, and its record is renewed, making six. About 8 min.
//   node lab/existing-session.mjs <testuser>
import { cfg, assertTestUser, ts, short, pause } from './lib/config.mjs';
import { launch, sessionId } from './lib/chrome.mjs';
import { openHeaderSession } from './lib/proxy.mjs';
import { userState } from './lib/state.mjs';

const user = assertTestUser(process.argv[2]);
const dir = cfg.headerProxy.userDirectory;
const appUrl = `https://${cfg.sense.entryHost}/${cfg.headerProxy.prefix}/sense/app/${cfg.apps.first}`;
const loaded = `/too many sessions|An error occurred|Access is denied/i.test(document.body.innerText) || !!document.querySelector('.qv-object, .sheet-list, [data-testid="sheet-list"], .qv-panel-sheet')`;
const b = await launch({ user });
try {
    await b.page.send('Page.navigate', { url: appUrl });
    await b.page.until(loaded, 45000).catch(() => {});
    await pause(4000);
    const sid = await sessionId(b.page);
    const rec = (await userState(dir, user)).record(sid);
    if (!rec) throw new Error('session A got no licence record');
    console.log(
        ts(),
        `session A ${short(sid)} in, record ${rec.latest}. Waiting for it to run out…`
    );
    await b.page.send('Page.navigate', { url: 'about:blank' }); // idle: no app open
    while (Date.now() - Date.parse(rec.latest) < 390000) await pause(10000);

    for (let i = 0; (await userState(dir, user)).slots() < 5 && i < 7; i++) {
        const o = await openHeaderSession(user);
        await pause(1200);
        console.log(
            ts(),
            `new session ${short(o.sid)} licensed=${!!(await userState(dir, user)).record(o.sid)}`
        );
    }
    console.log(
        ts(),
        `slots in use: ${(await userState(dir, user)).slots()} (window full). Session A opens the app again…`
    );
    await b.page.send('Page.navigate', { url: appUrl });
    await b.page.until(loaded, 45000).catch(() => {});
    await pause(4000);
    const text = await b.page.evaluate(
        `document.body.innerText.replace(/\\s+/g, ' ').slice(0, 120)`
    );
    const st = await userState(dir, user);
    const again = st.record(sid);
    console.log(
        ts(),
        `A: ${/too many sessions/i.test(text) ? 'REFUSED' : 'let in'}; record ${rec.latest} -> ${again?.latest ?? '(none)'}; slots in use now ${st.slots()}`
    );
} finally {
    await b.close();
}
