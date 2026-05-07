import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import Fastify from 'fastify';

const mockGlobals = {
    logger: {
        debug: jest.fn(),
        verbose: jest.fn(),
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
                eventId: 'a0000000-0000-4000-8000-000000000002',
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
                eventId: 'a0000000-0000-4000-8000-000000000001',
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
                eventId: 'a0000000-0000-4000-8000-000000000003',
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

    test('logs objectData at debug level for screenshot.url.received', async () => {
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
                        selectionTxnId: 'txn-1',
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
                expect.stringContaining('objectData for eventId=a0000000-0000-4000-8000-000000000004'),
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
                    selectionTxnId: 'txn-123',
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
                    selectionTxnId: 'txn-123',
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
                        selectionTxnId: 'txn-1',
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
                        selectionTxnId: 'txn-1',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);
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
                        selectionTxnId: 'txn-1',
                        details: [],
                    },
                },
            },
        });

        expect(res.statusCode).toBe(202);
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
                        selectionTxnId: 'txn-1',
                        details: [],
                    },
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
                        selectionTxnId: 'txn-1',
                        details: [],
                    },
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
        jest.clearAllMocks();
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
                payload: {},
            },
        });

        expect(res.statusCode).toBe(202);
    });
});

describe('audit-events-api envelope constraint validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGlobals.config.has.mockReturnValue(false);
        mockGlobals.config.get.mockReturnValue(undefined);
        mockGlobals.auditEventsQueueManager = null;
    });

    function validEnvelope(overrides = {}) {
        return {
            schemaVersion: 1,
            eventId: 'a0000000-0000-4000-8000-000000000001',
            timestamp: '2025-01-01T00:00:00.000Z',
            type: 'selection.state.changed',
            payload: {},
            ...overrides,
        };
    }

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

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('eventId is not a valid UUID')
        );
    });

    test('drops event and warns when correlationId exceeds 64 characters', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ correlationId: 'x'.repeat(65) }));

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('correlationId exceeds 64 characters')
        );
    });

    test('accepts a short non-UUID correlationId (numeric fallback from audit.qs)', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ correlationId: '1777868693436' }));

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

        expect(res.statusCode).toBe(202);
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
            validEnvelope({ payload: { context: { appId: 'b0000000-0000-4000-8000-000000000001' } } })
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

        expect(res.statusCode).toBe(202);
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

    test('drops event when type is "event." with empty suffix', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ type: 'event.' }));

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('type is not a recognised event type')
        );
    });

    test('drops event when type is unknown', async () => {
        const { registerAuditEventRoutes } = await import('../audit-events-api.js');
        const fastify = Fastify({ logger: false });
        await registerAuditEventRoutes(fastify, { apiToken: 'secret', corsOrigins: ['*'] });

        const res = await postEnvelope(fastify, validEnvelope({ type: 'unknown.type' }));

        expect(res.statusCode).toBe(202);
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('type is not a recognised event type')
        );
    });
});
