import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockFs = {
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
};

const mockGlobals = {
    config: {
        has: jest.fn(),
        get: jest.fn(),
    },
    logger: {
        debug: jest.fn(),
        verbose: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
    },
    getErrorMessage: (err) => (err instanceof Error ? err.message : String(err)),
};

jest.unstable_mockModule('node:fs', () => ({
    default: mockFs,
    existsSync: mockFs.existsSync,
    mkdirSync: mockFs.mkdirSync,
    writeFileSync: mockFs.writeFileSync,
}));

jest.unstable_mockModule('../../../../globals.js', () => ({
    default: mockGlobals,
}));

jest.unstable_mockModule('../../../util/user-identity.js', () => ({
    parseQlikUserIdentity: jest.fn().mockReturnValue({
        user: 'UserDirectory=LAB; UserId=goran',
        userDirectory: 'LAB',
        userId: 'goran',
    }),
}));

describe('audit JSON destination logging', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        mockFs.existsSync.mockReturnValue(true);

        mockGlobals.config.has.mockImplementation(
            (key) => key === 'Butler-SOS.auditEvents.destination.json.objectdata'
        );
        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.json.objectdata') {
                return {
                    enable: true,
                    exportDirectory: 'audit-events/json',
                };
            }

            return undefined;
        });
    });

    test('writes per-event objectData logs at verbose instead of info', async () => {
        const { writeAuditEventToJson } = await import('../index.js');

        await writeAuditEventToJson({
            eventId: 'evt-1',
            correlationId: 'corr-1',
            timestamp: '2025-01-01T00:00:00.000Z',
            type: 'screenshot.url.received',
            payload: {
                context: {
                    appId: 'app-1',
                    appName: 'Sales',
                    user: 'UserDirectory=LAB; UserId=goran',
                    sheetId: 'sheet-1',
                    sheetName: 'Main',
                },
                event: {
                    objectId: 'obj-1',
                    selectionTxnId: 'txn-1',
                    objectData: {
                        objectType: 'barchart',
                        dimensions: [],
                        measures: [],
                    },
                },
            },
        });

        expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(mockGlobals.logger.verbose).toHaveBeenCalledWith(
            expect.stringContaining('AUDIT JSON: Wrote objectData to')
        );
        expect(mockGlobals.logger.info).not.toHaveBeenCalled();
    });
});