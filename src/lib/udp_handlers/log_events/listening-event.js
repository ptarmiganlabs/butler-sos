import globals from '../../../globals.js';

/**
 * Handler for UDP server startup event for log events.
 *
 * This function is called when the UDP server for log events starts listening.
 * It logs information about the server's address and port.
 *
 * @param {*} _message - The message received (unused in this handler)
 * @param {*} _remote - Information about the remote sender (unused in this handler)
 * @returns {void}
 */
export function listeningEventHandler(_message, _remote) {
    const address = globals.udpServerLogEvents.socket.address();

    globals.logger.info(`LOG EVENT: UDP server listening on ${address.address}:${address.port}`);
}
