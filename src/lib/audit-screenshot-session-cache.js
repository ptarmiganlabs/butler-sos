import { LRUCache } from 'lru-cache';

const DEFAULT_TTL_SECONDS = 120;
const DEFAULT_MAX_ENTRIES = 100;

let sessionCache = null;
let sessionCacheOptionsKey = null;
let suppressDisposal = false;

/**
 * Minimal logger interface used by this module.
 *
 * @typedef {object} Logger
 * @property {(msg: string) => void} [debug] Logs debug messages.
 * @property {(msg: string) => void} [warn] Logs warning messages.
 */

/**
 * Screenshot session cache settings.
 *
 * @typedef {object} ScreenshotSessionCacheConfig
 * @property {boolean} [enable] Whether session caching is enabled.
 * @property {number} [ttlSeconds] Maximum session age in seconds.
 * @property {number} [maxEntries] Maximum cached sessions.
 */

/**
 * Screenshot authentication configuration.
 *
 * @typedef {object} ScreenshotAuthConfig
 * @property {'none'|'qpsTicket'|'userTicket'} [mode] Authentication mode.
 * @property {ScreenshotSessionCacheConfig} [sessionCache] Session cache settings.
 */

/**
 * QPS ticket request settings used to partition cached sessions.
 *
 * @typedef {object} ScreenshotSessionCacheQps
 * @property {string} host QPS hostname.
 * @property {number|string} port QPS port.
 * @property {string} userDirectory Qlik user directory.
 * @property {string} userId Qlik user id.
 * @property {string} [virtualProxy] Qlik virtual proxy name.
 */

/**
 * Cached Qlik session cookie.
 *
 * @typedef {object} CachedScreenshotSession
 * @property {string} cacheKey Cache key.
 * @property {'qpsTicket'|'userTicket'} authMode Authentication mode.
 * @property {ScreenshotSessionCacheQps} qps QPS settings for cleanup.
 * @property {string} cookieName Qlik session cookie name.
 * @property {string} cookieValue Qlik session id/cookie value.
 * @property {string} cookieHeader HTTP Cookie header value.
 * @property {number} createdAt Epoch timestamp when the entry was created.
 * @property {number} expiresAt Epoch timestamp when the entry expires.
 * @property {(entry: CachedScreenshotSession, reason: string) => Promise<void>|void} [cleanup] Cleanup callback.
 */

/**
 * Normalizes session cache settings while keeping runtime defaults close to the cache code.
 *
 * @param {ScreenshotAuthConfig | null | undefined} auth Screenshot authentication configuration.
 * @returns {{ enabled: boolean, ttlSeconds: number, maxEntries: number }} Normalized cache settings.
 */
export function normalizeScreenshotSessionCacheConfig(auth) {
    const rawConfig = auth?.sessionCache || {};
    const modeSupportsCache = auth?.mode === 'qpsTicket' || auth?.mode === 'userTicket';

    return {
        enabled: modeSupportsCache && rawConfig.enable === true,
        ttlSeconds: toPositiveNumber(rawConfig.ttlSeconds, DEFAULT_TTL_SECONDS),
        maxEntries: toPositiveInteger(rawConfig.maxEntries, DEFAULT_MAX_ENTRIES),
    };
}

/**
 * Returns whether screenshot session caching is enabled for the auth mode.
 *
 * @param {ScreenshotAuthConfig | null | undefined} auth Screenshot authentication configuration.
 * @returns {boolean} True when session caching is enabled.
 */
export function isScreenshotSessionCacheEnabled(auth) {
    return normalizeScreenshotSessionCacheConfig(auth).enabled;
}

/**
 * Builds a deterministic cache key for a Qlik session cookie.
 *
 * @param {'qpsTicket'|'userTicket'} authMode Authentication mode.
 * @param {ScreenshotSessionCacheQps} qps QPS settings.
 * @returns {string} Cache key.
 */
export function buildScreenshotSessionCacheKey(authMode, qps) {
    return JSON.stringify([
        authMode,
        normalizeKeyPart(qps?.host).toLowerCase(),
        normalizeKeyPart(qps?.port),
        normalizeVirtualProxyForKey(qps?.virtualProxy),
        normalizeKeyPart(qps?.userDirectory),
        normalizeKeyPart(qps?.userId),
    ]);
}

