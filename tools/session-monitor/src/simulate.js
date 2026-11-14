/**
 * A simulated Qlik Sense site, for trying the live view at any size without a Sense server:
 * `node src/index.js --simulate 300`. It applies the same rule Sense does (a new session is refused
 * when the user has `limit` licence records active within `windowSeconds`) to a made-up population:
 * most users keep one session, some open several, a few hit the limit, a couple of scripts keep
 * starting sessions, and a service account holds many sessions without a licence.
 */

const FIRST =
    'anna erik maria lars karin johan sara mikael emma anders lena peter ida jonas eva oskar linda daniel sofia fredrik maja niklas elin magnus hanna olof frida viktor klara henrik'.split(
        ' '
    );
const LAST =
    'berg lind holm strand nyberg ek dahl lund sjoberg forsberg wall hedlund bergman lindqvist nord sandberg falk blom engstrom hagstrom'.split(
        ' '
    );
const VPS = [
    ['/', 0.5],
    ['sales', 0.25],
    ['finance', 0.15],
    ['partners', 0.1],
];
// [share of users, new-session chance per minute, end chance per minute, app-open chance per minute]
const KINDS = {
    steady: [0.72, 0.1, 0.02, 0.15],
    busy: [0.2, 0.08, 0.06, 0.25],
    heavy: [0.06, 0.3, 0.08, 0.3],
    script: [0.02, 1.0, 0.25, 0.2],
};

