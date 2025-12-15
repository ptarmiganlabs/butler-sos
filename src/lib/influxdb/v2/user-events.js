import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';

/**
 * Store user event to InfluxDB v2
 *
 * @param {object} msg - User event message
 * @returns {Promise<void>}
 */
export async function storeUserEventV2(msg) {
    try {
        globals.logger.debug(`USER EVENT V2: ${JSON.stringify(msg)}`);

        // Create write API with options
        const writeOptions = {
            flushInterval: 5000,
            maxRetries: 2,
        };

        const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

        const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

        if (!writeApi) {
            globals.logger.warn('USER EVENT V2: Influxdb write API object not found');
            return;
        }

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

        // Add app id and name to tags if available
        if (msg?.appId) point.tag('appId', msg.appId);
        if (msg?.appName) point.tag('appName', msg.appName);

        // Add user agent info to tags if available
        if (msg?.ua?.browser?.name) point.tag('uaBrowserName', msg?.ua?.browser?.name);
        if (msg?.ua?.browser?.major) point.tag('uaBrowserMajorVersion', msg?.ua?.browser?.major);
        if (msg?.ua?.os?.name) point.tag('uaOsName', msg?.ua?.os?.name);
        if (msg?.ua?.os?.version) point.tag('uaOsVersion', msg?.ua?.os?.version);

        // Add custom tags from config file to payload
        if (
            globals.config.has('Butler-SOS.userEvents.tags') &&
            globals.config.get('Butler-SOS.userEvents.tags') !== null &&
            globals.config.get('Butler-SOS.userEvents.tags').length > 0
        ) {
            const configTags = globals.config.get('Butler-SOS.userEvents.tags');
            for (const item of configTags) {
                point.tag(item.name, item.value);
            }
        }

        // Add app id and name to fields if available
        if (msg?.appId) point.stringField('appId', msg.appId);
        if (msg?.appName) point.stringField('appName', msg.appName);

        globals.logger.silly(
            `USER EVENT V2: Influxdb datapoint: ${JSON.stringify(point, null, 2)}`
        );

        await writeApi.writePoint(point);

        globals.logger.verbose('USER EVENT V2: Sent user event data to InfluxDB');
    } catch (err) {
        globals.logger.error(
            `USER EVENT V2: Error saving user event: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
