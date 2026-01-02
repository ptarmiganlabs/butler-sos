import { jest, describe, test, expect, beforeEach } from '@jest/globals';

/**
 * Convert unknown errors to a message string.
 *
 * @param {unknown} e Error-like object.
 * @returns {string} Error message.
 */
function getErrorMessage(e) {
    if (e && typeof e === 'object' && 'message' in e) {
        return String(e.message);
    }

    return String(e);
}

/**
 * Minimal HttpError class used for instanceof checks.
 */
class HttpError extends Error {
    /**
     * Create an HttpError instance.
     *
     * @param {number} statusCode HTTP status code.
     */
    constructor(statusCode) {
        super('HttpError');
        this.statusCode = statusCode;
    }
}

/**
 * Create a minimal config stub that mimics `globals.config`.
 *
 * @param {Record<string, unknown>} initial Initial key/values.
 * @returns {{ store: Map<string, unknown>, config: { get: (k: string) => unknown, has: (k: string) => boolean } }}
 *   Stub config store and config facade.
 */
function createConfigStub(initial = {}) {
    const store = new Map(Object.entries(initial));

    return {
        store,
        config: {
            /**
             * Get a config value.
             *
             * @param {string} k Config key.
             * @returns {unknown} Stored config value.
             */
            get: (k) => store.get(k),
            /**
             * Check if a config key exists.
             *
             * @param {string} k Config key.
             * @returns {boolean} True if key exists.
             */
            has: (k) => store.has(k),
        },
    };
}

/**
 * Create mock OrgsAPI/BucketsAPI classes with pluggable implementations.
 *
 * @param {{
 *   getOrgs: import('@jest/globals').Mock,
 *   getBuckets: import('@jest/globals').Mock,
 *   postBuckets: import('@jest/globals').Mock,
 * }} fns Mock function container.
 * @returns {{
 *   OrgsAPI: new () => { getOrgs: import('@jest/globals').Mock },
 *   BucketsAPI: new () => {
 *     getBuckets: import('@jest/globals').Mock,
 *     postBuckets: import('@jest/globals').Mock
 *   }
 * }} Mocked API classes.
 */
function createInfluxApisMock(fns) {
    /**
     * Mock OrgsAPI.
     */
    class OrgsAPI {
        /**
         * Create OrgsAPI instance.
         *
         * @param {unknown} client Influx client (unused).
         */
        constructor(client) {
            void client;
            this.getOrgs = fns.getOrgs;
        }
    }

    /**
     * Mock BucketsAPI.
     */
    class BucketsAPI {
        /**
         * Create BucketsAPI instance.
         *
         * @param {unknown} client Influx client (unused).
         */
        constructor(client) {
            void client;
            this.getBuckets = fns.getBuckets;
            this.postBuckets = fns.postBuckets;
        }
    }

    return { OrgsAPI, BucketsAPI };
}

beforeEach(() => {
    jest.resetModules();
});

