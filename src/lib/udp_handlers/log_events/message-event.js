import globals from '../../../globals.js';
import { postLogEventToInfluxdb } from '../../influxdb/index.js';
import { postLogEventToNewRelic } from '../../post-to-new-relic.js';
import { postLogEventToMQTT } from '../../post-to-mqtt.js';
import { categoriseLogEvent } from '../../log-event-categorise.js';
import { logError } from '../../log-error.js';

// Import handlers for different log event sources
import { processEngineEvent } from './handlers/engine-handler.js';
import { processProxyEvent } from './handlers/proxy-handler.js';
import { processRepositoryEvent } from './handlers/repository-handler.js';
import { processSchedulerEvent } from './handlers/scheduler-handler.js';
import { processQixPerfEvent } from './handlers/qix-perf-handler.js';

/**
 * Handler for UDP messages containing Qlik Sense log events.
 *
 * This function processes incoming UDP messages from Qlik Sense Enterprise on Windows (QSEoW)
 * log events. It supports different log sources:
 * - qseow-engine: Engine service logs
 * - qseow-proxy: Proxy service logs
 * - qseow-repository: Repository service logs
 * - qseow-scheduler: Scheduler service logs
 * - qseow-qix-perf: QIX performance logs
 *
 * Each log event type is processed by a specialized handler function, then categorized
 * (if enabled), and finally forwarded to configured destinations (MQTT, InfluxDB, New Relic).
 *
 * @param {Buffer} message - The raw UDP message buffer containing the log event
 * @param {object} _remote - Information about the remote sender (unused in this handler)
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export async function messageEventHandler(message, _remote) {
    try {
        globals.logger.silly(`LOG EVENT (raw): ${message.toString()}`);

        // Parse the message
        const msgParts = message.toString().split(';');

        // Check if any of the log event sources are enabled in the configuration
        if (
            (globals.config.get('Butler-SOS.logEvents.source.engine.enable') === true &&
                msgParts[0].toLowerCase() === '/qseow-engine/') ||
            (globals.config.get('Butler-SOS.logEvents.source.proxy.enable') === true &&
                msgParts[0].toLowerCase() === '/qseow-proxy/') ||
            (globals.config.get('Butler-SOS.logEvents.source.repository.enable') === true &&
                msgParts[0].toLowerCase() === '/qseow-repository/') ||
            (globals.config.get('Butler-SOS.logEvents.source.scheduler.enable') === true &&
                msgParts[0].toLowerCase() === '/qseow-scheduler/') ||
            (globals.config.get('Butler-SOS.logEvents.source.qixPerf.enable') === true &&
                msgParts[0].toLowerCase() === '/qseow-qix-perf/')
        ) {
            // Clean up the first message field (=message source)
            // Remove leading and trailing /
            msgParts[0] = msgParts[0].toLowerCase().replace('/', '');
            msgParts[0] = msgParts[0].replace('/', '');

            // Build object based on message source
            let msgObj = {};

            // Process event based on source
            switch (msgParts[0]) {
                case 'qseow-engine':
                    msgObj = processEngineEvent(msgParts);
                    break;
                case 'qseow-proxy':
                    msgObj = processProxyEvent(msgParts);
                    break;
                case 'qseow-repository':
                    msgObj = processRepositoryEvent(msgParts);
                    break;
                case 'qseow-scheduler':
                    msgObj = processSchedulerEvent(msgParts);
                    break;
                case 'qseow-qix-perf':
                    msgObj = await processQixPerfEvent(msgParts);
                    // If null is returned, it means the event should be skipped
                    if (msgObj === null) {
                        return;
                    }
                    break;
                default:
                    globals.logger.warn(`LOG EVENT: Unknown source: ${msgParts[0]}`);

                    // Is logging of event counts enabled?
                    if (
                        globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.enable') === true
                    ) {
                        // Increase counter for unknown log events
                        await globals.udpEvents.addLogEvent({
                            source: 'Unknown',
                            host: 'Unknown',
                            subsystem: 'Unknown',
                        });
                    }

                    return;
            }

            // Add counter for received log events
            // Is logging of event counts enabled?
            if (globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.enable') === true) {
                globals.logger.debug(
                    `LOG EVENT: Received message that is a recognised log event: ${msgParts[0]}`
                );

                // Get source, host and subsystem if they exist, otherwise set to 'Unknown'
                let source = 'Unknown';
                let host = 'Unknown';
                let subsystem = 'Unknown';

                if (msgObj.source.length > 0) {
                    source = msgObj.source;
                }
                if (msgObj.host.length > 0) {
                    host = msgObj.host;
                }
                if (msgObj.subsystem.length > 0) {
                    subsystem = msgObj.subsystem;
                }

                // Increase counter for log events
                await globals.udpEvents.addLogEvent({
                    source: source,
                    host: host,
                    subsystem: subsystem,
                });
            }

            // If message parsing was done and categorisation is enabled, categorise the log event
            if (
                Object.keys(msgObj).length !== 0 &&
                globals.config.get('Butler-SOS.logEvents.categorise.enable') === true
            ) {
                // Categorise the log event based on the message content, according to rules in the config file
                const categoryResult = categoriseLogEvent(msgObj.level, msgObj.message);
                globals.logger.debug(
                    `LOG EVENT: Categorised log event as ${JSON.stringify(categoryResult)}`
                );

                // Add the categories to the log event object
                msgObj.category = categoryResult.category;
            }

            globals.logger.debug(`LOG EVENT (json): ${JSON.stringify(msgObj, null, 2)}`);

            // Post to MQTT (if enabled)
            if (
                globals.config.get('Butler-SOS.mqttConfig.enable') === true &&
                globals.config.get('Butler-SOS.logEvents.sendToMQTT.enable')
            ) {
                globals.logger.debug('LOG EVENT: Calling log event MQTT posting method');
                postLogEventToMQTT(msgObj);
            }

            // Post to Influxdb (if enabled)
            if (
                globals.config.get('Butler-SOS.influxdbConfig.enable') === true &&
                globals.config.get('Butler-SOS.logEvents.sendToInfluxdb.enable')
            ) {
                globals.logger.debug('LOG EVENT: Calling log event Influxdb posting method');
                postLogEventToInfluxdb(msgObj);
            }

            // Post to New Relic (if enabled)
            if (
                globals.config.get('Butler-SOS.newRelic.enable') === true &&
                globals.config.get('Butler-SOS.logEvents.sendToNewRelic.enable')
            ) {
                globals.logger.debug('LOG EVENT: Calling log event New Relic posting method');
                postLogEventToNewRelic(msgObj);
            }
        } else {
            globals.logger.debug(
                `LOG EVENT: Log event source not recognized or not enabled in configuration, skipping message: ${msgParts[0]}`
            );

            // Is logging of event counts enabled?
            if (globals.config.get('Butler-SOS.qlikSenseEvents.eventCount.enable') === true) {
                // Get source, host and subsystem if they exist, otherwise set to 'Unknown'
                let source = 'Unknown';
                let host = 'Unknown';
                let subsystem = 'Unknown';

                if (msgParts.length > 0) {
                    source = msgParts[0].toLowerCase().replace('/', '').replace('/', '');
                }
                if (msgParts.length > 1) {
                    host = msgParts[1];
                }
                if (msgParts.length > 5) {
                    subsystem = msgParts[5];
                }

                globals.logger.warn(
                    `LOG EVENT: Received message that is an unrecognized log event: ${source}`
                );

                // Increase counter for log events
                await globals.udpEvents.addLogEvent({
                    source: source,
                    host: host,
                    subsystem: subsystem,
                });
            }
        }
    } catch (err) {
        logError('LOG EVENT: Error handling message', err);
    }
}
