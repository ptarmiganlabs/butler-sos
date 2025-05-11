import globals from '../../../globals.js';

/**
 * Handler for UDP server startup event
 * @param {*} _message Unused parameter
 * @param {*} _remote Unused parameter
 */
export function listeningEventHandler(_message, _remote) {
    const address = globals.udpServerUserActivity.socket.address();

    globals.logger.info(`USER EVENT: UDP server listening on ${address.address}:${address.port}`);
}
