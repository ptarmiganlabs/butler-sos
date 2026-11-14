/**
 * Reading Sense: which proxies and virtual proxies exist, which proxy sessions are open,
 * and which licence allocations and licence usage records exist. GET requests only.
 *
 * Finding every proxy node and virtual proxy from the QRS follows the approach of
 * Ctrl-Q's `session-get` command (https://github.com/ptarmiganlabs/ctrl-q, MIT).
 */

/** @param {string} dir User directory. @param {string} id User id. @returns {string} Lower-case user key. */
export const userKey = (dir, id) => `${dir}\\${id}`.toLowerCase();

/**
 * Lists proxy nodes and the virtual proxies linked to each.
 *
 * @param {import('./sense.js').SenseClient} client Sense client.
 * @param {string[]} onlyPrefixes Virtual proxy prefixes to keep; empty keeps all.
 * @returns {Promise<Array<{host: string, port: number, nodeName: string, prefix: string}>>} Targets to poll.
 */
export async function discover(client, onlyPrefixes) {
    const proxies = (await client.qrs('/proxyservice/full')) || [];
    const targets = [];
    for (const p of proxies) {
        const host = p.serverNodeConfiguration?.hostName;
        const port = p.settings?.restListenPort || 4243;
        if (!host) continue;
        for (const vp of p.settings?.virtualProxies || []) {
            const prefix = (vp.prefix || '').replace(/^\/+|\/+$/g, '');
            if (onlyPrefixes.length && !onlyPrefixes.includes(prefix)) continue;
            targets.push({ host, port, nodeName: p.serverNodeConfiguration?.name || host, prefix });
        }
    }
    return targets;
}

const KINDS = [
    {
        kind: 'professional',
        type: 'professionalaccesstype',
        usage: 'professionalaccessusage',
        ref: 'professionalAccessType',
    },
    {
        kind: 'analyzer',
        type: 'analyzeraccesstype',
        usage: 'analyzeraccessusage',
        ref: 'analyzerAccessType',
    },
];

/**
 * Licence allocations (who holds professional or analyzer access), kept for a while between polls:
 * on a large site that list is long and changes rarely. It is read again when it is older than
 * `maxAgeMs`, or when a usage record points at an allocation it doesn't know (a new user).
 */
export class AllocationCache {
    /** @param {number} maxAgeMs How long a read is reused. */
    constructor(maxAgeMs) {
        this.maxAgeMs = maxAgeMs;
        this.map = new Map();
        this.at = 0;
    }

    /**
     * @param {import('./sense.js').SenseClient} client Sense client.
     * @param {boolean} force Read even if the cached copy is fresh.
     * @returns {Promise<Map<string, object>>} access type id -> { key, userDirectory, userId, kind, lastUsed }.
     */
    async get(client, force = false) {
        if (!force && this.at && Date.now() - this.at < this.maxAgeMs) return this.map;
        const map = new Map();
        for (const k of KINDS) {
            for (const a of (await client.qrs(`/license/${k.type}/full`)) || []) {
                if (!a.user) continue;
                map.set(a.id, {
                    key: userKey(a.user.userDirectory, a.user.userId),
                    userDirectory: a.user.userDirectory,
                    userId: a.user.userId,
                    kind: k.kind,
                    lastUsed: a.lastUsed,
                });
            }
        }
        this.map = map;
        this.at = Date.now();
        return map;
    }
}

/**
 * Takes one snapshot of proxy sessions and licence data.
 *
 * @param {import('./sense.js').SenseClient} client Sense client.
 * @param {Array<{host: string, port: number, nodeName: string, prefix: string}>} targets From discover().
 * @param {object} opts Options.
 * @param {AllocationCache} opts.allocationCache Licence allocations, reused between polls.
 * @param {Map<string, object[]>} [opts.sessionCache] Each proxy's last good session list, reused
 *     between polls when that proxy can't be read.
 * @param {number} opts.recordsSinceMs Only usage records active within this many ms are read. Older
 *     ones can't hold a slot, and on a large site there are thousands of them.
 * @returns {Promise<object>} { at, sessions[], allocations Map, records[], recordsSince, errors[] }.
 */
