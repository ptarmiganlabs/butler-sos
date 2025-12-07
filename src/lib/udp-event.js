import { Mutex } from 'async-mutex';

import globals from '../globals.js';
import { storeRejectedEventCountInfluxDB, storeEventCountInfluxDB } from './post-to-influxdb.js';

/**
 * Class for tracking counts of UDP events received from Qlik Sense.
 *
 * This class provides thread-safe methods to track different types of events:
 * - Log events (from various Qlik Sense services)
 * - User events (user session related events)
 * - Rejected log events (events that didn't match filtering criteria)
 */
export class UdpEvents {
    /**
     * Creates a new UdpEvents instance.
     *
     * @param {object} logger - Logger instance with error, debug, info, and verbose methods
     */
    constructor(logger) {
        this.logger = logger;

        // Array of objects with log events
        // Each object has properties:
        // - source: string
        // - subsystem: string
        // - counter: integer
        this.logEvents = [];

        // Array of objects with user events
        // Each object has properties:
        // - source: string
        // - counter: integer
        this.userEvents = [];

        // Array of objects with rejected log events
        // Each object has a counter and dimension properties to track app IDs, methods and object types
        this.rejectedLogEvents = [];

        // Mutexes for synchronizing access to the arrays
        this.logMutex = new Mutex();
        this.userMutex = new Mutex();
        this.rejectedLogMutex = new Mutex();
    }

    /**
     * Adds a log event to the tracking.
     *
     * @param {object} event - The log event to add
     * @param {string} event.source - The source of the event
     * @param {string} event.host - The host where the event originated
     * @param {string} event.subsystem - The subsystem that generated the event
     * @returns {Promise<void>}
     */
    async addLogEvent(event) {
        // Ensure the passed event is an object with properties:
        // - source: string
        // - host: string
        // - subsystem: string
        if (!event.source || !event.subsystem || !event.host) {
            this.logger.error(
                `LOG EVENT TRACKER: Log event object must have properties "source", "subsystem" and "host": ${JSON.stringify(
                    event
                )}`
            );
            return;
        }

        const release = await this.logMutex.acquire();

        try {
            const found = this.logEvents.find((element) => {
                return (
                    element.source === event.source &&
                    element.subsystem === event.subsystem &&
                    element.host === event.host
                );
            });

            if (found) {
                found.counter += 1;
                this.logger.debug(
                    `LOG EVENT TRACKER: Adding another log event: ${JSON.stringify(event)}, new counter value: ${found.counter}`
                );
            } else {
                this.logger.debug(
                    `LOG EVENT TRACKER: Adding first log event: ${JSON.stringify(event)}`
                );

                this.logEvents.push({
                    source: event.source,
                    host: event.host,
                    subsystem: event.subsystem,
                    counter: 1,
                });
            }
        } finally {
            release();
        }
    }

    /**
     * Clears all tracked log events.
     *
     * @returns {Promise<void>}
     */
    async clearLogEvents() {
        const release = await this.logMutex.acquire();

        try {
            this.logEvents = [];

            this.logger.debug('LOG EVENT TRACKER: Cleared all log events');
        } finally {
            release();
        }
    }

    /**
     * Clears all tracked rejected events.
     *
     * @returns {Promise<void>}
     */
    async clearRejectedEvents() {
        const release = await this.rejectedLogMutex.acquire();

        try {
            this.rejectedLogEvents = [];

            this.logger.debug('REJECTED EVENT: Cleared all rejected events');
        } finally {
            release();
        }
    }

    /**
     * Clears all tracked user events.
     *
     * @returns {Promise<void>}
     */
    async clearUserEvents() {
        const release = await this.userMutex.acquire();

        try {
            this.userEvents = [];

            this.logger.debug('USER EVENT TRACKER: Cleared all user events');
        } finally {
            release();
        }
    }

    /**
     * Adds a user event to the tracking.
     *
     * @param {object} event - The user event to add
     * @param {string} event.source - The source of the event
     * @param {string} event.host - The host where the event originated
     * @param {string} event.subsystem - The subsystem that generated the event
     * @returns {Promise<void>}
     */
    async addUserEvent(event) {
        // Ensure the passed event is an object with properties:
        // - source: string
        // - host: string
        // - subsystem: string
        if (!event.source || !event.subsystem || !event.host) {
            this.logger.error(
                `USER EVENT TRACKER: User event object must have properties "source", "subsystem" and "host": ${JSON.stringify(
                    event
                )}`
            );
            return;
        }

        const release = await this.userMutex.acquire();

        try {
            const found = this.userEvents.find((element) => {
                return (
                    element.source === event.source &&
                    element.subsystem === event.subsystem &&
                    element.host === event.host
                );
            });

            if (found) {
                found.counter += 1;
                this.logger.debug(
                    `USER EVENT TRACKER: Adding another user event: ${JSON.stringify(event)}, new counter value: ${found.counter}`
                );
            } else {
                this.logger.debug(
                    `USER EVENT TRACKER: Adding first user event: ${JSON.stringify(event)}`
                );

                this.userEvents.push({
                    source: event.source,
                    host: event.host,
                    subsystem: event.subsystem,
                    counter: 1,
                });
            }
        } finally {
            release();
        }
    }

    /**
     * Retrieves all tracked log events.
     *
     * @returns {Promise<Array<{source: string, host: string, subsystem: string, counter: number}>>} Array of tracked log events
     */
    async getLogEvents() {
        const release = await this.logMutex.acquire();

        try {
            return this.logEvents;
        } finally {
            release();
        }
    }

