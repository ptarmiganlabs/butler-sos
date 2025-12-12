import globals from '../../../globals.js';
import { getFormattedTime, processAppDocuments } from '../shared/utils.js';

/**
 * Store health metrics from multiple Sense engines to InfluxDB v1
 *
 * @param {object} serverTags - Server tags for all measurements
 * @param {object} body - Health metrics data from Sense engine
 * @returns {Promise<void>}
 */
export async function storeHealthMetricsV1(serverTags, body) {
    try {
        // Process app names for different document types
        const [appNamesActive, sessionAppNamesActive] = await processAppDocuments(
            body.apps.active_docs
        );
        const [appNamesLoaded, sessionAppNamesLoaded] = await processAppDocuments(
            body.apps.loaded_docs
        );
        const [appNamesInMemory, sessionAppNamesInMemory] = await processAppDocuments(
            body.apps.in_memory_docs
        );

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

        // Write to InfluxDB v1 using node-influx library
        await globals.influx.writePoints(datapoint);

        globals.logger.verbose(
            `INFLUXDB V1 HEALTH METRICS: Stored health data from server: ${serverTags.server_name}`
        );
    } catch (err) {
        globals.logger.error(`INFLUXDB V1 HEALTH METRICS: Error saving health data: ${err}`);
        throw err;
    }
}