/** @param {number} seed Seed. @returns {() => number} Deterministic random numbers in [0, 1). */
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class SimulatedSite {
    /**
     * @param {number} users Number of users.
     * @param {object} limit The `limit` configuration (sessions, windowSeconds).
     * @param {number} [seed] Random seed.
     */
    constructor(users, limit, seed = 42) {
        this.r = rng(seed);
        this.limit = limit;
        this.users = [];
        this.allocations = new Map();
        this.sessions = new Map(); // sid -> { user, vp, node, alive }
        this.records = new Map(); // sid -> { user, created, latest }
        this.lastAt = null;
        const used = new Set();
        const kindFor = (x) => {
            let acc = 0;
            for (const [k, [share]] of Object.entries(KINDS)) if (x < (acc += share)) return k;
            return 'steady';
        };
        for (let i = 0; i < users; i++) {
            let id;
            do
                id = `${FIRST[Math.floor(this.r() * FIRST.length)]}.${LAST[Math.floor(this.r() * LAST.length)]}`;
            while (used.has(id) && used.size < FIRST.length * LAST.length);
            if (used.has(id)) id = `${id}${i}`;
            used.add(id);
            const kind = kindFor(this.r());
            const pick = this.r();
            let acc = 0;
            const vp = VPS.find(([, share]) => pick < (acc += share))?.[0] ?? '/';
            const u = {
                id: kind === 'script' ? `svc-report-${i}` : id,
                kind,
                vp: kind === 'script' ? 'partners' : vp,
                accessTypeId: `at-${i}`,
            };
            this.users.push(u);
            this.allocations.set(u.accessTypeId, {
                key: `demo\\${u.id}`.toLowerCase(),
                userDirectory: 'DEMO',
                userId: u.id,
                kind: this.r() < 0.15 ? 'analyzer' : 'professional',
            });
        }
        this.service = { id: 'svc-qliksense', vp: '/' };
    }

    /** @param {number} p Chance per minute. @param {number} dtMs Step. @returns {boolean} Happens this step. */
    chance(p, dtMs) {
        return this.r() < 1 - Math.pow(1 - p, dtMs / 60000);
    }

    newSession(u, at) {
        const hex = (n) =>
            Math.floor(this.r() * 16 ** n)
                .toString(16)
                .padStart(n, '0');
        const sid = `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(6)}${hex(6)}`;
        const node = this.r() < 0.6 ? 'proxy-1' : 'proxy-2';
        this.sessions.set(sid, { user: u, vp: u.vp, node, alive: true });
        if (!u.accessTypeId) return; // no licence allocation: a proxy session only
        const inWindow = [...this.records.values()].filter(
            (r) => r.user === u && at - r.latest < this.limit.windowSeconds * 1000
        ).length;
        if (inWindow < this.limit.sessions)
            this.records.set(sid, { user: u, created: at, latest: at });
        // else: refused. The proxy session stays until it times out.
    }

    /**
     * Advances the site to `at` and returns a snapshot shaped like collect.snapshot()'s.
     *
     * @param {number} at Time in ms.
     * @param {number} recordsSinceMs Only records active this recently are returned, as in collect.js.
     * @returns {object} Snapshot.
     */
    step(at, recordsSinceMs) {
        const dt = this.lastAt == null ? 15000 : at - this.lastAt;
        const prev = this.lastAt;
        this.lastAt = at;
        // The Repository's hourly sweep, at six minutes past the hour.
        if (
            prev != null &&
            Math.floor((prev - 360000) / 3600000) !== Math.floor((at - 360000) / 3600000)
        )
            this.records.clear();
        // The service account opens 14 sessions at :52 each hour and never closes them.
        if (
            prev != null &&
            Math.floor((prev - 3120000) / 3600000) !== Math.floor((at - 3120000) / 3600000)
        )
            for (let i = 0; i < 14; i++) this.newSession(this.service, at);

        for (const u of this.users) {
            const [, pNew, pEnd, pApp] = KINDS[u.kind];
            const live = [...this.sessions.entries()].filter(([, s]) => s.alive && s.user === u);
            // Steady users only start a session when they have none open.
            if ((u.kind !== 'steady' || live.length === 0) && this.chance(pNew, dt))
                this.newSession(u, at - Math.floor(this.r() * dt));
            for (const [sid, s] of live) {
                const rec = this.records.get(sid);
                if (this.chance(pEnd, dt) || (!rec && this.chance(0.04, dt))) s.alive = false;
                else if (this.chance(pApp, dt)) {
                    // Opening an app refreshes the record; a session that already got in is never refused.
                    if (rec) rec.latest = at - Math.floor(this.r() * dt);
                    else if (this.wasLicensed?.has(sid))
                        this.records.set(sid, { user: u, created: at, latest: at });
                }
                if (rec) (this.wasLicensed ??= new Set()).add(sid);
            }
        }
        for (const [sid, s] of this.sessions)
            if (!s.alive && at - (this.records.get(sid)?.latest ?? 0) > 3600000)
                this.sessions.delete(sid);

        const since = at - recordsSinceMs;
        const users = this.users.length;
        const liveUsers = new Set(
            [...this.sessions.values()]
                .filter((s) => s.alive && s.user.accessTypeId)
                .map((s) => s.user)
        );
        const kindCount = (k) =>
            this.users.filter((u) => this.allocations.get(u.accessTypeId).kind === k);
        return {
            at,
            sessions: [...this.sessions.entries()]
                .filter(([, s]) => s.alive)
                .map(([sid, s]) => ({
                    sessionId: sid,
                    userDirectory: 'DEMO',
                    userId: s.user.id,
                    proxyHost: `${s.node}.demo.local`,
                    proxyNode: s.node,
                    virtualProxy: s.vp,
                })),
            allocations: this.allocations,
            records: [...this.records.entries()]
                .filter(([, r]) => r.latest >= since)
                .map(([sid, r]) => ({
                    sessionId: sid,
                    accessTypeId: r.user.accessTypeId,
                    kind: this.allocations.get(r.user.accessTypeId).kind,
                    createdDate: new Date(r.created).toISOString(),
                    latestActivity: new Date(r.latest).toISOString(),
                })),
            recordsSince: since,
            qpsOk: true,
            licencesOk: true,
            errors: [],
            licenceOverview: {
                at: new Date(at).toISOString(),
                professional: {
                    total: Math.ceil((users * 1.3) / 50) * 50,
                    allocated: kindCount('professional').length,
                    used: [...liveUsers].filter(
                        (u) => this.allocations.get(u.accessTypeId).kind === 'professional'
                    ).length,
                    quarantined: 3,
                    available: 0,
                },
                analyzer: {
                    total: Math.ceil((users * 0.3) / 50) * 50,
                    allocated: kindCount('analyzer').length,
                    used: [...liveUsers].filter(
                        (u) => this.allocations.get(u.accessTypeId).kind === 'analyzer'
                    ).length,
                    quarantined: 0,
                    available: 0,
                },
                analyzerTime: { allocatedMinutes: 20000, usedMinutes: 4130 },
                tokens: null,
            },
        };
    }
}
