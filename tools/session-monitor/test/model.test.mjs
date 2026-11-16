import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tracker } from '../src/model.js';

const LIMIT = {
    sessions: 5,
    windowSeconds: 360,
    warnAt: 4,
    criticalAt: 5,
    refusalGraceSeconds: 20,
    excludeUsers: ['internal\\sa_api'],
};
const T0 = Date.parse('2026-11-14T08:45:00Z');
const s = (sec) => T0 + sec * 1000;
const isoAt = (sec) => new Date(s(sec)).toISOString();

const ALLOC = new Map([
    ['at-1', { key: 'corp\\test1', userDirectory: 'CORP', userId: 'test1', kind: 'professional' }],
    ['at-2', { key: 'corp\\test2', userDirectory: 'CORP', userId: 'test2', kind: 'professional' }],
]);
const sess = (sid, user = 'test1', vp = 'demoworld') => ({
    sessionId: sid,
    userDirectory: 'CORP',
    userId: user,
    proxyHost: 'node1',
    proxyNode: 'Central',
    virtualProxy: vp,
});
const rec = (sid, latestSec, at = 'at-1') => ({
    sessionId: sid,
    accessTypeId: at,
    kind: 'professional',
    createdDate: isoAt(latestSec),
    latestActivity: isoAt(latestSec),
});
const snap = (atSec, sessions, records, extra = {}) => ({
    at: s(atSec),
    sessions,
    records,
    allocations: ALLOC,
    qpsOk: true,
    licencesOk: true,
    errors: [],
    ...extra,
});
const types = (r) => r.events.map((e) => e.type);
const alert = (r) => r.events.find((e) => e.type === 'alert');

test('sessions present at start are never reported as refused', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('a')], []));
    const r = t.update(snap(60, [sess('a')], []));
    assert.deepEqual(types(r), []);
});

test('a new session of a licensed user that never gets a record is refused once, after the grace period', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    assert.deepEqual(types(t.update(snap(15, [sess('x')], []))), []); // inside grace
    assert.deepEqual(types(t.update(snap(30, [sess('x')], []))), []); // 15 s after first seen: still inside grace
    const r = t.update(snap(45, [sess('x')], []));
    assert.deepEqual(types(r), ['refused']);
    assert.equal(r.events[0].sessionId, 'x');
    assert.equal(r.users.find((u) => u.userId === 'test1').refusedTotal, 1);
    assert.deepEqual(types(t.update(snap(60, [sess('x')], []))), []); // not repeated
});

test('a new session that gets a record is not refused', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    t.update(snap(15, [sess('x')], [rec('x', 14)]));
    assert.deepEqual(types(t.update(snap(45, [sess('x')], [rec('x', 14)]))), []);
});

test('users without a licence allocation (service accounts) are never reported as refused', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    const svc = { ...sess('svc1'), userDirectory: 'DOMAIN', userId: 'svc-qliksense' };
    t.update(snap(15, [svc], []));
    assert.deepEqual(types(t.update(snap(60, [svc], []))), []);
});

test('no refusal is reported for a session that appeared around a record sweep', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('old')], [rec('old', -600)]));
    const sweep = t.update(snap(15, [sess('old'), sess('new')], [])); // record of 'old' vanished
    assert.deepEqual(types(sweep), ['sweep']);
    assert.deepEqual(types(t.update(snap(45, [sess('old'), sess('new')], []))), []);
});

test('nothing is decided while licence data could not be read', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    t.update(snap(15, [sess('x')], []));
    assert.deepEqual(types(t.update(snap(45, [sess('x')], [], { licencesOk: false }))), []);
});

test('alert levels follow slots used in the window: raise, escalate, then clear when records age out', () => {
    const t = new Tracker(LIMIT, 15);
    const four = ['a', 'b', 'c', 'd'].map((x, i) => rec(x, i * 30));
    let r = t.update(
        snap(
            100,
            four.map((x) => sess(x.sessionId)),
            four
        )
    );
    assert.deepEqual(types(r), ['alert']);
    assert.equal(alert(r).level, 'warn');
    assert.equal(alert(r).change, 'raised');

    const five = [...four, rec('e', 120)];
    r = t.update(
        snap(
            130,
            five.map((x) => sess(x.sessionId)),
            five
        )
    );
    assert.equal(alert(r).level, 'critical');
    assert.equal(alert(r).change, 'escalated');
    const u = r.users.find((x) => x.userId === 'test1');
    assert.equal(u.slotsUsed, 5);
    assert.equal(u.nextSlotFreeAt, isoAt(360)); // oldest record (t=0) + 360 s
    assert.equal(u.atLimitUntil, isoAt(360));

    r = t.update(
        snap(
            361,
            five.map((x) => sess(x.sessionId)),
            five
        )
    ); // 'a' (t=0) left the window
    assert.equal(alert(r).level, 'warn');
    assert.equal(alert(r).change, 'lowered');

    r = t.update(snap(500, [], five)); // all older than 360 s now
    assert.equal(alert(r).change, 'cleared');
    assert.equal(alert(r).level, 'ok');
});

