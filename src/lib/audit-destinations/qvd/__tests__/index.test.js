import { jest } from '@jest/globals';
import path from 'path';

const mockLogger = {
    verbose: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockConfig = {
    has: jest.fn(),
    get: jest.fn(),
};

const mockFs = {
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
};

const mockQvdDataFrame = {
    fromDict: jest.fn().mockResolvedValue({
        toQvd: jest.fn().mockResolvedValue(true),
    }),
};

// Use absolute paths for ESM mocking
const globalsPath = path.resolve('src/globals.js');

jest.unstable_mockModule(globalsPath, () => ({
    default: {
        logger: mockLogger,
        config: mockConfig,
        getErrorMessage: (err) => err.message,
    },
}));

jest.unstable_mockModule('node:fs', () => ({
    default: mockFs,
}));

jest.unstable_mockModule('qvdjs', () => ({
    QvdDataFrame: mockQvdDataFrame,
}));

const qvd = await import('../index.js');

describe('QVD Audit Destination', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        qvd._resetState();

        mockConfig.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.qvd') return true;
            if (key === 'Butler-SOS.auditEvents.destination.qvd.staticTags') return true;
            return false;
        });

        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.qvd') {
                return {
                    exportDirectory: './audit-events/qvd',
                    maxBatchSize: 2,
                    writeFrequency: 5000,
                };
            }
            if (key === 'Butler-SOS.auditEvents.destination.qvd.staticTags') {
                return [{ name: 'env', value: 'prod' }];
            }
            return null;
        });

        mockFs.existsSync.mockReturnValue(false);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('Buffers events and flushes when maxBatchSize is reached', async () => {
        const event = {
            eventId: '123',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: { objectId: 'obj1' },
            },
        };

        // First event - should not flush
        qvd.bufferAuditQvdEvent(event);
        expect(mockQvdDataFrame.fromDict).not.toHaveBeenCalled();

        // Second event - should flush (maxBatchSize is 2)
        qvd.bufferAuditQvdEvent(event);

        // Wait for async flush
        await Promise.resolve();
        await Promise.resolve();

        expect(mockQvdDataFrame.fromDict).toHaveBeenCalled();
        const callArgs = mockQvdDataFrame.fromDict.mock.calls[0][0];
        expect(callArgs.data.length).toBe(2);
        expect(callArgs.columns).toContain('eventId');
    });

    test('Flushes when writeFrequency is reached', async () => {
        const event = {
            eventId: '123',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: { objectId: 'obj1' },
            },
        };

        qvd.bufferAuditQvdEvent(event);
        expect(mockQvdDataFrame.fromDict).not.toHaveBeenCalled();

        // Advance time
        jest.advanceTimersByTime(5001);

        // Wait for async flush
        await Promise.resolve();
        await Promise.resolve();

        expect(mockQvdDataFrame.fromDict).toHaveBeenCalled();
    });

    test('Handles file rotation (part files)', async () => {
        const event = {
            eventId: '123',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: { objectId: 'obj1' },
            },
        };

        // Mock part1 exists, part2 does not
        mockFs.existsSync.mockImplementation((p) => {
            if (p.includes('part1.qvd')) return true;
            return false;
        });

        qvd.bufferAuditQvdEvent(event);
        qvd.bufferAuditQvdEvent(event);

        await Promise.resolve();
        await Promise.resolve();

        const df = await mockQvdDataFrame.fromDict.mock.results[0].value;
        expect(df.toQvd).toHaveBeenCalledWith(expect.stringContaining('part2.qvd'));
    });

    test('Handles errors during flush and retries', async () => {
        const event = {
            eventId: '123',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: { objectId: 'obj1' },
            },
        };

        // Fail first flush
        mockQvdDataFrame.fromDict.mockRejectedValueOnce(new Error('Write failed'));

        qvd.bufferAuditQvdEvent(event);
        qvd.bufferAuditQvdEvent(event);

        await Promise.resolve();
        await Promise.resolve();

        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Write failed'));

        // Second flush should succeed and include previous events
        qvd.bufferAuditQvdEvent(event);
        // The call above will trigger a flush because buffer length becomes 3 (2 from before + 1 new)
        // and maxBatchSize is 2.

        await Promise.resolve();
        await Promise.resolve();

        expect(mockQvdDataFrame.fromDict).toHaveBeenCalledTimes(2);
        const secondCallArgs = mockQvdDataFrame.fromDict.mock.calls[1][0];
        expect(secondCallArgs.data.length).toBe(3);
    });

    test('writeAuditEventToQvd respects configuration', async () => {
        const event = {
            eventId: '123',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: { objectId: 'obj1' },
            },
        };

        // Mock config missing
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.qvd') return null;
            return true;
        });

        await qvd.writeAuditEventToQvd(event);
        expect(mockQvdDataFrame.fromDict).not.toHaveBeenCalled();

        // Mock config present
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.qvd') {
                return {
                    exportDirectory: './audit-events/qvd',
                    maxBatchSize: 1,
                    writeFrequency: 5000,
                };
            }
            return true;
        });

        await qvd.writeAuditEventToQvd(event);
        await Promise.resolve();
        await Promise.resolve();
        expect(mockQvdDataFrame.fromDict).toHaveBeenCalled();
    });

    test('Correctly handles BigInt for INT64 fields', async () => {
        const event = {
            eventId: '123',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: {
                    objectId: 'obj1',
                    duration: 1234,
                    dataStateId: 5678,
                },
            },
        };

        qvd.bufferAuditQvdEvent(event);
        qvd.bufferAuditQvdEvent(event);

        await Promise.resolve();
        await Promise.resolve();

        const callArgs = mockQvdDataFrame.fromDict.mock.calls[0][0];
        const row = callArgs.data[0];

        // timestamp is at index 0
        expect(typeof row[0]).toBe('number');
        expect(row[0]).toBe(Date.parse('2023-10-27T10:00:00Z'));

        // durationMs is at index 12
        expect(typeof row[12]).toBe('number');
        expect(row[12]).toBe(1234);

        // dataStateId is at index 16
        expect(typeof row[16]).toBe('number');
        expect(row[16]).toBe(5678);
    });
});
