import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockGlobals = {
    logger: {
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    config: { get: jest.fn(), has: jest.fn() },
    hostInfo: { hostname: 'test-host' },
    udpQueueManagerUserActivity: null,
    udpQueueManagerLogEvents: null,
    auditEventsQueueManager: null,
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    isInfluxDbEnabled: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('shared/queue-metrics-builder', () => {
    let prepareQueueMetricData;
    let QUEUE_METRIC_FIELDS;
    let QUEUE_TYPE_CONFIGS;
    let mockQueueManager;

    beforeEach(async () => {
        jest.clearAllMocks();

        const builder = await import('../shared/queue-metrics-builder.js');
        prepareQueueMetricData = builder.prepareQueueMetricData;
        QUEUE_METRIC_FIELDS = builder.QUEUE_METRIC_FIELDS;
        QUEUE_TYPE_CONFIGS = builder.QUEUE_TYPE_CONFIGS;

        mockQueueManager = {
            getMetrics: jest.fn().mockResolvedValue({
                queueSize: 1,
                queueMaxSize: 10,
                queueUtilizationPct: 10.0,
                queuePending: 0,
                messagesReceived: 5,
                messagesQueued: 5,
                messagesProcessed: 4,
                messagesFailed: 0,
                messagesDroppedTotal: 1,
                messagesDroppedRateLimit: 0,
                messagesDroppedQueueFull: 1,
                messagesDroppedSize: 0,
                processingTimeAvgMs: 1.5,
                processingTimeP95Ms: 2.5,
                processingTimeMaxMs: 3.5,
                rateLimitCurrent: 50,
                backpressureActive: 0,
            }),
            clearMetrics: jest.fn(),
        };

        mockGlobals.config.get.mockImplementation((path) => {
            if (path.includes('measurementName')) return 'queue_metrics_test';
            if (path.includes('tags')) return [{ name: 'env', value: 'unit' }];
            if (path.includes('enable')) return true;
            return undefined;
        });
        mockGlobals.config.has.mockReturnValue(true);
        mockGlobals.udpQueueManagerUserActivity = mockQueueManager;
        mockGlobals.udpQueueManagerLogEvents = mockQueueManager;
        mockGlobals.auditEventsQueueManager = mockQueueManager;
        mockUtils.isInfluxDbEnabled.mockReturnValue(true);
    });

    describe('QUEUE_METRIC_FIELDS', () => {
        test('exposes a stable set of fields with name/source/type', () => {
            expect(Array.isArray(QUEUE_METRIC_FIELDS)).toBe(true);
            expect(QUEUE_METRIC_FIELDS.length).toBe(17);
            for (const field of QUEUE_METRIC_FIELDS) {
                expect(typeof field.name).toBe('string');
                expect(typeof field.source).toBe('string');
                expect(['int', 'float']).toContain(field.type);
            }
        });

        test('includes the canonical queue metric field names', () => {
            const names = QUEUE_METRIC_FIELDS.map((f) => f.name);
            expect(names).toEqual(
                expect.arrayContaining([
                    'queue_size',
                    'queue_max_size',
                    'queue_utilization_pct',
                    'queue_running',
                    'messages_received',
                    'messages_queued',
                    'messages_processed',
                    'messages_failed',
                    'messages_dropped_total',
                    'messages_dropped_rate_limit',
                    'messages_dropped_queue_full',
                    'messages_dropped_size',
                    'processing_time_avg_ms',
                    'processing_time_p95_ms',
                    'processing_time_max_ms',
                    'rate_limit_current',
                    'backpressure_active',
                ])
            );
        });
    });

    describe('QUEUE_TYPE_CONFIGS', () => {
        test('defines the three known queue types', () => {
            expect(Object.keys(QUEUE_TYPE_CONFIGS).sort()).toEqual([
                'audit_events',
                'log_events',
                'user_events',
            ]);
        });

        test('audit_events uses config.has() guard', () => {
            expect(QUEUE_TYPE_CONFIGS.audit_events.useConfigHas).toBe(true);
            expect(QUEUE_TYPE_CONFIGS.user_events.useConfigHas).toBe(false);
            expect(QUEUE_TYPE_CONFIGS.log_events.useConfigHas).toBe(false);
        });
    });

    describe('prepareQueueMetricData', () => {
        test('throws when queue type is unknown', async () => {
            await expect(
                prepareQueueMetricData('unknown_queue', 'TEST PREFIX')
            ).rejects.toThrow('Unknown queue type: unknown_queue');
        });

        test('returns null when feature is disabled', async () => {
            mockGlobals.config.get.mockImplementation((path) => {
                if (path.includes('enable')) return false;
                return undefined;
            });
            const result = await prepareQueueMetricData('user_events', 'TEST PREFIX');
            expect(result).toBeNull();
            expect(mockUtils.isInfluxDbEnabled).not.toHaveBeenCalled();
        });

        test('returns null when audit events config has no enable key', async () => {
            mockGlobals.config.has.mockReturnValue(false);
            const result = await prepareQueueMetricData('audit_events', 'AUDIT TEST');
            expect(result).toBeNull();
        });

        test('warns and returns null when queue manager is not initialised', async () => {
            mockGlobals.udpQueueManagerUserActivity = null;
            const result = await prepareQueueMetricData('user_events', 'USER TEST');
            expect(result).toBeNull();
            expect(mockGlobals.logger.warn).toHaveBeenCalledWith(
                'USER TEST: Queue manager not initialized'
            );
        });

        test('returns null when InfluxDB itself is disabled', async () => {
            mockUtils.isInfluxDbEnabled.mockReturnValue(false);
            const result = await prepareQueueMetricData('user_events', 'USER TEST');
            expect(result).toBeNull();
            expect(mockQueueManager.getMetrics).not.toHaveBeenCalled();
        });

        test('returns the prepared payload when everything is enabled', async () => {
            const result = await prepareQueueMetricData('log_events', 'LOG TEST');
            expect(result).not.toBeNull();
            expect(result.config).toBe(QUEUE_TYPE_CONFIGS.log_events);
            expect(result.queueManager).toBe(mockQueueManager);
            expect(result.measurementName).toBe('queue_metrics_test');
            expect(result.configTags).toEqual([{ name: 'env', value: 'unit' }]);
            expect(result.metrics.queueSize).toBe(1);
            expect(mockQueueManager.getMetrics).toHaveBeenCalledTimes(1);
        });
    });
});
