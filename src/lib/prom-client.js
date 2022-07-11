const client = require('prom-client');
// import { collectDefaultMetrics, register } from 'prom-client';

// Load global variables and functions
const globals = require('../globals');
const serverTags = require('./servertags');

let promLabels = null;

let promMetricAppsCalls = null;
let promMetricAppsSelections = null;
let promMetricAppsActiveDocs = null;
let promMetricAppsInMemoryDocs = null;
let promMetricAppsLoadedDocs = null;

let promMetricCacheAdded = null;
let promMetricCacheBytesAdded = null;
let promMetricCacheHits = null;
let promMetricCacheLookups = null;
let promMetricCacheReplaced = null;
let promMetricCacheSaturated = null;

let promMetricCPUTotal = null;

let promMetricMemCommitted = null;
let promMetricMemAllocated = null;
let promMetricMemFree = null;

let promMetricSessionActive = null;
let promMetricSessionTotal = null;

let promMetricUsersActive = null;
let promMetricUsersTotal = null;

let promMetricEngineMetadata = null;

let promMetricUserSessionsTotal = null;

// client.collectDefaultMetrics();

async function setupPromClient(promServer, promPort, promHost) {
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
        promMetricAppsCalls = new client.Gauge({
            name: 'butlersos_apps_calls',
            help: 'Total number of requests made to the Qlik Sense engine.',
            labelNames: promLabels,
        });

        promMetricAppsSelections = new client.Gauge({
            name: 'butlersos_apps_selections',
            help: 'Total number of selections made to the Qlik Sense engine.',
            labelNames: promLabels,
        });

        promMetricAppsActiveDocs = new client.Gauge({
            name: 'butlersos_apps_activedocs_total',
            help: 'Number of active apps. An app is active when a user is currently performing some action on it.',
            labelNames: promLabels,
        });

        promMetricAppsInMemoryDocs = new client.Gauge({
            name: 'butlersos_apps_inmemorydocs_total',
            help: 'Number of apps apps currently loaded into memory, even if they do not have any open sessions or connections to it. Apps disappear from this metric when the engine has purged them from memory.',
            labelNames: promLabels,
        });

        promMetricAppsLoadedDocs = new client.Gauge({
            name: 'butlersos_apps_loadeddocs_total',
            help: 'Number of apps apps currently loaded into memory, that also have open sessions or connections.',
            labelNames: promLabels,
        });

        promMetricCacheAdded = new client.Gauge({
            name: 'butlersos_cache_added',
            help: 'Number of cache objects added.',
            labelNames: promLabels,
        });

        promMetricCacheBytesAdded = new client.Gauge({
            name: 'butlersos_cache_bytes_added',
            help: 'Size in bytes of cache objects added.',
            labelNames: promLabels,
        });

        promMetricCacheHits = new client.Gauge({
            name: 'butlersos_cache_hits',
            help: 'Number of cache hits.',
            labelNames: promLabels,
        });

        promMetricCacheLookups = new client.Gauge({
            name: 'butlersos_cache_lookups',
            help: 'Number of cache lookups.',
            labelNames: promLabels,
        });

        promMetricCacheReplaced = new client.Gauge({
            name: 'butlersos_cache_replaced',
            help: 'Number of cache replaced cache objects.',
            labelNames: promLabels,
        });

        promMetricCacheSaturated = new client.Gauge({
            name: 'butlersos_cache_saturated',
            help: 'When the value is 1, the engine is running with high resource usage; otherwise the value is 0.',
            labelNames: promLabels,
        });

        promMetricCPUTotal = new client.Gauge({
            name: 'butlersos_cpu_total',
            help: 'Percentage of the CPU used by the engine, averaged over a time period of 30 seconds.',
            labelNames: promLabels,
        });

        promMetricMemCommitted = new client.Gauge({
            name: 'butlersos_mem_committed',
            help: 'The total amount of committed memory for the engine process in MB.',
            labelNames: promLabels,
        });

        promMetricMemAllocated = new client.Gauge({
            name: 'butlersos_mem_allocated',
            help: 'The total amount of allocated memory (committed + reserved) from the operating system in MB.',
            labelNames: promLabels,
        });

        promMetricMemFree = new client.Gauge({
            name: 'butlersos_mem_free',
            help: 'The total amount of free memory (minimum of free virtual and physical memory) in MB.',
            labelNames: promLabels,
        });

        promMetricSessionActive = new client.Gauge({
            name: 'butlersos_session_active',
            help: 'Number of active engine sessions. A session is active when a user is currently performing some action on an app, for example, making selections or creating content.',
            labelNames: promLabels,
        });

        promMetricSessionTotal = new client.Gauge({
            name: 'butlersos_session_total',
            help: 'Total number of engine sessions.',
            labelNames: promLabels,
        });

        promMetricUsersActive = new client.Gauge({
            name: 'butlersos_users_active',
            help: 'Number of distinct active users. An active user is one who is currently performing an action on an app.',
            labelNames: promLabels,
        });

        promMetricUsersTotal = new client.Gauge({
            name: 'butlersos_users_total',
            help: 'Total number of distinct users within the current engine sessions.',
            labelNames: promLabels,
        });

        const promMetadataLabels = [...promLabels];
        promMetadataLabels.push('engine_started');
        promMetadataLabels.push('engine_version');

        promMetricEngineMetadata = new client.Gauge({
            name: 'butlersos_engine_metadata',
            help: 'Metadata about the Qlik Sense engine.',
            labelNames: promMetadataLabels,
        });

        // ------- User session metrics --------
        const promUserSessionLabels = [...promLabels];
        promUserSessionLabels.push('user_session_virtual_proxy');
        promUserSessionLabels.push('user_session_host');

        promMetricUserSessionsTotal = new client.Gauge({
            name: 'butlersos_user_session_total',
            help: 'Number of sessions (as reported by the proxy service).',
            labelNames: promUserSessionLabels,
        });

        promServer.get('/metrics', {}, async (request, reply) => {
            globals.logger.verbose('MAIN: Prometheus Butler SOS metrics API endpoint called.');
            try {
                reply
                    .code(200)
                    .header('Content-Type', client.register.contentType)
                    .send(await client.register.metrics());
            } catch (err) {
                reply.status(500).send(err);
            }
        });

        await promServer.listen({ port: promPort, host: promHost });
        globals.logger.info(
            `PROM: Prometheus Butler SOS metrics server now listening on port ${promPort}`
        );
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
        promMetricAppsCalls.set(labels, data.apps.calls);
        promMetricAppsSelections.set(labels, data.apps.selections);
        promMetricAppsActiveDocs.set(labels, data.apps.active_docs.length);
        promMetricAppsInMemoryDocs.set(labels, data.apps.in_memory_docs.length);
        promMetricAppsLoadedDocs.set(labels, data.apps.loaded_docs.length);

        // Cache
        promMetricCacheAdded.set(labels, data.cache.added);
        promMetricCacheBytesAdded.set(labels, data.cache.bytes_added);
        promMetricCacheHits.set(labels, data.cache.hits);
        promMetricCacheLookups.set(labels, data.cache.lookups);
        promMetricCacheReplaced.set(labels, data.cache.replaced);
        promMetricCacheSaturated.set(labels, data.saturated ? 1 : 0);

        // CPU
        promMetricCPUTotal.set(labels, data.cpu.total);

        // Memory
        promMetricMemCommitted.set(labels, data.mem.committed * 1048576);
        promMetricMemAllocated.set(labels, data.mem.allocated * 1048576);
        promMetricMemFree.set(labels, data.mem.free * 1048576);

        // Session
        promMetricSessionActive.set(labels, data.session.active);
        promMetricSessionTotal.set(labels, data.session.total);

        // Users
        promMetricUsersActive.set(labels, data.users.active);
        promMetricUsersTotal.set(labels, data.users.total);

        // Metadata
        const metadataLabels = { ...labels };
        metadataLabels.engine_version = data.version;
        metadataLabels.engine_started = data.started;
        promMetricEngineMetadata.set(metadataLabels, 1);
    } catch (err) {
        globals.logger.error(`PROM: Error saving health data for Prometheus! ${err.stack}`);
    }
}

function saveUserSessionMetrics(userSessionsData) {
    try {
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
        promMetricUserSessionsTotal.set(
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
