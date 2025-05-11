import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Update the mock implementation of prom-client
jest.unstable_mockModule('prom-client', () => {
    const mockSet = jest.fn();
    const mockGauge = jest.fn().mockImplementation(() => ({
        set: mockSet,
    }));

    return {
        default: {
            Registry: jest.fn().mockImplementation(() => ({
                registerMetric: jest.fn(),
                metrics: jest.fn().mockResolvedValue('test metrics'),
                contentType: 'text/plain; version=0.0.4; charset=utf-8',
            })),
            Gauge: mockGauge,
        },
    };
});

// Mock globals
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            error: jest.fn(),
            info: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            silly: jest.fn(),
        },
        serverList: [
            {
                serverName: 'server1',
                host: 'host1.example.com',
                serverTags: { environment: 'production' },
            },
        ],
        getLoggingLevel: jest.fn().mockReturnValue('info'),
    },
}));

// Mock servertags
jest.unstable_mockModule('../servertags.js', () => ({
    getServerTags: jest.fn().mockImplementation(() => ({
        server_name: 'server1',
        server_environment: 'production',
    })),
}));

// Import the module under test
const { setupPromClient, saveHealthMetricsToPrometheus } = await import('../prom-client.js');

describe('prom-client', () => {
    let promClient;
    let client;
    let globals;
    let servertags;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Get mocked modules
        client = (await import('prom-client')).default;
        globals = (await import('../../globals.js')).default;
        servertags = await import('../servertags.js');
    });

    describe('setupPromClient', () => {
        test('should set up Prometheus client', async () => {
            // Execute
            await setupPromClient(true, 9090, 'localhost');

            // Verify
            expect(globals.logger.verbose).toHaveBeenCalledWith(
                expect.stringContaining('Setting up Prometheus client for server')
            );
            expect(client.Gauge).toHaveBeenCalled();
        });

        test('should handle errors gracefully', async () => {
            // Setup
            client.Gauge.mockImplementation(() => {
                throw new Error('Test error');
            });

            // Execute
            await setupPromClient(true, 9090, 'localhost');

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error setting up Prometheus client')
            );
        });

        test('should not set up client if prometheus is disabled', async () => {
            // Execute
            await setupPromClient(false, 9090, 'localhost');

            // Verify
            expect(client.Gauge).not.toHaveBeenCalled();
        });
    });

    describe('saveHealthMetricsToPrometheus', () => {
        test('should set metrics based on provided data', async () => {
            // Setup
            const host = 'test-host';
            const labels = { server_name: 'server1', environment: 'test' };
            const data = {
                apps: {
                    calls: 100,
                    selections: 50,
                    active_docs: ['doc1', 'doc2'],
                    in_memory_docs: ['doc1', 'doc2', 'doc3'],
                    loaded_docs: ['doc1', 'doc2'],
                },
                cache: {
                    added: 10,
                    bytes_added: 1024,
                    hits: 20,
                    lookups: 30,
                    replaced: 5,
                },
                saturated: true,
                cpu: {
                    total: 45.6,
                },
                mem: {
                    committed: 4.5,
                    allocated: 8.2,
                    free: 2.3,
                },
                session: {
                    active: 15,
                    total: 25,
                },
                users: {
                    active: 10,
                    total: 20,
                },
                version: '12.1.0.0',
                started: '2023-05-01T10:00:00.000Z',
            };

            // Create mock gauge instances
            const mockGauge = {
                set: jest.fn(),
            };

            // Replace all gauge instances with our mock
            client.Gauge.mockImplementation(() => mockGauge);

            // Call setupPromClient to initialize the metric variables with our mocks
            await setupPromClient(true, 9090, 'localhost');

            // Execute
            saveHealthMetricsToPrometheus(host, data, labels);

            // Verify that set() was called multiple times with the correct values
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 100); // apps.calls
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 50); // apps.selections
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 2); // apps.active_docs.length
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 3); // apps.in_memory_docs.length
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 2); // apps.loaded_docs.length
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 10); // cache.added
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 1024); // cache.bytes_added
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 1); // cache.saturated (true → 1)
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 45.6); // cpu.total
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 4.5 * 1048576); // mem.committed
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 8.2 * 1048576); // mem.allocated
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 2.3 * 1048576); // mem.free
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 15); // session.active
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 25); // session.total
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 10); // users.active
            expect(mockGauge.set).toHaveBeenCalledWith(labels, 20); // users.total

            // Check metadata was set with extended labels
            expect(mockGauge.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...labels,
                    engine_version: '12.1.0.0',
                    engine_started: '2023-05-01T10:00:00.000Z',
                }),
                1
            );
        });

        test('should handle errors gracefully', () => {
            // Setup
            const host = 'test-host';
            const labels = { server_name: 'server1', environment: 'test' };
            const data = {
                apps: {
                    calls: 100,
                    // Missing required fields to trigger error
                },
            };

            // Create mock gauge that throws error
            const mockGauge = {
                set: jest.fn().mockImplementation(() => {
                    throw new Error('Test error');
                }),
            };

            client.Gauge.mockImplementation(() => mockGauge);

            // Execute
            saveHealthMetricsToPrometheus(host, data, labels);

            // Verify
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error saving health data for Prometheus!')
            );
        });

        test('should handle saturated false value', async () => {
            // Setup
            const host = 'test-host';
            const labels = { server_name: 'server1', environment: 'test' };
            const data = {
                apps: {
                    calls: 100,
                    selections: 50,
                    active_docs: ['doc1', 'doc2'],
                    in_memory_docs: ['doc1', 'doc2', 'doc3'],
                    loaded_docs: ['doc1', 'doc2'],
                },
                cache: {
                    added: 10,
                    bytes_added: 1024,
                    hits: 20,
                    lookups: 30,
                    replaced: 5,
                },
                saturated: false,
                cpu: {
                    total: 45.6,
                },
                mem: {
                    committed: 4.5,
                    allocated: 8.2,
                    free: 2.3,
                },
                session: {
                    active: 15,
                    total: 25,
                },
                users: {
                    active: 10,
                    total: 20,
                },
                version: '12.1.0.0',
                started: '2023-05-01T10:00:00.000Z',
            };
            // Create separate mocks for each metric
            const mockGauges = {};
            const metricNames = [
                'butlersos_apps_calls',
                'butlersos_apps_selections',
                'butlersos_apps_activedocs_total',
                'butlersos_apps_inmemorydocs_total',
                'butlersos_apps_loadeddocs_total',
                'butlersos_cache_added',
                'butlersos_cache_bytes_added',
                'butlersos_cache_hits',
                'butlersos_cache_lookups',
                'butlersos_cache_replaced',
                'butlersos_cache_saturated',
                'butlersos_cpu_total',
                'butlersos_mem_committed',
                'butlersos_mem_allocated',
                'butlersos_mem_free',
                'butlersos_session_active',
                'butlersos_session_total',
                'butlersos_users_active',
                'butlersos_users_total',
                'butlersos_engine_metadata',
            ];
            metricNames.forEach((name) => {
                mockGauges[name] = { set: jest.fn() };
            });

            client.Gauge.mockImplementation(({ name }) => {
                return mockGauges[name] || { set: jest.fn() };
            });

            // Call setupPromClient to initialize the metric variables with our mocks
            await setupPromClient(true, 9090, 'localhost');

            // Execute
            saveHealthMetricsToPrometheus(host, data, labels);

            // Verify that saturated=false is converted to 0
            expect(mockGauges['butlersos_cache_saturated'].set).toHaveBeenCalledWith(labels, 0);
        });
    });
});
