/**
 * Turns snapshots into per-user state, a per-session timeline and events. Pure logic, no I/O, so it
 * can be tested with recorded data.
 *
 * The rule it applies was measured on Sense May 2026 (see README): a NEW session is refused when the
 * user already has `limit.sessions` licence usage records whose latestActivity is younger than
 * `limit.windowSeconds`. Records are matched to proxy sessions on the session id, an idea taken
 * from Christof Schwarz's sessionTerminator (https://github.com/ChristofSchwarz/qs-OEM-tricks).
 */
import { userKey } from './collect.js';

const LEVELS = ['ok', 'warn', 'critical'];
// Objects keyed by names from Sense (virtual proxy prefixes, node names) must have no inherited
// properties: a prefix such as "constructor" would otherwise hit Object.prototype.
const dict = () => Object.create(null);
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());

/** Most sessions listed per user in the timeline (newest first); service accounts can hold hundreds. */
const MAX_TIMELINE_SESSIONS = 40;

export class Tracker {
    /**
     * @param {object} limit The `limit` section of the configuration.
     * @param {number} intervalSeconds Poll interval, used to size the uncertainty around record sweeps.
     * @param {object} [opts] Options.
     * @param {number} [opts.timelineMinutes] How long ended sessions stay in the timeline. Default 30.
     */
    constructor(limit, intervalSeconds, { timelineMinutes = 30 } = {}) {
        this.limit = limit;
        this.intervalMs = intervalSeconds * 1000;
        this.timelineMs = timelineMinutes * 60 * 1000;
        this.first = true;
        /** @type {Map<string, object>} session id -> what we know about that session */
        this.sessions = new Map();
        /** @type {Map<string, string>} user key -> level */
        this.levels = new Map();
        /** @type {Map<string, number>} record session id -> latestActivity, at the previous update */
        this.prevRecords = new Map();
        this.lastSweepAt = 0;
        this.prevUsers = new Set();
        this.refusedTotal = new Map();
        /** @type {Map<string, number>} user key -> when the user was last refused */
        this.lastRefusedAt = new Map();
        this.refusedByVirtualProxy = new Map();
        this.refusedByNode = new Map();
        /** @type {Map<string, [string, string]>} user key -> [directory, id] as Sense spells them */
        this.names = new Map();
        this.startedAt = null;
        /** @type {Set<string>} "host/virtual proxy" pairs that couldn't be read at the previous update */
        this.prevFailedTargets = new Set();
        this.prevLicenceOkAt = null;
    }

    /**
     * @param {string} key User key.
     * @returns {boolean} True when the user is excluded from reporting.
     */
    excluded(key) {
        return this.limit.excludeUsers.includes(key);
    }

