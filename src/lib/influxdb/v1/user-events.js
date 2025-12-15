import globals from '../../../globals.js';
import { logError } from '../../log-error.js';

/**
 * Store user event to InfluxDB v1
 *
 * @param {object} msg - User event message
 * @returns {Promise<void>}
 */
export async function storeUserEventV1(msg) {
    try {
        globals.logger.debug(`USER EVENT V1: ${JSON.stringify(msg)}`);

        // First prepare tags relating to the actual user event, then add tags defined in the config file
        // The config file tags can for example be used to separate data from DEV/TEST/PROD environments
        const tags = {
            host: msg.host,
            event_action: msg.command,
            userFull: `${msg.user_directory}\\${msg.user_id}`,
            userDirectory: msg.user_directory,
            userId: msg.user_id,
            origin: msg.origin,
        };

        // Add app id and name to tags if available
        if (msg?.appId) tags.appId = msg.appId;
        if (msg?.appName) tags.appName = msg.appName;

        // Add user agent info to tags if available
        if (msg?.ua?.browser?.name) tags.uaBrowserName = msg?.ua?.browser?.name;
        if (msg?.ua?.browser?.major) tags.uaBrowserMajorVersion = msg?.ua?.browser?.major;
        if (msg?.ua?.os?.name) tags.uaOsName = msg?.ua?.os?.name;
        if (msg?.ua?.os?.version) tags.uaOsVersion = msg?.ua?.os?.version;

        // Add custom tags from config file to payload
        if (
            globals.config.has('Butler-SOS.userEvents.tags') &&
            globals.config.get('Butler-SOS.userEvents.tags') !== null &&
            globals.config.get('Butler-SOS.userEvents.tags').length > 0
        ) {
            const configTags = globals.config.get('Butler-SOS.userEvents.tags');
            for (const item of configTags) {
                tags[item.name] = item.value;
            }
        }

        const datapoint = [
            {
                measurement: 'user_events',
                tags,
                fields: {
                    userFull: tags.userFull,
                    userId: tags.userId,
                },
            },
        ];

        // Add app id and name to fields if available
        if (msg?.appId) datapoint[0].fields.appId = msg.appId;
        if (msg?.appName) datapoint[0].fields.appName = msg.appName;

        globals.logger.silly(
            `USER EVENT V1: Influxdb datapoint: ${JSON.stringify(datapoint, null, 2)}`
        );

        await globals.influx.writePoints(datapoint);

        globals.logger.verbose('USER EVENT V1: Sent user event data to InfluxDB');
    } catch (err) {
        logError('USER EVENT V1: Error saving user event', err);
        throw err;
    }
}
