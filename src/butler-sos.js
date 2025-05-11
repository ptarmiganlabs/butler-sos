// Add dependencies
import path from 'path';
import FastifyHealthcheck from 'fastify-healthcheck';
import Fastify from 'fastify';

const promServer = Fastify({ logger: false });
const promFastifyMetricsServer = Fastify({ logger: false });
const dockerHealthCheckServer = Fastify({ logger: false });

import metricsPlugin from 'fastify-metrics';

promServer.server.keepAliveTimeout = 0;
promFastifyMetricsServer.register(metricsPlugin, { endpoint: '/metrics' });

// Load code from sub modules
import { setupHealthMetricsTimer } from './lib/healthmetrics.js';
import { setupUserSessionsTimer } from './lib/proxysessionmetrics.js';
import { setupAppNamesExtractTimer } from './lib/appnamesextract.js';
import { setupHeartbeatTimer } from './lib/heartbeat.js';
import { serviceUptimeStart } from './lib/service_uptime.js';
import { udpInitUserActivityServer } from './lib/udp_handlers_user_activity.js';
import { udpInitLogEventServer } from './lib/udp_handlers_log_events.js';
import { setupAnonUsageReportTimer } from './lib/telemetry.js';
import { setupPromClient } from './lib/prom-client.js';
import { setupConfigVisServer } from './lib/config-visualise.js';
import { setupUdpEventsStorage } from './lib/udp-event.js';

// Suppress experimental warnings
// https://stackoverflow.com/questions/55778283/how-to-disable-warnings-when-node-is-launched-via-a-global-shell-script
const originalEmit = process.emit;

/**
 * Custom implementation of the `process.emit` function to suppress specific Node.js warnings.
 *
 * This function intercepts emitted events and checks if the event name is `warning` and the
 * warning is of type `ExperimentalWarning` related to the Fetch API. If so, it suppresses
 * the warning by returning `false`. Otherwise, it delegates the event emission to the original
 * `process.emit` function.
 *
 * @param {string} name - The name of the event being emitted.
 * @param {object} data - The data associated with the event. Expected to be an object containing
 *                        warning details when the event name is `warning`.
 * @param {...*} args - Additional arguments passed to the event handler.
 * @returns {boolean} `false` if the warning is suppressed; otherwise, the result of the original
 *                    `process.emit` function.
 */
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

/**
 * Delays execution for the specified amount of time.
 *
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified time has elapsed.
 */
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main application entry point that initializes and starts all Butler SOS services.
 *
 * This function initializes globals, sets up logging, starts UDP servers for user events
 * and log events, and initializes various metrics collection services based on configuration.
 *
 * @returns {Promise<void>} A promise that resolves when initialization is complete.
 */
async function mainScript() {
    // Set env variable to indicate that it is ok to change config settings
    process.env.ALLOW_CONFIG_MUTATIONS = 'true';

    // Load globals dynamically/async to ensure singleton pattern works
    const settingsObj = (await import('./globals.js')).default;
    const globals = await settingsObj.init();
    globals.logger.verbose(`START: Globals init done: ${globals.initialised}`);

    // Ensure that initialisation of globals is complete
    // Sleep 5 seconds otherwise to allow globals to be initialised
    /**
     * Helper function for sleeping/delaying within the mainScript function.
     *
     * @param {number} ms - The number of milliseconds to sleep.
     * @returns {Promise<void>} A promise that resolves after the specified time has elapsed.
     */
    function sleepLocal(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    if (!globals.initialised) {
        globals.logger.info('START: Sleeping 5 seconds to allow globals to be initialised.');
        globals.logger.info('5...');
        await sleepLocal(1000);
        globals.logger.info('4...');
        await sleepLocal(1000);
        globals.logger.info('3...');
        await sleepLocal(1000);
        globals.logger.info('2...');
        await sleepLocal(1000);
        globals.logger.info('1...');
        await sleepLocal(1000);
    } else {
        globals.logger.info('START: Globals initialised - all good.');
    }

    if (globals.config.get('Butler-SOS.uptimeMonitor.enable') === true) {
        serviceUptimeStart();
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
        setupHeartbeatTimer(globals.config, globals.logger);
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
        globals.logger.info(`Log level         : ${globals.getLoggingLevel()}`);
        globals.logger.info(`App version       : ${globals.appVersion}`);
        globals.logger.info(`Instance ID       : ${globals.hostInfo.id}`);
        globals.logger.info(`Running in Docker : ${globals.hostInfo.isRunningInDocker}`);
        globals.logger.info('');
        globals.logger.info(`Node version      : ${globals.hostInfo.node.nodeVersion}`);
        globals.logger.info(`Architecture      : ${globals.hostInfo.si.os.arch}`);
        globals.logger.info(`Platform          : ${globals.hostInfo.si.os.platform}`);
        globals.logger.info(`Release           : ${globals.hostInfo.si.os.release}`);
        globals.logger.info(`Distro            : ${globals.hostInfo.si.os.distro}`);
        globals.logger.info(`Codename          : ${globals.hostInfo.si.os.codename}`);
        globals.logger.info(`Virtual           : ${globals.hostInfo.si.system.virtual}`);
        globals.logger.info(`Processors        : ${globals.hostInfo.si.cpu.processors}`);
        globals.logger.info(`Physical cores    : ${globals.hostInfo.si.cpu.physicalCores}`);
        globals.logger.info(`Cores             : ${globals.hostInfo.si.cpu.cores}`);
        globals.logger.info(`Docker arch.      : ${globals.hostInfo.si.cpu.hypervizor}`);
        globals.logger.info(`Total memory      : ${globals.hostInfo.si.memory.total}`);
        globals.logger.info(`Standalone app    : ${globals.isSea}`);

        // Log info about what Qlik Sense certificates are being used
        globals.logger.info(`Client cert       : ${certFile}`);
        globals.logger.info(`Client cert key   : ${keyFile}`);
        globals.logger.info(`CA cert           : ${caFile}`);
        globals.logger.info('--------------------------------------');

        // Set up anon usage reports, if enabled
        if (globals.config.get('Butler-SOS.anonTelemetry') === true) {
            setupAnonUsageReportTimer();
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
        udpInitUserActivityServer();

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
        udpInitLogEventServer();

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
            setupPromClient(promServer, promPort, promHost);
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

    // Set up extraction of sessions data
    if (globals.config.get('Butler-SOS.userSessions.enableSessionExtract') === true) {
        setupUserSessionsTimer();
    }

    // Set up extraction on main metrics data (i.e. the Sense healthcheck API)
    setupHealthMetricsTimer();

    // Set up extraction of app IDs and names
    if (globals.config.get('Butler-SOS.appNames.enableAppNameExtract') === true) {
        setupAppNamesExtractTimer();
    }

    // Set up config server, if enabled
    if (globals.config.get('Butler-SOS.configVisualisation.enable') === true) {
        await setupConfigVisServer();
    }

    // Set up rejected user/log events storage, if enabled
    if (globals.config.get('Butler-SOS.qlikSenseEvents.rejectedEventCount.enable') === true) {
        globals.logger.verbose('MAIN: Rejected events storage enabled');
        await setupUdpEventsStorage();
    }
}

mainScript();
