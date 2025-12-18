import { jest, describe, test, expect } from '@jest/globals';
import { postErrorMetricsToInfluxdb } from '../error-metrics.js';

describe('error-metrics', () => {
    describe('postErrorMetricsToInfluxdb', () => {
        test('should resolve successfully with valid error stats', async () => {
            const errorStats = {
                HEALTH_API: {
                    total: 5,
                    servers: {
                        sense1: 3,
                        sense2: 2,
                    },
                },
                INFLUXDB_V3_WRITE: {
                    total: 2,
                    servers: {
                        _no_server_context: 2,
                    },
                },
            };

            await expect(postErrorMetricsToInfluxdb(errorStats)).resolves.toBeUndefined();
        });

        test('should resolve successfully with empty error stats', async () => {
            const errorStats = {};

            await expect(postErrorMetricsToInfluxdb(errorStats)).resolves.toBeUndefined();
        });

        test('should resolve successfully with null input', async () => {
            await expect(postErrorMetricsToInfluxdb(null)).resolves.toBeUndefined();
        });

        test('should resolve successfully with undefined input', async () => {
            await expect(postErrorMetricsToInfluxdb(undefined)).resolves.toBeUndefined();
        });

        test('should resolve successfully with complex error stats', async () => {
            const errorStats = {
                API_TYPE_1: {
                    total: 100,
                    servers: {
                        server1: 25,
                        server2: 25,
                        server3: 25,
                        server4: 25,
                    },
                },
                API_TYPE_2: {
                    total: 0,
                    servers: {},
                },
            };

            await expect(postErrorMetricsToInfluxdb(errorStats)).resolves.toBeUndefined();
        });
    });
});
