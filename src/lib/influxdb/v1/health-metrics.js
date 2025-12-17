import globals from '../../../globals.js';
import {
    getFormattedTime,
    processAppDocuments,
    isInfluxDbEnabled,
    writeToInfluxWithRetry,
} from '../shared/utils.js';

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
export async function storeHealthMetricsV1(serverTags, body) {
    globals.logger.debug(
        `HEALTH METRICS V1: Processing health data for server: ${serverTags.server_name}`
    );

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    try {
        globals.logger.debug(
            `HEALTH METRICS V1: Number of apps active: ${body.apps.active_docs.length}`
        );
        globals.logger.debug(
            `HEALTH METRICS V1: Number of apps loaded: ${body.apps.loaded_docs.length}`
        );
        globals.logger.debug(
            `HEALTH METRICS V1: Number of apps in memory: ${body.apps.in_memory_docs.length}`
        );

        // Process app names for different document types
        const { appNames: appNamesActive, sessionAppNames: sessionAppNamesActive } =
            await processAppDocuments(body.apps.active_docs, 'HEALTH METRICS V1', 'active');

        const { appNames: appNamesLoaded, sessionAppNames: sessionAppNamesLoaded } =
            await processAppDocuments(body.apps.loaded_docs, 'HEALTH METRICS V1', 'loaded');

        const { appNames: appNamesInMemory, sessionAppNames: sessionAppNamesInMemory } =
            await processAppDocuments(body.apps.in_memory_docs, 'HEALTH METRICS V1', 'in memory');

        // Create datapoint array for v1 - plain objects with measurement, tags, fields
        const datapoint = [
            {
                measurement: 'sense_server',
                tags: serverTags,
                fields: {
                    version: body.version,
                    started: body.started,
                    uptime: getFormattedTime(body.started),
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

                    active_docs: globals.config.get(
                        'Butler-SOS.influxdbConfig.includeFields.activeDocs'
                    )
                        ? body.apps.active_docs
                        : '',
                    active_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                            ? appNamesActive.map((name) => `"${name}"`).join(',')
                            : '',
                    active_session_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                            ? sessionAppNamesActive.map((name) => `"${name}"`).join(',')
                            : '',

                    loaded_docs: globals.config.get(
                        'Butler-SOS.influxdbConfig.includeFields.loadedDocs'
                    )
                        ? body.apps.loaded_docs
                        : '',
                    loaded_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                            ? appNamesLoaded.map((name) => `"${name}"`).join(',')
                            : '',
                    loaded_session_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                            ? sessionAppNamesLoaded.map((name) => `"${name}"`).join(',')
                            : '',

                    in_memory_docs: globals.config.get(
                        'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs'
                    )
                        ? body.apps.in_memory_docs
                        : '',
                    in_memory_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                            ? appNamesInMemory.map((name) => `"${name}"`).join(',')
                            : '',
                    in_memory_session_docs_names:
                        globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                            ? sessionAppNamesInMemory.map((name) => `"${name}"`).join(',')
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
        await writeToInfluxWithRetry(
            async () => await globals.influx.writePoints(datapoint),
            `Health metrics for ${serverTags.server_name}`,
            'v1',
            serverTags.server_name
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
