// Load global variables and functions
import globals from '../globals.js';
import { listeningEventHandler, messageEventHandler } from './udp_handlers/user_events/index.js';

// --------------------------------------------------------
// Set up UDP server for acting on Sense user activity events
// --------------------------------------------------------
/**
 * Initializes the UDP server for handling Qlik Sense user activity events.
 *
 * This function sets up event handlers for the UDP server that listens for
 * user activity events from Qlik Sense (such as session start/stop and
 * connection open/close events). It also adds queue management, rate limiting,
 * and error handling capabilities.
 *
 * @returns {void}
 */
export function udpInitUserActivityServer() {
    // Handler for UDP server startup event
    globals.udpServerUserActivity.socket.on('listening', listeningEventHandler);

    // Handler for UDP messages relating to user activity events
    globals.udpServerUserActivity.socket.on('message', async (message, remote) => {
        try {
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
            globals.logger.error(
                `[UDP Queue] Error handling user activity message: ${globals.getErrorMessage(err)}`
            );
        }
    });

    // Handler for UDP server errors
    globals.udpServerUserActivity.socket.on('error', (err) => {
        globals.logger.error(`[UDP] User activity server error: ${globals.getErrorMessage(err)}`);
    });

    // Handler for UDP server close event
    globals.udpServerUserActivity.socket.on('close', () => {
        globals.logger.warn('[UDP] User activity server socket closed');
    });
}
