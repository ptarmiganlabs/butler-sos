import globals from '../../../globals.js';

/**
 * Publishes an event to all configured destinations (MQTT, InfluxDB, New Relic).
 *
 * This utility centralizes the destination routing logic that was previously duplicated
 * across multiple event handlers. It checks both global and per-event-type configuration
 * to determine which destinations should receive the event.
 *
 * @param {object} eventData - The event data to publish
 * @param {string} eventType - Event type config key (e.g., 'logEvents', 'userEvents')
 * @param {object} publishers - Object with destination-specific publishing functions
 * @param {Function} [publishers.mqtt] - Function to publish to MQTT
 * @param {Function} [publishers.influxdb] - Function to publish to InfluxDB
 * @param {Function} [publishers.newRelic] - Function to publish to New Relic
 * @returns {void}
 */
export function publishToDestinations(eventData, eventType, publishers) {
    const configBase = `Butler-SOS.${eventType}`;
    
    // Format event type for logging: 'logEvents' -> 'LOG EVENT', 'log event'
    // Remove trailing 's' to make singular, then split camelCase
    const eventTypeSingular = eventType.replace(/s$/, '');
    const eventTypeFormatted = eventTypeSingular.replace(/([A-Z])/g, ' $1').trim();
    const eventTypeUpper = eventTypeFormatted.toUpperCase();
    const eventTypeLower = eventTypeFormatted.toLowerCase();

    // Post to MQTT (if enabled)
    if (
        globals.config.get('Butler-SOS.mqttConfig.enable') === true &&
        globals.config.get(`${configBase}.sendToMQTT.enable`) &&
        publishers.mqtt
    ) {
        globals.logger.debug(`${eventTypeUpper}: Calling ${eventTypeLower} MQTT posting method`);
        publishers.mqtt(eventData);
    }

    // Post to InfluxDB (if enabled)
    if (
        globals.config.get('Butler-SOS.influxdbConfig.enable') === true &&
        globals.config.get(`${configBase}.sendToInfluxdb.enable`) &&
        publishers.influxdb
    ) {
        globals.logger.debug(
            `${eventTypeUpper}: Calling ${eventTypeLower} InfluxDB posting method`
        );
        publishers.influxdb(eventData);
    }

    // Post to New Relic (if enabled)
    if (
        globals.config.get('Butler-SOS.newRelic.enable') === true &&
        globals.config.get(`${configBase}.sendToNewRelic.enable`) &&
        publishers.newRelic
    ) {
        globals.logger.debug(
            `${eventTypeUpper}: Calling ${eventTypeLower} New Relic posting method`
        );
        publishers.newRelic(eventData);
    }
}
