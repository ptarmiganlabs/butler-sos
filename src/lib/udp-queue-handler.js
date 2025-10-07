import PQueue from 'p-queue';
import globals from '../globals.js';

/**
 * Class for handling UDP message queuing, rate limiting, and backpressure.
 *
 * This class provides:
 * - Message queuing with configurable concurrency
 * - Rate limiting to prevent message flooding
 * - Message size validation
 * - Backpressure monitoring
 * - Metrics tracking (messages received, dropped, processing time)
 */
export class UdpQueueHandler {
    /**
     * Creates a new UdpQueueHandler instance.
     *
     * @param {object} config - Configuration object
     * @param {string} config.name - Name of this handler (for logging)
     * @param {number} config.maxConcurrent - Max concurrent message processing
     * @param {number} config.maxSize - Max queue size
     * @param {string} config.dropStrategy - 'oldest' or 'newest' when queue is full
     * @param {boolean} config.rateLimitEnable - Enable rate limiting
     * @param {number} config.maxMessagesPerMinute - Max messages per minute
     * @param {number} config.violationLogThrottle - Log violations once per N seconds
     * @param {number} config.maxMessageSize - Max message size in bytes
     * @param {number} config.backpressureThreshold - Backpressure warning at N% utilization
     * @param {object} logger - Logger object
     */
    constructor(config, logger) {
        this.name = config.name;
        this.logger = logger;
        this.config = config;

        // Initialize message queue
        this.queue = new PQueue({
            concurrency: config.maxConcurrent,
            timeout: 30000, // 30 second timeout per message
        });

        // Rate limiting state
        this.rateLimitEnable = config.rateLimitEnable;
        this.maxMessagesPerMinute = config.maxMessagesPerMinute;
        this.violationLogThrottle = config.violationLogThrottle;
        this.messageTimestamps = [];
        this.lastViolationLog = 0;

        // Metrics
        this.metrics = {
            messagesReceived: 0,
            messagesQueued: 0,
            messagesProcessed: 0,
            messagesDroppedRateLimit: 0,
            messagesDroppedQueueFull: 0,
            messagesDroppedSize: 0,
            messagesFailed: 0,
            processingTimes: [],
            maxProcessingTimeMs: 0,
        };

        // Backpressure state
        this.backpressureActive = false;

        this.logger.info(
            `UDP QUEUE [${this.name}]: Initialized with maxConcurrent=${config.maxConcurrent}, maxSize=${config.maxSize}, rateLimit=${config.rateLimitEnable ? config.maxMessagesPerMinute + '/min' : 'disabled'}`
        );
    }

