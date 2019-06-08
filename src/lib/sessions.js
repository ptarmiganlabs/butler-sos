// Get info on what sessions currently exist
function setupSessionsTimer() {
    globals.logger.debug(`Monitor sessions for virtual proxies: ${JSON.stringify(globals.virtualProxyList, null, 2)}`);

    // Configure timer for getting log data from Postgres
    setInterval(function () {
        globals.logger.verbose("Event started: Poll user sessions");

        globals.userSessionsServers.forEach(function (server) {
            globals.logger.verbose(`Getting sessions for ${JSON.stringify(server, null, 2)}`);

            getSessionStatsFromSense(server);
        });

    }, globals.config.get("Butler-SOS.userSessions.pollingInterval"));
}



module.exports = {
    setupSessionsTimer,
    getSessionsFromSense
};