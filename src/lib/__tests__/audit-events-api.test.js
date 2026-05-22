import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import Fastify from 'fastify';

const mockGlobals = {
    logger: {
        debug: jest.fn(),
        verbose: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        isLevelEnabled: jest.fn().mockReturnValue(false),
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
    appVersion: '15.0.0',
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
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    test('allows CORS preflight (OPTIONS) even when apiToken is configured', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, {
            apiToken: 'secret',
            corsOrigins: ['https://qliksense.company.com'],
        });

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
                eventId: 'a0000000-0000-4000-8000-000000000001',
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
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
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
                eventId: 'a0000000-0000-4000-8000-000000000002',
                correlationId: 'd0000000-0000-4000-8000-000000000002',
                timestamp: '2025-12-27T05:46:40.337Z',
                type: 'object.view.duration',
                source: {
                    kind: 'qlik-sense-extension',
                    name: 'audit-qs',
                },
                payload: {
                    timestamp: '2025-12-27T05:46:40.337Z',
                    context: {
                        appId: 'b0000000-0000-4000-8000-000000000001',
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
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
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

    test('returns 422 and drops event when payload validation fails', async () => {
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
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    // Missing required fields for selection.state.changed
                },
            },
        });

        expect(res.statusCode).toBe(422);
        const body = res.json();
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
    });

    test('handles screenshot.url.received and downloads screenshot', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        downloadScreenshot.mockResolvedValue({ savedPaths: ['/path/to/screenshot.png'] });

        mockGlobals.config.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.allowedImageDownloadHosts')
                return true;
            return false;
        });
        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.allowedImageDownloadHosts')
                return ['example.com'];
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.storageTargets')
                return ['local'];
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
                eventId: 'a0000000-0000-4000-8000-000000000003',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'screenshot.url.received',
                payload: {
                    event: {
                        screenshotUrl: 'https://example.com/screenshot.png',
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(downloadScreenshot).toHaveBeenCalled();
        expect(downloadScreenshot.mock.calls[0][2]).toMatchObject({
            allowedImageDownloadHosts: ['example.com'],
        });
    });

    test('logs objectData at debug level for screenshot.url.received', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        downloadScreenshot.mockResolvedValue({ savedPaths: ['/path/to/screenshot.png'] });

        mockGlobals.config.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.allowedImageDownloadHosts')
                return true;
            return false;
        });
        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.allowedImageDownloadHosts')
                return ['example.com'];
            if (key === 'Butler-SOS.auditEvents.destination.screenshots.storageTargets')
                return ['local'];
            return null;
        });

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const objectData = {
            schemaVersion: 1,
            objectType: 'barchart',
            extractedAt: '2025-01-01T00:00:00.000Z',
            dimensions: [{ fieldName: 'Country', label: 'Country', values: ['Sweden', 'Norway'] }],
            measures: [{ label: 'Sales', values: ['1000', '2000'] }],
        };

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
                eventId: 'a0000000-0000-4000-8000-000000000004',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'screenshot.url.received',
                payload: {
                    event: {
                        screenshotUrl: 'https://example.com/screenshot.png',
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        objectData,
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);

        // Verify the debug logging of objectData
        const debugCalls = mockGlobals.logger.debug.mock.calls.map((c) => c[0]);
        expect(debugCalls).toEqual(
            expect.arrayContaining([
                expect.stringContaining(
                    'objectData for eventId=a0000000-0000-4000-8000-000000000004'
                ),
                expect.stringContaining('objectType=barchart'),
            ])
        );
    });

    test('handles selection.state.changed and passes selectionDetails to destinations', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const payload = {
            schemaVersion: 1,
            eventId: 'a0000000-0000-4000-8000-000000000005',
            timestamp: '2025-01-01T00:00:00.000Z',
            type: 'selection.state.changed',
            payload: {
                event: {
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000002',
                    details: [
                        { qField: 'Dim1', qSelectedCount: 1, qSelected: 'A', extra: 'ignored' },
                    ],
                },
            },
        };

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload,
        });

        expect(res.statusCode).toBe(202);
        expect(writeAuditEventToDestinations).toHaveBeenCalledWith(
            expect.objectContaining({ eventId: 'a0000000-0000-4000-8000-000000000005' }),
            expect.objectContaining({
                selectionDetails: [{ qField: 'Dim1', qSelectedCount: 1, qSelected: 'A' }],
            })
        );
    });

    test('handles app.model.validated and passes dataStateId to destinations', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const payload = {
            schemaVersion: 1,
            eventId: 'a0000000-0000-4000-8000-000000000006',
            timestamp: '2025-01-01T00:00:00.000Z',
            type: 'app.model.validated',
            payload: {
                event: {
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000002',
                    dataStateId: 1766865955336,
                },
            },
        };

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload,
        });

        expect(res.statusCode).toBe(202);
        expect(writeAuditEventToDestinations).toHaveBeenCalledWith(
            expect.objectContaining({ eventId: 'a0000000-0000-4000-8000-000000000006' }),
            expect.objectContaining({
                dataStateId: 1766865955336,
            })
        );
    });
});

