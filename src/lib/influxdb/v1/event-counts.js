import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV1 } from '../shared/utils.js';

/**
 * Store event count in InfluxDB v1
 *
 * @description
 * This function reads arrays of log and user events from the `udpEvents` object,
 * and stores the data in InfluxDB v1. The data is written to a measurement named after
 * the `Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName` config setting.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeEventCountV1() {
    // Get array of log events
    const logEvents = await globals.udpEvents.getLogEvents();
    const userEvents = await globals.udpEvents.getUserEvents();

    globals.logger.debug(`EVENT COUNT V1: Log events: ${JSON.stringify(logEvents, null, 2)}`);
    globals.logger.debug(`EVENT COUNT V1: User events: ${JSON.stringify(userEvents, null, 2)}`);

    // Are there any events to store?
    if (logEvents.length === 0 && userEvents.length === 0) {
        globals.logger.verbose('EVENT COUNT V1: No events to store in InfluxDB');
        return;
    }

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    try {
        const points = [];

        // Get measurement name to use for event counts
        const measurementName = globals.config.get(
            'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName'
        );

        // Get config tags once to avoid repeated config lookups
        const configTagsArray =
            globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
            Array.isArray(globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'))
                ? globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags')
                : null;

        // Loop through data in log events and create datapoints
        for (const event of logEvents) {
            const point = {
                measurement: measurementName,
                tags: {
                    event_type: 'log',
                    source: event.source,
                    host: event.host,
                    subsystem: event.subsystem,
                },
                fields: {
                    counter: event.counter,
                },
            };

            // Add static tags from config file
            if (configTagsArray) {
                for (const item of configTagsArray) {
                    point.tags[item.name] = item.value;
                }
            }

            points.push(point);
        }

        // Loop through data in user events and create datapoints
        for (const event of userEvents) {
            const point = {
                measurement: measurementName,
                tags: {
                    event_type: 'user',
                    source: event.source,
                    host: event.host,
                    subsystem: event.subsystem,
                },
                fields: {
                    counter: event.counter,
                },
            };

            // Add static tags from config file
            if (configTagsArray) {
                for (const item of configTagsArray) {
                    point.tags[item.name] = item.value;
                }
            }

            points.push(point);
        }

        // Write with retry logic
        await writeBatchToInfluxV1(
            points,
            'Event counts',
            '',
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose('EVENT COUNT V1: Sent event count data to InfluxDB');
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', '');
        globals.logger.error(`EVENT COUNT V1: Error saving data: ${globals.getErrorMessage(err)}`);
        throw err;
    }
}

/**
 * Store rejected event counts to InfluxDB v1
 *
 * @description
 * Tracks events that were rejected due to validation failures, rate limiting,
 * or filtering rules. Particularly important for QIX performance monitoring.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeRejectedEventCountV1() {
    // Get array of rejected log events
    const rejectedLogEvents = await globals.rejectedEvents.getRejectedLogEvents();

    globals.logger.debug(
        `REJECTED EVENT COUNT V1: Rejected log events: ${JSON.stringify(
            rejectedLogEvents,
            null,
            2
        )}`
    );

    // Are there any events to store?
    if (rejectedLogEvents.length === 0) {
        globals.logger.verbose('REJECTED EVENT COUNT V1: No events to store in InfluxDB');
        return;
    }

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    try {
        const points = [];

        // Get measurement name to use for rejected events
        const measurementName = globals.config.get(
            'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
        );

        // Loop through data in rejected log events and create datapoints
        // Use counter and process_time as fields
        for (const event of rejectedLogEvents) {
            if (event.source === 'qseow-qix-perf') {
                // For each unique combination of source, appId, appName, method and objectType,
                // write the counter and processTime properties to InfluxDB
                const tags = {
                    source: event.source,
                    app_id: event.appId,
                    method: event.method,
                    object_type: event.objectType,
                };

                // Tags that are empty in some cases. Only add if they are non-empty
                if (event?.appName?.length > 0) {
                    tags.app_name = event.appName;
                    tags.app_name_set = 'true';
                } else {
                    tags.app_name_set = 'false';
                }

                // Add static tags from config file
                if (
                    globals.config.has(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    ) &&
                    globals.config.get(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    ) !== null &&
                    globals.config.get(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    ).length > 0
                ) {
                    const configTags = globals.config.get(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    );
                    for (const item of configTags) {
                        tags[item.name] = item.value;
                    }
                }

                const fields = {
                    counter: event.counter,
                    process_time: event.processTime,
                };

                const point = {
                    measurement: measurementName,
                    tags,
                    fields,
                };

                points.push(point);
            } else {
                const point = {
                    measurement: measurementName,
                    tags: {
                        source: event.source,
                    },
                    fields: {
                        counter: event.counter,
                    },
                };

                points.push(point);
            }
        }

        // Write with retry logic
        await writeBatchToInfluxV1(
            points,
            'Rejected event counts',
            '',
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose(
            'REJECTED EVENT COUNT V1: Sent rejected event count data to InfluxDB'
        );
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', '');
        globals.logger.error(
            `REJECTED EVENT COUNT V1: Error saving data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
