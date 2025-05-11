// Load global variables and functions
import globals from '../globals.js';
import { listeningEventHandler, messageEventHandler } from './udp_handlers/user_events/index.js';

// --------------------------------------------------------
// Set up UDP server for acting on Sense user activity events
// --------------------------------------------------------
export function udpInitUserActivityServer() {
    // Handler for UDP server startup event
    globals.udpServerUserActivity.socket.on('listening', listeningEventHandler);

    // Handler for UDP messages relating to user activity events
    globals.udpServerUserActivity.socket.on('message', messageEventHandler);
}