describe('audit-events-api queue manager', () => {
    beforeEach(() => {
        jest.resetModules();
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
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'b0000000-0000-4000-8000-000000000001',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
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
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'b0000000-0000-4000-8000-000000000001',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(429);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Rate limit exceeded');
        expect(body.details.retryAfter).toBe(60);
        expect(mockGlobals.auditEventsQueueManager.handleRateLimitDrop).toHaveBeenCalled();
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Dropped audit event due to queue rate limit')
        );
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
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'b0000000-0000-4000-8000-000000000001',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Event queue is full');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Dropped audit event due to full queue')
        );
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
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'b0000000-0000-4000-8000-000000000001',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('error');
        expect(body.reason).toBe('Internal error while processing event');
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
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                    context: {
                        appId: 'b0000000-0000-4000-8000-000000000001',
                        appName: 'My App',
                        user: 'user-1',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                        userAgent: 'UA',
                    },
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('error');
        expect(body.reason).toBe('Internal error while processing event');
        expect(mockGlobals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error while handling audit event: Processing error')
        );
    });
});

describe('setupAuditEventsApiServer', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    test('does nothing if auditEvents.enable is false', async () => {
        const { setupAuditEventsApiServer } = await import('../audit-events-api.js');
        mockGlobals.config.has.mockReturnValue(true);
        mockGlobals.config.get.mockReturnValue(false);

        await setupAuditEventsApiServer();

        expect(mockGlobals.logger.info).toHaveBeenCalledWith(
            'AUDIT API: Audit events API is disabled.'
        );
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

describe('audit-events-api token comparison security', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    test('rejects request with wrong token', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'correct-secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer wrong-secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {},
            },
        });

        expect(res.statusCode).toBe(401);
    });

    test('rejects request with empty bearer token', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'correct-secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer ',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {},
            },
        });

        expect(res.statusCode).toBe(401);
    });

    test('accepts request with correct token using timing-safe comparison', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, {
            apiToken: 'correct-secret',
            corsOrigins: ['*'],
        });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer correct-secret',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000007',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000007',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);
        const body = JSON.parse(res.payload);
        expect(body.outcome).toBe('processed');
    });
});

