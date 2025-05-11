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
 * connection open/close events).
 *
 * @returns {void}
 */
export function udpInitUserActivityServer() {
    // Handler for UDP server startup event
    globals.udpServerUserActivity.socket.on('listening', listeningEventHandler);

    // Handler for UDP messages relating to user activity events
    globals.udpServerUserActivity.socket.on('message', messageEventHandler);
}
