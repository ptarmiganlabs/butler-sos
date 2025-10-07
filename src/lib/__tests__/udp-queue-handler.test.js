import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock p-queue
jest.unstable_mockModule('p-queue', () => ({
    default: jest.fn().mockImplementation(function (config) {
        this.size = 0;
        this.pending = 0;
        this.concurrency = config.concurrency;
        this.add = jest.fn().mockImplementation(async (fn) => {
            this.size += 1;
            this.pending += 1;
            try {
                await fn();
            } finally {
                this.size -= 1;
                this.pending -= 1;
            }
        });
        this.onEmpty = jest.fn().mockResolvedValue();
        this.onIdle = jest.fn().mockResolvedValue();
        return this;
    }),
}));

describe('UdpQueueHandler', () => {
    let UdpQueueHandler;
    let mockLogger;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockLogger = {
            info: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            silly: jest.fn(),
        };

        // Import the module under test
        const module = await import('../udp-queue-handler.js');
        UdpQueueHandler = module.UdpQueueHandler;
    });

    describe('constructor', () => {
        test('should initialize with correct configuration', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: true,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);

            expect(handler.name).toBe('TestQueue');
            expect(handler.config.maxConcurrent).toBe(5);
            expect(handler.config.maxSize).toBe(100);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('TestQueue')
            );
        });
    });

    describe('sanitizeField', () => {
        test('should remove control characters from string', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: false,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);
            const result = handler.sanitizeField('test\x00\x01\x1Fstring');

            expect(result).toBe('teststring');
        });

        test('should limit string length', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: false,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);
            const longString = 'a'.repeat(600);
            const result = handler.sanitizeField(longString, 100);

            expect(result.length).toBe(100);
        });
    });

    describe('checkRateLimit', () => {
        test('should not rate limit when disabled', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: false,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);
            const result = handler.checkRateLimit();

            expect(result).toBe(false);
        });

        test('should rate limit when threshold exceeded', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: true,
                maxMessagesPerMinute: 5,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);

            // Add messages to exceed limit
            for (let i = 0; i < 6; i++) {
                handler.checkRateLimit();
            }

            // Next call should be rate limited
            const result = handler.checkRateLimit();
            expect(result).toBe(true);
        });
    });

    describe('addMessage', () => {
        test('should drop message if size exceeds limit', async () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: false,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 100,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);
            const largeMessage = Buffer.alloc(200);
            const mockHandler = jest.fn();

            const result = await handler.addMessage(largeMessage, {}, mockHandler);

            expect(result).toBe(false);
            expect(handler.metrics.messagesDroppedSize).toBe(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Message size')
            );
        });

        test('should queue message when within limits', async () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: false,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);
            const message = Buffer.from('test message');
            const mockHandler = jest.fn().mockResolvedValue();

            const result = await handler.addMessage(message, {}, mockHandler);

            expect(result).toBe(true);
            expect(handler.metrics.messagesReceived).toBe(1);
            expect(handler.metrics.messagesQueued).toBe(1);
        });

        test('should drop message when rate limit exceeded', async () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: true,
                maxMessagesPerMinute: 2,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);
            const message = Buffer.from('test message');
            const mockHandler = jest.fn().mockResolvedValue();

            // Add messages to exceed rate limit
            await handler.addMessage(message, {}, mockHandler);
            await handler.addMessage(message, {}, mockHandler);
            await handler.addMessage(message, {}, mockHandler);

            expect(handler.metrics.messagesDroppedRateLimit).toBeGreaterThan(0);
        });
    });

    describe('getMetrics', () => {
        test('should return correct metrics structure', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: true,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);
            const metrics = handler.getMetrics();

            expect(metrics).toHaveProperty('name');
            expect(metrics).toHaveProperty('queue');
            expect(metrics).toHaveProperty('messages');
            expect(metrics).toHaveProperty('dropped');
            expect(metrics).toHaveProperty('processingTime');
            expect(metrics).toHaveProperty('rateLimit');
            expect(metrics).toHaveProperty('backpressure');

            expect(metrics.queue).toHaveProperty('currentSize');
            expect(metrics.queue).toHaveProperty('maxSize');
            expect(metrics.queue).toHaveProperty('utilizationPercent');
        });
    });

    describe('checkBackpressure', () => {
        test('should activate backpressure when threshold exceeded', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 10,
                dropStrategy: 'oldest',
                rateLimitEnable: false,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 50,
            };

            const handler = new UdpQueueHandler(config, mockLogger);

            // Simulate queue at 60% capacity
            handler.queue.size = 6;
            handler.checkBackpressure();

            expect(handler.backpressureActive).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Backpressure detected')
            );
        });

        test('should deactivate backpressure when below threshold', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 10,
                dropStrategy: 'oldest',
                rateLimitEnable: false,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 50,
            };

            const handler = new UdpQueueHandler(config, mockLogger);

            // Set backpressure active
            handler.backpressureActive = true;

            // Simulate queue at 20% capacity
            handler.queue.size = 2;
            handler.checkBackpressure();

            expect(handler.backpressureActive).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Backpressure relieved')
            );
        });
    });

    describe('getStatus', () => {
        test('should return formatted status string', () => {
            const config = {
                name: 'TestQueue',
                maxConcurrent: 5,
                maxSize: 100,
                dropStrategy: 'oldest',
                rateLimitEnable: true,
                maxMessagesPerMinute: 300,
                violationLogThrottle: 60,
                maxMessageSize: 65507,
                backpressureThreshold: 80,
            };

            const handler = new UdpQueueHandler(config, mockLogger);
            const status = handler.getStatus();

            expect(typeof status).toBe('string');
            expect(status).toContain('Queue:');
            expect(status).toContain('Processed:');
            expect(status).toContain('Dropped:');
        });
    });
});