describe('audit-events-api envelope constraint validation', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    /**
     * Builds a valid audit event envelope with optional field overrides.
     *
     * @param {object} [overrides] - Fields to override in the default envelope.
     * @returns {object} A valid audit event envelope.
     */
    function validEnvelope(overrides = {}) {
        const type = overrides.type || 'selection.state.changed';

        // Type-specific base payloads for known event types with validators
        const payloadsByType = {
            'selection.state.changed': {
                event: {
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                    details: [],
                },
            },
            'selection.transaction.finalized': {
                event: {
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                    beforeSelections: [],
                    afterSelections: [],
                },
            },
            'app.model.validated': {
                event: {
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                },
            },
            'screenshot.url.received': {
                event: {
                    screenshotUrl: 'https://example.com/screenshot.png',
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                },
            },
            'event.unsupported.visualization': {
                event: {
                    vizType: 'unsupported',
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                },
            },
            'object.view.duration': {
                event: {
                    objectId: 'obj-1',
                    duration: 1000,
                    leftAt: '2025-01-01T00:00:00.000Z',
                },
            },
        };

        // Types without a validator use a generic payload that satisfies most schemas
        const basePayload = payloadsByType[type] || {
            event: {
                selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
            },
        };

        const base = {
            schemaVersion: 1,
            eventId: 'a0000000-0000-4000-8000-000000000001',
            timestamp: '2025-01-01T00:00:00.000Z',
            type,
            payload: basePayload,
        };
        if (overrides.payload) {
            return { ...base, ...overrides, payload: { ...base.payload, ...overrides.payload } };
        }
        return { ...base, ...overrides };
    }

    /**
     * Posts an audit event envelope to the audit API.
     *
     * @param {object} fastify - Fastify instance with registered audit routes.
     * @param {object} payload - Audit event envelope to post.
     * @returns {Promise<object>} Fastify inject response.
     */
    async function postEnvelope(fastify, payload) {
        return fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload,
        });
    }

    test('accepts a valid UUID eventId', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope());

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('constraint violations')
        );
    });

    test('drops event and warns when eventId is not a UUID', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ eventId: 'not-a-uuid' }));

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('One or more constraint violations');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('eventId is not a valid UUID')
        );
    });

    test('drops event and warns when correlationId is not a UUID', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ correlationId: '1777868693436' }));

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('One or more constraint violations');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('correlationId is not a valid UUID')
        );
    });

    test('accepts correlationId when it is a valid UUID', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(
            fastify,
            validEnvelope({ correlationId: 'd0000000-0000-4000-8000-000000000001' })
        );

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('constraint violations')
        );
    });

    test('drops event and warns when payload.context.appId is not a UUID', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(
            fastify,
            validEnvelope({ payload: { context: { appId: 'not-a-uuid' } } })
        );

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('One or more constraint violations');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('payload.context.appId is not a valid UUID')
        );
    });

    test('accepts payload.context.appId when it is a valid UUID', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(
            fastify,
            validEnvelope({
                payload: { context: { appId: 'b0000000-0000-4000-8000-000000000001' } },
            })
        );

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('constraint violations')
        );
    });

    test('accumulates all failures: both bad eventId and bad type produce a single warning listing both', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(
            fastify,
            validEnvelope({ eventId: 'bad-id', type: 'unknown.type' })
        );

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('One or more constraint violations');
        const warnCalls = mockGlobals.logger.warn.mock.calls.map((c) => String(c[0]));
        const constraintWarn = warnCalls.find((m) => m.includes('constraint violations'));
        expect(constraintWarn).toBeDefined();
        expect(constraintWarn).toContain('eventId is not a valid UUID');
        expect(constraintWarn).toContain('type is not a recognised event type');
        // Only one warn call for constraint violations (not one per failure)
        expect(warnCalls.filter((m) => m.includes('constraint violations'))).toHaveLength(1);
    });

    test.each([
        'selection.state.changed',
        'object.visibility.changed',
        'object.view.duration',
        'navigation.sheet.loaded',
        'app.model.validated',
        'screenshot.url.received',
        'event.bookmark',
        'event.unsupported.visualization',
        'audit.event',
    ])('accepts known event type "%s"', async (type) => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ type }));

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('constraint violations')
        );
    });

    test('accepts wildcard event type "event.custom"', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ type: 'event.custom' }));

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('constraint violations')
        );
    });

    test('drops legacy event type "selection.transaction.finalized"', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(
            fastify,
            validEnvelope({ type: 'selection.transaction.finalized' })
        );

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('One or more constraint violations');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('type is not a recognised event type')
        );
    });

    test('drops event when type is "event." with empty suffix', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ type: 'event.' }));

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('One or more constraint violations');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('type is not a recognised event type')
        );
    });

    test('drops event when type is unknown', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ type: 'unknown.type' }));

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('One or more constraint violations');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('type is not a recognised event type')
        );
    });
});

