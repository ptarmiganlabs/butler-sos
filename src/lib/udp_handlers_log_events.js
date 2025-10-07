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
 * and scheduler services).
 *
 * @returns {void}
 */
export function udpInitLogEventServer() {
    // Handler for UDP server startup event
    globals.udpServerLogEvents.socket.on('listening', listeningEventHandler);

    // Handler for UDP messages relating to log events
    // Wrap with queue handler if available
    if (globals.udpQueueHandlerLogEvents) {
        globals.udpServerLogEvents.socket.on('message', (message, remote) => {
            globals.udpQueueHandlerLogEvents.addMessage(message, remote, messageEventHandler);
        });
    } else {
        globals.udpServerLogEvents.socket.on('message', messageEventHandler);
    }

    // Error handler for UDP socket
    globals.udpServerLogEvents.socket.on('error', (err) => {
        globals.logger.error(`UDP LOG EVENTS: Socket error: ${globals.getErrorMessage(err)}`);
    });

    // Close handler for UDP socket
    globals.udpServerLogEvents.socket.on('close', () => {
        globals.logger.warn('UDP LOG EVENTS: Socket closed');
    });
}
