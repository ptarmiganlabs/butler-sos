/* eslint-disable camelcase */
/** @format */

const client = require('prom-client');
// const { users } = require('systeminformation');
// import { collectDefaultMetrics, register } from 'prom-client';

// Load global variables and functions
const globals = require('../globals');
const serverTags = require('./servertags');

let promLabels = null;

let promMetric_AppsCalls = null;
let promMetric_AppsSelections = null;
let promMetric_AppsActiveDocs = null;
let promMetric_AppsInMemoryDocs = null;
let promMetric_AppsLoadedDocs = null;

let promMetric_CacheAdded = null;
let promMetric_CacheBytesAdded = null;
let promMetric_CacheHits = null;
let promMetric_CacheLookups = null;
let promMetric_CacheReplaced = null;
let promMetric_CacheSaturated = null;

let promMetric_CPUTotal = null;

let promMetric_MemCommitted = null;
let promMetric_MemAllocated = null;
let promMetric_MemFree = null;

let promMetric_SessionActive = null;
let promMetric_SessionTotal = null;

let promMetric_UsersActive = null;
let promMetric_UsersTotal = null;

let promMetric_EngineMetadata = null;

let promMetric_UserSessionsTotal = null;

// client.collectDefaultMetrics();

function setupPromClient(restPromClient) {
    try {
        // Create array with all defined server tags that should be used as Prometheus labels
        globals.serverList.forEach((server) => {
            globals.logger.verbose(
                `PROM: Setting up Prometheus client for server: ${server.serverName}`
            );
            globals.logger.debug(`PROM: Server details: ${JSON.stringify(server)}`);

            promLabels = Object.keys(serverTags.getServerTags(server));
        });

        // Define Butler SOS metrics, Prometheus style
        // https://help.qlik.com/en-US/sense-developer/May2021/Subsystems/EngineAPI/Content/Sense_EngineAPI/GettingSystemInformation/HealthCheckStatus.htm
        // ------- Health/engine metrics --------
        promMetric_AppsCalls = new client.Gauge({
            name: 'butlersos_apps_calls',
            help: 'Total number of requests made to the Qlik Sense engine.',
            labelNames: promLabels,
        });

        promMetric_AppsSelections = new client.Gauge({
            name: 'butlersos_apps_selections',
            help: 'Total number of selections made to the Qlik Sense engine.',
            labelNames: promLabels,
        });

        promMetric_AppsActiveDocs = new client.Gauge({
            name: 'butlersos_apps_activedocs_total',
            help: 'Number of active apps. An app is active when a user is currently performing some action on it.',
            labelNames: promLabels,
        });

        promMetric_AppsInMemoryDocs = new client.Gauge({
            name: 'butlersos_apps_inmemorydocs_total',
            help: 'Number of apps apps currently loaded into the memory, even if they do not have any open sessions or connections to it. Apps disappear from this metric when the engine has purged them from memory.',
            labelNames: promLabels,
        });

        promMetric_AppsLoadedDocs = new client.Gauge({
            name: 'butlersos_apps_loadeddocs_total',
            help: 'Number of apps apps currently loaded into the memory and that have open sessions or connections.',
            labelNames: promLabels,
        });

        promMetric_CacheAdded = new client.Gauge({
            name: 'butlersos_cache_added',
            help: 'Number of cache objects added.',
            labelNames: promLabels,
        });

        promMetric_CacheBytesAdded = new client.Gauge({
            name: 'butlersos_cache_bytes_added',
            help: 'Size in bytes of cache objects added.',
            labelNames: promLabels,
        });

        promMetric_CacheHits = new client.Gauge({
            name: 'butlersos_cache_hits',
            help: 'Number of cache hits.',
            labelNames: promLabels,
        });

        promMetric_CacheLookups = new client.Gauge({
            name: 'butlersos_cache_lookups',
            help: 'Number of cache lookups.',
            labelNames: promLabels,
        });

        promMetric_CacheReplaced = new client.Gauge({
            name: 'butlersos_cache_replaced',
            help: 'Number of cache objects replaced.',
            labelNames: promLabels,
        });

        promMetric_CacheSaturated = new client.Gauge({
            name: 'butlersos_cache_saturated',
            help: 'When the value is 1, the engine is running with high resource usage; otherwise the value is 0.',
            labelNames: promLabels,
        });

        promMetric_CPUTotal = new client.Gauge({
            name: 'butlersos_cpu_total',
            help: 'Percentage of the CPU used by the engine, averaged over a time period of 30 seconds.',
            labelNames: promLabels,
        });

        promMetric_MemCommitted = new client.Gauge({
            name: 'butlersos_mem_committed',
            help: 'The total amount of committed memory for the engine process in MB.',
            labelNames: promLabels,
        });

        promMetric_MemAllocated = new client.Gauge({
            name: 'butlersos_mem_allocated',
            help: 'The total amount of allocated memory (committed + reserved) from the operating system in MB.',
            labelNames: promLabels,
        });

        promMetric_MemFree = new client.Gauge({
            name: 'butlersos_mem_free',
            help: 'The total amount of free memory (minimum of free virtual and physical memory) in MB.',
            labelNames: promLabels,
        });

        promMetric_SessionActive = new client.Gauge({
            name: 'butlersos_session_active',
            help: 'Number of active engine sessions. A session is active when a user is currently performing some action on an app, for example, making selections or creating content.',
            labelNames: promLabels,
        });

        promMetric_SessionTotal = new client.Gauge({
            name: 'butlersos_session_total',
            help: 'Total number of engine sessions.',
            labelNames: promLabels,
        });

        promMetric_UsersActive = new client.Gauge({
            name: 'butlersos_users_active',
            help: 'Number of distinct active users. An active user is one who is currently performing an action on an app.',
            labelNames: promLabels,
        });

        promMetric_UsersTotal = new client.Gauge({
            name: 'butlersos_users_total',
            help: 'Total number of distinct users within the current engine sessions.',
            labelNames: promLabels,
        });

        const promMetadataLabels = [...promLabels];
        promMetadataLabels.push('engine_started');
        promMetadataLabels.push('engine_version');

        promMetric_EngineMetadata = new client.Gauge({
            name: 'butlersos_engine_metadata',
            help: 'Metadata about the Qlik Sense engine.',
            labelNames: promMetadataLabels,
        });

        // ------- User session metrics --------
        const promUserSessionLabels = [...promLabels];
        promUserSessionLabels.push('user_session_virtual_proxy');
        promUserSessionLabels.push('user_session_host');

        promMetric_UserSessionsTotal = new client.Gauge({
            name: 'butlersos_user_session_total',
            help: 'Number of sessions (as reported by the proxy service).',
            labelNames: promUserSessionLabels,
        });

        // Set up Prometheus scraping endpoint
        restPromClient.get(
            {
                path: '/metrics',
            },
            async (req, res, next) => {
                try {
                    globals.logger.verbose('MAIN: Prometheus metrics API endpoint called.');

                    res.set('Content-Type', client.register.contentType);
                    res.send(await client.register.metrics());
                    next();
                } catch (err) {
                    res.status(500).end(err);
                }
            }
        );

        const promPort = globals.config.has('Butler-SOS.prometheus.port')
            ? globals.config.get('Butler-SOS.prometheus.port')
            : 4001;

        restPromClient.listen(4001, () => {
            globals.logger.info(
                `PROM: Prometheus metrics server now listening on port ${promPort}`
            );
        });
    } catch (err) {
        globals.logger.error(`PROM: ${err}`);
    }
}