test('slots are counted per user across virtual proxies; proxy sessions are counted separately', () => {
    const t = new Tracker(LIMIT, 15);
    const recs = [rec('a', 0), rec('b', 1)];
    const r = t.update(
        snap(
            5,
            [
                sess('a', 'test1', 'demoworld'),
                sess('b', 'test1', 'impersonate'),
                sess('c', 'test1', 'demoworld'),
            ],
            recs
        )
    );
    const u = r.users.find((x) => x.userId === 'test1');
    assert.equal(u.slotsUsed, 2);
    assert.equal(u.proxySessions, 3);
    assert.deepEqual({ ...u.byVirtualProxy }, { demoworld: 2, impersonate: 1 });
});

test('excluded users are not reported', () => {
    const t = new Tracker(LIMIT, 15);
    const r = t.update(
        snap(0, [{ ...sess('z'), userDirectory: 'INTERNAL', userId: 'sa_api' }], [])
    );
    assert.equal(r.users.length, 0);
});

test('a user who disappears is reported once more with zeros', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('a')], [rec('a', 0)]));
    let r = t.update(snap(15, [], []));
    const gone = r.users.find((u) => u.userId === 'test1');
    assert.equal(gone.gone, true);
    assert.equal(gone.slotsUsed, 0);
    r = t.update(snap(30, [], []));
    assert.equal(r.users.length, 0);
});

test('new sessions that get a licence are reported with the slot they took, in order', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('a')], [rec('a', 0)]));
    const r = t.update(
        snap(15, [sess('a'), sess('c'), sess('b')], [rec('a', 0), rec('c', 12), rec('b', 10)])
    );
    const lic = r.events.filter((e) => e.type === 'licensed');
    assert.deepEqual(
        lic.map((e) => [e.sessionId, e.slotsUsed]),
        [
            ['b', 2],
            ['c', 3],
        ]
    );
});

test('the timeline shows each session state', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('base')], [])); // open at start, never licensed
    t.update(snap(15, [sess('base'), sess('ok'), sess('wait'), sess('ref')], [rec('ok', 14)]));
    const r = t.update(
        snap(40, [sess('base'), sess('ok'), sess('wait'), sess('ref')], [rec('ok', 14)])
    );
    // 'wait' and 'ref' were first seen at 15; at 40 both are past the grace period, so both count as refused.
    const states = Object.fromEntries(r.users[0].timeline.map((e) => [e.sessionId, e.state]));
    assert.equal(states.base, 'unlicensed');
    assert.equal(states.ok, 'slot');
    assert.equal(states.ref, 'refused');
    const ok = r.users[0].timeline.find((e) => e.sessionId === 'ok');
    assert.equal(ok.slotUntil, isoAt(14 + 360));
});

test('a session inside the grace period is pending, and a swept record shows as swept', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('a')], [rec('a', 0)]));
    let r = t.update(snap(15, [sess('a'), sess('new')], [rec('a', 0)]));
    assert.equal(r.users[0].timeline.find((e) => e.sessionId === 'new').state, 'pending');
    r = t.update(snap(30, [sess('a'), sess('new')], [])); // sweep removed every record
    assert.equal(r.users[0].timeline.find((e) => e.sessionId === 'a').state, 'swept');
});

test('a record whose proxy session was never seen still counts and appears in the timeline', () => {
    const t = new Tracker(LIMIT, 15);
    const r = t.update(snap(30, [], [rec('gone', 20)]));
    const u = r.users.find((x) => x.userId === 'test1');
    assert.equal(u.slotsUsed, 1);
    assert.equal(u.timeline[0].sessionId, 'gone');
    assert.equal(u.timeline[0].state, 'slot');
    assert.equal(u.timeline[0].firstSeen, null);
});

