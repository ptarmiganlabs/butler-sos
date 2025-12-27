import { jest } from '@jest/globals';
import path from 'path';

const mockLogger = {
    verbose: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockConfig = {
    has: jest.fn(),
    get: jest.fn(),
};

const mockSharedUtils = {
    writeToInfluxWithRetry: jest.fn((fn) => fn()),
};

const mockMapping = {
    buildAuditInfluxPointModel: jest.fn((envelope) => {
        if (envelope.failMapping) return null;
        return {
            measurementName: 'audit',
            tags: { id: envelope.id },
            fields: { value: 1 },
        };
    }),
};

const mockClient = {
    getAuditInfluxClient: jest.fn(),
};

const mockOrgsAPI = jest.fn().mockImplementation(() => ({
    getOrgs: jest.fn().mockResolvedValue({ orgs: [{ id: 'org-id' }] }),
}));

const mockBucketsAPI = jest.fn().mockImplementation(() => ({
    getBuckets: jest.fn().mockResolvedValue({ buckets: [{ id: 'bucket-id' }] }),
    postBuckets: jest.fn().mockResolvedValue({}),
}));

const mockQueueManager = {
    addToQueue: jest.fn().mockImplementation((fn) => {
        if (mockQueueManager.shouldFail) {
            return Promise.reject(new Error('Queue Full'));
        }
        return Promise.resolve(fn());
    }),
    shouldFail: false,
};

// Use absolute paths for ESM mocking
const globalsPath = path.resolve('src/globals.js');
const sharedUtilsPath = path.resolve('src/lib/influxdb/shared/utils.js');
const mappingPath = path.resolve('src/lib/audit-destinations/influxdb/shared/mapping.js');
const clientPath = path.resolve('src/lib/audit-destinations/influxdb/shared/client.js');

jest.unstable_mockModule(globalsPath, () => ({
    default: {
        logger: mockLogger,
        config: mockConfig,
        getErrorMessage: (err) => err.message,
        auditEventsQueueManager: mockQueueManager,
    },
}));

jest.unstable_mockModule(sharedUtilsPath, () => mockSharedUtils);
jest.unstable_mockModule(mappingPath, () => mockMapping);
jest.unstable_mockModule(clientPath, () => mockClient);

jest.unstable_mockModule('@influxdata/influxdb-client-apis', () => ({
    OrgsAPI: mockOrgsAPI,
    BucketsAPI: mockBucketsAPI,
}));

const buffer = await import('../buffer.js');

describe('InfluxDB Audit Buffer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        buffer._resetState();
        mockQueueManager.shouldFail = false;

        mockConfig.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            return false;
        });
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return {
                    version: 1,
                    maxBatchSize: 3,
                    writeFrequency: 5000,
                    host: 'localhost',
                };
            }
            return null;
        });

        mockClient.getAuditInfluxClient.mockReturnValue({
            client: {
                writePoints: jest.fn().mockResolvedValue(undefined),
            },
        });
    });

    afterEach(async () => {
        buffer._resetState();
        jest.useRealTimers();
    });

    test('should buffer events and flush when maxBatchSize is reached', async () => {
        const event = { id: '1', action: 'test' };
        buffer.bufferAuditInfluxEvent(event);
        buffer.bufferAuditInfluxEvent(event);
        expect(mockLogger.verbose).not.toHaveBeenCalledWith(expect.stringContaining('Flushed'));

        buffer.bufferAuditInfluxEvent(event);

        // Allow the async flush to run.
        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        expect(mockLogger.verbose).toHaveBeenCalledWith(
            expect.stringContaining('Flushed 3 point(s)')
        );
    });

    test('should handle queue manager failure', async () => {
        mockQueueManager.shouldFail = true;
        buffer.bufferAuditInfluxEvent({ id: 'q-fail' });
        buffer.bufferAuditInfluxEvent({ id: 'q-fail' });
        buffer.bufferAuditInfluxEvent({ id: 'q-fail' });

        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Failed to enqueue flush: Queue Full')
        );
    });

    test('should handle flush failures and retry', async () => {
        mockClient.getAuditInfluxClient.mockReturnValue({
            client: {
                writePoints: jest.fn().mockRejectedValue(new Error('Influx Down')),
            },
        });

        buffer.bufferAuditInfluxEvent({ id: 'fail' });
        buffer.bufferAuditInfluxEvent({ id: 'fail' });
        buffer.bufferAuditInfluxEvent({ id: 'fail' });

        // Allow all progressive retries to run
        await jest.runOnlyPendingTimersAsync();
        // Progressive retries might schedule more timers/microtasks
        for (let i = 0; i < 10; i++) {
            await jest.runOnlyPendingTimersAsync();
            await Promise.resolve();
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Flush failed; will retry later')
        );

        mockClient.getAuditInfluxClient.mockReturnValue({
            client: { writePoints: jest.fn().mockResolvedValue(undefined) },
        });
        await buffer.flushNow();
        expect(mockLogger.verbose).toHaveBeenCalledWith(
            expect.stringContaining('Flushed 3 point(s)')
        );
    });

    test('should handle InfluxDB v2 with bucket creation and close error', async () => {
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return {
                    version: 2,
                    maxBatchSize: 1,
                    writeFrequency: 0,
                    v2Config: { org: 'my-org', bucket: 'new-bucket', retentionDuration: '1d' },
                };
            }
            return null;
        });

        const mockWriteApi = {
            writePoints: jest.fn().mockResolvedValue(undefined),
            close: jest
                .fn()
                .mockRejectedValueOnce(new Error('Close Error'))
                .mockResolvedValue(undefined),
        };
        const mockV2Client = {
            getWriteApi: jest.fn().mockReturnValue(mockWriteApi),
        };
        mockClient.getAuditInfluxClient.mockReturnValue({
            client: mockV2Client,
            org: 'my-org',
            bucket: 'new-bucket',
        });

        // Mock bucket not found (empty list)
        const bucketsAPIInstance = {
            getBuckets: jest.fn().mockResolvedValue({ buckets: [] }),
            postBuckets: jest.fn().mockResolvedValue({}),
        };
        mockBucketsAPI.mockReturnValue(bucketsAPIInstance);

        buffer.bufferAuditInfluxEvent({ id: 'v2-new' });

        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        expect(bucketsAPIInstance.postBuckets).toHaveBeenCalled();
        // The close error is caught and ignored in the code
    });

    test('should handle InfluxDB v3 progressive sizes', async () => {
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return {
                    version: 3,
                    maxBatchSize: 10,
                    writeFrequency: 0,
                    v3Config: { database: 'my-db' },
                };
            }
            return null;
        });

        const mockV3Client = {
            write: jest.fn().mockRejectedValue(new Error('V3 Error')),
        };
        mockClient.getAuditInfluxClient.mockReturnValue({
            client: mockV3Client,
            database: 'my-db',
        });

        buffer.bufferAuditInfluxEvent({ id: 'v3-fail' });

        await jest.runOnlyPendingTimersAsync();
        for (let i = 0; i < 10; i++) {
            await jest.runOnlyPendingTimersAsync();
            await Promise.resolve();
        }

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('retrying with smaller batches')
        );
    });

    test('should handle unsupported InfluxDB version', async () => {
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return { version: 99, maxBatchSize: 1, writeFrequency: 0 };
            }
            return null;
        });

        buffer.bufferAuditInfluxEvent({ id: 'v99' });

        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Unsupported InfluxDB version v99')
        );
    });

    test('should handle mapping failure', async () => {
        buffer.bufferAuditInfluxEvent({ failMapping: true });
        expect(mockLogger.verbose).not.toHaveBeenCalled();
    });

    test('should handle destination disabled', async () => {
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return false;
            return null;
        });
        buffer.bufferAuditInfluxEvent({ id: 'disabled' });
        expect(mockLogger.verbose).not.toHaveBeenCalled();
    });

    test('should handle config change', async () => {
        const event = { id: '1' };
        buffer.bufferAuditInfluxEvent(event);

        // Change config
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return { version: 1, maxBatchSize: 10, writeFrequency: 1000, host: 'other-host' };
            }
            return null;
        });

        buffer.bufferAuditInfluxEvent(event);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Destination config changed')
        );
    });

    test('should handle v2/v3 with boolean fields and timestamps', async () => {
        mockMapping.buildAuditInfluxPointModel.mockReturnValue({
            measurementName: 'audit',
            tags: { t1: 'v1' },
            fields: { f1: true, f2: 's1', f3: 123 },
            timestampMs: 1234567890,
        });

        // Test v2
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return {
                    version: 2,
                    maxBatchSize: 1,
                    writeFrequency: 0,
                    v2Config: { org: 'o', bucket: 'b', retentionDuration: '1d' },
                };
            }
            return null;
        });
        buffer.bufferAuditInfluxEvent({ id: 'v2' });
        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        // Test v3
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return {
                    version: 3,
                    maxBatchSize: 1,
                    writeFrequency: 0,
                    v3Config: { database: 'd' },
                };
            }
            return null;
        });
        buffer.bufferAuditInfluxEvent({ id: 'v3' });
        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        expect(mockLogger.verbose).toHaveBeenCalled();
    });

    test('should handle v2 bucket already exists', async () => {
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return {
                    version: 2,
                    maxBatchSize: 1,
                    writeFrequency: 0,
                    v2Config: { org: 'o', bucket: 'exists', retentionDuration: '1d' },
                };
            }
            return null;
        });

        const bucketsAPIInstance = {
            getBuckets: jest.fn().mockResolvedValue({ buckets: [{ id: 'b1' }] }),
            postBuckets: jest.fn(),
        };
        mockBucketsAPI.mockReturnValue(bucketsAPIInstance);

        buffer.bufferAuditInfluxEvent({ id: 'v2-exists' });
        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        expect(bucketsAPIInstance.postBuckets).not.toHaveBeenCalled();
    });

    test('should handle v2 missing config', async () => {
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return { version: 2, maxBatchSize: 1, writeFrequency: 0, v2Config: {} };
            }
            return null;
        });

        buffer.bufferAuditInfluxEvent({ id: 'v2-missing' });
        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Missing required audit InfluxDB v2 config')
        );
    });

    test('should handle v2 org not found', async () => {
        mockConfig.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') {
                return {
                    version: 2,
                    maxBatchSize: 1,
                    writeFrequency: 0,
                    v2Config: { org: 'no-org', bucket: 'b', retentionDuration: '1d' },
                };
            }
            return null;
        });

        const orgsAPIInstance = {
            getOrgs: jest.fn().mockResolvedValue({ orgs: [] }),
        };
        mockOrgsAPI.mockReturnValue(orgsAPIInstance);

        buffer.bufferAuditInfluxEvent({ id: 'v2-no-org' });
        await jest.runOnlyPendingTimersAsync();
        await Promise.resolve();

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('No organization named "no-org" found')
        );
    });
});
