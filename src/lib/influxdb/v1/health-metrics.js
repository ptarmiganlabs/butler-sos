import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV1 } from '../shared/utils.js';
import { buildHealthMetricDatapoints } from '../shared/health-metrics-builder.js';

/**
 * Posts health metrics data from Qlik Sense to InfluxDB v1.
 *
 * This function processes health data from the Sense engine's healthcheck API and
 * formats it for storage in InfluxDB v1. It handles various metrics including:
 * - CPU usage
 * - Memory usage
 * - Cache metrics
 * - Active/loaded/in-memory apps
 * - Session counts
 * - User counts
 *
 * @param {object} serverTags - Tags to associate with the metrics (e.g., server_name, host, etc.)
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @param {object} body.version - Qlik Sense version
 * @param {string} body.started - Server start time
 * @param {object} body.mem - Memory metrics
 * @param {object} body.apps - App metrics including active_docs, loaded_docs, in_memory_docs
 * @param {object} body.cpu - CPU metrics
 * @param {object} body.session - Session metrics
 * @param {object} body.users - User metrics
 * @param {object} body.cache - Cache metrics
 * @param {boolean} body.saturated - Saturation status
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postHealthMetricsToInfluxdbV1(serverTags, body) {
    globals.logger.debug(
        `HEALTH METRICS V1: Processing health data for server: ${serverTags.server_name}`
    );

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    try {
        // Build shared metric datapoints
        const { formattedTime, appNames, config } = await buildHealthMetricDatapoints(
            body,
            'HEALTH METRICS V1'
        );

        // Create datapoint array for v1 - plain objects with measurement, tags, fields
        const datapoint = [
            {
                measurement: 'sense_server',
                tags: serverTags,
                fields: {
                    version: body.version,
                    started: body.started,
                    uptime: formattedTime,
                },
            },
            {
                measurement: 'mem',
                tags: serverTags,
                fields: {
                    comitted: body.mem.committed,
                    allocated: body.mem.allocated,
                    free: body.mem.free,
                },
            },
            {
                measurement: 'apps',
                tags: serverTags,
                fields: {
                    active_docs_count: body.apps.active_docs.length,
                    loaded_docs_count: body.apps.loaded_docs.length,
                    in_memory_docs_count: body.apps.in_memory_docs.length,

                    active_docs: config.includeActiveDocs ? body.apps.active_docs : '',
                    active_docs_names:
                        config.enableAppNameExtract && config.includeActiveDocs
                            ? appNames.active.map((name) => `"${name}"`).join(',')
                            : '',
                    active_session_docs_names:
                        config.enableAppNameExtract && config.includeActiveDocs
                            ? appNames.activeSession.map((name) => `"${name}"`).join(',')
                            : '',

                    loaded_docs: config.includeLoadedDocs ? body.apps.loaded_docs : '',
                    loaded_docs_names:
                        config.enableAppNameExtract && config.includeLoadedDocs
                            ? appNames.loaded.map((name) => `"${name}"`).join(',')
                            : '',
                    loaded_session_docs_names:
                        config.enableAppNameExtract && config.includeLoadedDocs
                            ? appNames.loadedSession.map((name) => `"${name}"`).join(',')
                            : '',

                    in_memory_docs: config.includeInMemoryDocs ? body.apps.in_memory_docs : '',
                    in_memory_docs_names:
                        config.enableAppNameExtract && config.includeInMemoryDocs
                            ? appNames.inMemory.map((name) => `"${name}"`).join(',')
                            : '',
                    in_memory_session_docs_names:
                        config.enableAppNameExtract && config.includeInMemoryDocs
                            ? appNames.inMemorySession.map((name) => `"${name}"`).join(',')
                            : '',
                    calls: body.apps.calls,
                    selections: body.apps.selections,
                },
            },
            {
                measurement: 'cpu',
                tags: serverTags,
                fields: {
                    total: body.cpu.total,
                },
            },
            {
                measurement: 'session',
                tags: serverTags,
                fields: {
                    active: body.session.active,
                    total: body.session.total,
                },
            },
            {
                measurement: 'users',
                tags: serverTags,
                fields: {
                    active: body.users.active,
                    total: body.users.total,
                },
            },
            {
                measurement: 'cache',
                tags: serverTags,
                fields: {
                    hits: body.cache.hits,
                    lookups: body.cache.lookups,
                    added: body.cache.added,
                    replaced: body.cache.replaced,
                    bytes_added: body.cache.bytes_added,
                },
            },
            {
                measurement: 'saturated',
                tags: serverTags,
                fields: {
                    saturated: body.saturated,
                },
            },
        ];

        // Write to InfluxDB v1 using node-influx library with retry logic
        await writeBatchToInfluxV1(
            datapoint,
            `Health metrics for ${serverTags.server_name}`,
            serverTags.server_name,
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose(
            `HEALTH METRICS V1: Stored health data from server: ${serverTags.server_name}`
        );
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', serverTags.server_name);
        globals.logger.error(
            `HEALTH METRICS V1: Error saving health data for ${serverTags.server_name}: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}

// Re-export with old name for backward compatibility
export { postHealthMetricsToInfluxdbV1 as storeHealthMetricsV1 };