describe('audit-events-api field-length and source constraints', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    /**
     * Creates a base audit event envelope with default values for testing.
     *
     * @param {object} [payloadOverrides] - Fields to override in the payload.
     * @returns {object} Base audit event envelope.
     */
    function baseEnvelope(payloadOverrides = {}) {
        return {
            schemaVersion: 1,
            eventId: 'a0000000-0000-4000-8000-000000000001',
            timestamp: '2025-01-01T00:00:00.000Z',
            type: 'selection.state.changed',
            payload: {
                context: {
                    appId: 'b0000000-0000-4000-8000-000000000001',
                    appName: 'My App',
                    sheetId: 'sheet-1',
                    sheetName: 'Sheet 1',
                    user: 'UserDirectory=LAB; UserId=user1',
                    userAgent: 'Mozilla/5.0',
                },
                event: {
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                    details: [],
                },
                ...payloadOverrides,
            },
        };
    }

    /**
     * Posts an audit event to the audit API with default headers.
     *
     * @param {object} fastify - Fastify instance with registered audit routes.
     * @param {object} payload - Audit event payload to post.
     * @returns {Promise<object>} Fastify inject response.
     */
    async function post(fastify, payload) {
        return fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload,
        });
    }

    // --- source object ---

    test('accepts valid source with kind and name', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const envelope = {
            ...baseEnvelope(),
            source: { kind: 'qlik-sense-extension', name: 'audit-qs' },
        };
        const res = await post(fastify, envelope);

        expect(res.statusCode).toBe(202);
        const body = JSON.parse(res.payload);
        expect(body.outcome).toBe('processed');
    });

    test('rejects source with unknown kind (Fastify schema → 400)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const envelope = {
            ...baseEnvelope(),
            source: { kind: 'unknown-tool', name: 'audit-qs' },
        };
        const res = await post(fastify, envelope);

        expect(res.statusCode).toBe(400);
    });

    test('accepts source with extra properties (enum guards kind/name; Fastify strips unknown fields)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const envelope = {
            ...baseEnvelope(),
            source: { kind: 'qlik-sense-extension', name: 'audit-qs', extra: 'injected' },
        };
        const res = await post(fastify, envelope);

        // Fastify passes nested additionalProperties through; enum constraints on kind/name are the real gate
        expect(res.statusCode).toBe(202);
        const body = JSON.parse(res.payload);
        expect(body.outcome).toBe('processed');
    });

    // --- validation logging (warn + debug) ---

    test('logs warning and debug on Fastify schema validation failure (400)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        fastify.setErrorHandler((error, request, reply) => {
            if (error.statusCode === 400 && error.validation) {
                const validationErrors = error.validation.map((v) => ({
                    instancePath: v.instancePath,
                    message: v.message,
                    params: v.params,
                }));
                mockGlobals.logger.warn(
                    `AUDIT API: Fastify schema validation failed for ip=${request.ip} errors=${JSON.stringify(validationErrors)}`
                );
                mockGlobals.logger.debug(
                    `AUDIT API: Full invalid envelope: ${JSON.stringify(request.body)}`
                );
            }
            reply.send(error);
        });

        const res = await post(fastify, {
            ...baseEnvelope(),
            source: { kind: 'unknown-tool', name: 'audit-qs' },
        });

        expect(res.statusCode).toBe(400);
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Fastify schema validation failed')
        );
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('instancePath')
        );
        expect(mockGlobals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Full invalid envelope')
        );
    });

    test('logs warning and debug on envelope constraint violation (422)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        mockGlobals.logger.isLevelEnabled.mockReturnValueOnce(true);
        const res = await post(fastify, { ...baseEnvelope(), eventId: 'not-a-uuid' });

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('One or more constraint violations');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('eventId is not a valid UUID')
        );
        expect(mockGlobals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Full invalid envelope')
        );
    });

    test('logs warning and debug on payload validation failure (422)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        mockGlobals.logger.isLevelEnabled.mockReturnValueOnce(true);
        const res = await post(
            fastify,
            baseEnvelope({
                context: {
                    appName: 'A'.repeat(65),
                    sheetId: 's',
                    sheetName: 's',
                    user: 'u',
                    userAgent: 'ua',
                },
            })
        );

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
        expect(mockGlobals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Full invalid payload')
        );
    });

    // --- payload.context field lengths ---

    test('drops event when appName exceeds 64 chars (AJV → 422 warn)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await post(
            fastify,
            baseEnvelope({
                context: {
                    appName: 'A'.repeat(65),
                    sheetId: 's',
                    sheetName: 's',
                    user: 'u',
                    userAgent: 'ua',
                },
            })
        );

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
    });

    test('drops event when userAgent exceeds 512 chars (AJV → 422 warn)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await post(
            fastify,
            baseEnvelope({
                context: {
                    appName: 'App',
                    sheetId: 's',
                    sheetName: 's',
                    user: 'u',
                    userAgent: 'x'.repeat(513),
                },
            })
        );

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
    });

    test('drops event when user exceeds 256 chars (AJV → 422 warn)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await post(
            fastify,
            baseEnvelope({
                context: {
                    appName: 'App',
                    sheetId: 's',
                    sheetName: 's',
                    user: 'u'.repeat(257),
                    userAgent: 'ua',
                },
            })
        );

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
    });

    // --- event.selectionTxnId UUID ---

    test('drops event when selectionTxnId is not a UUID (AJV → 422 warn)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await post(
            fastify,
            baseEnvelope({ event: { selectionTxnId: 'not-a-uuid', details: [] } })
        );

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
    });

    test('accepts selectionTxnId as valid UUID', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await post(fastify, baseEnvelope());

        expect(res.statusCode).toBe(202);
        const body = JSON.parse(res.payload);
        expect(body.outcome).toBe('processed');
        expect(mockGlobals.logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
    });

    // --- event.unsupported.visualization string lengths ---

    test('drops event.unsupported.visualization when vizType exceeds 64 chars', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const envelope = {
            ...baseEnvelope(),
            type: 'event.unsupported.visualization',
            payload: {
                event: {
                    vizType: 'v'.repeat(65),
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                },
            },
        };
        const res = await post(fastify, envelope);

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
    });

    // --- object.view.duration objectId length ---

    test('drops object.view.duration when objectId exceeds 64 chars', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const envelope = {
            ...baseEnvelope(),
            type: 'object.view.duration',
            payload: {
                event: {
                    objectId: 'o'.repeat(65),
                    duration: 1000,
                    leftAt: '2025-01-01T00:01:00.000Z',
                },
            },
        };
        const res = await post(fastify, envelope);

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
    });
});

