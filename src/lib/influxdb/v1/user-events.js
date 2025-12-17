import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Posts a user event to InfluxDB v1.
 *
 * User events track user interactions with Qlik Sense, such as opening apps,
 * starting sessions, creating connections, etc.
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
 * @returns {Promise<void>} A promise that resolves when the event has been posted to InfluxDB.
 */
export async function storeUserEventV1(msg) {
    globals.logger.debug(`USER EVENT V1: ${JSON.stringify(msg)}`);

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Validate required fields
    if (!msg.host || !msg.command || !msg.user_directory || !msg.user_id || !msg.origin) {
        globals.logger.warn(
            `USER EVENT V1: Missing required fields in user event message: ${JSON.stringify(msg)}`
        );
        return;
    }

    try {
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

        // Write with retry logic
        await writeToInfluxWithRetry(
            async () => await globals.influx.writePoints(datapoint),
            'User event',
            'v1',
            msg.host
        );

        globals.logger.verbose('USER EVENT V1: Sent user event data to InfluxDB');
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', msg.host);
        globals.logger.error(
            `USER EVENT V1: Error saving user event: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
