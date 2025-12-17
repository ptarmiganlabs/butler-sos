import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV3 } from '../shared/utils.js';

/**
 * Sanitize tag values for InfluxDB line protocol.
 * Remove or replace characters that cause parsing issues.
 *
 * @param {string} value - The value to sanitize
 * @returns {string} - The sanitized value
 */
function sanitizeTagValue(value) {
    if (!value) return value;
    return String(value)
        .replace(/[<>\\]/g, '')
        .replace(/\s+/g, '-');
}

/**
 * Posts a user event to InfluxDB v3.
 *
 * @param {object} msg - The event to be posted to InfluxDB. The object should contain the following properties:
 *   - host: The hostname of the Qlik Sense server that the user event originated from.
 *   - command: The command (e.g. OpenApp, CreateApp, etc.) that the user event corresponds to.
 *   - user_directory: The user directory of the user who triggered the event.
 *   - user_id: The user ID of the user who triggered the event.
 *   - origin: The origin of the event (e.g. Qlik Sense, QlikView, etc.).
 *   - appId: The ID of the app that the event corresponds to (if applicable).
 *   - appName: The name of the app that the event corresponds to (if applicable).
 *   - ua: An object containing user agent information (if available).
 * @returns {Promise<void>} - A promise that resolves when the event has been posted to InfluxDB.
 */
export async function postUserEventToInfluxdbV3(msg) {
    globals.logger.debug(`USER EVENT INFLUXDB V3: ${msg})`);

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    // Validate required fields
    if (!msg.host || !msg.command || !msg.user_directory || !msg.user_id || !msg.origin) {
        globals.logger.warn(
            `USER EVENT INFLUXDB V3: Missing required fields in user event message: ${JSON.stringify(msg)}`
        );
        return;
    }

    // Create a new point with the data to be written to InfluxDB v3
    // NOTE: InfluxDB v3 does not allow the same name for both tags and fields,
    // unlike v1/v2. Fields use different names with _field suffix where needed.
    const point = new Point3('user_events')
        .setTag('host', msg.host)
        .setTag('event_action', msg.command)
        .setTag('userFull', `${msg.user_directory}\\${msg.user_id}`)
        .setTag('userDirectory', msg.user_directory)
        .setTag('userId', msg.user_id)
        .setTag('origin', msg.origin)
        .setStringField('userFull_field', `${msg.user_directory}\\${msg.user_id}`)
        .setStringField('userId_field', msg.user_id);

    // Add app id and name to tags and fields if available
    if (msg?.appId) {
        point.setTag('appId', msg.appId);
        point.setStringField('appId_field', msg.appId);
    }
    if (msg?.appName) {
        point.setTag('appName', msg.appName);
        point.setStringField('appName_field', msg.appName);
    }

    // Add user agent info to tags if available
    if (msg?.ua?.browser?.name) point.setTag('uaBrowserName', msg?.ua?.browser?.name);
    if (msg?.ua?.browser?.major) point.setTag('uaBrowserMajorVersion', msg?.ua?.browser?.major);
    if (msg?.ua?.os?.name) point.setTag('uaOsName', msg?.ua?.os?.name);
    if (msg?.ua?.os?.version) point.setTag('uaOsVersion', msg?.ua?.os?.version);

    // Add custom tags from config file to payload
    if (
        globals.config.has('Butler-SOS.userEvents.tags') &&
        globals.config.get('Butler-SOS.userEvents.tags') !== null &&
        globals.config.get('Butler-SOS.userEvents.tags').length > 0
    ) {
        const configTags = globals.config.get('Butler-SOS.userEvents.tags');
        for (const item of configTags) {
            point.setTag(item.name, item.value);
        }
    }

    globals.logger.silly(
        `USER EVENT INFLUXDB V3: Influxdb datapoint for Butler SOS user event: ${JSON.stringify(
            point,
            null,
            2
        )}`
    );

    // Write to InfluxDB
    try {
        // Convert point to line protocol and write directly with retry logic
        await writeBatchToInfluxV3(
            [point],
            database,
            `User event for ${msg.host}`,
            msg.host,
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );
        globals.logger.debug(`USER EVENT INFLUXDB V3: Wrote data to InfluxDB v3`);
    } catch (err) {
        // Track error count
        await globals.errorTracker.incrementError('INFLUXDB_V3_WRITE', '');

        globals.logger.error(
            `USER EVENT INFLUXDB V3: Error saving user event to InfluxDB v3! ${globals.getErrorMessage(err)}`
        );
        // Log the line protocol for debugging
        try {
            const lineProtocol = point.toLineProtocol();
            globals.logger.debug(`USER EVENT INFLUXDB V3: Failed line protocol: ${lineProtocol}`);
        } catch (e) {
            // Ignore errors in debug logging
        }
    }

    globals.logger.verbose('USER EVENT INFLUXDB V3: Sent Butler SOS user event data to InfluxDB');
}