/**
 * Gets a cached session cookie for the supplied auth and QPS settings.
 *
 * @param {ScreenshotAuthConfig | null | undefined} auth Screenshot authentication configuration.
 * @param {ScreenshotSessionCacheQps} qps QPS settings.
 * @param {Logger} logger Logger.
 * @returns {CachedScreenshotSession | null} Cached session entry, if present.
 */
export function getCachedScreenshotSession(auth, qps, logger) {
    const cache = getOrCreateSessionCache(auth, logger);
    if (!cache) return null;

    const authMode = auth.mode;
    const cacheKey = buildScreenshotSessionCacheKey(authMode, qps);
    const entry = cache.get(cacheKey) || null;

    if (entry) {
        logger?.debug?.(
            `AUDIT API: Screenshot session cache hit authMode=${authMode} cacheKey=${cacheKey} cookieName=${entry.cookieName} sessionIdLength=${entry.cookieValue.length}`
        );
    } else {
        logger?.debug?.(
            `AUDIT API: Screenshot session cache miss authMode=${authMode} cacheKey=${cacheKey}`
        );
    }

    return entry;
}

/**
 * Stores a session cookie in the screenshot session cache.
 *
 * @param {ScreenshotAuthConfig | null | undefined} auth Screenshot authentication configuration.
 * @param {ScreenshotSessionCacheQps} qps QPS settings.
 * @param {{ name: string, value: string }} sessionCookie Session cookie.
 * @param {(entry: CachedScreenshotSession, reason: string) => Promise<void>|void} cleanup Cleanup callback.
 * @param {Logger} logger Logger.
 * @returns {CachedScreenshotSession | null} Stored cache entry, or null when caching is disabled.
 */
export function setCachedScreenshotSession(auth, qps, sessionCookie, cleanup, logger) {
    const cache = getOrCreateSessionCache(auth, logger);
    if (!cache || !sessionCookie?.name || !sessionCookie?.value) return null;

    const cacheConfig = normalizeScreenshotSessionCacheConfig(auth);
    const authMode = auth.mode;
    const cacheKey = buildScreenshotSessionCacheKey(authMode, qps);
    const now = Date.now();
    const entry = {
        cacheKey,
        authMode,
        qps: sanitizeQpsForCache(qps),
        cookieName: sessionCookie.name,
        cookieValue: sessionCookie.value,
        cookieHeader: `${sessionCookie.name}=${sessionCookie.value}`,
        createdAt: now,
        expiresAt: now + cacheConfig.ttlSeconds * 1000,
        cleanup,
    };

    cache.set(cacheKey, entry);
    logger?.debug?.(
        `AUDIT API: Screenshot session cache stored authMode=${authMode} cacheKey=${cacheKey} cookieName=${entry.cookieName} ttlSeconds=${cacheConfig.ttlSeconds} maxEntries=${cacheConfig.maxEntries}`
    );

    return entry;
}

/**
 * Deletes a cached screenshot session entry.
 *
 * @param {ScreenshotAuthConfig | null | undefined} auth Screenshot authentication configuration.
 * @param {ScreenshotSessionCacheQps} qps QPS settings.
 * @param {Logger} logger Logger.
 * @returns {boolean} True when an entry was deleted.
 */
export function deleteCachedScreenshotSession(auth, qps, logger) {
    const cache = getOrCreateSessionCache(auth, logger);
    if (!cache) return false;

    const authMode = auth.mode;
    const cacheKey = buildScreenshotSessionCacheKey(authMode, qps);
    const deleted = cache.delete(cacheKey);

    logger?.debug?.(
        `AUDIT API: Screenshot session cache delete authMode=${authMode} cacheKey=${cacheKey} deleted=${deleted}`
    );

    return deleted;
}

/**
 * Clears the in-memory screenshot session cache.
 *
 * @param {{ cleanup?: boolean }} [options] Clear options.
 * @returns {void}
 */
