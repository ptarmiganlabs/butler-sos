// Add dependencies
var restify = require('restify');

// Load code from sub modules
const globals = require('./globals');
const healthMetrics = require('./lib/healthmetrics');
const logDb = require('./lib/logdb');
const sessionMetrics = require('./lib/sessionmetrics');
const appNamesExtract = require('./lib/appnamesextract');
const heartbeat = require('./lib/heartbeat');
const serviceUptime = require('./lib/service_uptime');
const udp = require('./lib/udp_handlers');
const telemetry = require('./lib/telemetry');

globals.initInfluxDB();

if ((globals.config.has('Butler-SOS.uptimeMonitor.enabled') && globals.config.get('Butler-SOS.uptimeMonitor.enabled') == true) || 
    (globals.config.has('Butler-SOS.uptimeMonitor.enable') && globals.config.get('Butler-SOS.uptimeMonitor.enable') == true)) {
    serviceUptime.serviceUptimeStart();
}

mainScript();

async function mainScript() {
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
            globals.logger.verbose('MAIN: Docker healthcheck API endpoint called.');

            res.send(0);
            next();
        },
    );

    // Set up heartbeats, if enabled in the config file
    if ((globals.config.has('Butler-SOS.heartbeat.enabled') && globals.config.get('Butler-SOS.heartbeat.enabled') == true) || 
        (globals.config.has('Butler-SOS.heartbeat.enable') && globals.config.get('Butler-SOS.heartbeat.enable') == true)) {
        heartbeat.setupHeartbeatTimer(globals.config, globals.logger);
    }

    try {
        // Get host info
        globals.hostInfo = await globals.initHostInfo();
        globals.logger.debug('CONFIG: Initiated host info data structures');

        // Set specific log level (if/when needed to override the config file setting)
        // Possible values are { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
        // Default is to use log level defined in config file
        globals.logger.info('--------------------------------------');
        globals.logger.info('Starting Butler SOS');
        globals.logger.info(`Log level: ${globals.getLoggingLevel()}`);
        globals.logger.info(`App version: ${globals.appVersion}`);
        globals.logger.info('');
        globals.logger.info(`Node version   : ${globals.hostInfo.node.nodeVersion}`);
        globals.logger.info(`Architecture   : ${globals.hostInfo.si.os.arch}`);
        globals.logger.info(`Platform       : ${globals.hostInfo.si.os.platform}`);
        globals.logger.info(`Release        : ${globals.hostInfo.si.os.release}`);
        globals.logger.info(`Distro         : ${globals.hostInfo.si.os.distro}`);
        globals.logger.info(`Codename       : ${globals.hostInfo.si.os.codename}`);
        globals.logger.info(`Virtual        : ${globals.hostInfo.si.system.virtual}`);
        globals.logger.info(`Processors     : ${globals.hostInfo.si.cpu.processors}`);
        globals.logger.info(`Physical cores : ${globals.hostInfo.si.cpu.physicalCores}`);
        globals.logger.info(`Cores          : ${globals.hostInfo.si.cpu.cores}`);
        globals.logger.info(`Docker arch.   : ${globals.hostInfo.si.cpu.hypervizor}`);
        globals.logger.info(`Total memory   : ${globals.hostInfo.si.memory.total}`);
        globals.logger.info('--------------------------------------');

        // Log info about what Qlik Sense certificates are being used
        globals.logger.info(`Client cert: ${certFile}`);
        globals.logger.info(`Client cert key: ${keyFile}`);
        globals.logger.info(`CA cert: ${caFile}`);

        // Set up anon usage reports, if enabled
        if (
            globals.config.has('Butler-SOS.anonTelemetry') == false ||
            (globals.config.has('Butler-SOS.anonTelemetry') == true && globals.config.get('Butler-SOS.anonTelemetry') == true)
        ) {
            telemetry.setupAnonUsageReportTimer();
            globals.logger.verbose('MAIN: Anonymous telemetry reporting has been set up.');
        }
    } catch (err) {
        globals.logger.error(`CONFIG: Error initiating host info: ${err}`);
    }

    // ---------------------------------------------------
    // Set up UDP handler
    if (globals.config.has('Butler-SOS.userEvents.enable') && globals.config.get('Butler-SOS.userEvents.enable')) {
        udp.udpInitUserActivityServer();

        globals.logger.debug(`MAIN: Server for UDP server: ${globals.udpServer.host}`);

        // Start UDP server for user activity events
        globals.udpServer.userActivitySocket.bind(
            globals.udpServer.portUserActivity,
            globals.udpServer.host,
        );
    }

    // ---------------------------------------------------
    // Start Docker healthcheck REST server on port set in config file
    if ((globals.config.has('Butler-SOS.dockerHealthCheck.enabled') && globals.config.get('Butler-SOS.dockerHealthCheck.enabled') == true) || 
        (globals.config.has('Butler-SOS.dockerHealthCheck.enable') && globals.config.get('Butler-SOS.dockerHealthCheck.enable') == true)) {
        globals.logger.verbose('MAIN: Starting Docker healthcheck server...');

        restServer.listen(globals.config.get('Butler-SOS.dockerHealthCheck.port'), function () {
            globals.logger.info('MAIN: Docker healthcheck server now listening');
        });
    }

    // Set up extraction of data from log db
    if ((globals.config.has('Butler-SOS.logdb.enableLogDb') && globals.config.get('Butler-SOS.logdb.enableLogDb') == true) || 
        (globals.config.has('Butler-SOS.logdb.enable') && globals.config.get('Butler-SOS.logdb.enable') == true)) {
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