function saveHealthMetrics(host, data, labels) {
    try {
        globals.logger.silly(`PROM: Health metrics (host): ${host}`);
        globals.logger.silly(`PROM: Health metrics (data): ${JSON.stringify(data)}`);
        globals.logger.silly(`PROM: Health metrics (labels): ${JSON.stringify(labels)}`);

        // Apps
        promMetric_AppsCalls.set(labels, data.apps.calls);
        promMetric_AppsSelections.set(labels, data.apps.selections);
        promMetric_AppsActiveDocs.set(labels, data.apps.active_docs.length);
        promMetric_AppsInMemoryDocs.set(labels, data.apps.in_memory_docs.length);
        promMetric_AppsLoadedDocs.set(labels, data.apps.loaded_docs.length);

        // Cache
        promMetric_CacheAdded.set(labels, data.cache.added);
        promMetric_CacheBytesAdded.set(labels, data.cache.bytes_added);
        promMetric_CacheHits.set(labels, data.cache.hits);
        promMetric_CacheLookups.set(labels, data.cache.lookups);
        promMetric_CacheReplaced.set(labels, data.cache.replaced);
        promMetric_CacheSaturated.set(labels, data.saturated ? 1 : 0);

        // CPU
        promMetric_CPUTotal.set(labels, data.cpu.total);

        // Memory
        promMetric_MemCommitted.set(labels, data.mem.commited * 1048576);
        promMetric_MemAllocated.set(labels, data.mem.allocated * 1048576);
        promMetric_MemFree.set(labels, data.mem.free * 1048576);

        // Session
        promMetric_SessionActive.set(labels, data.session.active);
        promMetric_SessionTotal.set(labels, data.session.total);

        // Users
        promMetric_UsersActive.set(labels, data.users.active);
        promMetric_UsersTotal.set(labels, data.users.total);

        // Metadata
        const metadataLabels = { ...labels };
        metadataLabels.engine_version = data.version;
        metadataLabels.engine_started = data.started;
        promMetric_EngineMetadata.set(metadataLabels, 1);
    } catch (err) {
        globals.logger.error(`PROM: Error saving health data for Prometheus! ${err.stack}`);
    }
}

function saveUserSessionMetrics(userSessionsData) {
    try {
        console.log(userSessionsData);
        globals.logger.silly(`PROM: Session metrics (host): ${userSessionsData.host}`);
        globals.logger.silly(
            `PROM: Session metrics (virtual proxy): ${userSessionsData.virtualProxy}`
        );
        globals.logger.silly(
            `PROM: Session metrics (data): ${JSON.stringify(userSessionsData.datapointPrometheus)}`
        );
        globals.logger.silly(
            `PROM: Session metrics (labels): ${JSON.stringify(userSessionsData.tags)}`
        );

        // Sessions
        promMetric_UserSessionsTotal.set(
            userSessionsData.datapointPrometheus.butlersos_user_session_summary_total.labels,
            userSessionsData.datapointPrometheus.butlersos_user_session_summary_total.value
        );
    } catch (err) {
        globals.logger.error(`PROM: Error saving health data for Prometheus! ${err.stack}`);
    }
}

module.exports = {
    setupPromClient,
    saveHealthMetrics,
    saveUserSessionMetrics,
};