test('ended sessions are reported and leave the timeline after the timeline period', () => {
    const t = new Tracker(LIMIT, 15, { timelineMinutes: 10 });
    t.update(snap(0, [], []));
    t.update(snap(15, [sess('x')], [rec('x', 14)]));
    const r = t.update(snap(30, [], [rec('x', 14)]));
    assert.deepEqual(
        types(r).filter((x) => x === 'session-ended'),
        ['session-ended']
    );
    assert.equal(r.users[0].timeline[0].endedAt, isoAt(30));
    const later = t.update(snap(14 + 360 + 601, [], []));
    assert.equal(later.users.filter((u) => !u.gone).length, 0); // only the one-off zero row is left
    assert.equal(t.sessions.size, 0);
});

test('entry points count sessions, users and refusals per virtual proxy and node', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    t.update(
        snap(
            15,
            [
                sess('a', 'test1', 'demoworld'),
                sess('b', 'test2', '/'),
                sess('c', 'test2', 'demoworld'),
            ],
            [rec('a', 14), rec('b', 14, 'at-2')]
        )
    );
    const r = t.update(
        snap(
            40,
            [
                sess('a', 'test1', 'demoworld'),
                sess('b', 'test2', '/'),
                sess('c', 'test2', 'demoworld'),
            ],
            [rec('a', 14), rec('b', 14, 'at-2')]
        )
    );
    assert.deepEqual(
        { ...r.breakdown.virtualProxies.demoworld },
        { sessions: 2, users: 2, refused: 1 }
    );
    assert.deepEqual({ ...r.breakdown.virtualProxies['/'] }, { sessions: 1, users: 1, refused: 0 });
    assert.deepEqual({ ...r.breakdown.nodes.Central }, { sessions: 3, users: 2, refused: 1 });
});

test('records that only age past the read window are not a sweep, and show as idle', () => {
    const t = new Tracker(LIMIT, 15);
    // Records are read from 'recordsSince' on; at 100 the record from 0 is still read, at 800 it isn't.
    t.update({ ...snap(100, [sess('a')], [rec('a', 0)]), recordsSince: s(-500) });
    const r = t.update({ ...snap(800, [sess('a')], []), recordsSince: s(200) });
    assert.deepEqual(
        types(r).filter((x) => x === 'sweep'),
        []
    );
    const e = r.users[0].timeline.find((x) => x.sessionId === 'a');
    assert.equal(e.state, 'idle');
    assert.equal(e.latestActivity, isoAt(0));
});

test('the simulated site reaches the limit and refuses sessions, and sign-ins report slots 1 to 5', async () => {
    const { SimulatedSite } = await import('../src/simulate.js');
    const site = new SimulatedSite(120, LIMIT, 7);
    const t = new Tracker(LIMIT, 15);
    let refused = 0;
    let maxSlotTaken = 0;
    for (let at = T0; at < T0 + 40 * 60000; at += 15000) {
        const r = t.update(site.step(at, 31 * 60000));
        refused += r.events.filter((e) => e.type === 'refused').length;
        for (const e of r.events)
            if (e.type === 'licensed') maxSlotTaken = Math.max(maxSlotTaken, e.slotsUsed);
    }
    assert.ok(refused > 0, 'some sessions are refused');
    assert.ok(maxSlotTaken === 5, `a new session took slot ${maxSlotTaken}`);
});

test('a failed licence read keeps the last good slot counts, marked stale, and decides nothing', () => {
    const t = new Tracker(LIMIT, 15);
    const five = ['a', 'b', 'c', 'd', 'e'].map((x, i) => rec(x, i));
    t.update(
        snap(
            10,
            five.map((x) => sess(x.sessionId)),
            five
        )
    );
    const r = t.update(
        snap(
            25,
            five.map((x) => sess(x.sessionId)),
            [],
            { licencesOk: false, errors: ['QRS licences: timeout'] }
        )
    );
    assert.equal(r.users.find((u) => u.userId === 'test1').slotsUsed, 5);
    assert.equal(r.summary.licencesStale, true);
    assert.deepEqual(types(r), []); // no "cleared" alert, no sweep
    const later = t.update(
        snap(
            400,
            five.map((x) => sess(x.sessionId)),
            [],
            { licencesOk: false }
        )
    );
    assert.equal(later.users.find((u) => u.userId === 'test1').slotsUsed, 0); // stale records still age out
});

test('a user whose only, refused session ended stays listed with that refusal', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    t.update(snap(15, [sess('x', 'test2')], []));
    t.update(snap(45, [sess('x', 'test2')], [])); // refused
    const r = t.update(snap(60, [], []));
    const u = r.users.find((x) => x.userId === 'test2');
    assert.ok(u && !u.gone);
    assert.equal(u.refusedTotal, 1);
    assert.equal(u.timeline[0].state, 'refused');
    assert.ok(u.lastRefusedAt);
});