describe('audit influx init', () => {
    test('returns early when audit API is disabled', async () => {
        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const { config } = createConfigStub({
            'Butler-SOS.auditEvents.enable': false,
            'Butler-SOS.auditEvents.destination.enable': true,
            'Butler-SOS.auditEvents.destination.type': 'influxdb',
            'Butler-SOS.auditEvents.destination.influxdb': {
                version: 1,
                v1Config: { dbName: 'db' },
            },
        });

        const getAuditInfluxClient = jest.fn();

        jest.unstable_mockModule('../../../../globals.js', () => ({
            default: {
                config,
                logger,
                getErrorMessage,
            },
        }));

        jest.unstable_mockModule('../shared/client.js', () => ({
            getAuditInfluxClient,
        }));

        jest.unstable_mockModule('@influxdata/influxdb-client-apis', () =>
            createInfluxApisMock({
                getOrgs: jest.fn(),
                getBuckets: jest.fn(),
                postBuckets: jest.fn(),
            })
        );

        jest.unstable_mockModule('@influxdata/influxdb-client', () => ({ HttpError }));

        const { initAuditInfluxDestination } = await import('../init.js');
        await initAuditInfluxDestination();

        expect(getAuditInfluxClient).not.toHaveBeenCalled();
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    test('returns early when destination type is not influxdb', async () => {
        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const { config } = createConfigStub({
            'Butler-SOS.auditEvents.enable': true,
            'Butler-SOS.auditEvents.destination.enable': true,
            'Butler-SOS.auditEvents.destination.type': 'mqtt',
            'Butler-SOS.auditEvents.destination.influxdb': {
                version: 1,
                v1Config: { dbName: 'db' },
            },
        });

        const getAuditInfluxClient = jest.fn();

        jest.unstable_mockModule('../../../../globals.js', () => ({
            default: {
                config,
                logger,
                getErrorMessage,
            },
        }));

        jest.unstable_mockModule('../shared/client.js', () => ({
            getAuditInfluxClient,
        }));

        jest.unstable_mockModule('@influxdata/influxdb-client-apis', () =>
            createInfluxApisMock({
                getOrgs: jest.fn(),
                getBuckets: jest.fn(),
                postBuckets: jest.fn(),
            })
        );

        jest.unstable_mockModule('@influxdata/influxdb-client', () => ({ HttpError }));

        const { initAuditInfluxDestination } = await import('../init.js');
        await initAuditInfluxDestination();

        expect(getAuditInfluxClient).not.toHaveBeenCalled();
    });

    test('v1 creates database + retention policy when missing', async () => {
        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const influxCfg = {
            version: 1,
            v1Config: {
                dbName: 'butler_audit',
                retentionPolicy: {
                    name: 'autogen',
                    duration: '0s',
                },
            },
        };

        const { config } = createConfigStub({
            'Butler-SOS.auditEvents.enable': true,
            'Butler-SOS.auditEvents.destination.enable': true,
            'Butler-SOS.auditEvents.destination.type': 'influxdb',
            'Butler-SOS.auditEvents.destination.influxdb': influxCfg,
        });

        const v1Client = {
            getDatabaseNames: jest.fn().mockResolvedValue(['other_db']),
            createDatabase: jest.fn().mockResolvedValue(undefined),
            createRetentionPolicy: jest.fn().mockResolvedValue(undefined),
        };

        const getAuditInfluxClient = jest.fn().mockReturnValue({ client: v1Client });

        jest.unstable_mockModule('../../../../globals.js', () => ({
            default: {
                config,
                logger,
                getErrorMessage,
            },
        }));

        jest.unstable_mockModule('../shared/client.js', () => ({
            getAuditInfluxClient,
        }));

        jest.unstable_mockModule('@influxdata/influxdb-client-apis', () =>
            createInfluxApisMock({
                getOrgs: jest.fn(),
                getBuckets: jest.fn(),
                postBuckets: jest.fn(),
            })
        );

        jest.unstable_mockModule('@influxdata/influxdb-client', () => ({ HttpError }));

        const { initAuditInfluxDestination } = await import('../init.js');
        await initAuditInfluxDestination();

        expect(v1Client.getDatabaseNames).toHaveBeenCalledTimes(1);
        expect(v1Client.createDatabase).toHaveBeenCalledWith('butler_audit');
        expect(v1Client.createRetentionPolicy).toHaveBeenCalledWith('autogen', {
            database: 'butler_audit',
            duration: '0s',
            replication: 1,
            isDefault: true,
        });
    });

    test('v1 does not create database when it already exists', async () => {
        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const influxCfg = {
            version: 1,
            v1Config: {
                dbName: 'butler_audit',
                retentionPolicy: {
                    name: 'autogen',
                    duration: '0s',
                },
            },
        };

        const { config } = createConfigStub({
            'Butler-SOS.auditEvents.enable': true,
            'Butler-SOS.auditEvents.destination.enable': true,
            'Butler-SOS.auditEvents.destination.type': 'influxdb',
            'Butler-SOS.auditEvents.destination.influxdb': influxCfg,
        });

        const v1Client = {
            getDatabaseNames: jest.fn().mockResolvedValue(['butler_audit']),
            createDatabase: jest.fn(),
            createRetentionPolicy: jest.fn(),
        };

        const getAuditInfluxClient = jest.fn().mockReturnValue({ client: v1Client });

        jest.unstable_mockModule('../../../../globals.js', () => ({
            default: {
                config,
                logger,
                getErrorMessage,
            },
        }));

        jest.unstable_mockModule('../shared/client.js', () => ({
            getAuditInfluxClient,
        }));

        jest.unstable_mockModule('@influxdata/influxdb-client-apis', () =>
            createInfluxApisMock({
                getOrgs: jest.fn(),
                getBuckets: jest.fn(),
                postBuckets: jest.fn(),
            })
        );

        jest.unstable_mockModule('@influxdata/influxdb-client', () => ({ HttpError }));

        const { initAuditInfluxDestination } = await import('../init.js');
        await initAuditInfluxDestination();

        expect(v1Client.getDatabaseNames).toHaveBeenCalledTimes(1);
        expect(v1Client.createDatabase).not.toHaveBeenCalled();
        expect(v1Client.createRetentionPolicy).not.toHaveBeenCalled();
    });

    test('v2 creates bucket when not found (404)', async () => {
        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const influxCfg = {
            version: 2,
            v2Config: {
                org: 'test-org',
                bucket: 'audit-bucket',
                description: 'Audit events bucket',
                retentionDuration: '0s',
            },
        };

        const { config } = createConfigStub({
            'Butler-SOS.auditEvents.enable': true,
            'Butler-SOS.auditEvents.destination.enable': true,
            'Butler-SOS.auditEvents.destination.type': 'influxdb',
            'Butler-SOS.auditEvents.destination.influxdb': influxCfg,
        });

        const getOrgs = jest.fn().mockResolvedValue({ orgs: [{ id: 'org-1' }] });
        const getBuckets = jest.fn();
        const postBuckets = jest.fn().mockResolvedValue(undefined);

        jest.unstable_mockModule('@influxdata/influxdb-client-apis', () =>
            createInfluxApisMock({ getOrgs, getBuckets, postBuckets })
        );

        jest.unstable_mockModule('@influxdata/influxdb-client', () => ({ HttpError }));

        getBuckets.mockRejectedValue(new HttpError(404));

        const getAuditInfluxClient = jest.fn().mockReturnValue({ client: {} });

        jest.unstable_mockModule('../../../../globals.js', () => ({
            default: {
                config,
                logger,
                getErrorMessage,
            },
        }));

        jest.unstable_mockModule('../shared/client.js', () => ({
            getAuditInfluxClient,
        }));

        const { initAuditInfluxDestination } = await import('../init.js');
        await initAuditInfluxDestination();

        expect(getOrgs).toHaveBeenCalledWith({ org: 'test-org' });
        expect(getBuckets).toHaveBeenCalledWith({ orgID: 'org-1', name: 'audit-bucket' });
        expect(postBuckets).toHaveBeenCalledWith({
            body: {
                orgID: 'org-1',
                name: 'audit-bucket',
                description: 'Audit events bucket',
                rp: '0s',
            },
        });
    });

    test('v2 does not create bucket when it already exists', async () => {
        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const influxCfg = {
            version: 2,
            v2Config: {
                org: 'test-org',
                bucket: 'audit-bucket',
                description: 'Audit events bucket',
                retentionDuration: '0s',
            },
        };

        const { config } = createConfigStub({
            'Butler-SOS.auditEvents.enable': true,
            'Butler-SOS.auditEvents.destination.enable': true,
            'Butler-SOS.auditEvents.destination.type': 'influxdb',
            'Butler-SOS.auditEvents.destination.influxdb': influxCfg,
        });

        const getOrgs = jest.fn().mockResolvedValue({ orgs: [{ id: 'org-1' }] });
        const getBuckets = jest.fn().mockResolvedValue({ buckets: [{ id: 'bucket-1' }] });
        const postBuckets = jest.fn();

        jest.unstable_mockModule('@influxdata/influxdb-client-apis', () =>
            createInfluxApisMock({ getOrgs, getBuckets, postBuckets })
        );

        jest.unstable_mockModule('@influxdata/influxdb-client', () => ({ HttpError }));

        const getAuditInfluxClient = jest.fn().mockReturnValue({ client: {} });

        jest.unstable_mockModule('../../../../globals.js', () => ({
            default: {
                config,
                logger,
                getErrorMessage,
            },
        }));

        jest.unstable_mockModule('../shared/client.js', () => ({
            getAuditInfluxClient,
        }));

        const { initAuditInfluxDestination } = await import('../init.js');
        await initAuditInfluxDestination();

        expect(getOrgs).toHaveBeenCalledWith({ org: 'test-org' });
        expect(getBuckets).toHaveBeenCalledWith({ orgID: 'org-1', name: 'audit-bucket' });
        expect(postBuckets).not.toHaveBeenCalled();
    });

    test('v3 never auto-creates (does not call getAuditInfluxClient)', async () => {
        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const influxCfg = {
            version: 3,
            v3Config: {
                database: 'audit',
                description: 'Audit events database',
                token: 't',
                retentionDuration: '0s',
                writeTimeout: 10000,
            },
        };

        const { config } = createConfigStub({
            'Butler-SOS.auditEvents.enable': true,
            'Butler-SOS.auditEvents.destination.enable': true,
            'Butler-SOS.auditEvents.destination.type': 'influxdb',
            'Butler-SOS.auditEvents.destination.influxdb': influxCfg,
        });

        const getAuditInfluxClient = jest.fn();

        jest.unstable_mockModule('../../../../globals.js', () => ({
            default: {
                config,
                logger,
                getErrorMessage,
            },
        }));

        jest.unstable_mockModule('../shared/client.js', () => ({
            getAuditInfluxClient,
        }));

        jest.unstable_mockModule('@influxdata/influxdb-client-apis', () =>
            createInfluxApisMock({
                getOrgs: jest.fn(),
                getBuckets: jest.fn(),
                postBuckets: jest.fn(),
            })
        );

        jest.unstable_mockModule('@influxdata/influxdb-client', () => ({ HttpError }));

        const { initAuditInfluxDestination } = await import('../init.js');
        await initAuditInfluxDestination();

        expect(getAuditInfluxClient).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalled();
    });
});