    /**
     * Retrieves all tracked rejected log events.
     *
     * @returns {Promise<Array<{source: string, counter: number, appId?: string, appName?: string, method?: string, objectType?: string, processTime?: number}>>} Array of tracked rejected log events
     */
    async getRejectedLogEvents() {
        const release = await this.rejectedLogMutex.acquire();
        try {
            return this.rejectedLogEvents;
        } finally {
            release();
        }
    }

    /**
     * Retrieves all tracked user events.
     *
     * @returns {Promise<Array<{source: string, host: string, subsystem: string, counter: number}>>} Array of tracked user events
     */
    async getUserEvents() {
        const release = await this.userMutex.acquire();

        try {
            return this.userEvents;
        } finally {
            release();
        }
    }

    /**
     * Adds a rejected log event to the tracking.
     *
     * "Rejected log events" are events that are correctly formatted but are rejected
     * by Butler SOS due to some reason, e.g. matching the exclude filter criteria in the config file.
     * This method handles both regular log events and performance log events (from qseow-qix-perf).
     *
     * @param {object} event - The rejected log event to add
     * @param {string} event.source - The source of the event
     * @param {string} [event.appId] - The app ID (for performance log events)
     * @param {string} [event.appName] - The app name (for performance log events)
     * @param {string} [event.method] - The method name (for performance log events)
     * @param {string} [event.objectType] - The object type (for performance log events)
     * @param {number} [event.processTime] - The process time (for performance log events)
     * @returns {Promise<void>}
     */
    async addRejectedLogEvent(event) {
        // Ensure the passed event is an object with properties:
        // - source: string
        //
        // Pertformance log events also have these properties:
        // - appId: string
        // - method: string)
        // - objectType: string)
        // - processTime: float)
        if (!event.source) {
            this.logger.error(
                `REJECTED EVENT: Log event object must have property "source": ${JSON.stringify(
                    event
                )}`
            );
            return;
        }

        const release = await this.rejectedLogMutex.acquire();
        // Is this a performance log event?
        if (event.source === 'qseow-qix-perf') {
            try {
                const found = this.rejectedLogEvents.find((element) => {
                    return (
                        element.source === event.source &&
                        element.appId === event.appId &&
                        element.appName === event.appName &&
                        element.method === event.method &&
                        element.objectType === event.objectType
                    );
                });

                if (found) {
                    found.counter += 1;
                    found.processTime += event.processTime;
                    this.logger.debug(
                        `REJECTED EVENT: Adding another log event: ${JSON.stringify(event)}, new counter value: ${found.counter}`
                    );
                } else {
                    this.logger.debug(
                        `REJECTED EVENT: Adding first log event: ${JSON.stringify(event)}`
                    );

                    this.rejectedLogEvents.push({
                        source: event.source,
                        appId: event.appId,
                        appName: event.appName,
                        method: event.method,
                        objectType: event.objectType,
                        counter: 1,
                        processTime: event.processTime,
                    });
                }
            } finally {
                release();
            }
        } else {
            try {
                const found = this.rejectedLogEvents.find((element) => {
                    return element.source === event.source;
                });

                if (found) {
                    found.counter += 1;
                    this.logger.debug(
                        `REJECTED EVENT: Adding another log event: ${JSON.stringify(event)}, new counter value: ${found.counter}`
                    );
                } else {
                    this.logger.debug(
                        `REJECTED EVENT: Adding first log event: ${JSON.stringify(event)}`
                    );

                    this.rejectedLogEvents.push({
                        source: event.source,
                        counter: 1,
                    });
                }
            } finally {
                release();
            }
        }
    }
}

/**
 * Sets up periodic storage of UDP events statistics to InfluxDB.
 *
 * This function creates a timer that periodically:
 * 1. Stores event counts (log and user events) to InfluxDB
 * 2. Stores rejected event counts to InfluxDB
 * 3. Clears event counters after they've been stored
 *
 * @param {() => void} [callbackForTest] - Optional callback function used for testing
 * @returns {number|undefined} The interval ID if the timer was set up, or undefined if disabled
 */
export function setupUdpEventsStorage(callbackForTest) {
    // Is storing event counts to InfluxDB enabled?
    if (
        globals.config.get('Butler-SOS.influxdbConfig.enable') !== true ||
        globals.config.get('Butler-SOS.qlikSenseEvents.influxdb.enable') !== true
    ) {
        globals.logger.info(
            'EVENT COUNTS: Feature is disabled in config file. Skipping setup of timer for storing event counts to InfluxDB'
        );
        return;
    } else {
        // Configure timer for storing event counts to InfluxDB
        const intervalId = setInterval(async () => {
            globals.logger.verbose(
                'EVENT COUNTS: Timer for storing event counts to InfluxDB triggered'
            );

            // Store log and user event counts
            await storeEventCountInfluxDB();

            // Store rejected event counts
            await storeRejectedEventCountInfluxDB();

            // Clear event counts
            globals.logger.debug('clearing event counters');
            await globals.rejectedEvents.clearRejectedEvents();
            await globals.udpEvents.clearLogEvents();
            await globals.udpEvents.clearUserEvents();

            // For testing purposes - allows tests to know when the timer callback has completed
            if (callbackForTest) {
                callbackForTest();
            }
        }, globals.config.get('Butler-SOS.qlikSenseEvents.influxdb.writeFrequency'));

        return intervalId;
    }
}