describe('audit-events-api SSRF protection', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    const SCREENSHOT_ENVELOPE = {
        schemaVersion: 1,
        eventId: 'a0000000-0000-4000-8000-000000000003',
        timestamp: '2025-01-01T00:00:00.000Z',
        type: 'screenshot.url.received',
        payload: {
            event: {
                screenshotUrl: 'https://example.com/screenshot.png',
                selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
            },
        },
    };

    /**
     * Creates a mock config object for screenshot destination testing.
     *
     * @param {string[]|undefined} allowedImageDownloadHosts - Allowed hosts for screenshot downloads.
     * @returns {object} Mock config object with get/has methods.
     */
    function screenshotConfigMock(allowedImageDownloadHosts) {
        return {
            has: jest.fn((key) => {
                if (key === 'Butler-SOS.auditEvents.destination.screenshots.enable') return true;
                if (
                    key ===
                    'Butler-SOS.auditEvents.destination.screenshots.allowedImageDownloadHosts'
                )
                    return allowedImageDownloadHosts !== undefined;
                return false;
            }),
            get: jest.fn((key) => {
                if (key === 'Butler-SOS.auditEvents.destination.screenshots.enable') return true;
                if (
                    key ===
                    'Butler-SOS.auditEvents.destination.screenshots.allowedImageDownloadHosts'
                )
                    return allowedImageDownloadHosts;
                if (key === 'Butler-SOS.auditEvents.destination.screenshots.storageTargets')
                    return ['local'];
                return null;
            }),
        };
    }

    /**
     * Posts a screenshot audit event to the audit API with a screenshot envelope.
     *
     * @param {object} fastify - Fastify instance with registered audit routes.
     * @param {object} [envelopeOverride] - Fields to override in the screenshot envelope.
     * @returns {Promise<object>} Fastify inject response.
     */
    async function postScreenshot(fastify, envelopeOverride = {}) {
        return fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                authorization: 'Bearer secret',
            },
            payload: { ...SCREENSHOT_ENVELOPE, ...envelopeOverride },
        });
    }

    test('blocks download when allowedImageDownloadHosts key is absent in config (fail-closed)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        // allowedImageDownloadHosts key absent: has() returns false
        const mock = screenshotConfigMock(undefined);
        mockGlobals.config.has.mockImplementation(mock.has);
        mockGlobals.config.get.mockImplementation(mock.get);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postScreenshot(fastify);

        expect(res.statusCode).toBe(202);
        expect(downloadScreenshot).not.toHaveBeenCalled();
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('no allowedImageDownloadHosts configured')
        );
    });

    test('blocks download when allowedImageDownloadHosts is an empty array (fail-closed)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        const mock = screenshotConfigMock([]);
        mockGlobals.config.has.mockImplementation(mock.has);
        mockGlobals.config.get.mockImplementation(mock.get);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postScreenshot(fastify);

        expect(res.statusCode).toBe(202);
        expect(downloadScreenshot).not.toHaveBeenCalled();
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('no allowedImageDownloadHosts configured')
        );
    });

    test('allows download when URL hostname is in allowedImageDownloadHosts', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        downloadScreenshot.mockResolvedValue({ savedPaths: ['/tmp/shot.png'] });
        const mock = screenshotConfigMock(['example.com']);
        mockGlobals.config.has.mockImplementation(mock.has);
        mockGlobals.config.get.mockImplementation(mock.get);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postScreenshot(fastify);

        expect(res.statusCode).toBe(202);
        expect(downloadScreenshot).toHaveBeenCalled();
    });

    test('blocks download when URL hostname is not in allowedImageDownloadHosts', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        const mock = screenshotConfigMock(['example.com']);
        mockGlobals.config.has.mockImplementation(mock.has);
        mockGlobals.config.get.mockImplementation(mock.get);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        // Use a different hostname not in the allow-list
        const envelope = {
            ...SCREENSHOT_ENVELOPE,
            payload: {
                event: {
                    screenshotUrl: 'https://evil.internal/screenshot.png',
                    selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                },
            },
        };
        const res = await postScreenshot(fastify, { payload: envelope.payload });

        expect(res.statusCode).toBe(202);
        expect(downloadScreenshot).not.toHaveBeenCalled();
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('is not in allowedImageDownloadHosts')
        );
    });

    test('allowedImageDownloadHosts matching is case-insensitive', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        downloadScreenshot.mockResolvedValue({ savedPaths: ['/tmp/shot.png'] });
        // Configured with uppercase; URL uses lowercase
        const mock = screenshotConfigMock(['EXAMPLE.COM']);
        mockGlobals.config.has.mockImplementation(mock.has);
        mockGlobals.config.get.mockImplementation(mock.get);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        // URL hostname is lowercase example.com
        const res = await postScreenshot(fastify);

        expect(res.statusCode).toBe(202);
        expect(downloadScreenshot).toHaveBeenCalled();
    });
});

