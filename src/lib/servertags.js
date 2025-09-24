// Get tag values from the server object
/**
 *     } catch (err) {
        logger.error(`SERVERTAGS: ${globals.getErrorMessage(err)}`);
        return null;
    }acts tag values from a server configuration object.
 *
 * This function processes a server configuration object and extracts tags that can be
 * used to tag metrics in time series databases or monitoring systems. It always includes
 * host, server_name, and server_description tags, plus any custom tags defined in the
 * server's serverTags property.
 *
 * @param {object} logger - Logger object for logging debug and error information
 * @param {object} server - Server configuration object
 * @param {string} server.host - Hostname of the server (may include port)
 * @param {string} server.serverName - Name of the server
 * @param {string} server.serverDescription - Description of the server
 * @param {object} [server.serverTags] - Optional additional tags for the server
 * @returns {object | Array} Object with all tags if successful, empty array on error
 */
export function getServerTags(logger, server) {
    try {
        let tags = {
            host: server.host.split(':')[0],
            server_name: server.serverName,
            server_description: server.serverDescription,
        };

        // Check if there are any extra tags for this server that should be added
        // if (server.hasOwnProperty('serverTags') && server.serverTags !== null) {
        // Suggested by GitHub Copilot
        if (
            Object.prototype.hasOwnProperty.call(server, 'serverTags') &&
            server.serverTags !== null
        ) {
            // Loop over all tags defined for the current server, adding them to the data structure that will later be passed to Influxdb
            Object.entries(server.serverTags).forEach((entry) => {
                logger.debug(`SERVERTAGS: Found server tag: ${JSON.stringify(entry)}`);

                tags = Object.assign(tags, {
                    [entry[0]]: entry[1],
                });
            });
        }
        logger.debug(
            `SERVERTAGS: Complete list of tags for server ${server.serverName}: ${JSON.stringify(
                tags
            )}`
        );

        return tags;
    } catch (err) {
        logger.error(`SERVERTAGS: ${err}`);
        return [];
    }
}