test('the webhook output queues and returns at once, whatever the endpoint does', async () => {
    const { webhookOutput } = await import('../src/outputs/webhook.js');
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = () => {
        calls++;
        return new Promise(() => {}); // an endpoint that never answers
    };
    try {
        const out = webhookOutput({ url: 'http://example.invalid/hook' });
        const events = Array.from({ length: 20 }, (_, i) => ({
            type: 'refused',
            at: isoAt(i),
            userId: `u${i}`,
        }));
        const started = Date.now();
        out.handle({ at: isoAt(0), events });
        assert.ok(Date.now() - started < 50);
        assert.equal(calls, 1); // one request at a time
        assert.equal(out.pending, 19);
    } finally {
        globalThis.fetch = realFetch;
    }
});

test('sessions stay baseline until the proxies have been read once in full', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], [], { qpsOk: false, errors: ['QPS node1 /: timeout'] }));
    t.update(snap(15, [sess('old')], [])); // first complete read: already-open, idle session
    assert.deepEqual(types(t.update(snap(60, [sess('old')], []))), []);
});

test('a refused session that closed before the grace period ended is still counted', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    t.update(snap(15, [sess('x')], []));
    t.update(snap(30, [sess('x')], [])); // still no record, grace not yet over
    const r = t.update(snap(45, [], [])); // closed
    assert.deepEqual(
        types(r).filter((x) => x === 'refused'),
        ['refused']
    );
});

test('a session that may have lost its record to a sweep is never refused, even after a later sweep', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('a')], [rec('a', 0)]));
    t.update(snap(15, [sess('a'), sess('new')], [])); // sweep: 'a' record vanished; 'new' appears now
    t.update(snap(30, [sess('a'), sess('new'), sess('b')], [rec('b', 29)]));
    t.update(snap(3600, [sess('a'), sess('new'), sess('b')], [])); // next sweep, an hour later
    const r = t.update(snap(3640, [sess('a'), sess('new'), sess('b')], []));
    assert.deepEqual(
        types(r).filter((x) => x === 'refused'),
        []
    );
});

test('virtual proxy and node names that match Object properties work', () => {
    const t = new Tracker(LIMIT, 15);
    const odd = (sid, vp) => ({ ...sess(sid, 'test1', vp), proxyNode: 'constructor' });
    const r = t.update(
        snap(0, [odd('a', 'constructor'), odd('b', '__proto__'), odd('c', 'toString')], [])
    );
    assert.equal(r.breakdown.virtualProxies.constructor.sessions, 1);
    assert.equal(r.breakdown.nodes.constructor.sessions, 3);
    assert.equal(r.users[0].byVirtualProxy.toString, 1);
    assert.equal(JSON.parse(JSON.stringify(r.breakdown)).virtualProxies.__proto__.sessions, 1);
});

test('the simulated site renews a slot only after its window has run out', async () => {
    const { SimulatedSite } = await import('../src/simulate.js');
    const site = new SimulatedSite(60, LIMIT, 3);
    for (let at = T0; at < T0 + 30 * 60000; at += 15000) {
        const before = new Map([...site.records].map(([sid, r]) => [sid, { ...r }]));
        site.step(at, 31 * 60000);
        for (const [sid, r] of site.records) {
            const prev = before.get(sid);
            // The same record (not one re-created after a sweep) whose time moved: only after the window.
            if (prev && prev.created === r.created && r.latest !== prev.latest)
                assert.ok(
                    r.latest - prev.latest >= 360000,
                    `renewed after ${r.latest - prev.latest} ms`
                );
        }
    }
});

test('sessions first seen on a proxy that just came back from an outage are taken as already open', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    t.update(snap(15, [], [], { qpsOk: false, failedTargets: ['node1/demoworld'] }));
    t.update(snap(600, [sess('opened-during-outage')], [])); // its record has long aged out
    const r = t.update(snap(660, [sess('opened-during-outage')], []));
    assert.deepEqual(
        types(r).filter((x) => x === 'refused'),
        []
    );
});

test('a sweep after a gap in licence reads exempts sessions first seen during the gap', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('a')], [rec('a', 0)]));
    t.update(snap(15, [sess('a'), sess('x')], [], { licencesOk: false })); // 'x' appears; licences unreadable
    t.update(snap(300, [sess('a'), sess('x')], [], { licencesOk: false }));
    const r = t.update(snap(600, [sess('a'), sess('x')], [])); // reads back: 'a' record gone = sweep
    assert.ok(types(r).includes('sweep'));
    assert.deepEqual(
        types(r).filter((x) => x === 'refused'),
        []
    );
    assert.deepEqual(
        types(t.update(snap(700, [sess('a'), sess('x')], []))).filter((x) => x === 'refused'),
        []
    );
});