    /**
     * Sanitizes a message field by removing control characters and limiting length.
     *
     * @param {string} field - Field to sanitize
     * @param {number} maxLength - Maximum field length
     * @returns {string} Sanitized field
     */
    sanitizeField(field, maxLength = 500) {
        if (typeof field !== 'string') {
            return String(field).slice(0, maxLength);
        }
        // Remove control characters and limit length
        return field.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLength);
    }

    /**
     * Checks if rate limit is exceeded.
     *
     * @returns {boolean} True if rate limit exceeded
     */
    checkRateLimit() {
        if (!this.rateLimitEnable) {
            return false;
        }

        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Remove timestamps older than 1 minute
        this.messageTimestamps = this.messageTimestamps.filter((ts) => ts > oneMinuteAgo);

        // Check if limit exceeded
        if (this.messageTimestamps.length >= this.maxMessagesPerMinute) {
            // Log violation if throttle period has passed
            if (now - this.lastViolationLog > this.violationLogThrottle * 1000) {
                this.logger.warn(
                    `UDP QUEUE [${this.name}]: Rate limit exceeded (${this.messageTimestamps.length} messages in last minute, max ${this.maxMessagesPerMinute})`
                );
                this.lastViolationLog = now;
            }
            return true;
        }

        // Add current timestamp
        this.messageTimestamps.push(now);
        return false;
    }

    /**
     * Checks for backpressure condition.
     *
     * @returns {void}
     */
    checkBackpressure() {
        const queueUtilization = (this.queue.size / this.config.maxSize) * 100;

        if (queueUtilization >= this.config.backpressureThreshold && !this.backpressureActive) {
            this.backpressureActive = true;
            this.logger.warn(
                `UDP QUEUE [${this.name}]: Backpressure detected - queue at ${queueUtilization.toFixed(1)}% (${this.queue.size}/${this.config.maxSize})`
            );
        } else if (
            queueUtilization < this.config.backpressureThreshold &&
            this.backpressureActive
        ) {
            this.backpressureActive = false;
            this.logger.info(
                `UDP QUEUE [${this.name}]: Backpressure relieved - queue at ${queueUtilization.toFixed(1)}%`
            );
        }
    }

    /**
     * Adds a message to the queue for processing.
     *
     * @param {Buffer} message - The UDP message
     * @param {object} remote - Remote sender info
     * @param {Function} handler - Message handler function
     * @returns {Promise<boolean>} True if message was queued, false if dropped
     */
    async addMessage(message, remote, handler) {
        this.metrics.messagesReceived += 1;

        // Check message size
        if (message.length > this.config.maxMessageSize) {
            this.metrics.messagesDroppedSize += 1;
            this.logger.warn(
                `UDP QUEUE [${this.name}]: Message size ${message.length} exceeds limit ${this.config.maxMessageSize}, dropping`
            );
            return false;
        }

        // Check rate limit
        if (this.checkRateLimit()) {
            this.metrics.messagesDroppedRateLimit += 1;
            return false;
        }

        // Check if queue is full
        if (this.queue.size >= this.config.maxSize) {
            this.metrics.messagesDroppedQueueFull += 1;

            // Log with throttling (max once per 10 seconds)
            const now = Date.now();
            if (!this.lastQueueFullLog || now - this.lastQueueFullLog > 10000) {
                this.logger.warn(
                    `UDP QUEUE [${this.name}]: Queue full (${this.queue.size}/${this.config.maxSize}), dropping ${this.config.dropStrategy} message`
                );
                this.lastQueueFullLog = now;
            }

            return false;
        }

        // Add to queue
        this.metrics.messagesQueued += 1;
        this.checkBackpressure();

        // Queue the message processing
        this.queue
            .add(async () => {
                const startTime = Date.now();
                try {
                    await handler(message, remote);
                    this.metrics.messagesProcessed += 1;

                    const processingTime = Date.now() - startTime;
                    this.metrics.processingTimes.push(processingTime);
                    if (processingTime > this.metrics.maxProcessingTimeMs) {
                        this.metrics.maxProcessingTimeMs = processingTime;
                    }

                    // Keep only last 1000 processing times for stats
                    if (this.metrics.processingTimes.length > 1000) {
                        this.metrics.processingTimes.shift();
                    }

                    this.logger.debug(
                        `UDP QUEUE [${this.name}]: Message processed in ${processingTime}ms (queue: ${this.queue.size}/${this.config.maxSize})`
                    );
                } catch (err) {
                    this.metrics.messagesFailed += 1;
                    this.logger.error(
                        `UDP QUEUE [${this.name}]: Error processing message: ${err.message}`
                    );
                }
            })
            .catch((err) => {
                // Handle queue timeout or other queue errors
                this.metrics.messagesFailed += 1;
                this.logger.error(`UDP QUEUE [${this.name}]: Queue error: ${err.message}`);
            });

        return true;
    }

    /**
     * Gets current queue metrics.
     *
     * @returns {object} Metrics object
     */
    getMetrics() {
        const processingTimes = this.metrics.processingTimes;
        const avgProcessingTime =
            processingTimes.length > 0
                ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
                : 0;

        // Calculate p95
        let p95ProcessingTime = 0;
        if (processingTimes.length > 0) {
            const sorted = [...processingTimes].sort((a, b) => a - b);
            const p95Index = Math.floor(sorted.length * 0.95);
            p95ProcessingTime = sorted[p95Index] || 0;
        }

        return {
            name: this.name,
            queue: {
                currentSize: this.queue.size,
                maxSize: this.config.maxSize,
                utilizationPercent: (this.queue.size / this.config.maxSize) * 100,
                pendingCount: this.queue.pending,
                maxConcurrent: this.config.maxConcurrent,
            },
            messages: {
                received: this.metrics.messagesReceived,
                queued: this.metrics.messagesQueued,
                processed: this.metrics.messagesProcessed,
                failed: this.metrics.messagesFailed,
            },
            dropped: {
                total:
                    this.metrics.messagesDroppedRateLimit +
                    this.metrics.messagesDroppedQueueFull +
                    this.metrics.messagesDroppedSize,
                rateLimit: this.metrics.messagesDroppedRateLimit,
                queueFull: this.metrics.messagesDroppedQueueFull,
                messageSize: this.metrics.messagesDroppedSize,
            },
            processingTime: {
                avgMs: Math.round(avgProcessingTime),
                p95Ms: Math.round(p95ProcessingTime),
                maxMs: this.metrics.maxProcessingTimeMs,
            },
            rateLimit: {
                enabled: this.rateLimitEnable,
                maxPerMinute: this.maxMessagesPerMinute,
                currentRate: this.messageTimestamps.length,
            },
            backpressure: this.backpressureActive,
        };
    }

    /**
     * Clears metrics (for periodic reset).
     *
     * @returns {void}
     */
    clearMetrics() {
        // Keep cumulative counters, only clear processing times
        this.metrics.processingTimes = [];
        this.metrics.maxProcessingTimeMs = 0;
    }

    /**
     * Waits for all queued messages to complete processing.
     *
     * @returns {Promise<void>}
     */
    async waitForEmpty() {
        await this.queue.onEmpty();
        await this.queue.onIdle();
    }

    /**
     * Gets queue status summary for logging.
     *
     * @returns {string} Status summary
     */
    getStatus() {
        const metrics = this.getMetrics();
        return `Queue: ${metrics.queue.currentSize}/${metrics.queue.maxSize} (${metrics.queue.utilizationPercent.toFixed(1)}%), Processed: ${metrics.messages.processed}, Dropped: ${metrics.dropped.total}, Rate: ${metrics.rateLimit.currentRate}/min`;
    }
}
