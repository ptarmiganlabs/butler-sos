import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import Fastify from 'fastify';

const mockGlobals = {
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    /**
     * Convert an unknown error into a safe loggable string.
     *
     * @param {unknown} err
     *   Possible error value.
     * @returns {string}
     *   Error message.
     */
    getErrorMessage: (err) => (err instanceof Error ? err.message : String(err)),
};

jest.unstable_mockModule('../../globals.js', () => ({
    default: mockGlobals,
}));

jest.unstable_mockModule('../audit-screenshots.js', () => ({
    downloadScreenshot: jest.fn(),
}));

describe('audit-events-api CORS + auth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('allows CORS preflight (OPTIONS) even when apiToken is configured', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'OPTIONS',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'access-control-request-method': 'POST',
                'access-control-request-headers':
                    'content-type,authorization,x-qlik-web-integration-id',
            },
        });

        // Status varies between 200/204 depending on CORS plugin defaults.
        expect([200, 204]).toContain(res.statusCode);
        expect(res.headers['access-control-allow-origin']).toBe('https://qliksense.company.com');
        expect(res.headers['access-control-allow-methods']).toContain('POST');
        expect(res.headers['access-control-allow-headers']).toContain('authorization');
    });

    test('rejects POST without Authorization when apiToken is configured', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-1',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {},
            },
        });

        expect(res.statusCode).toBe(401);
    });
});
