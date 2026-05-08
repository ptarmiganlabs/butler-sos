// Load global variables and functions
import globals from '../globals.js';
import { listeningEventHandler, messageEventHandler } from './udp_handlers/log_events/index.js';
import { logError } from './log-error.js';
import { parseAllowedSources, isIpAllowed, createRejectThrottle } from './udp-ip-validator.js';

// Per-source throttle for reject warnings (avoids log flooding from spamming hosts)
const rejectThrottle = createRejectThrottle();

// --------------------------------------------------------
// Set up UDP server for acting on Sense log events
// --------------------------------------------------------
/**
 * Initializes the UDP server for handling Qlik Sense log events.
 *
 * This function sets up event handlers for the UDP server that listens for
 * log events from Qlik Sense services (such as engine, proxy, repository,
 * and scheduler services). It also adds queue management, rate limiting,
 * source IP validation, and error handling capabilities.
 *
 * @returns {Promise<void>} A promise that resolves when the server is initialized
 */
export async function udpInitLogEventServer() {
    // Resolve allowed source IPs if source validation is enabled
    if (
        globals.udpServerLogEvents.enableSourceValidation &&
        globals.udpServerLogEvents.allowedSourcesConfig.length > 0
    ) {
        try {
            const { allowedIPs, errors } = await parseAllowedSources(
                globals.udpServerLogEvents.allowedSourcesConfig
            );

            // Log any per-entry resolution errors
            if (errors.length > 0) {
                errors.forEach((err) =>
                    globals.logger.error(`[UDP Log Events] SOURCE VALIDATION: ${err}`)
                );
            }

            if (allowedIPs.length > 0) {
                // At least some entries resolved — keep validation active
                globals.udpServerLogEvents.allowedIPs = allowedIPs;
                globals.logger.info(
                    `[UDP Log Events] SOURCE VALIDATION: Enabled, ${allowedIPs.length} IP(s) loaded`
                );
                if (errors.length > 0) {
                    globals.logger.warn(
                        `[UDP Log Events] SOURCE VALIDATION: ${errors.length} source(s) could not be resolved and were skipped`
                    );
                }
            } else {
                // No IPs could be resolved at all — disable to avoid silently blocking everything
                globals.logger.warn(
                    '[UDP Log Events] SOURCE VALIDATION: No source IPs could be resolved — disabling source validation'
                );
                globals.udpServerLogEvents.enableSourceValidation = false;
            }
        } catch (err) {
            logError('[UDP Log Events] SOURCE VALIDATION: Error parsing allowed sources', err);
            globals.udpServerLogEvents.enableSourceValidation = false;
        }
    } else if (globals.udpServerLogEvents.enableSourceValidation) {
        globals.logger.warn(
            '[UDP Log Events] SOURCE VALIDATION: Enabled but no allowed sources configured - disabling source validation'
        );
        globals.udpServerLogEvents.enableSourceValidation = false;
    }

    // Handler for UDP server startup event
    globals.udpServerLogEvents.socket.on('listening', listeningEventHandler);

    // Handler for UDP messages relating to log events
    globals.udpServerLogEvents.socket.on('message', async (message, remote) => {
        try {
            // Check source IP validation before any other processing
            if (remote?.address) {
                if (
                    !isIpAllowed(
                        remote.address,
                        globals.udpServerLogEvents.allowedIPs,
                        globals.udpServerLogEvents.enableSourceValidation
                    )
                ) {
                    rejectThrottle.logRejection(
                        remote.address,
                        remote.port,
                        globals.logger,
                        '[UDP Log Events] SOURCE VALIDATION:'
                    );
                    return;
                }
            }

            globals.logger.debug(`[UDP LOG EVENT MSG] !!! RAW MESSAGE EVENT !!!`);
            globals.logger.debug(`[UDP LOG EVENT MSG] From:  ${remote.address}:${remote.port}`);
            globals.logger.debug(`[UDP LOG EVENT MSG] Length: ${message.length} bytes`);
            globals.logger.debug(
                `[UDP LOG EVENT MSG] First 200 chars: ${message.toString().substring(0, 200)}`
            );
            globals.logger.debug(`[UDP LOG EVENT MSG] ---`);

            // Get queue manager
            const queueManager = globals.udpQueueManagerLogEvents;

            // Validate message size
            if (!queueManager.validateMessageSize(message)) {
                globals.logger.warn(
                    `[UDP Queue] Log event message exceeds size limit: ${message.length} bytes`
                );
                await queueManager.handleSizeDrop();
                return;
            }

            // Check rate limit if enabled
            if (!queueManager.checkRateLimit()) {
                await queueManager.handleRateLimitDrop();
                return;
            }

            // Add message to queue for processing
            const queued = await queueManager.addToQueue(async () => {
                await messageEventHandler(message, remote);
            });

            if (!queued) {
                globals.logger.debug(`[UDP Queue] Log event message dropped due to full queue`);
            }
        } catch (err) {
            logError('[UDP Queue] Error handling log event message', err);
        }
    });

    // Handler for UDP server errors
    globals.udpServerLogEvents.socket.on('error', (err) => {
        logError('[UDP] Log events server error', err);
    });

    // Handler for UDP server close event
    globals.udpServerLogEvents.socket.on('close', () => {
        globals.logger.warn('[UDP] Log events server socket closed');
    });
}
