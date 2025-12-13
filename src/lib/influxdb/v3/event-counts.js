import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxV3WithRetry } from '../shared/utils.js';

/**
 * Store event count in InfluxDB v3
 *
 * @description
 * This function reads arrays of log and user events from the `udpEvents` object,
 * and stores the data in InfluxDB v3. The data is written to a measurement named after
 * the `Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName` config setting.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeEventCountInfluxDBV3() {
    // Get array of log events
    const logEvents = await globals.udpEvents.getLogEvents();
    const userEvents = await globals.udpEvents.getUserEvents();

    // Debug
    globals.logger.debug(
        `EVENT COUNT INFLUXDB V3: Log events: ${JSON.stringify(logEvents, null, 2)}`
    );
    globals.logger.debug(
        `EVENT COUNT INFLUXDB V3: User events: ${JSON.stringify(userEvents, null, 2)}`
    );

    // Are there any events to store?
    if (logEvents.length === 0 && userEvents.length === 0) {
        globals.logger.verbose('EVENT COUNT INFLUXDB V3: No events to store in InfluxDB');
        return;
    }

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    try {
        // Store data for each log event
        for (const logEvent of logEvents) {
            const tags = {
                butler_sos_instance: globals.options.instanceTag,
                event_type: 'log',
                source: logEvent.source,
                host: logEvent.host,
                subsystem: logEvent.subsystem,
            };

            // Add static tags defined in config file, if any
            if (
                globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                Array.isArray(
                    globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags')
                )
            ) {
                const configTags = globals.config.get(
                    'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                );

                configTags.forEach((tag) => {
                    tags[tag.name] = tag.value;
                });
            }

            const point = new Point3(
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName')
            )
                .setTag('event_type', 'log')
                .setTag('source', logEvent.source)
                .setTag('host', logEvent.host)
                .setTag('subsystem', logEvent.subsystem)
                .setIntegerField('counter', logEvent.counter);

            // Add additional tags to point
            Object.keys(tags).forEach((key) => {
                point.setTag(key, tags[key]);
            });

            await writeToInfluxV3WithRetry(
                async () => await globals.influx.write(point.toLineProtocol(), database),
                'Log event count'
            );
            globals.logger.debug(`EVENT COUNT INFLUXDB V3: Wrote log event data to InfluxDB v3`);
        }

        // Loop through data in user events and create datapoints
        for (const event of userEvents) {
            const tags = {
                butler_sos_instance: globals.options.instanceTag,
                event_type: 'user',
                source: event.source,
                host: event.host,
                subsystem: event.subsystem,
            };

            // Add static tags defined in config file, if any
            if (
                globals.config.has('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags') &&
                Array.isArray(
                    globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags')
                )
            ) {
                const configTags = globals.config.get(
                    'Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags'
                );

                configTags.forEach((tag) => {
                    tags[tag.name] = tag.value;
                });
            }

            const point = new Point3(
                globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName')
            )
                .setTag('event_type', 'user')
                .setTag('source', event.source)
                .setTag('host', event.host)
                .setTag('subsystem', event.subsystem)
                .setIntegerField('counter', event.counter);

            // Add additional tags to point
            Object.keys(tags).forEach((key) => {
                point.setTag(key, tags[key]);
            });

            await writeToInfluxV3WithRetry(
                async () => await globals.influx.write(point.toLineProtocol(), database),
                'User event count'
            );
            globals.logger.debug(`EVENT COUNT INFLUXDB V3: Wrote user event data to InfluxDB v3`);
        }

        globals.logger.verbose(
            'EVENT COUNT INFLUXDB V3: Sent Butler SOS event count data to InfluxDB'
        );
    } catch (err) {
        globals.logger.error(
            `EVENT COUNT INFLUXDB V3: Error writing data to InfluxDB: ${globals.getErrorMessage(err)}`
        );
    }
}

/**
 * Store rejected event count in InfluxDB v3
 *
 * @description
 * This function reads an array of rejected log events from the `rejectedEvents` object,
 * and stores the data in InfluxDB v3. The data is written to a measurement named after
 * the `Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName` config setting.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeRejectedEventCountInfluxDBV3() {
    // Get array of rejected log events
    const rejectedLogEvents = await globals.rejectedEvents.getRejectedLogEvents();

    // Debug
    globals.logger.debug(
        `REJECTED EVENT COUNT INFLUXDB V3: Rejected log events: ${JSON.stringify(
            rejectedLogEvents,
            null,
            2
        )}`
    );

    // Are there any events to store?
    if (rejectedLogEvents.length === 0) {
        globals.logger.verbose('REJECTED EVENT COUNT INFLUXDB V3: No events to store in InfluxDB');
        return;
    }

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    try {
        const points = [];
        const measurementName = globals.config.get(
            'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
        );

        rejectedLogEvents.forEach((event) => {
            globals.logger.debug(`REJECTED LOG EVENT INFLUXDB V3: ${JSON.stringify(event)}`);

            if (event.source === 'qseow-qix-perf') {
                let point = new Point3(measurementName)
                    .setTag('source', event.source)
                    .setTag('object_type', event.objectType)
                    .setTag('method', event.method)
                    .setIntegerField('counter', event.counter)
                    .setFloatField('process_time', event.processTime);

                // Add app_id and app_name if available
                if (event?.appId) {
                    point.setTag('app_id', event.appId);
                }
                if (event?.appName?.length > 0) {
                    point.setTag('app_name', event.appName);
                    point.setTag('app_name_set', 'true');
                } else {
                    point.setTag('app_name_set', 'false');
                }

                // Add static tags defined in config file, if any
                if (
                    globals.config.has(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    ) &&
                    Array.isArray(
                        globals.config.get(
                            'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                        )
                    )
                ) {
                    const configTags = globals.config.get(
                        'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
                    );
                    for (const item of configTags) {
                        point.setTag(item.name, item.value);
                    }
                }

                points.push(point);
            } else {
                let point = new Point3(measurementName)
                    .setTag('source', event.source)
                    .setIntegerField('counter', event.counter);

                points.push(point);
            }
        });

        // Write to InfluxDB
        for (const point of points) {
            await writeToInfluxV3WithRetry(
                async () => await globals.influx.write(point.toLineProtocol(), database),
                'Rejected event count'
            );
        }
        globals.logger.debug(`REJECT LOG EVENT INFLUXDB V3: Wrote data to InfluxDB v3`);

        globals.logger.verbose(
            'REJECT LOG EVENT INFLUXDB V3: Sent Butler SOS rejected event count data to InfluxDB'
        );
    } catch (err) {
        globals.logger.error(
            `REJECTED LOG EVENT INFLUXDB V3: Error writing data to InfluxDB: ${globals.getErrorMessage(err)}`
        );
    }
}