test('when licences have never been read, the result says slot counts are unknown', () => {
    const t = new Tracker(LIMIT, 15);
    const r = t.update(
        snap(0, [sess('a')], [], { licencesOk: false, errors: ['QRS licences: timeout'] })
    );
    assert.equal(r.summary.licencesUnknown, true);
    const r2 = t.update(snap(15, [sess('a')], [rec('a', 14)]));
    assert.equal(r2.summary.licencesUnknown, false);
});

test('sessions on a newly discovered proxy, or first seen while licences are unreadable, are never taken for refused', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    // A virtual proxy discovered later: its idle, already-open session appears for the first time.
    t.update(snap(15, [sess('idle', 'test1', 'newvp')], [], { newTargets: ['node1/newvp'] }));
    // A session first seen while the licence read fails.
    t.update(snap(30, [sess('idle', 'test1', 'newvp'), sess('gap')], [], { licencesOk: false }));
    const r = t.update(snap(120, [sess('idle', 'test1', 'newvp'), sess('gap')], []));
    assert.deepEqual(
        types(r).filter((x) => x === 'refused'),
        []
    );
});

test('a session that ends on a working proxy is noticed while another proxy is down', () => {
    const t = new Tracker(LIMIT, 15);
    const onB = (sid) => ({ ...sess(sid, 'test2'), proxyHost: 'node2' });
    t.update(snap(0, [sess('a'), onB('b')], [rec('a', 0)]));
    // node2 can't be read (its last list is reused), and 'a' on node1 has ended.
    const r = t.update(
        snap(15, [onB('b')], [rec('a', 0)], { qpsOk: false, failedTargets: ['node2/demoworld'] })
    );
    const a = r.users.find((u) => u.userId === 'test1').timeline.find((e) => e.sessionId === 'a');
    assert.equal(a.endedAt, isoAt(15));
    const b = r.users.find((u) => u.userId === 'test2');
    assert.equal(b.proxySessions, 1); // the unreadable proxy's session is kept
});

test('the simulated site does not grow when left running', async () => {
    const { SimulatedSite } = await import('../src/simulate.js');
    const site = new SimulatedSite(80, LIMIT, 11);
    const sizes = [];
    for (let at = T0; at < T0 + 6 * 3600000; at += 15000) {
        site.step(at, 31 * 60000);
        if ((at - T0) % 3600000 === 0)
            sizes.push(site.sessions.size + site.records.size + (site.wasLicensed?.size ?? 0));
    }
    // After the first hours the size levels off instead of rising every hour.
    assert.ok(sizes[5] < sizes[2] * 1.5, `sizes per hour: ${sizes.join(', ')}`);
});

test('every open session is listed for ending, even one the capped timeline has dropped', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [sess('old')], []));
    const many = Array.from({ length: 45 }, (_, i) => sess(`n${i}`));
    t.update(snap(15, [sess('old'), ...many], []));
    const r = t.update(snap(30, [sess('old')], []));
    const u = r.users.find((x) => x.key === 'corp\\test1');
    assert.equal(u.timeline.length, 40);
    assert.ok(
        !u.timeline.some((e) => e.sessionId === 'old'),
        'the oldest session is off the timeline'
    );
    assert.deepEqual(
        u.openSessions.map((e) => e.sessionId),
        ['old']
    );
});

test('a session listed by a proxy read now and remembered from one that failed is ended where it was read now', () => {
    const t = new Tracker(LIMIT, 15);
    t.update(snap(0, [], []));
    const cachedA = { ...sess('dup', 'test1', 'a'), proxyHost: 'node1', proxyNode: 'Central' };
    const liveB = { ...sess('dup', 'test1', 'b'), proxyHost: 'node2', proxyNode: 'Rim' };
    t.update(snap(15, [cachedA, liveB], [], { failedTargets: ['node1/a'] }));
    assert.deepEqual(t.sessions.get('dup').seenOn, {
        proxyHost: 'node2',
        virtualProxy: 'b',
        proxyNode: 'Rim',
    });
    const r = t.update(snap(30, [liveB], []));
    const u = r.users.find((x) => x.key === 'corp\\test1');
    assert.equal(u.openSessions[0].virtualProxy, 'b');
    assert.equal(u.openSessions[0].proxyNode, 'Rim');
    assert.ok(!('seenOn' in u.timeline[0]), 'the timeline carries no location field');
});
