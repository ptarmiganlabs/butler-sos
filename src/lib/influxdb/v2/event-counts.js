import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';

/**
 * Store event counts to InfluxDB v2
 * Aggregates and stores counts for log and user events
 *
 * @returns {Promise<void>}
 */
export async function storeEventCountV2() {
    try {
        // Get array of log events
        const logEvents = await globals.udpEvents.getLogEvents();
        const userEvents = await globals.udpEvents.getUserEvents();

        globals.logger.debug(`EVENT COUNT V2: Log events: ${JSON.stringify(logEvents, null, 2)}`);
        globals.logger.debug(`EVENT COUNT V2: User events: ${JSON.stringify(userEvents, null, 2)}`);

        // Are there any events to store?
        if (logEvents.length === 0 && userEvents.length === 0) {
            globals.logger.verbose('EVENT COUNT V2: No events to store in InfluxDB');
            return;
        }

        // Create write API with options
        const writeOptions = {
            flushInterval: 5000,
            maxRetries: 2,
        };

        const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

        const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

        if (!writeApi) {
            globals.logger.warn('EVENT COUNT V2: Influxdb write API object not found');
            return;
        }

        const points = [];

        // Get measurement name to use for event counts
        const measurementName = globals.config.get(
            'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName'
        );

        // Loop through data in log events and create datapoints
        for (const event of logEvents) {
            const point = new Point(measurementName)
                .tag('event_type', 'log')
                .tag('source', event.source)
                .tag('host', event.host)
                .tag('subsystem', event.subsystem)
                .intField('counter', event.counter);

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
                    point.tag(item.name, item.value);
                }
            }

            points.push(point);
        }

        // Loop through data in user events and create datapoints
        for (const event of userEvents) {
            const point = new Point(measurementName)
                .tag('event_type', 'user')
                .tag('source', event.source)
                .tag('host', event.host)
                .tag('subsystem', event.subsystem)
                .intField('counter', event.counter);

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
                    point.tag(item.name, item.value);
                }
            }

            points.push(point);
        }

        await writeApi.writePoints(points);

        globals.logger.verbose('EVENT COUNT V2: Sent event count data to InfluxDB');
    } catch (err) {
        globals.logger.error(`EVENT COUNT V2: Error saving data: ${err}`);
        throw err;
    }
}

/**
 * Store rejected event counts to InfluxDB v2
 * Tracks events that were rejected due to validation failures or rate limiting
 *
 * @returns {Promise<void>}
 */
export async function storeRejectedEventCountV2() {
    try {
        // Get array of rejected log events
        const rejectedLogEvents = await globals.rejectedEvents.getRejectedLogEvents();

        globals.logger.debug(
            `REJECTED EVENT COUNT V2: Rejected log events: ${JSON.stringify(
                rejectedLogEvents,
                null,
                2
            )}`
        );

        // Are there any events to store?
        if (rejectedLogEvents.length === 0) {
            globals.logger.verbose('REJECTED EVENT COUNT V2: No events to store in InfluxDB');
            return;
        }

        // Create write API with options
        const writeOptions = {
            flushInterval: 5000,
            maxRetries: 2,
        };

        const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

        const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

        if (!writeApi) {
            globals.logger.warn('REJECTED EVENT COUNT V2: Influxdb write API object not found');
            return;
        }

        const points = [];

        // Get measurement name to use for rejected events
        const measurementName = globals.config.get(
            'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
        );

        // Loop through data in rejected log events and create datapoints
        for (const event of rejectedLogEvents) {
            if (event.source === 'qseow-qix-perf') {
                // For qix-perf events, include app info and performance metrics
                let point = new Point(measurementName)
                    .tag('source', event.source)
                    .tag('app_id', event.appId)
                    .tag('method', event.method)
                    .tag('object_type', event.objectType)
                    .intField('counter', event.counter)
                    .floatField('process_time', event.processTime);

                if (event?.appName?.length > 0) {
                    point.tag('app_name', event.appName).tag('app_name_set', 'true');
                } else {
                    point.tag('app_name_set', 'false');
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
                        point.tag(item.name, item.value);
                    }
                }

                points.push(point);
            } else {
                const point = new Point(measurementName)
                    .tag('source', event.source)
                    .intField('counter', event.counter);

                points.push(point);
            }
        }

        await writeApi.writePoints(points);

        globals.logger.verbose(
            'REJECTED EVENT COUNT V2: Sent rejected event count data to InfluxDB'
        );
    } catch (err) {
        globals.logger.error(`REJECTED EVENT COUNT V2: Error saving data: ${err}`);
        throw err;
    }
}
