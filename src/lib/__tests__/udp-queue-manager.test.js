/**
 * Tests for UDP Queue Manager
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { UdpQueueManager, sanitizeField } from '../udp-queue-manager.js';

describe('sanitizeField', () => {
    it('should remove control characters from string', () => {
        const input = 'Hello\x00World\x1FTest\x7F';
        const result = sanitizeField(input);
        expect(result).toBe('HelloWorldTest');
    });

    it('should limit string length to default 500 characters', () => {
        const input = 'a'.repeat(1000);
        const result = sanitizeField(input);
        expect(result).toHaveLength(500);
    });

    it('should limit string length to custom maxLength', () => {
        const input = 'a'.repeat(1000);
        const result = sanitizeField(input, 100);
        expect(result).toHaveLength(100);
    });

    it('should handle non-string input by converting to string', () => {
        const result = sanitizeField(12345);
        expect(result).toBe('12345');
    });

    it('should handle empty string', () => {
        const result = sanitizeField('');
        expect(result).toBe('');
    });

    it('should remove newlines and carriage returns', () => {
        const input = 'Line1\nLine2\rLine3';
        const result = sanitizeField(input);
        expect(result).toBe('Line1Line2Line3');
    });

    it('should preserve normal characters', () => {
        const input = 'Hello World! 123 @#$%';
        const result = sanitizeField(input);
        expect(result).toBe('Hello World! 123 @#$%');
    });
});

describe('UdpQueueManager', () => {
    let queueManager;
    let mockLogger;
    let config;

    beforeEach(() => {
        mockLogger = {
            warn: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        config = {
            messageQueue: {
                maxConcurrent: 5,
                maxSize: 10,
                backpressureThreshold: 80,
            },
            rateLimit: {
                enable: false,
                maxMessagesPerMinute: 60,
            },
            maxMessageSize: 1024,
        };

        queueManager = new UdpQueueManager(config, mockLogger, 'test-queue');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct config', () => {
            expect(queueManager.config).toEqual(config);
            expect(queueManager.logger).toEqual(mockLogger);
            expect(queueManager.queueType).toBe('test-queue');
        });

        it('should initialize rate limiter when enabled', () => {
            const configWithRateLimit = {
                ...config,
                rateLimit: { enable: true, maxMessagesPerMinute: 60 },
            };
            const qm = new UdpQueueManager(configWithRateLimit, mockLogger, 'test');
            expect(qm.rateLimiter).toBeTruthy();
        });

        it('should not initialize rate limiter when disabled', () => {
            expect(queueManager.rateLimiter).toBeNull();
        });
    });

    describe('validateMessageSize', () => {
        it('should accept message within size limit', () => {
            const message = Buffer.from('small message');
            expect(queueManager.validateMessageSize(message)).toBe(true);
        });

        it('should reject message exceeding size limit', () => {
            const message = Buffer.alloc(2000);
            expect(queueManager.validateMessageSize(message)).toBe(false);
        });

        it('should handle string messages', () => {
            const message = 'test string';
            expect(queueManager.validateMessageSize(message)).toBe(true);
        });
    });

    describe('checkRateLimit', () => {
        it('should return true when rate limiting is disabled', () => {
            expect(queueManager.checkRateLimit()).toBe(true);
        });

        it('should respect rate limit when enabled', () => {
            const configWithRateLimit = {
                ...config,
                rateLimit: { enable: true, maxMessagesPerMinute: 5 },
            };
            const qm = new UdpQueueManager(configWithRateLimit, mockLogger, 'test');

            // Should accept first 5 messages
            for (let i = 0; i < 5; i++) {
                expect(qm.checkRateLimit()).toBe(true);
            }

            // Should reject 6th message
            expect(qm.checkRateLimit()).toBe(false);
        });

        it('should reset rate limit after 1 minute', async () => {
            const configWithRateLimit = {
                ...config,
                rateLimit: { enable: true, maxMessagesPerMinute: 2 },
            };
            const qm = new UdpQueueManager(configWithRateLimit, mockLogger, 'test');

            // Fill up the rate limit
            expect(qm.checkRateLimit()).toBe(true);
            expect(qm.checkRateLimit()).toBe(true);
            expect(qm.checkRateLimit()).toBe(false);

            // Fast-forward time by 61 seconds
            jest.useFakeTimers();
            jest.advanceTimersByTime(61000);

            // Should accept messages again
            expect(qm.checkRateLimit()).toBe(true);

            jest.useRealTimers();
        });
    });

    describe('addToQueue', () => {
        it('should queue and process messages', async () => {
            const processFunction = jest.fn().mockResolvedValue();
            const result = await queueManager.addToQueue(processFunction);

            expect(result).toBe(true);

            // Wait for queue to process
            await queueManager.queue.onIdle();

            expect(processFunction).toHaveBeenCalled();
        });

        it('should reject messages when queue is full', async () => {
            // Use very slow processing to ensure queue fills up
            const processFunction = jest.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        // Never resolve during test - keep queue full
                    })
            );

            // Rapidly add more messages than queue can hold
            // maxConcurrent: 5, maxSize: 10
            // Queue.size only counts pending (not currently processing)
            // So: 5 processing + 5 pending (queue.size=5) = 10 total capacity
            // When we try to add 20, some should be rejected
            const promises = [];
            for (let i = 0; i < 20; i++) {
                promises.push(queueManager.addToQueue(processFunction));
            }

            // Wait for all attempts to complete
            const results = await Promise.all(promises);

            // Count rejections and acceptances
            const rejectedCount = results.filter((r) => r === false).length;
            const acceptedCount = results.filter((r) => r === true).length;

            // We should have some rejections (at least a few)
            expect(rejectedCount).toBeGreaterThanOrEqual(5);
            // And total should be 20
            expect(acceptedCount + rejectedCount).toBe(20);
        });

        it('should track metrics for processed messages', async () => {
            const processFunction = jest.fn().mockResolvedValue();
            await queueManager.addToQueue(processFunction);

            await queueManager.queue.onIdle();

            const metrics = await queueManager.getMetrics();
            expect(metrics.messagesReceived).toBe(1);
            expect(metrics.messagesQueued).toBe(1);
            expect(metrics.messagesProcessed).toBe(1);
        });

        it('should track failed messages', async () => {
            const processFunction = jest.fn().mockRejectedValue(new Error('Test error'));
            await queueManager.addToQueue(processFunction);

            await queueManager.queue.onIdle();

            const metrics = await queueManager.getMetrics();
            expect(metrics.messagesFailed).toBe(1);
        });
    });

    describe('handleRateLimitDrop', () => {
        it('should increment rate limit drop counter', async () => {
            await queueManager.handleRateLimitDrop();

            const metrics = await queueManager.getMetrics();
            expect(metrics.messagesDroppedRateLimit).toBe(1);
            expect(metrics.messagesDroppedTotal).toBe(1);
        });
    });

    describe('handleSizeDrop', () => {
        it('should increment size drop counter', async () => {
            await queueManager.handleSizeDrop();

            const metrics = await queueManager.getMetrics();
            expect(metrics.messagesDroppedSize).toBe(1);
            expect(metrics.messagesDroppedTotal).toBe(1);
        });
    });

    describe('getMetrics', () => {
        it('should return all metrics', async () => {
            const metrics = await queueManager.getMetrics();

            expect(metrics).toHaveProperty('queueSize');
            expect(metrics).toHaveProperty('queueMaxSize');
            expect(metrics).toHaveProperty('queueUtilizationPct');
            expect(metrics).toHaveProperty('messagesReceived');
            expect(metrics).toHaveProperty('messagesQueued');
            expect(metrics).toHaveProperty('messagesProcessed');
            expect(metrics).toHaveProperty('messagesFailed');
            expect(metrics).toHaveProperty('messagesDroppedTotal');
            expect(metrics).toHaveProperty('messagesDroppedRateLimit');
            expect(metrics).toHaveProperty('messagesDroppedQueueFull');
            expect(metrics).toHaveProperty('messagesDroppedSize');
            expect(metrics).toHaveProperty('processingTimeAvgMs');
            expect(metrics).toHaveProperty('processingTimeP95Ms');
            expect(metrics).toHaveProperty('processingTimeMaxMs');
            expect(metrics).toHaveProperty('backpressureActive');
        });

        it('should calculate queue utilization correctly', async () => {
            const processFunction = jest.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        // Never resolve - keep in pending state
                    })
            );

            // Add messages that will be pending
            for (let i = 0; i < 5; i++) {
                await queueManager.addToQueue(processFunction);
            }

            // Check metrics - pending count should be > 0
            const metrics = await queueManager.getMetrics();
            expect(metrics.queuePending).toBeGreaterThan(0);
            expect(metrics.messagesQueued).toBe(5);
        });
    });

    describe('clearMetrics', () => {
        it('should reset all metrics', async () => {
            // Generate some metrics
            const processFunction = jest.fn().mockResolvedValue();
            await queueManager.addToQueue(processFunction);
            await queueManager.handleRateLimitDrop();
            await queueManager.handleSizeDrop();

            await queueManager.queue.onIdle();

            // Clear metrics
            await queueManager.clearMetrics();

            const metrics = await queueManager.getMetrics();
            expect(metrics.messagesReceived).toBe(0);
            expect(metrics.messagesQueued).toBe(0);
            expect(metrics.messagesProcessed).toBe(0);
            expect(metrics.messagesFailed).toBe(0);
            expect(metrics.messagesDroppedTotal).toBe(0);
            expect(metrics.messagesDroppedRateLimit).toBe(0);
            expect(metrics.messagesDroppedQueueFull).toBe(0);
            expect(metrics.messagesDroppedSize).toBe(0);
        });
    });

    describe('checkBackpressure', () => {
        it('should activate backpressure when threshold exceeded', async () => {
            const processFunction = jest.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        // Never resolve - keep queue full
                    })
            );

            // Fill queue beyond backpressure threshold (80% of maxSize=10 means 8)
            // Queue.size only counts pending items (not currently processing)
            // So to get queue.size = 8, we need: 5 processing + 8 pending = 13 total
            const promises = [];
            for (let i = 0; i < 13; i++) {
                promises.push(queueManager.addToQueue(processFunction));
            }
            await Promise.all(promises);

            // Check backpressure
            await queueManager.checkBackpressure();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Backpressure detected')
            );
        });

        it('should clear backpressure when utilization drops', async () => {
            queueManager.backpressureActive = true;

            await queueManager.checkBackpressure();

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Backpressure cleared')
            );
        });
    });

    describe('CircularBuffer', () => {
        it('should track processing times', async () => {
            const processFunction = jest.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(resolve, 10);
                    })
            );

            await queueManager.addToQueue(processFunction);
            await queueManager.queue.onIdle();

            const metrics = await queueManager.getMetrics();
            expect(metrics.processingTimeAvgMs).toBeGreaterThan(0);
            expect(metrics.processingTimeMaxMs).toBeGreaterThan(0);
        });

        it('should calculate 95th percentile', async () => {
            // Add messages with varying processing times
            for (let i = 0; i < 20; i++) {
                const processFunction = jest.fn().mockImplementation(
                    () =>
                        new Promise((resolve) => {
                            setTimeout(resolve, i * 5);
                        })
                );
                await queueManager.addToQueue(processFunction);
            }

            await queueManager.queue.onIdle();

            const metrics = await queueManager.getMetrics();
            expect(metrics.processingTimeP95Ms).toBeGreaterThan(0);
        });
    });

    describe('logDroppedMessages', () => {
        it('should log dropped messages after 60 seconds', async () => {
            jest.useFakeTimers();

            queueManager.droppedSinceLastLog = 5;

            jest.advanceTimersByTime(61000);

            queueManager.logDroppedMessages();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Dropped 5 messages')
            );

            jest.useRealTimers();
        });

        it('should not log if no messages dropped', () => {
            queueManager.logDroppedMessages();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });
    });
});
