const globals = require('../globals');

function getServerTags(server) {
    try {
        let tags = {
            host: server.host.split(':')[0],
            server_name: server.serverName,
            server_description: server.serverDescription,
        };

        // Check if there are any extra tags for this server that should be added
        if (server.hasOwnProperty('serverTags') && server.serverTags !== null) {
            // Loop over all tags defined for the current server, adding them to the data structure that will later be passed to Influxdb
            Object.entries(server.serverTags).forEach((entry) => {
                globals.logger.debug(`SERVERTAGS: Found server tag: ${JSON.stringify(entry)}`);

                tags = Object.assign(tags, {
                    [entry[0]]: entry[1],
                });
            });
        }
        globals.logger.debug(
            `SERVERTAGS: Complete list of tags for server ${server.serverName}: ${JSON.stringify(
                tags
            )}`
        );

        return tags;
    } catch (err) {
        globals.logger.error(`SERVERTAGS: ${err}`);
        return [];
    }
}

module.exports = {
    getServerTags,
};