    /**
     * Applies one snapshot.
     *
     * @param {object} snap From collect.snapshot(), optionally with `licenceOverview`.
     * @returns {object} { at, startedAt, config, users[], events[], summary, breakdown, licences }.
     */
    update(snap) {
        // A failed licence read must not look like "no one holds a slot": reuse the last good read.
        // Its timestamps age normally, so slots still free on time; nothing new is decided from it
        // (licencesOk stays false), and the result says the licence data is stale.
        let licencesStale = false;
        // No licence read has ever succeeded: slot counts and who holds a licence are unknown.
        const licencesUnknown = !snap.licencesOk && !this.lastLicences;
        if (snap.licencesOk) {
            this.lastLicences = {
                records: snap.records,
                allocations: snap.allocations,
                recordsSince: snap.recordsSince,
            };
        } else if (this.lastLicences) {
            snap = { ...snap, ...this.lastLicences };
            licencesStale = true;
        }
        const now = snap.at;
        this.startedAt ??= now;
        const {
            sessions: maxSlots,
            windowSeconds,
            warnAt,
            criticalAt,
            refusalGraceSeconds,
        } = this.limit;
        const windowMs = windowSeconds * 1000;
        const events = [];
        const user = (t) => ({ userDirectory: t.userDirectory, userId: t.userId });

        const sweepMarginMs = refusalGraceSeconds * 1000 + this.intervalMs;
        const recordBySid = new Map(snap.records.map((r) => [r.sessionId, r]));
        const allocationByUser = new Map([...snap.allocations.values()].map((a) => [a.key, a]));

        // Records disappear only in the Repository's periodic sweep, which removes live sessions'
        // records too. Around a sweep, "no record" says nothing about a refusal.
        // Only recent records are read (snap.recordsSince), so a record that merely aged past that
        // point is not a sweep: count only those that should still have been there.
        if (snap.licencesOk) {
            const since = (snap.recordsSince ?? -Infinity) + this.intervalMs;
            let vanished = 0;
            for (const [sid, latest] of this.prevRecords)
                if (!recordBySid.has(sid) && latest > since) vanished++;
            if (vanished > 0 && !this.first) {
                this.lastSweepAt = now;
                // Sessions that appeared just before the sweep may have had their record removed by
                // it: mark them, so they're never taken for refused, however long they stay idle.
                // After a gap in licence reads, the sweep may have come any time since the last good
                // read, so look back over the whole gap too.
                const gapMs =
                    this.prevLicenceOkAt != null
                        ? Math.max(0, now - this.prevLicenceOkAt - this.intervalMs)
                        : 0;
                for (const t of this.sessions.values())
                    if (
                        !t.recorded &&
                        t.firstSeen != null &&
                        now - t.firstSeen < sweepMarginMs + gapMs
                    )
                        t.sweepExempt = true;
                events.push({ type: 'sweep', at: iso(now), recordsRemoved: vanished });
            }
            this.prevLicenceOkAt = now;
            this.prevRecords = new Map(
                snap.records.map((r) => [r.sessionId, Date.parse(r.latestActivity)])
            );
        }

        // Track proxy sessions: first and last seen, whether they ever had a usage record.
        const live = new Set();
        // A session listed on two proxies counts once. Where it does, the listing from a proxy
        // read this time wins over one remembered from a proxy that couldn't be read.
        const stale = new Set(snap.failedTargets || []);
        const fresh = (x) => !stale.has(`${x.proxyHost}/${x.virtualProxy}`);
        const sessions = [
            ...snap.sessions.filter(fresh),
            ...snap.sessions.filter((x) => !fresh(x)),
        ];
        for (const s of sessions) {
            if (live.has(s.sessionId)) continue; // same session listed on two proxies
            live.add(s.sessionId);
            const key = userKey(s.userDirectory, s.userId);
            let t = this.sessions.get(s.sessionId);
            if (!t || t.recordOnly) {
                t = {
                    ...t,
                    sessionId: s.sessionId,
                    key,
                    userDirectory: s.userDirectory,
                    userId: s.userId,
                    virtualProxy: s.virtualProxy,
                    proxyNode: s.proxyNode,
                    proxyHost: s.proxyHost,
                    firstSeen: now,
                    // Unknown sessions on a proxy that couldn't be read last time may have opened
                    // during the gap: take them as already open, like those seen at start.
                    // Already open when first seen: at start, on a proxy that couldn't be read last
                    // time, or on a proxy/virtual proxy read for the first time (newly discovered).
                    baseline:
                        this.first ||
                        this.prevFailedTargets.has(`${s.proxyHost}/${s.virtualProxy}`) ||
                        (snap.newTargets || []).includes(`${s.proxyHost}/${s.virtualProxy}`),
                    // First seen right after a sweep: its record may already have been removed.
                    // Also when licences can't be read now: whether it got a licence can't be checked,
                    // and by the time reads recover its record may have aged out of the read window.
                    sweepExempt:
                        (!!this.lastSweepAt && now - this.lastSweepAt < sweepMarginMs) ||
                        !snap.licencesOk,
                    recorded: t?.recorded || false,
                    refused: false,
                    recordOnly: false,
                };
                this.sessions.set(s.sessionId, t);
            }
            t.lastSeen = now;
            t.endedAt = null;
            // Where the session was seen this time, which is where ending it must go.
            t.seenOn = {
                proxyHost: s.proxyHost,
                virtualProxy: s.virtualProxy,
                proxyNode: s.proxyNode,
            };
        }
        // A session missing from the proxies has ended, except on a proxy that couldn't be read this
        // time: one proxy being down must not stop ended sessions elsewhere from being noticed.
        {
            const failed = new Set(snap.failedTargets || []);
            const unknownWhichFailed = !snap.qpsOk && !failed.size;
            for (const t of this.sessions.values()) {
                if (t.recordOnly || t.endedAt || live.has(t.sessionId)) continue;
                if (unknownWhichFailed || failed.has(`${t.proxyHost}/${t.virtualProxy}`)) continue;
                t.endedAt = now;
                if ((t.recorded || t.refused) && !this.excluded(t.key) && !t.baseline) {
                    events.push({
                        type: 'session-ended',
                        at: iso(now),
                        ...user(t),
                        sessionId: t.sessionId,
                        virtualProxy: t.virtualProxy,
                        refused: t.refused,
                    });
                }
            }
        }

        // Attach usage records. A record whose proxy session we never saw (it ended before we
        // started, or runs on a virtual proxy we don't poll) still holds a slot: keep it as record-only.
        if (snap.licencesOk) {
            for (const r of snap.records) {
                const a = snap.allocations.get(r.accessTypeId);
                if (!a) continue;
                let t = this.sessions.get(r.sessionId);
                if (!t) {
                    t = {
                        sessionId: r.sessionId,
                        key: a.key,
                        userDirectory: a.userDirectory,
                        userId: a.userId,
                        virtualProxy: null,
                        proxyNode: null,
                        firstSeen: null,
                        lastSeen: null,
                        endedAt: null,
                        baseline: true,
                        recorded: false,
                        refused: false,
                        recordOnly: true,
                    };
                    this.sessions.set(r.sessionId, t);
                }
                const wasRecorded = t.recorded;
                t.recorded = true;
                t.licence = a.kind;
                t.recordCreated = Date.parse(r.createdDate);
                t.latestActivity = Date.parse(r.latestActivity);
                t.hasRecord = true;
                if (!wasRecorded && !t.baseline && !this.excluded(t.key)) {
                    t.licensedAt = now;
                    t.licensedEvent = true; // reported once the user's slot count is known, below
                }
            }
            for (const t of this.sessions.values()) t.hasRecord = recordBySid.has(t.sessionId);
        }

        // Refusals: a session that appeared while we watched, of a user holding a licence allocation,
        // that has gone the grace period without ever getting a usage record. A session that has
        // already closed counts too, if it was seen in two or more polls without a record.
        if (snap.licencesOk && snap.qpsOk) {
            for (const t of this.sessions.values()) {
                if (t.recordOnly || t.baseline || t.recorded || t.refused || t.sweepExempt)
                    continue;
                if (this.excluded(t.key) || !allocationByUser.has(t.key)) continue;
                if (now - t.firstSeen < refusalGraceSeconds * 1000) continue;
                if (t.endedAt && !(t.lastSeen > t.firstSeen)) continue;
                t.refused = true;
                t.refusedAt = now;
                const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
                inc(this.refusedTotal, t.key);
                this.lastRefusedAt.set(t.key, now);
                inc(this.refusedByVirtualProxy, t.virtualProxy);
                inc(this.refusedByNode, t.proxyNode);
                events.push({
                    type: 'refused',
                    at: iso(now),
                    firstSeen: iso(t.firstSeen),
                    ...user(t),
                    sessionId: t.sessionId,
                    virtualProxy: t.virtualProxy,
                    proxyHost: t.proxyHost,
                });
            }
        }

        // Forget sessions that ended (or lost their record) long enough ago to be off the timeline.
        for (const [sid, t] of this.sessions) {
            const ended = t.recordOnly ? !t.hasRecord : t.endedAt;
            const lastRelevant = Math.max(
                t.endedAt || 0,
                t.lastSeen || 0,
                t.latestActivity ? t.latestActivity + windowMs : 0
            );
            if (ended && now - lastRelevant > this.timelineMs) this.sessions.delete(sid);
        }

        // Per-user state.
        const users = new Map();
        const get = (key, dir, id) => {
            if (!users.has(key)) {
                this.names.set(key, [dir, id]);
                users.set(key, {
                    key,
                    userDirectory: dir,
                    userId: id,
                    proxySessions: 0,
                    byVirtualProxy: dict(),
                    byProxy: dict(),
                    slotTimes: [],
                    records: 0,
                    licence: allocationByUser.get(key)?.kind || null,
                    timeline: [],
                });
            }
            return users.get(key);
        };
        for (const sid of live) {
            const t = this.sessions.get(sid);
            if (this.excluded(t.key)) continue;
            const u = get(t.key, t.userDirectory, t.userId);
            u.proxySessions++;
            u.byVirtualProxy[t.virtualProxy] = (u.byVirtualProxy[t.virtualProxy] || 0) + 1;
            u.byProxy[t.proxyNode] = (u.byProxy[t.proxyNode] || 0) + 1;
        }
        for (const r of snap.records) {
            const a = snap.allocations.get(r.accessTypeId);
            if (!a || this.excluded(a.key)) continue;
            const u = get(a.key, a.userDirectory, a.userId);
            u.licence = a.kind;
            u.records++;
            const latest = Date.parse(r.latestActivity);
            if (now - latest < windowMs) u.slotTimes.push(latest);
        }
        for (const t of this.sessions.values()) {
            if (this.excluded(t.key)) continue;
            const isLive = live.has(t.sessionId);
            if (!isLive && !t.hasRecord && !t.endedAt) continue;
            // Ended sessions that took a slot or were refused keep their user listed until they leave
            // the timeline, so a recent refusal stays visible. Others only join an existing row.
            const u =
                isLive || t.hasRecord || ((t.recorded || t.refused) && !t.baseline)
                    ? get(t.key, t.userDirectory, t.userId)
                    : users.get(t.key);
            if (!u) continue;
            // A record no longer read because it is older than snap.recordsSince only aged out; one
            // that vanished while still recent was removed by the Repository's sweep.
            const agedOut =
                !t.hasRecord &&
                t.recorded &&
                t.latestActivity != null &&
                t.latestActivity <= (snap.recordsSince ?? -Infinity) + this.intervalMs;
            const knowsSlot = t.hasRecord || agedOut;
            const slotUntil = knowsSlot ? t.latestActivity + windowMs : null;
            let state;
            if (t.refused) state = 'refused';
            else if (knowsSlot) state = slotUntil > now ? 'slot' : 'idle';
            else if (t.recorded) state = 'swept';
            else if (!t.baseline && allocationByUser.has(t.key)) state = 'pending';
            else state = 'unlicensed';
            u.timeline.push({
                sessionId: t.sessionId,
                virtualProxy: t.virtualProxy,
                proxyNode: t.proxyNode,
                // Where an open session was seen in this poll, for ending it; dropped from the timeline.
                seenOn:
                    isLive && t.seenOn
                        ? { virtualProxy: t.seenOn.virtualProxy, proxyNode: t.seenOn.proxyNode }
                        : undefined,
                firstSeen: iso(t.firstSeen),
                lastSeen: iso(t.lastSeen),
                endedAt: iso(t.endedAt),
                live: isLive,
                seenAtStart: t.baseline,
                state,
                recordCreated: knowsSlot ? iso(t.recordCreated) : null,
                latestActivity: knowsSlot ? iso(t.latestActivity) : null,
                slotUntil: iso(slotUntil),
                licensedAt: iso(t.licensedAt),
                refusedAt: iso(t.refusedAt),
            });
        }

        const rows = [];
        for (const u of users.values()) {
            u.slotTimes.sort((x, y) => x - y);
            const slotsUsed = u.slotTimes.length;
            const level =
                slotsUsed >= criticalAt ? 'critical' : slotsUsed >= warnAt ? 'warn' : 'ok';
            // When the oldest record in the window leaves it, one slot comes back.
            const nextSlotFreeAt = slotsUsed ? u.slotTimes[0] + windowMs : null;
            const fullUntil =
                slotsUsed >= maxSlots ? u.slotTimes[slotsUsed - maxSlots] + windowMs : null;
            const sortKey = (e) => Date.parse(e.firstSeen || e.recordCreated || 0);
            u.timeline.sort((a, b) => sortKey(b) - sortKey(a));
            rows.push({
                userDirectory: u.userDirectory,
                userId: u.userId,
                licence: u.licence,
                slotsUsed,
                slotsLimit: maxSlots,
                slotsFreeAt: u.slotTimes.map((x) => iso(x + windowMs)),
                level,
                proxySessions: u.proxySessions,
                byVirtualProxy: u.byVirtualProxy,
                byProxy: u.byProxy,
                usageRecords: u.records,
                nextSlotFreeAt: iso(nextSlotFreeAt),
                nextSlotFreeInSeconds: nextSlotFreeAt
                    ? Math.max(0, Math.round((nextSlotFreeAt - now) / 1000))
                    : null,
                atLimitUntil: iso(fullUntil),
                refusedTotal: this.refusedTotal.get(u.key) || 0,
                lastRefusedAt: iso(this.lastRefusedAt.get(u.key)),
                timeline: u.timeline.slice(0, MAX_TIMELINE_SESSIONS).map(({ seenOn, ...e }) => e),
                timelineTotal: u.timeline.length,
                // Every open session, however many: the timeline above is capped, and a session
                // that has been open long can fall off it while it is still there to be ended.
                openSessions: u.timeline
                    .filter((e) => e.live)
                    .map(({ seenOn, ...e }) => ({ ...e, ...seenOn })),
                key: u.key,
            });
        }
        const rowByKey = new Map(rows.map((r) => [r.key, r]));

        // A new session got its licence: report it with the slot it took, in the order they took them.
        const newlyLicensed = [...this.sessions.values()]
            .filter((x) => x.licensedEvent)
            .sort((x, y) => x.latestActivity - y.latestActivity);
        for (const t of newlyLicensed) {
            if (!t.licensedEvent) continue;
            t.licensedEvent = false;
            const r = rowByKey.get(t.key);
            // Which slot it took: how many of the user's slots were taken when its record was created,
            // itself included. Sense only lets a session in below the limit, so this is at most the
            // limit; a later app open in an older session can still bring the user to six.
            const slot = r
                ? Math.min(
                      maxSlots,
                      r.slotsFreeAt.filter((x) => {
                          const latest = Date.parse(x) - windowMs;
                          return latest <= t.recordCreated && t.recordCreated - latest < windowMs;
                      }).length || 1
                  )
                : null;
            events.push({
                type: 'licensed',
                at: iso(now),
                ...user(t),
                sessionId: t.sessionId,
                virtualProxy: t.virtualProxy,
                licence: t.licence,
                slotsUsed: slot,
                slotsLimit: maxSlots,
            });
        }

        // Alert levels: raise, change and clear. Skipped while licence data is unavailable.
        if (snap.licencesOk) {
            for (const key of new Set([...this.levels.keys(), ...rowByKey.keys()])) {
                const r = rowByKey.get(key);
                const prev = this.levels.get(key) || 'ok';
                const level = r ? r.level : 'ok';
                if (level === prev) continue;
                const [dir, id] = this.names.get(key);
                const up = LEVELS.indexOf(level) > LEVELS.indexOf(prev);
                events.push({
                    type: 'alert',
                    at: iso(now),
                    level,
                    previousLevel: prev,
                    change: up
                        ? prev === 'ok'
                            ? 'raised'
                            : 'escalated'
                        : level === 'ok'
                          ? 'cleared'
                          : 'lowered',
                    userDirectory: dir,
                    userId: id,
                    slotsUsed: r ? r.slotsUsed : 0,
                    slotsLimit: maxSlots,
                    proxySessions: r ? r.proxySessions : 0,
                    nextSlotFreeAt: r ? r.nextSlotFreeAt : null,
                });
                if (level === 'ok') this.levels.delete(key);
                else this.levels.set(key, level);
            }
        }

        // Users that were reported last time but have neither sessions nor records now: report them
        // once more with zeros, so time series drop to zero instead of stopping at their last value.
        const nowKeys = new Set(rows.map((r) => r.key));
        for (const key of this.prevUsers) {
            if (nowKeys.has(key)) continue;
            const [dir, id] = this.names.get(key);
            rows.push({
                userDirectory: dir,
                userId: id,
                licence: null,
                slotsUsed: 0,
                slotsLimit: maxSlots,
                slotsFreeAt: [],
                level: 'ok',
                proxySessions: 0,
                byVirtualProxy: dict(),
                byProxy: dict(),
                usageRecords: 0,
                nextSlotFreeAt: null,
                nextSlotFreeInSeconds: null,
                atLimitUntil: null,
                refusedTotal: this.refusedTotal.get(key) || 0,
                lastRefusedAt: iso(this.lastRefusedAt.get(key)),
                timeline: [],
                timelineTotal: 0,
                openSessions: [],
                key,
                gone: true,
            });
        }
        this.prevUsers = nowKeys;

        rows.sort(
            (a, b) =>
                b.slotsUsed - a.slotsUsed ||
                b.refusedTotal - a.refusedTotal ||
                b.proxySessions - a.proxySessions ||
                a.key.localeCompare(b.key)
        );

        // Where sessions come in: per virtual proxy and per proxy node.
        const breakdown = { virtualProxies: dict(), nodes: dict() };
        const add = (bucket, name, key) => {
            const b = (bucket[name] ??= { sessions: 0, users: new Set(), refused: 0 });
            b.sessions++;
            b.users.add(key);
        };
        for (const sid of live) {
            const t = this.sessions.get(sid);
            if (this.excluded(t.key)) continue;
            add(breakdown.virtualProxies, t.virtualProxy, t.key);
            add(breakdown.nodes, t.proxyNode, t.key);
        }
        for (const [bucket, refused] of [
            [breakdown.virtualProxies, this.refusedByVirtualProxy],
            [breakdown.nodes, this.refusedByNode],
        ]) {
            for (const [name, n] of refused)
                (bucket[name] ??= { sessions: 0, users: new Set(), refused: 0 }).refused = n;
            for (const b of Object.values(bucket)) b.users = b.users.size;
        }

        // Sessions are taken as already open (never refused) until the proxies were read once in full.
        if (snap.qpsOk) this.first = false;
        this.prevFailedTargets = new Set(snap.failedTargets || []);
        return {
            at: iso(now),
            startedAt: iso(this.startedAt),
            config: {
                slotsLimit: maxSlots,
                windowSeconds,
                warnAt,
                criticalAt,
                timelineMinutes: this.timelineMs / 60000,
                refusalGraceSeconds,
            },
            users: rows,
            events,
            breakdown,
            licences: snap.licenceOverview || null,
            summary: {
                licencesStale,
                licencesUnknown,
                sessionsStale: !!snap.sessionsStale,
                proxySessions: live.size,
                usersWithSessions: rows.filter((r) => r.proxySessions > 0).length,
                usersWarn: rows.filter((r) => r.level === 'warn').length,
                usersCritical: rows.filter((r) => r.level === 'critical').length,
                slotsInUse: rows.reduce((n, r) => n + r.slotsUsed, 0),
                refusedSinceStart: [...this.refusedTotal.values()].reduce((a, b) => a + b, 0),
                usageRecords: snap.records.length,
                errors: snap.errors,
            },
        };
    }
}
