import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';

const mockConfig = {
    has: jest.fn(),
    get: jest.fn(),
};

const globalsPath = path.resolve('src/globals.js');

jest.unstable_mockModule(globalsPath, () => ({
    default: {
        config: mockConfig,
    },
}));

const { extractAuditEventFields } = await import('../extract-fields.js');

const STATIC_TAGS_KEY = 'Butler-SOS.auditEvents.destination.parquet.metadata.staticTags';

describe('shared/extract-fields – extractAuditEventFields', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockConfig.has.mockReturnValue(false);
        mockConfig.get.mockReturnValue(undefined);
    });

    test('maps basic envelope fields to the row schema', () => {
        const envelope = {
            eventId: 'evt-001',
            correlationId: 'corr-001',
            type: 'selection',
            timestamp: '2024-01-15T10:30:00.000Z',
            payload: {
                context: {
                    user: 'user@domain.com',
                    appId: 'app-123',
                    appName: 'My App',
                    sheetId: 'sheet-1',
                    sheetName: 'Dashboard',
                },
                event: {
                    objectId: 'obj-456',
                    selectionTxnId: 'txn-789',
                    duration: 100,
                    visible: true,
                    enteredAt: '2024-01-15T10:30:00.000Z',
                    leftAt: '2024-01-15T10:30:01.000Z',
                    dataStateId: 5,
                    screenshotUrl: 'http://example.com/screenshot.png',
                },
            },
        };

        const row = extractAuditEventFields(envelope, {}, STATIC_TAGS_KEY);

        expect(row.eventId).toBe('evt-001');
        expect(row.correlationId).toBe('corr-001');
        expect(row.eventType).toBe('selection');
        expect(row.userId).toBe('user@domain.com');
        expect(row.appId).toBe('app-123');
        expect(row.appName).toBe('My App');
        expect(row.sheetId).toBe('sheet-1');
        expect(row.sheetName).toBe('Dashboard');
        expect(row.objectId).toBe('obj-456');
        expect(row.selectionTxnId).toBe('txn-789');
        expect(row.durationMs).toBe(100n);
        expect(row.visible).toBe(true);
        expect(row.enteredAt).toBe('2024-01-15T10:30:00.000Z');
        expect(row.leftAt).toBe('2024-01-15T10:30:01.000Z');
        expect(row.dataStateId).toBe(5n);
        expect(row.screenshotUrl).toBe('http://example.com/screenshot.png');
    });

    test('sets eventType to "unknown" when type is missing', () => {
        const row = extractAuditEventFields({}, {}, STATIC_TAGS_KEY);
        expect(row.eventType).toBe('unknown');
    });

    test('parses timestamp and derives date', () => {
        const ts = '2024-06-01T12:00:00.000Z';
        const row = extractAuditEventFields({ timestamp: ts }, {}, STATIC_TAGS_KEY);

        expect(row.timestamp).toBe(BigInt(Date.parse(ts)));
        expect(row.date).toBe('20240601');
    });

    test('sets timestamp and date to null for invalid timestamp', () => {
        const row = extractAuditEventFields({ timestamp: 'not-a-date' }, {}, STATIC_TAGS_KEY);
        expect(row.timestamp).toBeNull();
        expect(row.date).toBeNull();
    });

    test('sets timestamp and date to null when timestamp is missing', () => {
        const row = extractAuditEventFields({}, {}, STATIC_TAGS_KEY);
        expect(row.timestamp).toBeNull();
        expect(row.date).toBeNull();
    });

    test('maps objectData and objectType when objectData is present', () => {
        const objectData = {
            objectType: 'barchart',
            dimensions: [{ fieldName: 'Dim1' }],
            measures: [],
        };
        const envelope = {
            payload: { context: {}, event: { objectData } },
        };
        const row = extractAuditEventFields(envelope, {}, STATIC_TAGS_KEY);

        expect(row.objectType).toBe('barchart');
        expect(JSON.parse(row.objectData)).toMatchObject({ objectType: 'barchart' });
    });

    test('sets objectType and objectData to null when objectData is absent', () => {
        const envelope = {
            payload: { context: {}, event: { objectId: 'obj-1' } },
        };
        const row = extractAuditEventFields(envelope, {}, STATIC_TAGS_KEY);
        expect(row.objectType).toBeNull();
        expect(row.objectData).toBeNull();
    });

    test('serialises selectionDetails from extras', () => {
        const extras = { selectionDetails: [{ field: 'Dim1', values: ['A', 'B'] }] };
        const row = extractAuditEventFields({}, extras, STATIC_TAGS_KEY);
        expect(JSON.parse(row.selectionDetails)).toEqual(extras.selectionDetails);
    });

    test('sets selectionDetails to null when extras array is empty', () => {
        const row = extractAuditEventFields({}, { selectionDetails: [] }, STATIC_TAGS_KEY);
        expect(row.selectionDetails).toBeNull();
    });

    test('sets selectionDetails to null when extras has no selectionDetails', () => {
        const row = extractAuditEventFields({}, {}, STATIC_TAGS_KEY);
        expect(row.selectionDetails).toBeNull();
    });

    test('serialises screenshotSavedPaths from extras', () => {
        const extras = { screenshot: { savedPaths: ['/tmp/a.png', '/tmp/b.png'] } };
        const row = extractAuditEventFields({}, extras, STATIC_TAGS_KEY);
        expect(JSON.parse(row.screenshotSavedPaths)).toEqual(['/tmp/a.png', '/tmp/b.png']);
    });

    test('sets screenshotSavedPaths to null when array is empty', () => {
        const extras = { screenshot: { savedPaths: [] } };
        const row = extractAuditEventFields({}, extras, STATIC_TAGS_KEY);
        expect(row.screenshotSavedPaths).toBeNull();
    });

    test('serialises static tags from config', () => {
        mockConfig.has.mockImplementation((key) => key === STATIC_TAGS_KEY);
        mockConfig.get.mockImplementation((key) => {
            if (key === STATIC_TAGS_KEY) return [{ name: 'env', value: 'prod' }];
            return undefined;
        });

        const row = extractAuditEventFields({}, {}, STATIC_TAGS_KEY);
        expect(JSON.parse(row.tags)).toEqual({ env: 'prod' });
    });

    test('sets tags to null when no static tags are configured', () => {
        mockConfig.has.mockReturnValue(false);
        const row = extractAuditEventFields({}, {}, STATIC_TAGS_KEY);
        expect(row.tags).toBeNull();
    });

    test('rejects fractional duration (non-integer BigInt)', () => {
        const envelope = {
            payload: { context: {}, event: { duration: 1.5 } },
        };
        const row = extractAuditEventFields(envelope, {}, STATIC_TAGS_KEY);
        expect(row.durationMs).toBeNull();
    });

    test('accepts string dataStateId from extras when event has none', () => {
        const envelope = { payload: { context: {}, event: {} } };
        const extras = { dataStateId: '42' };
        const row = extractAuditEventFields(envelope, extras, STATIC_TAGS_KEY);
        expect(row.dataStateId).toBe(42n);
    });

    test('handles a completely empty envelope gracefully', () => {
        expect(() => extractAuditEventFields(null, {}, STATIC_TAGS_KEY)).not.toThrow();
        expect(() => extractAuditEventFields(undefined, {}, STATIC_TAGS_KEY)).not.toThrow();
    });

    test('handles non-object extras gracefully', () => {
        expect(() => extractAuditEventFields({}, null, STATIC_TAGS_KEY)).not.toThrow();
    });
});
