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

const mockHyparquet = {
    parquetWriteBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
};

// Use absolute paths for ESM mocking
const globalsPath = path.resolve('src/globals.js');

jest.unstable_mockModule(globalsPath, () => ({
    default: {
        logger: mockLogger,
        config: mockConfig,
        /**
         * Extracts a human-readable error message from an error object, handling various error shapes.
         *
         * @param {unknown} err - The error object to extract the message from.
         * @returns {string} A human-readable error message.
         */
        getErrorMessage: (err) => err.message,
    },
}));

jest.unstable_mockModule('node:fs', () => ({
    default: mockFs,
}));

jest.unstable_mockModule('hyparquet-writer', () => mockHyparquet);

const parquet = await import('../index.js');

describe('Parquet Audit Destination', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        parquet._resetState();

        mockConfig.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') return true;
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata.staticTags') return true;
            return false;
        });

        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') {
                return {
                    exportDirectory: './audit-events/parquet',
                    maxBatchSize: 2,
                    writeFrequency: 5000,
                };
            }
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata.staticTags') {
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
        parquet.bufferAuditParquetEvent(event);
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();

        // Second event - should flush (maxBatchSize is 2)
        parquet.bufferAuditParquetEvent(event);

        // Wait for async flush
        await Promise.resolve();
        await Promise.resolve();

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
            expect.stringContaining('audit-events/parquet'),
            { recursive: true }
        );
        expect(mockFs.writeFileSync).toHaveBeenCalled();
        expect(mockHyparquet.parquetWriteBuffer).toHaveBeenCalled();

        const callArgs = mockHyparquet.parquetWriteBuffer.mock.calls[0][0];
        expect(callArgs.columnData).toHaveLength(23);
        expect(callArgs.columnData.find((c) => c.name === 'userId').data).toEqual([
            'user1',
            'user1',
        ]);
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

        parquet.bufferAuditParquetEvent(event);
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();

        // Advance time
        jest.advanceTimersByTime(5001);

        // Wait for async flush
        await Promise.resolve();
        await Promise.resolve();

        expect(mockFs.writeFileSync).toHaveBeenCalled();
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
            if (p.includes('part1.parquet')) return true;
            return false;
        });

        parquet.bufferAuditParquetEvent(event);
        parquet.bufferAuditParquetEvent(event);

        await Promise.resolve();
        await Promise.resolve();

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('part2.parquet'),
            expect.any(Uint8Array)
        );
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

        mockHyparquet.parquetWriteBuffer.mockRejectedValueOnce(new Error('Write failed'));

        parquet.bufferAuditParquetEvent(event);
        parquet.bufferAuditParquetEvent(event);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error flushing audit Parquet buffer: Write failed')
        );

        // The buffer should have been restored.
        // If we trigger another flush, it should try again.
        mockHyparquet.parquetWriteBuffer.mockResolvedValue(new ArrayBuffer(10));

        // Trigger flush via timer
        jest.advanceTimersByTime(5001);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    test('Flushes pending batch after in-flight flush completes', async () => {
        let resolveFirstFlush;
        const firstFlush = new Promise((resolve) => {
            resolveFirstFlush = resolve;
        });
        mockHyparquet.parquetWriteBuffer.mockImplementationOnce(() => firstFlush);

        const makeEvent = (eventId) => ({
            eventId,
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: { objectId: 'obj1' },
            },
        });

        parquet.bufferAuditParquetEvent(makeEvent('1'));
        parquet.bufferAuditParquetEvent(makeEvent('2'));
        await Promise.resolve();

        expect(mockHyparquet.parquetWriteBuffer).toHaveBeenCalledTimes(1);

        parquet.bufferAuditParquetEvent(makeEvent('3'));
        parquet.bufferAuditParquetEvent(makeEvent('4'));
        await Promise.resolve();

        expect(mockHyparquet.parquetWriteBuffer).toHaveBeenCalledTimes(1);

        resolveFirstFlush(new ArrayBuffer(10));
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(mockHyparquet.parquetWriteBuffer).toHaveBeenCalledTimes(2);

        const secondCallArgs = mockHyparquet.parquetWriteBuffer.mock.calls[1][0];
        const eventIdCol = secondCallArgs.columnData.find((c) => c.name === 'eventId');
        expect(eventIdCol.data).toEqual(['3', '4']);
    });

    test('writeAuditEventToParquet respects configuration', async () => {
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
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') return null;
            return true;
        });

        await parquet.writeAuditEventToParquet(event);
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();

        // Mock config present
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') {
                return {
                    exportDirectory: './audit-events/parquet',
                    maxBatchSize: 1,
                    writeFrequency: 5000,
                };
            }
            return true;
        });

        await parquet.writeAuditEventToParquet(event);
        await Promise.resolve();
        await Promise.resolve();
        expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    test('Correctly handles INT64 fields', async () => {
        const event = {
            eventId: '123',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: {
                    objectId: 'obj1',
                    duration: 1.23,
                    dataStateId: '5678',
                },
            },
        };

        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') {
                return {
                    exportDirectory: './audit-events/parquet',
                    maxBatchSize: 1,
                    writeFrequency: 5000,
                };
            }
            return true;
        });

        parquet.bufferAuditParquetEvent(event);
        await Promise.resolve();
        await Promise.resolve();

        const callArgs = mockHyparquet.parquetWriteBuffer.mock.calls[0][0];
        const durationCol = callArgs.columnData.find((c) => c.name === 'durationMs');
        const dataStateCol = callArgs.columnData.find((c) => c.name === 'dataStateId');
        const timestampCol = callArgs.columnData.find((c) => c.name === 'timestamp');

        expect(durationCol.data[0]).toBeNull();
        expect(dataStateCol.data[0]).toBe(5678n);
        expect(timestampCol.data[0]).toBe(BigInt(Date.parse('2023-10-27T10:00:00Z')));
    });

    test('Stores objectData and objectType when present', async () => {
        const event = {
            eventId: 'dim-1',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: {
                    objectId: 'obj1',
                    objectData: {
                        schemaVersion: 1,
                        objectType: 'barchart',
                        extractedAt: '2023-10-27T10:00:00.000Z',
                        dimensions: [
                            { fieldName: 'Dim1', label: 'Dimension 1', values: ['A', 'B'] },
                        ],
                        measures: [{ label: 'Sales', values: ['100', '200'] }],
                    },
                },
            },
        };

        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') {
                return {
                    exportDirectory: './audit-events/parquet',
                    maxBatchSize: 1,
                    writeFrequency: 5000,
                };
            }
            return true;
        });

        parquet.bufferAuditParquetEvent(event);
        await Promise.resolve();
        await Promise.resolve();

        const callArgs = mockHyparquet.parquetWriteBuffer.mock.calls[0][0];
        const objectTypeCol = callArgs.columnData.find((c) => c.name === 'objectType');
        const objectDataCol = callArgs.columnData.find((c) => c.name === 'objectData');

        expect(objectTypeCol).toBeDefined();
        expect(objectDataCol).toBeDefined();
        expect(objectTypeCol.data[0]).toBe('barchart');
        expect(JSON.parse(objectDataCol.data[0])).toMatchObject({
            objectType: 'barchart',
            dimensions: expect.any(Array),
        });
    });

    test('Stores null for objectData when not present', async () => {
        const event = {
            eventId: 'no-dim-1',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: { objectId: 'obj1' },
            },
        };

        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') {
                return {
                    exportDirectory: './audit-events/parquet',
                    maxBatchSize: 1,
                    writeFrequency: 5000,
                };
            }
            return true;
        });

        parquet.bufferAuditParquetEvent(event);
        await Promise.resolve();
        await Promise.resolve();

        const callArgs = mockHyparquet.parquetWriteBuffer.mock.calls[0][0];
        const objectTypeCol = callArgs.columnData.find((c) => c.name === 'objectType');
        const objectDataCol = callArgs.columnData.find((c) => c.name === 'objectData');

        expect(objectTypeCol.data[0]).toBeNull();
        expect(objectDataCol.data[0]).toBeNull();
    });

    test('Always includes objectData (includeObjectData toggle removed)', async () => {
        mockConfig.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') return true;
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata.staticTags') return true;
            return false;
        });

        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata') {
                return {
                    exportDirectory: './audit-events/parquet',
                    maxBatchSize: 1,
                    writeFrequency: 5000,
                };
            }
            if (key === 'Butler-SOS.auditEvents.destination.parquet.metadata.staticTags') {
                return [{ name: 'env', value: 'prod' }];
            }
            return null;
        });

        const event = {
            eventId: 'dim-always-1',
            timestamp: '2023-10-27T10:00:00Z',
            payload: {
                context: { user: 'user1' },
                event: {
                    objectId: 'obj1',
                    objectData: {
                        objectType: 'barchart',
                        dimensions: [{ fieldName: 'Dim1', label: 'D1', values: ['A'] }],
                        measures: [],
                    },
                },
            },
        };

        parquet.bufferAuditParquetEvent(event);
        await Promise.resolve();
        await Promise.resolve();

        const callArgs = mockHyparquet.parquetWriteBuffer.mock.calls[0][0];
        const objectTypeCol = callArgs.columnData.find((c) => c.name === 'objectType');
        const objectDataCol = callArgs.columnData.find((c) => c.name === 'objectData');

        expect(objectTypeCol.data[0]).toBe('barchart');
        expect(JSON.parse(objectDataCol.data[0])).toMatchObject({
            objectType: 'barchart',
            dimensions: expect.any(Array),
        });
    });
});
