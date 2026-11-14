// Watches the whole site, read-only: every proxy session and licence usage record that appears,
// changes or disappears, every 15 s. Shows sweeps (many records removed at once) and renewals.
//   node lab/watch.mjs [minutes]          (default 60)
import { qrs, qps } from './lib/sense.mjs';
import { ts, short, pause } from './lib/config.mjs';

const until = Date.now() + Number(process.argv[2] || 60) * 60000;
let prevSessions = null;
let prevRecords = null;

async function read() {
    const sessions = new Map();
    for (const v of (await qrs('GET', '/virtualproxyconfig/full')).body || []) {
        const r = await qps('GET', `${v.prefix ? `/${v.prefix}` : ''}/session`);
        for (const s of Array.isArray(r.body) ? r.body : [])
            sessions.set(s.SessionId, {
                vp: v.prefix || '/',
                user: `${s.UserDirectory}\\${s.UserId}`,
            });
    }
    const owner = new Map();
    for (const t of ['professionalaccesstype', 'analyzeraccesstype'])
        for (const a of (await qrs('GET', `/license/${t}/full`)).body || [])
            owner.set(a.id, `${a.user?.userDirectory}\\${a.user?.userId}`);
    const records = new Map();
    for (const [u, ref] of [
        ['professionalaccessusage', 'professionalAccessType'],
        ['analyzeraccessusage', 'analyzerAccessType'],
    ])
        for (const x of (await qrs('GET', `/license/${u}/full`)).body || [])
            records.set(x.sessionID, {
                user: owner.get(x[ref]?.id) || '?',
                created: x.createdDate,
                latest: x.latestActivity,
            });
    return { sessions, records };
}

while (Date.now() < until) {
    try {
        const { sessions, records } = await read();
        if (!prevSessions)
            console.log(
                ts(),
                `start: ${sessions.size} proxy sessions, ${records.size} licence records`
            );
        else {
            for (const [sid, s] of sessions)
                if (!prevSessions.has(sid))
                    console.log(
                        ts(),
                        `session +  ${short(sid)} ${s.user} on ${s.vp}${records.has(sid) ? '' : ' (no licence record yet)'}`
                    );
            for (const [sid, s] of prevSessions)
                if (!sessions.has(sid))
                    console.log(ts(), `session -  ${short(sid)} ${s.user} on ${s.vp}`);
            for (const [sid, r] of records) {
                const p = prevRecords.get(sid);
                if (!p)
                    console.log(ts(), `record  +  ${short(sid)} ${r.user} created ${r.created}`);
                else if (p.latest !== r.latest)
                    console.log(
                        ts(),
                        `record  ~  ${short(sid)} ${r.user} renewed ${p.latest} -> ${r.latest} (after ${Math.round((Date.parse(r.latest) - Date.parse(p.latest)) / 1000)} s)`
                    );
            }
            const gone = [...prevRecords.keys()].filter((sid) => !records.has(sid));
            if (gone.length > 1)
                console.log(ts(), `SWEEP: ${gone.length} licence records removed at once`);
            else
                for (const sid of gone)
                    console.log(ts(), `record  -  ${short(sid)} ${prevRecords.get(sid).user}`);
        }
        prevSessions = sessions;
        prevRecords = records;
    } catch (e) {
        console.log(ts(), 'error:', e.message);
    }
    await pause(15000);
}
