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
        jest.useRealTimers();
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

    test('expires entries and runs cleanup', async () => {
        const cleanup = jest.fn();
        const shortTtlAuthConfig = {
            ...authConfig,
            sessionCache: {
                ...authConfig.sessionCache,
                ttlSeconds: 0.001,
            },
        };

        cacheModule.setCachedScreenshotSession(
            shortTtlAuthConfig,
            qpsConfig,
            { name: 'X-Qlik-Session-analytics', value: 'SESSION123' },
            cleanup,
            logger
        );

        expect(
            cacheModule.getCachedScreenshotSession(shortTtlAuthConfig, qpsConfig, logger)
        ).not.toBeNull();

        await new Promise((resolve) => {
            setTimeout(resolve, 10);
        });

        expect(cacheModule.getCachedScreenshotSession(shortTtlAuthConfig, qpsConfig, logger)).toBeNull();
        expect(cleanup).toHaveBeenCalledWith(
            expect.objectContaining({
                cookieName: 'X-Qlik-Session-analytics',
                cookieValue: 'SESSION123',
            }),
            expect.any(String)
        );
    });
});
