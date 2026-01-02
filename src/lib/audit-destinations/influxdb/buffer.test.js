import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

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
 * Flush pending microtasks/promises.
 *
 * @returns {Promise<void>} Resolves after letting the event loop progress.
 */
function flushPromises() {
    return Promise.resolve();
}

describe('audit influx buffer', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('flushes immediately when maxBatchSize is reached', async () => {
        const writePoints = jest.fn().mockResolvedValue(undefined);

        const { store, config } = createConfigStub({
            'Butler-SOS.auditEvents.destination.enable': true,
        });

        const influxCfg = {
            host: 'localhost',
            port: 8086,
            version: 1,
            maxBatchSize: 2,
            writeFrequency: 20000,
            measurementName: 'audit_event',
            auditEventSchemaVersion: '1',
            staticTags: [],
            v3Config: {
                database: 'butler_audit',
                token: 'test-token',
                retentionDuration: '0s',
            },
            v2Config: {
                org: 'test-org',
                bucket: 'test-bucket',
                token: 'test-token',
                retentionDuration: '0s',
            },
            v1Config: {
                auth: {
                    enable: false,
                    username: '',
                    password: '',
                },
                dbName: 'butler_audit',
                retentionPolicy: {
                    name: 'autogen',
                    duration: '0s',
                },
            },
        };

        store.set('Butler-SOS.auditEvents.destination.influxdb', influxCfg);

        /**
         * Format an error as string.
         *
         * @param {unknown} err Error object.
         * @returns {string} Error message.
         */
        const getErrorMessage = (err) =>
            err && typeof err === 'object' && 'message' in err
                ? String(/** @type {{ message?: unknown }} */ (err).message ?? err)
                : String(err);

        /**
         * Run a queue job.
         *
         * @param {() => Promise<void>} fn Queue job.
         * @returns {Promise<void>} Resolves when job completes.
         */
        const addToQueue = async (fn) => fn();

        const globalsMock = {
            config,
            logger: {
                verbose: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            },
            getErrorMessage,
            auditEventsQueueManager: {
                addToQueue,
            },
        };

        jest.unstable_mockModule('../../../globals.js', () => ({ default: globalsMock }));
        jest.unstable_mockModule('./shared/mapping.js', () => {
            /**
             * Build a minimal deterministic point model for tests.
             *
             * @returns {{ measurementName: string, tags: Record<string,string>, fields: Record<string, string|number|boolean> }} Point model.
             */
            const buildAuditInfluxPointModel = () => ({
                measurementName: 'audit_event',
                tags: { eventType: 'test', auditEventSchemaVersion: '1' },
                fields: { value: 1 },
            });

            return { buildAuditInfluxPointModel };
        });
        jest.unstable_mockModule('./shared/client.js', () => {
            /**
             * Create a minimal audit Influx client.
             *
             * @returns {{ version: number, client: unknown }} Client info.
             */
            const getAuditInfluxClient = () => ({ version: 1, client: { writePoints } });
            return { getAuditInfluxClient };
        });
        jest.unstable_mockModule('../../influxdb/shared/utils.js', () => ({
            /**
             * Invoke write function without retries.
             *
             * @param {() => Promise<unknown>} fn Write function.
             * @returns {Promise<unknown>} Result.
             */
            writeToInfluxWithRetry: async (fn) => fn(),
        }));

        const { bufferAuditInfluxEvent } = await import('./buffer.js');

        const envelope = {
            schemaVersion: 1,
            eventId: 'e-1',
            timestamp: new Date().toISOString(),
            type: 'selection.state.changed',
            payload: {
                context: { user: 'LAB\\goran', appId: 'a', appName: 'app' },
                event: { selectionTxnId: 't-1' },
            },
        };

        bufferAuditInfluxEvent(envelope);
        bufferAuditInfluxEvent({ ...envelope, eventId: 'e-2' });

        await flushPromises();

        expect(writePoints).toHaveBeenCalledTimes(1);
        expect(writePoints.mock.calls[0][0]).toHaveLength(2);

        // Clean up timer/buffer
        store.set('Butler-SOS.auditEvents.destination.enable', false);
        bufferAuditInfluxEvent(envelope);
    });

    test('flushes on interval when writeFrequency is set', async () => {
        jest.useFakeTimers();

        const writePoints = jest.fn().mockResolvedValue(undefined);

        const { store, config } = createConfigStub({
            'Butler-SOS.auditEvents.destination.enable': true,
        });

        const influxCfg = {
            host: 'localhost',
            port: 8086,
            version: 1,
            maxBatchSize: 100,
            writeFrequency: 50,
            measurementName: 'audit_event',
            auditEventSchemaVersion: '1',
            staticTags: [],
            v3Config: {
                database: 'butler_audit',
                token: 'test-token',
                retentionDuration: '0s',
            },
            v2Config: {
                org: 'test-org',
                bucket: 'test-bucket',
                token: 'test-token',
                retentionDuration: '0s',
            },
            v1Config: {
                auth: {
                    enable: false,
                    username: '',
                    password: '',
                },
                dbName: 'butler_audit',
                retentionPolicy: {
                    name: 'autogen',
                    duration: '0s',
                },
            },
        };

        store.set('Butler-SOS.auditEvents.destination.influxdb', influxCfg);

        /**
         * Format an error as string.
         *
         * @param {unknown} err Error object.
         * @returns {string} Error message.
         */
        const getErrorMessage = (err) =>
            err && typeof err === 'object' && 'message' in err
                ? String(/** @type {{ message?: unknown }} */ (err).message ?? err)
                : String(err);

        /**
         * Run a queue job.
         *
         * @param {() => Promise<void>} fn Queue job.
         * @returns {Promise<void>} Resolves when job completes.
         */
        const addToQueue = async (fn) => fn();

        const globalsMock = {
            config,
            logger: {
                verbose: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            },
            getErrorMessage,
            auditEventsQueueManager: {
                addToQueue,
            },
        };

        jest.unstable_mockModule('../../../globals.js', () => ({ default: globalsMock }));
        jest.unstable_mockModule('./shared/mapping.js', () => {
            /**
             * Build a minimal deterministic point model for tests.
             *
             * @returns {{ measurementName: string, tags: Record<string,string>, fields: Record<string, string|number|boolean> }} Point model.
             */
            const buildAuditInfluxPointModel = () => ({
                measurementName: 'audit_event',
                tags: { eventType: 'test', auditEventSchemaVersion: '1' },
                fields: { value: 1 },
            });

            return { buildAuditInfluxPointModel };
        });
        jest.unstable_mockModule('./shared/client.js', () => {
            /**
             * Create a minimal audit Influx client.
             *
             * @returns {{ version: number, client: unknown }} Client info.
             */
            const getAuditInfluxClient = () => ({ version: 1, client: { writePoints } });
            return { getAuditInfluxClient };
        });
        jest.unstable_mockModule('../../influxdb/shared/utils.js', () => ({
            /**
             * Invoke write function without retries.
             *
             * @param {() => Promise<unknown>} fn Write function.
             * @returns {Promise<unknown>} Result.
             */
            writeToInfluxWithRetry: async (fn) => fn(),
        }));

        const { bufferAuditInfluxEvent } = await import('./buffer.js');

        const envelope = {
            schemaVersion: 1,
            eventId: 'e-1',
            timestamp: new Date().toISOString(),
            type: 'selection.state.changed',
            payload: {
                context: { user: 'LAB\\goran', appId: 'a', appName: 'app' },
                event: { selectionTxnId: 't-1' },
            },
        };

        bufferAuditInfluxEvent(envelope);

        jest.advanceTimersByTime(60);
        await flushPromises();
        await flushPromises();

        expect(writePoints).toHaveBeenCalledTimes(1);
        expect(writePoints.mock.calls[0][0]).toHaveLength(1);

        // Clean up timer/buffer
        store.set('Butler-SOS.auditEvents.destination.enable', false);
        bufferAuditInfluxEvent(envelope);
    });
});
