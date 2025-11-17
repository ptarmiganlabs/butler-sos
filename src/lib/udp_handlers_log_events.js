// Load global variables and functions
import globals from '../globals.js';
import { listeningEventHandler, messageEventHandler } from './udp_handlers/log_events/index.js';

// --------------------------------------------------------
// Set up UDP server for acting on Sense log events
// --------------------------------------------------------
/**
 * Initializes the UDP server for handling Qlik Sense log events.
 *
 * This function sets up event handlers for the UDP server that listens for
 * log events from Qlik Sense services (such as engine, proxy, repository,
 * and scheduler services). It also adds queue management, rate limiting,
 * and error handling capabilities.
 *
 * @returns {void}
 */
export function udpInitLogEventServer() {
    // Handler for UDP server startup event
    globals.udpServerLogEvents.socket.on('listening', listeningEventHandler);

    // Handler for UDP messages relating to log events
    globals.udpServerLogEvents.socket.on('message', async (message, remote) => {
        try {
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
            globals.logger.error(
                `[UDP Queue] Error handling log event message: ${globals.getErrorMessage(err)}`
            );
        }
    });

    // Handler for UDP server errors
    globals.udpServerLogEvents.socket.on('error', (err) => {
        globals.logger.error(`[UDP] Log events server error: ${globals.getErrorMessage(err)}`);
    });

    // Handler for UDP server close event
    globals.udpServerLogEvents.socket.on('close', () => {
        globals.logger.warn('[UDP] Log events server socket closed');
    });
}