export async function snapshot(
    client,
    targets,
    { allocationCache, recordsSinceMs, sessionCache = new Map() }
) {
    const errors = [];
    let sessionsStale = false;
    const failedTargets = [];
    const sessionLists = await Promise.all(
        targets.map(async (t) => {
            const path = t.prefix ? `/${t.prefix}/session` : '/session';
            const cacheKey = `${t.host}:${t.port}/${t.prefix}`;
            try {
                const list = (await client.qps(t.host, t.port, path)) || [];
                const sessions = list.map((s) => ({
                    sessionId: s.SessionId,
                    userDirectory: s.UserDirectory,
                    userId: s.UserId,
                    proxyHost: t.host,
                    proxyNode: t.nodeName,
                    virtualProxy: t.prefix || '/',
                }));
                sessionCache.set(cacheKey, sessions);
                return sessions;
            } catch (err) {
                errors.push(`QPS ${t.host} /${t.prefix}: ${err.message}`);
                failedTargets.push(`${t.host}/${t.prefix || '/'}`);
                // Keep showing that proxy's last good list rather than none: one proxy failing must
                // not make its users' sessions vanish. Nothing is decided from it (qpsOk is false).
                const last = sessionCache.get(cacheKey);
                if (last) sessionsStale = true;
                return last || [];
            }
        })
    );

    // Within one second is good enough against a 360 s window; offsets under 2 s are ignored as noise.
    const offset = Math.abs(client.clockOffsetMs) >= 2000 ? client.clockOffsetMs : 0;
    const recordsSince = Date.now() + offset - recordsSinceMs;
    const since = new Date(recordsSince).toISOString();
    let allocations = new Map();
    const records = [];
    try {
        allocations = await allocationCache.get(client);
        for (const k of KINDS) {
            const usage = await client.qrs(
                `/license/${k.usage}/full?filter=latestActivity ge '${since}'`
            );
            for (const r of usage || []) {
                records.push({
                    sessionId: r.sessionID,
                    accessTypeId: r[k.ref]?.id,
                    kind: k.kind,
                    createdDate: r.createdDate,
                    latestActivity: r.latestActivity,
                });
            }
        }
        if (records.some((r) => r.accessTypeId && !allocations.has(r.accessTypeId))) {
            allocations = await allocationCache.get(client, true);
        }
    } catch (err) {
        errors.push(`QRS licences: ${err.message}`);
    }

    return {
        at: Date.now() + offset,
        sessions: sessionLists.flat(),
        allocations,
        records,
        recordsSince,
        sessionsStale,
        failedTargets,
        qpsOk: !errors.some((e) => e.startsWith('QPS')),
        licencesOk: !errors.some((e) => e.startsWith('QRS')),
        errors,
    };
}

/**
 * Site-wide licence totals from the QRS licence overview (what the QMC's licence usage summary shows).
 *
 * @param {import('./sense.js').SenseClient} client Sense client.
 * @returns {Promise<object>} Professional, analyzer and analyzer-time totals, and token totals when tokens are in use.
 */
export async function licenceOverview(client) {
    const o = (await client.qrs('/license/accesstypeoverview')) || {};
    const access = (a) =>
        a?.enabled
            ? {
                  total: a.total,
                  allocated: a.allocated,
                  used: a.used,
                  quarantined: a.quarantined,
                  available: a.available,
                  excess: a.excess,
              }
            : null;
    return {
        at: new Date().toISOString(),
        professional: access(o.professionalAccess),
        analyzer: access(o.analyzerAccess),
        analyzerTime: o.analyzerTimeAccess?.enabled
            ? {
                  allocatedMinutes: o.analyzerTimeAccess.allocatedMinutes,
                  usedMinutes: o.analyzerTimeAccess.usedMinutes,
                  unavailableMinutes: o.analyzerTimeAccess.unavailableMinutes,
              }
            : null,
        tokens: o.tokensEnabled ? { total: o.totalTokens, available: o.availableTokens } : null,
    };
}
