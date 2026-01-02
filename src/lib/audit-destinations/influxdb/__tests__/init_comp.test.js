import { jest } from '@jest/globals';

// Mock dependencies
const mockGlobals = {
    config: {
        has: jest.fn(),
        get: jest.fn(),
    },
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    getErrorMessage: jest.fn((err) => err.message),
};

const mockClient = {
    getDatabaseNames: jest.fn(),
    createDatabase: jest.fn(),
    createRetentionPolicy: jest.fn(),
};

const mockClientInfo = {
    client: mockClient,
};

jest.unstable_mockModule('../../../../globals.js', () => ({
    default: mockGlobals,
}));

jest.unstable_mockModule('../shared/client.js', () => ({
    getAuditInfluxClient: jest.fn(() => mockClientInfo),
}));

// Mock InfluxDB APIs
const mockOrgsAPI = jest.fn();
const mockBucketsAPI = jest.fn();

jest.unstable_mockModule('@influxdata/influxdb-client-apis', () => ({
    OrgsAPI: mockOrgsAPI,
    BucketsAPI: mockBucketsAPI,
}));

const { initAuditInfluxDestination } = await import('../init.js');
const { getAuditInfluxClient } = await import('../shared/client.js');

describe('Audit InfluxDB Init', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should skip if audit API is disabled', async () => {
        mockGlobals.config.has.mockReturnValue(true);
        mockGlobals.config.get.mockReturnValue(false);
        await initAuditInfluxDestination();
        expect(mockGlobals.logger.info).not.toHaveBeenCalled();
    });

    test('should skip if destination is not influxdb', async () => {
        mockGlobals.config.has.mockReturnValue(true);
        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.type') return 'mqtt';
            return null;
        });
        await initAuditInfluxDestination();
        expect(mockGlobals.logger.info).not.toHaveBeenCalled();
    });

    describe('InfluxDB v1', () => {
        const v1Cfg = {
            version: 1,
            v1Config: {
                dbName: 'audit_db',
                retentionPolicy: {
                    name: 'audit_rp',
                    duration: '30d',
                },
            },
        };

        beforeEach(() => {
            mockGlobals.config.has.mockReturnValue(true);
            mockGlobals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.auditEvents.enable') return true;
                if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
                if (key === 'Butler-SOS.auditEvents.destination.type') return 'influxdb';
                if (key === 'Butler-SOS.auditEvents.destination.influxdb') return v1Cfg;
                return null;
            });
        });

        test('should skip if dbName is missing', async () => {
            const cfgNoDb = { version: 1, v1Config: {} };
            mockGlobals.config.get
                .mockReturnValueOnce(true) // enable
                .mockReturnValueOnce(true) // dest enable
                .mockReturnValueOnce('influxdb') // type
                .mockReturnValueOnce(cfgNoDb); // config

            await initAuditInfluxDestination();
            expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No v1 dbName configured')
            );
        });

        test('should skip if client is missing', async () => {
            getAuditInfluxClient.mockReturnValueOnce(null);
            await initAuditInfluxDestination();
            expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No v1 client available')
            );
        });

        test('should not create if database already exists', async () => {
            mockClient.getDatabaseNames.mockResolvedValue(['audit_db']);
            await initAuditInfluxDestination();
            expect(mockGlobals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Found InfluxDB v1 database: audit_db')
            );
            expect(mockClient.createDatabase).not.toHaveBeenCalled();
        });

        test('should create database and retention policy if missing', async () => {
            mockClient.getDatabaseNames.mockResolvedValue(['other_db']);
            mockClient.createDatabase.mockResolvedValue();
            mockClient.createRetentionPolicy.mockResolvedValue();

            await initAuditInfluxDestination();

            expect(mockClient.createDatabase).toHaveBeenCalledWith('audit_db');
            expect(mockClient.createRetentionPolicy).toHaveBeenCalledWith(
                'audit_rp',
                expect.any(Object)
            );
            expect(mockGlobals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Created new InfluxDB v1 database')
            );
        });

        test('should handle errors during database creation', async () => {
            mockClient.getDatabaseNames.mockResolvedValue([]);
            mockClient.createDatabase.mockRejectedValue(new Error('Failed'));

            await initAuditInfluxDestination();
            expect(mockGlobals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error creating InfluxDB v1 database')
            );
        });

        test('should handle missing retention policy config', async () => {
            const cfgNoRp = {
                version: 1,
                v1Config: { dbName: 'audit_db' },
            };
            mockGlobals.config.get
                .mockReturnValueOnce(true) // enable
                .mockReturnValueOnce(true) // dest enable
                .mockReturnValueOnce('influxdb') // type
                .mockReturnValueOnce(cfgNoRp); // config

            mockClient.getDatabaseNames.mockResolvedValue([]);
            mockClient.createDatabase.mockResolvedValue();

            await initAuditInfluxDestination();
            expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Missing v1 retentionPolicy config')
            );
        });

        test('should handle error getting database names', async () => {
            mockClient.getDatabaseNames.mockRejectedValue(new Error('Network error'));
            await initAuditInfluxDestination();
            expect(mockGlobals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error getting list of InfluxDB v1 databases')
            );
        });

        test('should handle error creating retention policy', async () => {
            mockClient.getDatabaseNames.mockResolvedValue([]);
            mockClient.createDatabase.mockResolvedValue();
            mockClient.createRetentionPolicy.mockRejectedValue(new Error('Policy failed'));

            await initAuditInfluxDestination();
            expect(mockGlobals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error creating InfluxDB v1 retention policy')
            );
        });
    });

    describe('InfluxDB v2', () => {
        const v2Cfg = {
            version: 2,
            v2Config: {
                org: 'my_org',
                bucket: 'audit_bucket',
            },
        };

        beforeEach(() => {
            mockGlobals.config.has.mockReturnValue(true);
            mockGlobals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.auditEvents.enable') return true;
                if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
                if (key === 'Butler-SOS.auditEvents.destination.type') return 'influxdb';
                if (key === 'Butler-SOS.auditEvents.destination.influxdb') return v2Cfg;
                return null;
            });
        });

        test('should skip if org or bucket is missing', async () => {
            const cfgIncomplete = { version: 2, v2Config: { org: 'my_org' } };
            mockGlobals.config.get
                .mockReturnValueOnce(true) // enable
                .mockReturnValueOnce(true) // dest enable
                .mockReturnValueOnce('influxdb') // type
                .mockReturnValueOnce(cfgIncomplete); // config

            await initAuditInfluxDestination();
            expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Missing v2 org/bucket')
            );
        });

        test('should skip if client is missing', async () => {
            getAuditInfluxClient.mockReturnValueOnce(null);
            await initAuditInfluxDestination();
            expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No v2 client available')
            );
        });

        test('should create bucket if missing', async () => {
            const mockOrgsInstance = {
                getOrgs: jest.fn().mockResolvedValue({ orgs: [{ id: 'org_id' }] }),
            };
            const mockBucketsInstance = {
                getBuckets: jest.fn().mockResolvedValue({ buckets: [] }),
                postBuckets: jest.fn().mockResolvedValue(),
            };
            mockOrgsAPI.mockImplementation(() => mockOrgsInstance);
            mockBucketsAPI.mockImplementation(() => mockBucketsInstance);

            await initAuditInfluxDestination();

            expect(mockOrgsInstance.getOrgs).toHaveBeenCalledWith({ org: 'my_org' });
            expect(mockBucketsInstance.getBuckets).toHaveBeenCalledWith({
                orgID: 'org_id',
                name: 'audit_bucket',
            });
            expect(mockBucketsInstance.postBuckets).toHaveBeenCalled();
            expect(mockGlobals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Created new InfluxDB v2 bucket')
            );
        });

        test('should not create if bucket already exists', async () => {
            const mockOrgsInstance = {
                getOrgs: jest.fn().mockResolvedValue({ orgs: [{ id: 'org_id' }] }),
            };
            const mockBucketsInstance = {
                getBuckets: jest.fn().mockResolvedValue({ buckets: [{ id: 'bucket_id' }] }),
                postBuckets: jest.fn(),
            };
            mockOrgsAPI.mockImplementation(() => mockOrgsInstance);
            mockBucketsAPI.mockImplementation(() => mockBucketsInstance);

            await initAuditInfluxDestination();
            expect(mockBucketsInstance.postBuckets).not.toHaveBeenCalled();
            expect(mockGlobals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Bucket named "audit_bucket" already exists')
            );
        });

        test('should handle error getting organization', async () => {
            const mockOrgsInstance = {
                getOrgs: jest.fn().mockRejectedValue(new Error('Org error')),
            };
            mockOrgsAPI.mockImplementation(() => mockOrgsInstance);

            await initAuditInfluxDestination();
            expect(mockGlobals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error getting organisation')
            );
        });

        test('should handle error ensuring bucket exists', async () => {
            const mockOrgsInstance = {
                getOrgs: jest.fn().mockResolvedValue({ orgs: [{ id: 'org_id' }] }),
            };
            const mockBucketsInstance = {
                getBuckets: jest.fn().mockRejectedValue(new Error('Bucket error')),
            };
            mockOrgsAPI.mockImplementation(() => mockOrgsInstance);
            mockBucketsAPI.mockImplementation(() => mockBucketsInstance);

            await initAuditInfluxDestination();
            expect(mockGlobals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error ensuring bucket exists')
            );
        });
    });

    describe('InfluxDB v3', () => {
        test('should log that v3 is not auto-created', async () => {
            mockGlobals.config.has.mockReturnValue(true);
            mockGlobals.config.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.auditEvents.enable') return true;
                if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
                if (key === 'Butler-SOS.auditEvents.destination.type') return 'influxdb';
                if (key === 'Butler-SOS.auditEvents.destination.influxdb') return { version: 3 };
                return null;
            });

            await initAuditInfluxDestination();
            expect(mockGlobals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('InfluxDB v3 database is not auto-created')
            );
        });
    });

    test('should warn on unsupported version', async () => {
        mockGlobals.config.has.mockReturnValue(true);
        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.auditEvents.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.enable') return true;
            if (key === 'Butler-SOS.auditEvents.destination.type') return 'influxdb';
            if (key === 'Butler-SOS.auditEvents.destination.influxdb') return { version: 4 };
            return null;
        });

        await initAuditInfluxDestination();
        expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Unsupported InfluxDB version v4')
        );
    });
});