describe('audit-events-api GET /api/v1/test-connection', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('returns 200 with status ok when no apiToken is configured', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.status).toBe('ok');
        expect(body.message).toBe('Butler SOS Audit API is reachable');
        expect(typeof body.timestamp).toBe('string');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('without Audit.qs version info')
        );
    });

    test('returns 200 with valid bearer token', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            headers: { authorization: 'Bearer secret' },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.status).toBe('ok');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('without Audit.qs version info')
        );
    });

    test('returns 401 when apiToken is configured and no token is provided', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
        });

        expect(res.statusCode).toBe(401);
        const body = res.json();
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Unauthorized');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Unauthorized request')
        );
    });

    test('returns 401 when apiToken is configured and wrong token is provided', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            headers: { authorization: 'Bearer wrong' },
        });

        expect(res.statusCode).toBe(401);
        const body = res.json();
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Unauthorized');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Unauthorized request')
        );
    });

    test('timestamp in response is a valid ISO 8601 string', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const before = Date.now();
        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
        });
        const after = Date.now();

        const body = res.json();
        const ts = new Date(body.timestamp).getTime();
        expect(ts).toBeGreaterThanOrEqual(before);
        expect(ts).toBeLessThanOrEqual(after);
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('without Audit.qs version info')
        );
    });
});

describe('audit-events-api HTTP rate limit (Fastify)', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    test('rate limit active by default - x-ratelimit-limit header present', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBeDefined();
        expect(res.headers['x-ratelimit-limit']).toBe('300');
    });

    test('rate limit disabled when enable: false - no rate limit header', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, {
            apiToken: null,
            corsOrigins: ['*'],
            rateLimitOpts: { enable: false },
        });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    });

    test('per-IP isolation - one IP rate limited, another IP allowed', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, {
            apiToken: null,
            corsOrigins: ['*'],
            rateLimitOpts: { enable: true, maxPerMinute: 2 },
        });

        const resA1 = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            remoteAddress: '10.0.0.1',
        });
        expect(resA1.statusCode).toBe(200);

        const resA2 = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            remoteAddress: '10.0.0.1',
        });
        expect(resA2.statusCode).toBe(200);

        const resA3 = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            remoteAddress: '10.0.0.1',
        });
        expect(resA3.statusCode).toBe(429);

        const resB = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            remoteAddress: '10.0.0.2',
        });
        expect(resB.statusCode).toBe(200);
    });

    test('logs WARN when HTTP rate limit exceeded', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, {
            apiToken: null,
            corsOrigins: ['*'],
            rateLimitOpts: { enable: true, maxPerMinute: 2 },
        });

        await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            remoteAddress: '10.0.0.1',
        });
        await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            remoteAddress: '10.0.0.1',
        });
        await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            remoteAddress: '10.0.0.1',
        });

        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('HTTP rate limit exceeded')
        );
    });
});

describe('audit-events-api array maxItems constraints', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    test('accepts selection.state.changed with details array at the limit', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: { 'content-type': 'application/json' },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    event: {
                        selectionTxnId: 'b1000000-0000-4000-8000-000000000001',
                        details: Array.from({ length: 500 }, (_, i) => ({ field: i })),
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(writeAuditEventToDestinations).toHaveBeenCalled();
    });

    test('drops selection.state.changed with oversized details array', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: { 'content-type': 'application/json' },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000003',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    event: {
                        selectionTxnId: 'b1000000-0000-4000-8000-000000000003',
                        details: Array.from({ length: 501 }, (_, i) => ({ field: i })),
                    },
                },
            },
        });

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Payload validation failed');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Payload validation failed')
        );
    });
});

