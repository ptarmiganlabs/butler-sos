import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockGlobals = {
    config: {
        get: jest.fn(),
        has: jest.fn(),
    },
};

jest.unstable_mockModule('../../../../../globals.js', () => ({
    default: mockGlobals,
}));

describe('audit-destinations/influxdb/shared/mapping', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockGlobals.config.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.influxdb.staticTags') return false;
            return false;
        });

        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.influxdb.measurementName')
                return 'audit_event';
            if (key === 'Butler-SOS.auditEvents.destination.influxdb.auditEventSchemaVersion')
                return '1';
            throw new Error(`Unexpected config.get key: ${key}`);
        });
    });

    test('maps staticTags from config into tags (ignores invalid entries)', async () => {
        mockGlobals.config.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.influxdb.staticTags') return true;
            return false;
        });

        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.influxdb.measurementName')
                return 'audit_event';
            if (key === 'Butler-SOS.auditEvents.destination.influxdb.auditEventSchemaVersion')
                return '1';
            if (key === 'Butler-SOS.auditEvents.destination.influxdb.staticTags')
                return [
                    { name: 'env', value: 'prod' },
                    { name: 'region', value: 'eu-north-1' },
                    { name: '', value: 'ignored' },
                    { name: 'missingValue' },
                    null,
                ];
            throw new Error(`Unexpected config.get key: ${key}`);
        });

        const { buildAuditInfluxPointModel } = await import('../mapping.js');

        const envelope = {
            type: 'object.visibility.changed',
            eventId: 'evt-static-1',
            timestamp: '2025-01-01T00:00:00.000Z',
            payload: {
                context: {
                    appId: 'app-1',
                },
                event: {
                    objectId: 'obj-1',
                },
            },
        };

        const model = buildAuditInfluxPointModel(envelope, {});

        expect(model.tags.env).toBe('prod');
        expect(model.tags.region).toBe('eu-north-1');
        expect(model.tags.missingValue).toBeUndefined();
        expect(model.tags['']).toBeUndefined();
    });

    test('maps visibility/duration fields and does not emit empty-string tags', async () => {
        const { buildAuditInfluxPointModel } = await import('../mapping.js');

        const envelope = {
            type: 'object.visibility.changed',
            eventId: 'evt-visibility-1',
            correlationId: '',
            timestamp: '2025-02-03T04:05:06.789Z',
            payload: {
                context: {
                    user: '',
                    appId: 'app-1',
                    appName: '',
                    sheetId: 'sheet-1',
                    sheetName: '',
                },
                event: {
                    objectId: 'obj-1',
                    duration: 1234,
                    visible: true,
                    selectionTxnId: '',
                },
            },
        };

        const model = buildAuditInfluxPointModel(envelope, {});

        expect(model.timestampMs).toBe(Date.parse('2025-02-03T04:05:06.789Z'));

        expect(model.tags).toMatchObject({
            eventType: 'object.visibility.changed',
            eventId: 'evt-visibility-1',
            appId: 'app-1',
            auditEventSchemaVersion: '1',
        });

        expect(model.tags.correlationId).toBeUndefined();
        expect(model.tags.userId).toBeUndefined();
        expect(model.tags.appName).toBeUndefined();
        expect(model.tags.selectionTxnId).toBeUndefined();

        expect(model.fields).toMatchObject({
            sheetId: 'sheet-1',
            objectId: 'obj-1',
            durationMs: 1234,
            visible: true,
        });

        expect(model.fields.sheetName).toBeUndefined();
    });

    test('maps screenshot saved paths from handler extras into fields', async () => {
        const { buildAuditInfluxPointModel } = await import('../mapping.js');

        const envelope = {
            type: 'screenshot.url.received',
            eventId: 'evt-1',
            correlationId: 'corr-1',
            timestamp: '2025-01-01T00:00:00.000Z',
            payload: {
                context: {
                    user: 'LAB\\test-user',
                    appId: 'app-1',
                    appName: 'Test App',
                    sheetId: 'sheet-1',
                    sheetName: 'Sheet 1',
                },
                event: {
                    objectId: 'obj-1',
                    selectionTxnId: 'txn-1',
                    screenshotUrl: 'https://example.com/screenshot.png',
                },
            },
        };

        const savedPaths = ['/tmp/audit/1.png', '/tmp/audit/1.meta.png'];
        const extras = {
            screenshot: {
                savedPaths,
            },
        };

        const model = buildAuditInfluxPointModel(envelope, extras);

        expect(model.measurementName).toBe('audit_event');
        expect(model.timestampMs).toBe(Date.parse('2025-01-01T00:00:00.000Z'));

        expect(model.tags).toMatchObject({
            eventType: 'screenshot.url.received',
            eventId: 'evt-1',
            correlationId: 'corr-1',
            selectionTxnId: 'txn-1',
            userId: 'LAB\\test-user',
            appId: 'app-1',
            appName: 'Test App',
            auditEventSchemaVersion: '1',
        });

        expect(model.fields).toMatchObject({
            sheetId: 'sheet-1',
            sheetName: 'Sheet 1',
            objectId: 'obj-1',
            screenshotUrl: 'https://example.com/screenshot.png',
            screenshotSavedPaths: JSON.stringify(savedPaths),
        });
    });

    test('does not include screenshotSavedPaths field when extras are missing', async () => {
        const { buildAuditInfluxPointModel } = await import('../mapping.js');

        const envelope = {
            type: 'screenshot.url.received',
            eventId: 'evt-2',
            correlationId: 'corr-2',
            timestamp: '2025-01-01T00:00:00.000Z',
            payload: {
                context: {
                    appId: 'app-1',
                    appName: 'Test App',
                },
                event: {
                    objectId: 'obj-2',
                    screenshotUrl: 'https://example.com/screenshot.png',
                },
            },
        };

        const model = buildAuditInfluxPointModel(envelope, {});
        expect(model.fields.screenshotSavedPaths).toBeUndefined();
    });

    test('maps dataStateId and selectionDetails from extras into fields', async () => {
        const { buildAuditInfluxPointModel } = await import('../mapping.js');

        const envelope = {
            type: 'selection.state.changed',
            eventId: 'evt-1',
            timestamp: '2025-01-01T00:00:00.000Z',
            payload: {
                context: { appId: 'app-1' },
                event: { selectionTxnId: 'txn-1' },
            },
        };

        const selectionDetails = [{ qField: 'Dim1', qSelectedCount: 1, qSelected: 'A' }];
        const extras = {
            selectionDetails,
            dataStateId: 123456789,
        };

        const model = buildAuditInfluxPointModel(envelope, extras);

        expect(model.fields.dataStateId).toBe(123456789);
        expect(model.fields.selectionDetails).toBe(JSON.stringify(selectionDetails));
    });

    test('maps dataStateId from envelope payload if present', async () => {
        const { buildAuditInfluxPointModel } = await import('../mapping.js');

        const envelope = {
            type: 'app.model.validated',
            eventId: 'evt-1',
            timestamp: '2025-01-01T00:00:00.000Z',
            payload: {
                context: { appId: 'app-1' },
                event: {
                    selectionTxnId: 'txn-1',
                    dataStateId: 987654321,
                },
            },
        };

        const model = buildAuditInfluxPointModel(envelope, {});

        expect(model.fields.dataStateId).toBe(987654321);
    });
});
