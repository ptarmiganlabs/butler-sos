// Add dependencies
const path = require('path');
const FastifyHealthcheck = require('fastify-healthcheck');
const Fastify = require('fastify');

const promServer = Fastify({ logger: false });
const promFastifyMetricsServer = Fastify({ logger: false });
const dockerHealthCheckServer = Fastify({ logger: false });

const metricsPlugin = require('fastify-metrics');

promServer.server.keepAliveTimeout = 0;
promFastifyMetricsServer.register(metricsPlugin, { endpoint: '/metrics' });

// Load code from sub modules
const globals = require('./globals');
const healthMetrics = require('./lib/healthmetrics');
const logDb = require('./lib/logdb');
const proxySessionMetrics = require('./lib/proxysessionmetrics');
const appNamesExtract = require('./lib/appnamesextract');
const heartbeat = require('./lib/heartbeat');
const serviceUptime = require('./lib/service_uptime');
const udpUserActivity = require('./lib/udp_handlers_user_activity');
const udpLogEvents = require('./lib/udp_handlers_log_events');
const telemetry = require('./lib/telemetry');
const promClient = require('./lib/prom-client');
const { verifyConfigFile } = require('./lib/config-file-verify');

// Suppress experimental warnings
// https://stackoverflow.com/questions/55778283/how-to-disable-warnings-when-node-is-launched-via-a-global-shell-script
const originalEmit = process.emit;
process.emit = function (name, data, ...args) {
    // console.log(`Got a Node.js event: ${name}`);
    // console.log(`Type of data: ${typeof data}`);
    // if (typeof data === `object`) {
    //     console.log(`Data: ${JSON.stringify(data)}`);
    //     console.log(`Data name: ${data.name}`);
    //     console.log(`Data message: ${data.message}`);
    // }
    // console.log(`Args: ${args}`);

    if (
        name === `warning` &&
        typeof data === `object` &&
        data.name === `ExperimentalWarning` &&
        data.message.includes(`Fetch API`)
    ) {
        return false;
    }
    return originalEmit.apply(process, arguments);
};