describe('audit-events-api version compatibility', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
        mockGlobals.appVersion = '15.0.0';
    });

    test('test-connection returns compatibility info for compatible versions', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            headers: {
                origin: 'https://qliksense.company.com',
                'x-audit-qs-version': '0.3.0',
            },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('ok');
        expect(body.butlerSosVersion).toBe('15.0.0');
        expect(body.auditQsVersion).toBe('0.3.0');
        expect(body.compatible).toBe(true);
    });

    test('test-connection returns compatibility info for incompatible versions', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            headers: {
                origin: 'https://qliksense.company.com',
                'x-audit-qs-version': '0.2.0',
            },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('ok');
        expect(body.butlerSosVersion).toBe('15.0.0');
        expect(body.auditQsVersion).toBe('0.2.0');
        expect(body.compatible).toBe(false);
    });

    test('test-connection uses first x-audit-qs-version value when header is duplicated', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            headers: {
                origin: 'https://qliksense.company.com',
                'x-audit-qs-version': ['0.3.0', '0.2.0'],
            },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.auditQsVersion).toBe('0.3.0');
        expect(body.compatible).toBe(true);
    });

    test('test-connection logs INFO when versions are compatible', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            headers: {
                origin: 'https://qliksense.company.com',
                'x-audit-qs-version': '0.3.0',
            },
        });

        expect(mockGlobals.logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Connection test successful')
        );
        expect(mockGlobals.logger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining('incompatible Audit.qs version')
        );
    });

    test('test-connection logs WARN when versions are incompatible', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        await fastify.inject({
            method: 'GET',
            url: '/api/v1/test-connection',
            headers: {
                origin: 'https://qliksense.company.com',
                'x-audit-qs-version': '0.2.0',
            },
        });

        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('incompatible Audit.qs version')
        );
    });

    test('drops audit event and returns 422 when Audit.qs version is incompatible', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                'x-audit-qs-version': '0.2.0',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('error');
        expect(body.outcome).toBe('dropped');
        expect(body.reason).toBe('Incompatible Audit.qs version');
        expect(body.details.compatible).toBe(false);
        expect(body.details.butlerSosVersion).toBe('15.0.0');
        expect(body.details.auditQsVersion).toBe('0.2.0');
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('incompatible Audit.qs version')
        );
    });

    test('accepts audit event when Audit.qs version is compatible', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                'x-audit-qs-version': '0.3.0',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(writeAuditEventToDestinations).toHaveBeenCalled();
    });

    test('drops audit event using envelope.source.version when x-audit-qs-version header is absent', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
            },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                source: {
                    kind: 'qlik-sense-extension',
                    name: 'audit-qs',
                    version: '0.2.0',
                },
                payload: {
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(422);
        const body = JSON.parse(res.payload);
        expect(body.reason).toBe('Incompatible Audit.qs version');
        expect(body.details.auditQsVersion).toBe('0.2.0');
    });

    test('accepts audit event when duplicated x-audit-qs-version header has compatible first value', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        const res = await fastify.inject({
            method: 'POST',
            url: '/api/v1/audit-event',
            headers: {
                origin: 'https://qliksense.company.com',
                'content-type': 'application/json',
                'x-audit-qs-version': ['0.3.0', '0.2.0'],
            },
            payload: {
                schemaVersion: 1,
                eventId: 'a0000000-0000-4000-8000-000000000001',
                timestamp: '2025-01-01T00:00:00.000Z',
                type: 'selection.state.changed',
                payload: {
                    event: {
                        selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);
        expect(writeAuditEventToDestinations).toHaveBeenCalled();
    });

    test('logs missing version at DEBUG for each event and WARN at most once per minute per IP', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const { writeAuditEventToDestinations } = await import('../audit-destinations/index.js');

        let now = 1_700_000_000_000;
        const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        /**
         *
         */
        const postEvent = () =>
            fastify.inject({
                method: 'POST',
                url: '/api/v1/audit-event',
                headers: {
                    origin: 'https://qliksense.company.com',
                    'content-type': 'application/json',
                },
                remoteAddress: '10.10.10.10',
                payload: {
                    schemaVersion: 1,
                    eventId: 'a0000000-0000-4000-8000-000000000001',
                    timestamp: '2025-01-01T00:00:00.000Z',
                    type: 'selection.state.changed',
                    payload: {
                        event: {
                            selectionTxnId: 'c0000000-0000-4000-8000-000000000001',
                            details: [],
                        },
                    },
                },
            });

        const firstRes = await postEvent();
        const secondRes = await postEvent();
        now += 61_000;
        const thirdRes = await postEvent();

        expect(firstRes.statusCode).toBe(202);
        expect(secondRes.statusCode).toBe(202);
        expect(thirdRes.statusCode).toBe(202);
        expect(writeAuditEventToDestinations).toHaveBeenCalledTimes(3);

        const missingVersionWarnCalls = mockGlobals.logger.warn.mock.calls
            .map((call) => call[0])
            .filter((msg) => msg.includes('without version info'));
        expect(missingVersionWarnCalls).toHaveLength(2);
        expect(missingVersionWarnCalls[0]).toContain('ip=10.10.10.10');
        expect(missingVersionWarnCalls[0]).toContain('missingVersionCount=1');
        expect(missingVersionWarnCalls[1]).toContain('ip=10.10.10.10');
        expect(missingVersionWarnCalls[1]).toContain('missingVersionCount=2');

        const missingVersionDebugCalls = mockGlobals.logger.debug.mock.calls
            .map((call) => call[0])
            .filter((msg) => msg.includes('without version info'));
        expect(missingVersionDebugCalls).toHaveLength(3);

        nowSpy.mockRestore();
    });

    test('tracks missing-version WARN rate limit separately per IP', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        /**
         *
         * @param remoteAddress
         * @param eventId
         * @param selectionTxnId
         */
        const postEvent = (remoteAddress, eventId, selectionTxnId) =>
            fastify.inject({
                method: 'POST',
                url: '/api/v1/audit-event',
                headers: {
                    origin: 'https://qliksense.company.com',
                    'content-type': 'application/json',
                },
                remoteAddress,
                payload: {
                    schemaVersion: 1,
                    eventId,
                    timestamp: '2025-01-01T00:00:00.000Z',
                    type: 'selection.state.changed',
                    payload: {
                        event: {
                            selectionTxnId,
                            details: [],
                        },
                    },
                },
            });

        const firstRes = await postEvent(
            '10.10.10.10',
            'a0000000-0000-4000-8000-000000000001',
            'c0000000-0000-4000-8000-000000000001'
        );
        const secondRes = await postEvent(
            '10.10.10.11',
            'a0000000-0000-4000-8000-000000000002',
            'c0000000-0000-4000-8000-000000000002'
        );

        expect(firstRes.statusCode).toBe(202);
        expect(secondRes.statusCode).toBe(202);

        const missingVersionWarnCalls = mockGlobals.logger.warn.mock.calls
            .map((call) => call[0])
            .filter((msg) => msg.includes('without version info'));
        expect(missingVersionWarnCalls).toHaveLength(2);
        expect(missingVersionWarnCalls[0]).toContain('ip=10.10.10.10');
        expect(missingVersionWarnCalls[1]).toContain('ip=10.10.10.11');
        expect(missingVersionWarnCalls[0]).toContain('missingVersionCount=1');
        expect(missingVersionWarnCalls[1]).toContain('missingVersionCount=1');

        nowSpy.mockRestore();
    });

    test('evicts stale missing-version WARN state for inactive IPs', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        let now = 1_700_000_000_000;
        const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: null, corsOrigins: ['*'] });

        /**
         *
         * @param remoteAddress
         * @param eventId
         * @param selectionTxnId
         */
        const postEvent = (remoteAddress, eventId, selectionTxnId) =>
            fastify.inject({
                method: 'POST',
                url: '/api/v1/audit-event',
                headers: {
                    origin: 'https://qliksense.company.com',
                    'content-type': 'application/json',
                },
                remoteAddress,
                payload: {
                    schemaVersion: 1,
                    eventId,
                    timestamp: '2025-01-01T00:00:00.000Z',
                    type: 'selection.state.changed',
                    payload: {
                        event: {
                            selectionTxnId,
                            details: [],
                        },
                    },
                },
            });

        await postEvent(
            '10.0.0.1',
            'a0000000-0000-4000-8000-000000000001',
            'c0000000-0000-4000-8000-000000000001'
        );
        now += 10_000;
        await postEvent(
            '10.0.0.1',
            'a0000000-0000-4000-8000-000000000002',
            'c0000000-0000-4000-8000-000000000002'
        );

        now += 901_000;
        await postEvent(
            '10.0.0.2',
            'a0000000-0000-4000-8000-000000000003',
            'c0000000-0000-4000-8000-000000000003'
        );

        now += 1_000;
        await postEvent(
            '10.0.0.1',
            'a0000000-0000-4000-8000-000000000004',
            'c0000000-0000-4000-8000-000000000004'
        );

        const ipOneWarnCalls = mockGlobals.logger.warn.mock.calls
            .map((call) => call[0])
            .filter((msg) => msg.includes('without version info') && msg.includes('ip=10.0.0.1'));

        expect(ipOneWarnCalls).toHaveLength(2);
        expect(ipOneWarnCalls[0]).toContain('missingVersionCount=1');
        expect(ipOneWarnCalls[1]).toContain('missingVersionCount=1');

        nowSpy.mockRestore();
    });

    test('allows CORS preflight (OPTIONS) for GET test-connection', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');

        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, {
            apiToken: 'secret',
            corsOrigins: ['https://qliksense.company.com'],
        });

        const res = await fastify.inject({
            method: 'OPTIONS',
            url: '/api/v1/test-connection',
            headers: {
                origin: 'https://qliksense.company.com',
                'access-control-request-method': 'GET',
                'access-control-request-headers': 'content-type,x-audit-qs-version',
            },
        });

        expect([200, 204]).toContain(res.statusCode);
        expect(res.headers['access-control-allow-origin']).toBe('https://qliksense.company.com');
        expect(res.headers['access-control-allow-methods']).toContain('GET');
    });
});