export function clearScreenshotSessionCache(options = {}) {
    if (!sessionCache) return;

    suppressDisposal = options.cleanup === false;
    try {
        sessionCache.clear();
    } finally {
        suppressDisposal = false;
        sessionCache = null;
        sessionCacheOptionsKey = null;
    }
}

/**
 * Returns cache diagnostics useful for tests and debug endpoints.
 *
 * @returns {{ size: number, max: number | null, ttl: number | null }} Cache diagnostics.
 */
export function getScreenshotSessionCacheStats() {
    return {
        size: sessionCache?.size || 0,
        max: sessionCache?.max || null,
        ttl: sessionCache?.ttl || null,
    };
}

/**
 * Gets the active cache or creates one matching the supplied config.
 *
 * @param {ScreenshotAuthConfig | null | undefined} auth Screenshot authentication configuration.
 * @param {Logger} logger Logger.
 * @returns {LRUCache<string, CachedScreenshotSession> | null} LRU cache, or null when disabled.
 */
function getOrCreateSessionCache(auth, logger) {
    const cacheConfig = normalizeScreenshotSessionCacheConfig(auth);
    if (!cacheConfig.enabled) {
        clearScreenshotSessionCache();
        return null;
    }

    const ttlMs = cacheConfig.ttlSeconds * 1000;
    const optionsKey = `${cacheConfig.maxEntries}:${ttlMs}`;

    if (sessionCache && sessionCacheOptionsKey !== optionsKey) {
        logger?.debug?.(
            `AUDIT API: Screenshot session cache config changed, recreating cache oldOptions=${sessionCacheOptionsKey} newOptions=${optionsKey}`
        );
        clearScreenshotSessionCache();
    }

    if (!sessionCache) {
        sessionCache = new LRUCache({
            max: cacheConfig.maxEntries,
            ttl: ttlMs,
            ttlAutopurge: true,
            allowStale: false,
            updateAgeOnGet: false,
            dispose: disposeCachedScreenshotSession,
        });
        sessionCacheOptionsKey = optionsKey;

        logger?.debug?.(
            `AUDIT API: Screenshot session cache created ttlSeconds=${cacheConfig.ttlSeconds} maxEntries=${cacheConfig.maxEntries}`
        );
    }

    return sessionCache;
}

/**
 * Runs best-effort cleanup for an evicted cached screenshot session.
 *
 * @param {CachedScreenshotSession} entry Cached session entry.
 * @param {string} _key Cache key.
 * @param {string} reason LRU cache disposal reason.
 * @returns {void}
 */
function disposeCachedScreenshotSession(entry, _key, reason) {
    if (suppressDisposal || typeof entry?.cleanup !== 'function') return;

    Promise.resolve(entry.cleanup(entry, reason)).catch(() => {
        // Cleanup is best effort and should never break the caller's cache operation.
    });
}

/**
 * Sanitizes QPS settings before storing them in cache entries.
 *
 * @param {ScreenshotSessionCacheQps} qps QPS settings.
 * @returns {ScreenshotSessionCacheQps} Sanitized QPS settings.
 */
function sanitizeQpsForCache(qps) {
    return {
        host: qps.host,
        port: qps.port,
        userDirectory: qps.userDirectory,
        userId: qps.userId,
        virtualProxy: qps.virtualProxy,
    };
}

/**
 * Returns a trimmed string for key generation.
 *
 * @param {unknown} value Candidate key part.
 * @returns {string} Normalized key part.
 */
function normalizeKeyPart(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

/**
 * Normalizes virtual proxy values for cache-key use.
 *
 * @param {unknown} value Candidate virtual proxy value.
 * @returns {string} Normalized virtual proxy key part.
 */
function normalizeVirtualProxyForKey(value) {
    return normalizeKeyPart(value).replace(/^\/+|\/+$/g, '');
}

/**
 * Returns a positive number or fallback.
 *
 * @param {unknown} value Candidate number.
 * @param {number} fallback Fallback value.
 * @returns {number} Positive number.
 */
function toPositiveNumber(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Returns a positive integer or fallback.
 *
 * @param {unknown} value Candidate integer.
 * @param {number} fallback Fallback value.
 * @returns {number} Positive integer.
 */
function toPositiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
}
