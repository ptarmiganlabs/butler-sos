import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import Fastify from 'fastify';

const mockGlobals = {
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    config: {
        has: jest.fn(),
        get: jest.fn(),
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
    getLoggingLevel: jest.fn().mockReturnValue('info'),
    auditEventsQueueManager: null,
};

jest.unstable_mockModule('../../globals.js', () => ({
    default: mockGlobals,
}));

jest.unstable_mockModule('../audit-screenshots.js', () => ({
    downloadScreenshot: jest.fn(),
}));

jest.unstable_mockModule('../audit-destinations/index.js', () => ({
    writeAuditEventToDestinations: jest.fn(),
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

describe('audit-events-api event types', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('accepts object.view.duration and logs concise info (no full envelope log)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-visibility-1',
                correlationId: 'txn-1',
                timestamp: '2025-12-27T05:46:40.337Z',
                type: 'object.view.duration',
                source: {
                    kind: 'qlik-sense-extension',
                    name: 'butler-sos-audit',
                },
                payload: {
                    timestamp: '2025-12-27T05:46:40.337Z',
                    context: {
                        appId: 'app-1',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        type: 'view.duration',
                        objectId: 'obj-1',
                        enteredAt: '2025-12-27T05:46:20.337Z',
                        leftAt: '2025-12-27T05:46:40.337Z',
                        duration: 20000,
                        visible: false,
                        selectionTxnId: 'txn-1',
                        enterSelectionTxnId: 'txn-0',
                        leaveSelectionTxnId: 'txn-1',
                        dataStateId: 123,
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);

        expect(mockGlobals.logger.info).toHaveBeenCalled();
        const infoMsgs = mockGlobals.logger.info.mock.calls.map((c) => String(c[0]));
        expect(infoMsgs.some((m) => m.includes('AUDIT API: object.view.duration'))).toBe(true);
        expect(infoMsgs.some((m) => m.includes('AUDIT API: Full envelope:'))).toBe(false);

        expect(writeAuditEventToDestinations).toHaveBeenCalled();
    });

    test('returns 202 and drops event when payload validation fails', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-1',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    // Missing required fields for selection.state.changed
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(res.json().status).toBe('accepted');
    });

    test('handles screenshot.url.received and downloads screenshot', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        downloadScreenshot.mockResolvedValue({ savedPaths: ['/path/to/screenshot.png'] });

        mockGlobals.config.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.screenshots.enable') return true;
            return false;
        });
        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.screenshots.enable') return true;
            if (key === 'Butler-SOS.auditEvents.screenshots.storageTargets') return ['local'];
            return null;
        });

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-screenshot-1',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'screenshot.url.received',
                payload: {
                    event: {
                        screenshotUrl: 'https://example.com/screenshot.png',
                        selectionTxnId: 'txn-1',
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(downloadScreenshot).toHaveBeenCalled();
    });
});

describe('audit-events-api queue manager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGlobals.auditEventsQueueManager = {
            checkRateLimit: jest.fn().mockReturnValue(true),
            handleRateLimitDrop: jest.fn().mockResolvedValue(true),
            addToQueue: jest.fn().mockImplementation(async (fn) => {
                await fn();
                return true;
            }),
        };
    });

    afterEach(() => {
        mockGlobals.auditEventsQueueManager = null;
    });

    test('enqueues event when queue manager is present', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-1',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'app-1',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'txn-1',
                        details: [],
                    }
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.auditEventsQueueManager.addToQueue).toHaveBeenCalled();
        expect(writeAuditEventToDestinations).toHaveBeenCalled();
    });

    test('drops event when rate limit exceeded', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        mockGlobals.auditEventsQueueManager.checkRateLimit.mockReturnValue(false);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-1',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'app-1',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'txn-1',
                        details: [],
                    }
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.auditEventsQueueManager.handleRateLimitDrop).toHaveBeenCalled();
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Dropped audit event due to queue rate limit'));
    });

    test('logs warning when queue is full', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        mockGlobals.auditEventsQueueManager.addToQueue.mockResolvedValue(false);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-1',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'app-1',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'txn-1',
                        details: [],
                    }
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Dropped audit event due to full queue'));
    });

    test('logs error when queue manager throws', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        mockGlobals.auditEventsQueueManager.addToQueue.mockRejectedValue(new Error('Queue error'));

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-1',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'app-1',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'txn-1',
                        details: [],
                    }
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error while enqueueing audit event: Queue error')
        );
    });

    test('logs error when processing fails (no queue manager)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');
        writeAuditEventToDestinations.mockRejectedValue(new Error('Processing error'));

        mockGlobals.auditEventsQueueManager = null;

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'evt-1',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'app-1',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'txn-1',
                        details: [],
                    }
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error while handling audit event: Processing error')
        );
    });
});

describe('setupAuditEventsApiServer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('does nothing if auditEvents.enable is false', async () => {
        const { setupAuditEventsApiServer } = await import('../audit-events-api.js');
        mockGlobals.config.has.mockReturnValue(true);
        mockGlobals.config.get.mockReturnValue(false);

        await setupAuditEventsApiServer();

        expect(mockGlobals.logger.info).toHaveBeenCalledWith('AUDIT API: Audit events API is disabled.');
    });

    test('logs error when setup fails', async () => {
        const { setupAuditEventsApiServer } = await import('../audit-events-api.js');
        mockGlobals.config.has.mockReturnValue(true);
        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.enable') return true;
            throw new Error('Config error');
        });

        await expect(setupAuditEventsApiServer()).rejects.toThrow('Config error');
        expect(mockGlobals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('AUDIT API: Error setting up audit events API: Config error')
        );
    });
});
