// Load global variables and functions
import globals from '../globals.js';
import { listeningEventHandler, messageEventHandler } from './udp_handlers/user_events/index.js';
import { logError } from './log-error.js';
import { parseAllowedSources, isIpAllowed, createRejectThrottle } from './udp-ip-validator.js';

// Per-source throttle for reject warnings (avoids log flooding from spamming hosts)
const rejectThrottle = createRejectThrottle();

// --------------------------------------------------------
// Set up UDP server for acting on Sense user activity events
// --------------------------------------------------------
/**
 * Initializes the UDP server for handling Qlik Sense user activity events.
 *
 * This function sets up event handlers for the UDP server that listens for
 * user activity events from Qlik Sense (such as session start/stop and
 * connection open/close events). It also adds queue management, rate limiting,
 * source IP validation, and error handling capabilities.
 *
 * @returns {Promise<void>} A promise that resolves when the server is initialized
 */
export async function udpInitUserActivityServer() {
    // Resolve allowed source IPs if source validation is enabled
    if (
        globals.udpServerUserActivity.enableSourceValidation &&
        globals.udpServerUserActivity.allowedSourcesConfig.length > 0
    ) {
        try {
            const { allowedIPs, errors } = await parseAllowedSources(
                globals.udpServerUserActivity.allowedSourcesConfig
            );

            // Log any per-entry resolution errors
            if (errors.length > 0) {
                errors.forEach((err) =>
                    globals.logger.error(`[UDP User Activity] SOURCE VALIDATION: ${err}`)
                );
            }

            if (allowedIPs.length > 0) {
                // At least some entries resolved — keep validation active
                globals.udpServerUserActivity.allowedIPs = allowedIPs;
                globals.logger.info(
                    `[UDP User Activity] SOURCE VALIDATION: Enabled, ${allowedIPs.length} IP(s) loaded`
                );
                if (errors.length > 0) {
                    globals.logger.warn(
                        `[UDP User Activity] SOURCE VALIDATION: ${errors.length} source(s) could not be resolved and were skipped`
                    );
                }
            } else {
                // No IPs could be resolved at all — disable to avoid silently blocking everything
                globals.logger.warn(
                    '[UDP User Activity] SOURCE VALIDATION: No source IPs could be resolved — disabling source validation'
                );
                globals.udpServerUserActivity.enableSourceValidation = false;
            }
        } catch (err) {
            logError('[UDP User Activity] SOURCE VALIDATION: Error parsing allowed sources', err);
            globals.udpServerUserActivity.enableSourceValidation = false;
        }
    } else if (globals.udpServerUserActivity.enableSourceValidation) {
        globals.logger.warn(
            '[UDP User Activity] SOURCE VALIDATION: Enabled but no allowed sources configured - all messages will be rejected'
        );
    }

    // Handler for UDP server startup event
    globals.udpServerUserActivity.socket.on('listening', listeningEventHandler);

    // Handler for UDP messages relating to user activity events
    globals.udpServerUserActivity.socket.on('message', async (message, remote) => {
        try {
            // Check source IP validation before any other processing
            if (remote?.address) {
                if (
                    !isIpAllowed(
                        remote.address,
                        globals.udpServerUserActivity.allowedIPs,
                        globals.udpServerUserActivity.enableSourceValidation
                    )
                ) {
                    rejectThrottle.logRejection(
                        remote.address,
                        remote.port,
                        globals.logger,
                        '[UDP User Activity] SOURCE VALIDATION:'
                    );
                    return;
                }
            }

            // Get queue manager
            const queueManager = globals.udpQueueManagerUserActivity;

            // Validate message size
            if (!queueManager.validateMessageSize(message)) {
                globals.logger.warn(
                    `[UDP Queue] User activity message exceeds size limit: ${message.length} bytes`
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
                globals.logger.debug(`[UDP Queue] User activity message dropped due to full queue`);
            }
        } catch (err) {
            logError('[UDP Queue] Error handling user activity message', err);
        }
    });

    // Handler for UDP server errors
    globals.udpServerUserActivity.socket.on('error', (err) => {
        logError('[UDP] User activity server error', err);
    });

    // Handler for UDP server close event
    globals.udpServerUserActivity.socket.on('close', () => {
        globals.logger.warn('[UDP] User activity server socket closed');
    });
}
