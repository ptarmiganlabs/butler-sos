import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV2 } from '../shared/utils.js';
import { applyInfluxTags } from './utils.js';

/**
 * Posts event counts to InfluxDB v2.
 *
 * @description
 * This function reads arrays of log and user events from the `udpEvents` object,
 * and stores the data in InfluxDB v2. The data is written to a measurement named after
 * the `Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName` config setting.
 *
 * Aggregates and stores counts for log and user events
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeEventCountV2() {
    globals.logger.debug('EVENT COUNT V2: Starting to store event counts');

    // Check if InfluxDB v2 is enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

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

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');
    const measurementName = globals.config.get(
        'Butler-SOS.qlikSenseEvents.eventCount.influxdb.measurementName'
    );
    const configTags = globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.influxdb.tags');

    const points = [];

    // Loop through data in log events and create datapoints
    for (const event of logEvents) {
        const point = new Point(measurementName)
            .tag('event_type', 'log')
            .tag('source', event.source)
            .tag('host', event.host)
            .tag('subsystem', event.subsystem)
            .intField('counter', event.counter);

        // Add static tags from config file
        applyInfluxTags(point, configTags);
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
        applyInfluxTags(point, configTags);
        points.push(point);
    }

    // Write to InfluxDB with retry logic
    await writeBatchToInfluxV2(
        points,
        org,
        bucketName,
        'Event count metrics',
        '',
        globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
    );

    globals.logger.verbose('EVENT COUNT V2: Sent event count data to InfluxDB');
}

/**
 * Posts rejected event counts to InfluxDB v2.
 *
 * @description
 * Tracks events that were rejected by Butler SOS due to validation failures,
 * rate limiting, or filtering rules. Helps monitor data quality and filtering effectiveness.
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeRejectedEventCountV2() {
    globals.logger.debug('REJECTED EVENT COUNT V2: Starting to store rejected event counts');

    // Check if InfluxDB v2 is enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

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

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');
    const measurementName = globals.config.get(
        'Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName'
    );

    const points = [];

    // Loop through data in rejected log events and create datapoints
    for (const event of rejectedLogEvents) {
        if (event.source === 'qseow-qix-perf') {
            // For qix-perf events, include app info and performance metrics
            const point = new Point(measurementName)
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
            const perfMonitorTags = globals.config.get(
                'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.tags'
            );
            applyInfluxTags(point, perfMonitorTags);

            points.push(point);
        } else {
            const point = new Point(measurementName)
                .tag('source', event.source)
                .intField('counter', event.counter);

            points.push(point);
        }
    }

    // Write to InfluxDB with retry logic
    await writeBatchToInfluxV2(
        points,
        org,
        bucketName,
        'Rejected event count metrics',
        '',
        globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
    );

    globals.logger.verbose('REJECTED EVENT COUNT V2: Sent rejected event count data to InfluxDB');
}
