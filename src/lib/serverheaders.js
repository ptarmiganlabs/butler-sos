import globals from '../globals.js';
import { logError } from './log-error.js';

/**
 * Extracts HTTP headers from a server configuration object.
 *
 * This function processes a server configuration object and extracts any custom HTTP headers
 * defined in the server's headers property. These headers can be used when making API requests
 * to the server.
 *
 * @param {object} server - Server configuration object
 * @param {string} server.serverName - Name of the server
 * @param {object} [server.headers] - Optional HTTP headers to use with this server
 * @returns {object | Array} Object with all headers if successful, empty array on error
 */
export function getServerHeaders(server) {
    try {
        const headers = {};

        // Check if there are any headers for this server that should be added
        if (Object.prototype.hasOwnProperty.call(server, 'headers') && server.headers !== null) {
            // Loop over all headers defined for the current server
            Object.entries(server.headers).forEach(([key, value]) => {
                globals.logger.debug(`SERVERHEADERS: Found header: ${value}: ${value}`);

                headers[key] = value;
            });
        }
        globals.logger.debug(
            `SERVERTAGS: Additional headers for server ${server.serverName}: ${JSON.stringify(
                headers
            )}`
        );

        return headers;
    } catch (err) {
        logError('SERVERTAGS', err);
        return [];
    }
}
