/**
 * Event Buffer
 *
 * Manages batching of events before sending to Butler SOS
 *
 * @module lib/event-buffer
 */

define([], function () {
    'use strict';

    /**
     * Creates a new EventBuffer instance
     *
     * @class
     * @param {number} intervalMs - Milliseconds between flush operations
     */
    function EventBuffer(intervalMs) {
        this.buffer = [];
        this.intervalMs = intervalMs || 1000;
        this.flushCallback = null;
        this.addCallback = null;
        this.timer = null;
        this.isRunning = false;
    }

    /**
     * Add an event to the buffer
     *
     * @param {object} event - Event object to buffer
     */
    EventBuffer.prototype.add = function (event) {
        this.buffer.push(event);

        if (this.addCallback) {
            this.addCallback(this.buffer.length);
        }
    };

    /**
     * Flush all buffered events
     * Calls the flush callback with all events and clears the buffer
     */
    EventBuffer.prototype.flush = function () {
        if (this.buffer.length === 0) {
            return;
        }

        var events = this.buffer.splice(0); // Remove all and return

        if (this.flushCallback) {
            this.flushCallback(events);
        }

        if (this.addCallback) {
            this.addCallback(0);
        }
    };

    /**
     * Start the periodic flush timer
     */
    EventBuffer.prototype.start = function () {
        if (this.isRunning) {
            return;
        }

        var self = this;
        this.timer = setInterval(function () {
            self.flush();
        }, this.intervalMs);

        this.isRunning = true;
    };

    /**
     * Stop the periodic flush timer and flush remaining events
     */
    EventBuffer.prototype.stop = function () {
        if (!this.isRunning) {
            return;
        }

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.isRunning = false;

        // Flush any remaining events
        this.flush();
    };

    /**
     * Register callback for flush events
     *
     * @param {Function} callback - Called with array of events to send
     */
    EventBuffer.prototype.onFlush = function (callback) {
        this.flushCallback = callback;
    };

    /**
     * Register callback for add events
     *
     * @param {Function} callback - Called with current buffer count
     */
    EventBuffer.prototype.onAdd = function (callback) {
        this.addCallback = callback;
    };

    /**
     * Get current buffer size
     *
     * @returns {number} Number of events in buffer
     */
    EventBuffer.prototype.getSize = function () {
        return this.buffer.length;
    };

    return EventBuffer;
});
