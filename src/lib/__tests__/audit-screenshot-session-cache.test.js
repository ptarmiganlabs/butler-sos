import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

let cacheModule;

const authConfig = {
    mode: 'userTicket',
    sessionCache: {
        enable: true,
        ttlSeconds: 1,
        maxEntries: 10,
    },
};

const qpsConfig = {
    host: 'Qlik.EXAMPLE.com',
    port: 4243,
    userDirectory: 'LAB',
    userId: 'goran',
    virtualProxy: '/analytics/',
};

const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
};

describe('audit-screenshot-session-cache', () => {
    beforeEach(async () => {
        jest.resetModules();
        // lru-cache captures globalThis.performance at module-evaluation time and uses it
        // as its TTL clock, so fake timers must be installed before the import below.
        jest.useFakeTimers();
        // performance.now() starts at 0 under fake timers, and lru-cache treats a start
        // timestamp of 0 as "no TTL", so move the clock off zero before anything is cached.
        jest.advanceTimersByTime(1000);
        jest.clearAllMocks();

        cacheModule = await import('../audit-screenshot-session-cache.js');
        cacheModule.clearScreenshotSessionCache({ cleanup: false });
    });

    afterEach(() => {
        cacheModule?.clearScreenshotSessionCache({ cleanup: false });
        jest.useRealTimers();
    });

    test('normalizes cache settings and disables caching for mode none', () => {
        expect(
            cacheModule.normalizeScreenshotSessionCacheConfig({
                mode: 'none',
                sessionCache: { enable: true, ttlSeconds: 30, maxEntries: 5 },
            })
        ).toEqual({ enabled: false, ttlSeconds: 30, maxEntries: 5 });

        expect(
            cacheModule.normalizeScreenshotSessionCacheConfig({
                mode: 'qpsTicket',
                sessionCache: { enable: true, ttlSeconds: 0, maxEntries: 0 },
            })
        ).toEqual({ enabled: true, ttlSeconds: 120, maxEntries: 100 });
    });

    test('builds stable keys and separates users', () => {
        const firstKey = cacheModule.buildScreenshotSessionCacheKey('userTicket', qpsConfig);
        const equivalentKey = cacheModule.buildScreenshotSessionCacheKey('userTicket', {
            ...qpsConfig,
            host: 'qlik.example.com',
            virtualProxy: 'analytics',
        });
        const otherUserKey = cacheModule.buildScreenshotSessionCacheKey('userTicket', {
            ...qpsConfig,
            userId: 'anna',
        });

        expect(firstKey).toBe(equivalentKey);
        expect(firstKey).not.toBe(otherUserKey);
    });

    test('stores and returns cached sessions', () => {
        const cleanup = jest.fn();

        const stored = cacheModule.setCachedScreenshotSession(
            authConfig,
            qpsConfig,
            { name: 'X-Qlik-Session-analytics', value: 'SESSION123' },
            cleanup,
            logger
        );

        const cached = cacheModule.getCachedScreenshotSession(authConfig, qpsConfig, logger);

        expect(stored).toMatchObject({
            cookieName: 'X-Qlik-Session-analytics',
            cookieValue: 'SESSION123',
            cookieHeader: 'X-Qlik-Session-analytics=SESSION123',
        });
        expect(cached).toMatchObject(stored);
        expect(cacheModule.getScreenshotSessionCacheStats()).toMatchObject({ size: 1, max: 10 });
    });

    test('does not return sessions for a different user', () => {
        cacheModule.setCachedScreenshotSession(
            authConfig,
            qpsConfig,
            { name: 'X-Qlik-Session-analytics', value: 'SESSION123' },
            jest.fn(),
            logger
        );

        expect(
            cacheModule.getCachedScreenshotSession(
                authConfig,
                { ...qpsConfig, userId: 'anna' },
                logger
            )
        ).toBeNull();
    });

    test('expires entries and runs cleanup', () => {
        const cleanup = jest.fn();
        const expiringAuthConfig = {
            ...authConfig,
            sessionCache: {
                ...authConfig.sessionCache,
                ttlSeconds: 5,
            },
        };

        cacheModule.setCachedScreenshotSession(
            expiringAuthConfig,
            qpsConfig,
            { name: 'X-Qlik-Session-analytics', value: 'SESSION123' },
            cleanup,
            logger
        );

        expect(
            cacheModule.getCachedScreenshotSession(expiringAuthConfig, qpsConfig, logger)
        ).not.toBeNull();

        // Past the TTL, and past the ttl+1 point where lru-cache arms its autopurge timer.
        jest.advanceTimersByTime(5001);

        expect(
            cacheModule.getCachedScreenshotSession(expiringAuthConfig, qpsConfig, logger)
        ).toBeNull();
        expect(cleanup).toHaveBeenCalledWith(
            expect.objectContaining({
                cookieName: 'X-Qlik-Session-analytics',
                cookieValue: 'SESSION123',
            }),
            expect.any(String)
        );
    });

    test.each([
        ['sub-millisecond precision', 1.0005, 1001],
        ['many decimals', 2.33333, 2333],
        ['below one millisecond', 0.0001, 1],
    ])('caches with a fractional ttlSeconds (%s)', (_name, ttlSeconds, expectedTtlMs) => {
        const fractionalTtlAuthConfig = {
            ...authConfig,
            sessionCache: { ...authConfig.sessionCache, ttlSeconds },
        };

        const stored = cacheModule.setCachedScreenshotSession(
            fractionalTtlAuthConfig,
            qpsConfig,
            { name: 'X-Qlik-Session-analytics', value: 'SESSION123' },
            jest.fn(),
            logger
        );

        // A non-integer ttl in milliseconds is rejected by the LRU cache, and a ttl of 0
        // means "never expires" there, so both are normalized away before it is used.
        expect(stored).not.toBeNull();
        expect(stored.expiresAt - stored.createdAt).toBe(expectedTtlMs);
        expect(cacheModule.getScreenshotSessionCacheStats()).toMatchObject({
            ttl: expectedTtlMs,
        });
        expect(
            cacheModule.getCachedScreenshotSession(fractionalTtlAuthConfig, qpsConfig, logger)
        ).not.toBeNull();
    });

    test('still expires an entry stored with a fractional ttlSeconds', () => {
        const cleanup = jest.fn();
        const fractionalTtlAuthConfig = {
            ...authConfig,
            sessionCache: { ...authConfig.sessionCache, ttlSeconds: 2.33333 },
        };

        cacheModule.setCachedScreenshotSession(
            fractionalTtlAuthConfig,
            qpsConfig,
            { name: 'X-Qlik-Session-analytics', value: 'SESSION123' },
            cleanup,
            logger
        );

        jest.advanceTimersByTime(2334);

        expect(
            cacheModule.getCachedScreenshotSession(fractionalTtlAuthConfig, qpsConfig, logger)
        ).toBeNull();
        expect(cleanup).toHaveBeenCalled();
    });
});
