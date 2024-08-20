import globals from '../globals.js';

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
        globals.logger.error(`SERVERTAGS: ${err}`);
        return [];
    }
}
