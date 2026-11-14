// A user's state from both sides: proxy sessions on every virtual proxy, and licence usage records.
import { qrs, qps } from './sense.mjs';

export async function userState(userDirectory, userId) {
    const vps = (await qrs('GET', '/virtualproxyconfig/full')).body || [];
    const sessions = [];
    for (const v of vps) {
        const prefix = v.prefix ? `/${v.prefix}` : '';
        const r = await qps('GET', `${prefix}/user/${userDirectory}/${userId}`);
        for (const s of Array.isArray(r.body) ? r.body : [])
            sessions.push({ vp: v.prefix || '/', sid: s.SessionId });
    }
    const filter = `user.userDirectory eq '${userDirectory}' and user.userId eq '${userId}'`;
    const records = [];
    for (const [type, usage, ref] of [
        ['professionalaccesstype', 'professionalaccessusage', 'professionalAccessType'],
        ['analyzeraccesstype', 'analyzeraccessusage', 'analyzerAccessType'],
    ]) {
        const at = ((await qrs('GET', `/license/${type}/full?filter=${filter}`)).body || [])[0];
        if (!at) continue;
        for (const u of (await qrs('GET', `/license/${usage}/full?filter=${ref}.id eq ${at.id}`))
            .body || [])
            records.push({ sid: u.sessionID, created: u.createdDate, latest: u.latestActivity });
    }
    const now = Date.now();
    return {
        sessions,
        records,
        /** Records younger than `windowMs`: the slots in use. */
        slots: (windowMs = 360000) =>
            records.filter((r) => now - Date.parse(r.latest) < windowMs).length,
        record: (sid) => records.find((r) => r.sid === sid),
        byVp: sessions.reduce((m, s) => ((m[s.vp] = (m[s.vp] || 0) + 1), m), {}),
    };
}
