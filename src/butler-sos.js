// Add dependencies
var restify = require('restify');

// Load code from sub modules
const globals = require('./globals');
const healthMetrics = require('./lib/healthmetrics');
const logDb = require('./lib/logdb');
const sessionMetrics = require('./lib/sessionmetrics');
const appNamesExtract = require('./lib/appnamesextract');
heartbeat = require('./lib/heartbeat');
serviceUptime = require('./lib/service_uptime');

globals.initInfluxDB();

serviceUptime.serviceUptimeStart();

mainScript();

function mainScript() {
    // Load certificates to use when connecting to healthcheck API
    var path = require('path'),
        certFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCert')),
        keyFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertKey')),
        caFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertCA'));

    // ---------------------------------------------------
    // Create restServer object
    var restServer = restify.createServer({
        name: 'Docker healthcheck for Butler-SOS',
        version: globals.appVersion,
    });

    // Enable parsing of http parameters
    restServer.use(restify.plugins.queryParser());

    // Set up endpoint for Docker healthcheck REST server
    restServer.get(
        {
            path: '/',
            flags: 'i',
        },
        (req, res, next) => {
            globals.logger.verbose(`MAIN: Docker healthcheck API endpoint called.`);

            res.send(0);
            next();
        },
    );

    // Set up heartbeats, if enabled in the config file
    if (globals.config.get('Butler-SOS.heartbeat.enabled') == true) {
        heartbeat.setupHeartbeatTimer(globals.config, globals.logger);
    }

    // Set specific log level (if/when needed to override the config file setting)
    // Possible values are { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
    // Default is to use log level defined in config file
    globals.logger.info('--------------------------------------');
    globals.logger.info('Starting Butler SOS');
    globals.logger.info(`Log level: ${globals.getLoggingLevel()}`);
    globals.logger.info(`App version: ${globals.appVersion}`);
    globals.logger.info('--------------------------------------');

    // Log info about what Qlik Sense certificates are being used
    globals.logger.debug(`Client cert: ${certFile}`);
    globals.logger.debug(`Client cert key: ${keyFile}`);
    globals.logger.debug(`CA cert: ${caFile}`);

    // ---------------------------------------------------

    // Start Docker healthcheck REST server on port 12398
    if (globals.config.get('Butler-SOS.docker.enableHealthCheck') == true) {
        globals.logger.verbose('MAIN: Starting Docker healthcheck server...');

        restServer.listen(globals.config.get('Butler-SOS.docker.healthCheckPort'), function () {
            globals.logger.info('MAIN: Docker healthcheck server now listening');
        });
    };

    // Set up extraction of data from log db
    if (globals.config.get('Butler-SOS.logdb.enableLogDb') == true) {
        logDb.setupLogDbTimer();
    }

    // Set up extraction of sessions data
    if (globals.config.get('Butler-SOS.userSessions.enableSessionExtract') == true) {
        sessionMetrics.setupUserSessionsTimer();
    }

    // Set up extraction on main metrics data (i.e. the Sense healthcheck API)
    healthMetrics.setupHealthMetricsTimer();

    // Set up extraction of app IDs and names
    if (globals.config.get('Butler-SOS.appNames.enableAppNameExtract') == true) {
        appNamesExtract.setupAppNamesExtractTimer();
    }
}
