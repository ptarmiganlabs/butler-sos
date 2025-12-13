import globals from '../../../globals.js';

/**
 * Store event counts to InfluxDB v1
 * Aggregates and stores counts for log and user events
 *
 * @returns {Promise<void>}
 */
export async function storeEventCountV1() {
    try {
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

        const points = [];

        // Get measurement name to use for event counts
        const measurementName = globals.config.get(
            'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName'
        );

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
            if (
                globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') !==
                    null &&
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags').length > 0
            ) {
                const configTags = globals.config.get(
                    'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                );
                for (const item of configTags) {
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
            if (
                globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') !==
                    null &&
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags').length > 0
            ) {
                const configTags = globals.config.get(
                    'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                );
                for (const item of configTags) {
                    point.tags[item.name] = item.value;
                }
            }

            points.push(point);
        }

        await globals.influx.writePoints(points);

        globals.logger.verbose('EVENT COUNT V1: Sent event count data to InfluxDB');
    } catch (err) {
        globals.logger.error(`EVENT COUNT V1: Error saving data: ${err}`);
        throw err;
    }
}

/**
 * Store rejected event counts to InfluxDB v1
 * Tracks events that were rejected due to validation failures or rate limiting
 *
 * @returns {Promise<void>}
 */
export async function storeRejectedEventCountV1() {
    try {
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

        await globals.influx.writePoints(points);

        globals.logger.verbose(
            'REJECTED EVENT COUNT V1: Sent rejected event count data to InfluxDB'
        );
    } catch (err) {
        globals.logger.error(`REJECTED EVENT COUNT V1: Error saving data: ${err}`);
        throw err;
    }
}
