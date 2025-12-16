import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';
import { applyInfluxTags } from './utils.js';

/**
 * Store user event to InfluxDB v2
 *
 * @description
 * Stores user interaction events from Qlik Sense to InfluxDB v2 for tracking user activity,
 * including app interactions, user agent information, and custom tags.
 *
 * @param {object} msg - User event message containing event details
 * @param {string} msg.host - Hostname of the Qlik Sense server
 * @param {string} msg.command - Event action/command (e.g., OpenApp, CreateApp, etc.)
 * @param {string} msg.user_directory - User directory
 * @param {string} msg.user_id - User ID
 * @param {string} msg.origin - Origin of the event (e.g., Qlik Sense, QlikView, etc.)
 * @param {string} [msg.appId] - Application ID (if applicable)
 * @param {string} [msg.appName] - Application name (if applicable)
 * @param {object} [msg.ua] - User agent information object
 * @param {object} [msg.ua.browser] - Browser information
 * @param {string} [msg.ua.browser.name] - Browser name
 * @param {string} [msg.ua.browser.major] - Browser major version
 * @param {object} [msg.ua.os] - Operating system information
 * @param {string} [msg.ua.os.name] - OS name
 * @param {string} [msg.ua.os.version] - OS version
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeUserEventV2(msg) {
    globals.logger.debug(`USER EVENT V2: ${JSON.stringify(msg)}`);

    // Only write to InfluxDB if enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Validate required fields
    if (!msg.host || !msg.command || !msg.user_directory || !msg.user_id || !msg.origin) {
        globals.logger.warn(
            `USER EVENT V2: Missing required fields in user event message: ${JSON.stringify(msg)}`
        );
        return;
    }

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    // Create point using v2 Point class
    const point = new Point('user_events')
        .tag('host', msg.host)
        .tag('event_action', msg.command)
        .tag('userFull', `${msg.user_directory}\\${msg.user_id}`)
        .tag('userDirectory', msg.user_directory)
        .tag('userId', msg.user_id)
        .tag('origin', msg.origin)
        .stringField('userFull', `${msg.user_directory}\\${msg.user_id}`)
        .stringField('userId', msg.user_id);

    // Add app id and name to tags and fields if available
    if (msg?.appId) {
        point.tag('appId', msg.appId);
        point.stringField('appId_field', msg.appId);
    }
    if (msg?.appName) {
        point.tag('appName', msg.appName);
        point.stringField('appName_field', msg.appName);
    }

    // Add user agent info to tags if available
    if (msg?.ua?.browser?.name) point.tag('uaBrowserName', msg?.ua?.browser?.name);
    if (msg?.ua?.browser?.major) point.tag('uaBrowserMajorVersion', msg?.ua?.browser?.major);
    if (msg?.ua?.os?.name) point.tag('uaOsName', msg?.ua?.os?.name);
    if (msg?.ua?.os?.version) point.tag('uaOsVersion', msg?.ua?.os?.version);

    // Add custom tags from config file
    const configTags = globals.config.get('Butler-SOS.userEvents.tags');
    applyInfluxTags(point, configTags);

    globals.logger.silly(`USER EVENT V2: Influxdb datapoint: ${JSON.stringify(point, null, 2)}`);

    // Write to InfluxDB with retry logic
    await writeToInfluxWithRetry(
        async () => {
            const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', {
                flushInterval: 5000,
                maxRetries: 0,
            });
            try {
                await writeApi.writePoint(point);
                await writeApi.close();
            } catch (err) {
                try {
                    await writeApi.close();
                } catch (closeErr) {
                    // Ignore close errors
                }
                throw err;
            }
        },
        `User event for ${msg.host}`,
        'v2',
        msg.host
    );

    globals.logger.verbose('USER EVENT V2: Sent user event data to InfluxDB');
}
