import { Mutex } from 'async-mutex';

import globals from '../globals.js';
import { storeRejectedEventCountInfluxDB, storeEventCountInfluxDB } from './post-to-influxdb.js';

// Class for counting rejected events
export class UdpEvents {
    constructor(logger) {
        this.logger = logger;

        // Array of objects with log events
        // Each object has properties:
        // - eventName: string
        // - subsystem: string
        // - counter: integer
        this.logEvents = [];

        // Array of objects with user events
        // Each object has properties:
        // - eventName: string
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

    // Add a log event of any type
    async addLogEvent(event) {
        // Ensure the passed event is an object with properties:
        // - eventName: string
        // - host: string
        // - subsystem: string
        if (!event.eventName || !event.subsystem || !event.host) {
            this.logger.error(
                `LOG EVENT TRACKER: Log event object must have properties "eventName", "subsystem" and "host": ${JSON.stringify(
                    event
                )}`
            );
            return;
        }

        const release = await this.logMutex.acquire();

        try {
            const found = this.logEvents.find((element) => {
                return (
                    element.eventName === event.eventName &&
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
                    eventName: event.eventName,
                    host: event.host,
                    subsystem: event.subsystem,
                    counter: 1,
                });
            }
        } finally {
            release();
        }
    }

    // Add a user event
    async addUserEvent(event) {
        // Ensure the passed event is an object with properties:
        // - eventName: string
        // - host: string
        // - subsystem: string
        if (!event.eventName || !event.subsystem || !event.host) {
            this.logger.error(
                `USER EVENT TRACKER: User event object must have properties "eventName", "subsystem" and "host": ${JSON.stringify(
                    event
                )}`
            );
            return;
        }

        const release = await this.userMutex.acquire();

        try {
            const found = this.userEvents.find((element) => {
                return (
                    element.eventName === event.eventName &&
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
                    eventName: event.eventName,
                    host: event.host,
                    subsystem: event.subsystem,
                    counter: 1,
                });
            }
        } finally {
            release();
        }
    }

    // Get log events
    async getLogEvents() {
        const release = await this.logMutex.acquire();

        try {
            return this.logEvents;
        } finally {
            release();
        }
    }

    // Get user events
    async getUserEvents() {
        const release = await this.userMutex.acquire();

        try {
            return this.userEvents;
        } finally {
            release();
        }
    }

    // Add rejected log event
    // "Rejected log events" are events that are correctly formatted but are rejected
    // Butler SOS due to some reason, e.g. matching the exclude filter criteria in the config file.
    async addRejectedLogEvent(event) {
        // Ensure the passed event is an object with properties:
        // - eventName: string
        //
        // Pertformance log events also have these properties:
        // - appId: string
        // - method: string)
        // - objectType: string)
        // - processTime: float)
        if (!event.eventName) {
            this.logger.error(
                `REJECTED EVENT: Log event object must have property "eventName": ${JSON.stringify(
                    event
                )}`
            );
            return;
        }

        const release = await this.rejectedLogMutex.acquire();
        // Is this a performance log event?
        if (event.eventName === 'qseow-qix-perf') {
            try {
                const found = this.rejectedLogEvents.find((element) => {
                    return (
                        element.eventName === event.eventName &&
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
                        eventName: event.eventName,
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
                    return element.eventName === event.eventName;
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
                        eventName: event.eventName,
                        counter: 1,
                    });
                }
            } finally {
                release();
            }
        }
    }

    // Get rejected log events
    async getRejectedLogEvents() {
        const release = await this.rejectedLogMutex.acquire();
        try {
            return this.rejectedLogEvents;
        } finally {
            release();
        }
    }

    // Clear rejected events
    async clearRejectedEvents() {
        const releaseLog = await this.rejectedLogMutex.acquire();

        try {
            this.rejectedLogEvents = [];

            this.logger.debug('REJECTED EVENT: Cleared all rejected events');
        } finally {
            releaseLog();
        }
    }
}

export function setupUdpEventsStorage() {
    // Is storing event counts to InfluxDB enabled?
    if (globals.config.get('Butler-SOS.qlikSenseEvents.influxdb.enable') !== true) {
        globals.logger.verbose(
            'EVENT COUNTS: Feature is disabled in config file. Skipping setup of timer for storing event counts to InfluxDB'
        );
        return;
    } else {
        // Configure timer for storing event counts to InfluxDB
        setInterval(() => {
            globals.logger.verbose(
                'EVENT COUNTS: Timer for storing event counts to InfluxDB triggered'
            );

            storeRejectedEventCountInfluxDB();
            storeEventCountInfluxDB();
        }, globals.config.get('Butler-SOS.qlikSenseEvents.influxdb.writeFrequency'));
    }
}