async function sleep(ms) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mainScript() {
    // Sleep 5 seconds to allow inits to complete
    globals.logger.info('MAIN: Waiting 5 seconds for initializations to complete...');
    globals.logger.info('5...');
    await sleep(1000);
    globals.logger.info('4...');
    await sleep(1000);
    globals.logger.info('3...');
    await sleep(1000);
    globals.logger.info('2...');
    await sleep(1000);
    globals.logger.info('1...');
    await sleep(1000);

    await globals.initInfluxDB();

    if (globals.config.get('Butler-SOS.uptimeMonitor.enable') === true) {
        serviceUptime.serviceUptimeStart();
    }

    // Verify that the config file has the correct format
    // Only do this if the command line option no-config-file-verify is NOT set
    if (globals.options.skipConfigVerification) {
        globals.logger.warn('MAIN: Skipping config file verification');
    } else {
        await verifyConfigFile();
    }

    // Load certificates to use when connecting to healthcheck API
    const certFile = path.resolve(process.cwd(), globals.config.get('Butler-SOS.cert.clientCert'));
    const keyFile = path.resolve(
        process.cwd(),
        globals.config.get('Butler-SOS.cert.clientCertKey')
    );
    const caFile = path.resolve(process.cwd(), globals.config.get('Butler-SOS.cert.clientCertCA'));

    // Set up heartbeats, if enabled in the config file
    if (globals.config.get('Butler-SOS.heartbeat.enable') === true) {
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
        globals.logger.info(`Log level       : ${globals.getLoggingLevel()}`);
        globals.logger.info(`App version     : ${globals.appVersion}`);
        globals.logger.info(`Instance ID     : ${globals.hostInfo.id}`);
        globals.logger.info('');
        globals.logger.info(`Node version    : ${globals.hostInfo.node.nodeVersion}`);
        globals.logger.info(`Architecture    : ${globals.hostInfo.si.os.arch}`);
        globals.logger.info(`Platform        : ${globals.hostInfo.si.os.platform}`);
        globals.logger.info(`Release         : ${globals.hostInfo.si.os.release}`);
        globals.logger.info(`Distro          : ${globals.hostInfo.si.os.distro}`);
        globals.logger.info(`Codename        : ${globals.hostInfo.si.os.codename}`);
        globals.logger.info(`Virtual         : ${globals.hostInfo.si.system.virtual}`);
        globals.logger.info(`Processors      : ${globals.hostInfo.si.cpu.processors}`);
        globals.logger.info(`Physical cores  : ${globals.hostInfo.si.cpu.physicalCores}`);
        globals.logger.info(`Cores           : ${globals.hostInfo.si.cpu.cores}`);
        globals.logger.info(`Docker arch.    : ${globals.hostInfo.si.cpu.hypervizor}`);
        globals.logger.info(`Total memory    : ${globals.hostInfo.si.memory.total}`);
        globals.logger.info(`Standalone app  : ${globals.isPkg}`);

        // Log info about what Qlik Sense certificates are being used
        globals.logger.info(`Client cert     : ${certFile}`);
        globals.logger.info(`Client cert key : ${keyFile}`);
        globals.logger.info(`CA cert         : ${caFile}`);
        globals.logger.info('--------------------------------------');

        // Set up anon usage reports, if enabled
        if (globals.config.get('Butler-SOS.anonTelemetry') === true) {
            telemetry.setupAnonUsageReportTimer();
            globals.logger.verbose('MAIN: Anonymous telemetry reporting has been set up.');
            globals.logger.verbose(
                'MAIN: ❤️  Thank you for supporting Butler SOS by allowing telemetry! ❤️'
            );
        }
    } catch (err) {
        globals.logger.error(`CONFIG: Error initiating host info: ${err}`);
    }

    // Set up UDP handler for user activity/events
    if (globals.config.get('Butler-SOS.userEvents.enable')) {
        udpUserActivity.udpInitUserActivityServer();

        globals.logger.debug(
            `MAIN: Server for user activity/events UDP server: ${globals.udpServerUserActivity.host}`
        );

        // Start UDP server for user activity events
        globals.udpServerUserActivity.socket.bind(
            globals.udpServerUserActivity.portUserActivity,
            globals.udpServerUserActivity.host
        );
    }

    // Set up UDP handler for log events
    if (
        globals.config.get('Butler-SOS.logEvents.source.repository.enable') ||
        globals.config.get('Butler-SOS.logEvents.source.scheduler.enable') ||
        globals.config.get('Butler-SOS.logEvents.source.proxy.enable')
    ) {
        udpLogEvents.udpInitLogEventServer();

        globals.logger.debug(
            `MAIN: Server for user activity/events UDP server: ${globals.udpServerLogEvents.host}`
        );

        // Start UDP server for user activity events
        globals.udpServerLogEvents.socket.bind(
            globals.udpServerLogEvents.port,
            globals.udpServerLogEvents.host
        );
    }

    // Start Docker healthcheck REST server on port set in config file
    if (globals.config.get('Butler-SOS.dockerHealthCheck.enable') === true) {
        try {
            globals.logger.verbose('MAIN: Starting Docker healthcheck server...');

            await dockerHealthCheckServer.register(FastifyHealthcheck);

            await dockerHealthCheckServer.listen({
                port: globals.config.get('Butler-SOS.dockerHealthCheck.port'),
            });

            globals.logger.info(
                `MAIN: Started Docker healthcheck server on port ${globals.config.get(
                    'Butler-SOS.dockerHealthCheck.port'
                )}.`
            );
        } catch (err) {
            globals.logger.error(
                `MAIN: Error while starting Docker healthcheck server on port ${globals.config.get(
                    'Butler-SOS.dockerHealthCheck.port'
                )}.`
            );
            dockerHealthCheckServer.log.error(err);
            process.exit(1);
        }
    }

    // Start Prometheus metrics REST server on port set in config file
    if (globals.config.get('Butler-SOS.prometheus.enable') === true) {
        const promHost = globals.config.get('Butler-SOS.prometheus.host');
        const promPort = globals.config.get('Butler-SOS.prometheus.port');

        const promNodeHost = '0.0.0.0';
        const promNodePort = 9001;

        try {
            // Set up Butler SOS metrics
            globals.logger.info(
                `MAIN: Starting Prometheus Butler SOS endpoint on ${promHost}:${promPort}.`
            );
            promClient.setupPromClient(promServer, promPort, promHost);
        } catch (err) {
            globals.logger.error(
                `MAIN: Error while starting Prometheus Butler SOS endpoint on ${promHost}:${promPort}.`
            );
            promServer.log.error(err);
            process.exit(1);
        }

        try {
            // Set up Node.js internal metrics
            await promFastifyMetricsServer.listen({ port: promNodePort, host: promNodeHost });
            globals.logger.info(
                `PROM: Prometheus Node.js metrics server now listening on port ${promNodeHost}:${promNodePort}`
            );
        } catch (err) {
            globals.logger.error(
                `MAIN: Error while starting Prometheus Node.js endpoint on ${promNodeHost}:${promNodePort}.`
            );
            promFastifyMetricsServer.log.error(err);
            process.exit(1);
        }
    }

    // Set up extraction of data from log db
    if (globals.config.get('Butler-SOS.logdb.enable') === true) {
        logDb.setupLogDbTimer();
    }

    // Set up extraction of sessions data
    if (globals.config.get('Butler-SOS.userSessions.enableSessionExtract') === true) {
        proxySessionMetrics.setupUserSessionsTimer();
    }

    // Set up extraction on main metrics data (i.e. the Sense healthcheck API)
    healthMetrics.setupHealthMetricsTimer();

    // Set up extraction of app IDs and names
    if (globals.config.get('Butler-SOS.appNames.enableAppNameExtract') === true) {
        appNamesExtract.setupAppNamesExtractTimer();
    }
}

mainScript();
