import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { getFormattedTime, processAppDocuments } from '../shared/utils.js';

/**
 * Store health metrics from multiple Sense engines to InfluxDB v2
 *
 * @param {string} serverName - The name of the Qlik Sense server
 * @param {string} host - The hostname or IP of the Qlik Sense server
 * @param {object} body - Health metrics data from Sense engine
 * @returns {Promise<void>}
 */
export async function storeHealthMetricsV2(serverName, host, body) {
    try {
        // Find writeApi for the server specified by serverName
        const writeApi = globals.influxWriteApi.find(
            (element) => element.serverName === serverName
        );

        if (!writeApi) {
            globals.logger.warn(
                `HEALTH METRICS V2: Influxdb write API object not found for host ${host}`
            );
            return;
        }

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

        const formattedTime = getFormattedTime(body.started);

        // Create points using v2 Point class
        const points = [
            new Point('sense_server')
                .stringField('version', body.version)
                .stringField('started', body.started)
                .stringField('uptime', formattedTime),

            new Point('mem')
                .floatField('comitted', body.mem.committed)
                .floatField('allocated', body.mem.allocated)
                .floatField('free', body.mem.free),

            new Point('apps')
                .intField('active_docs_count', body.apps.active_docs.length)
                .intField('loaded_docs_count', body.apps.loaded_docs.length)
                .intField('in_memory_docs_count', body.apps.in_memory_docs.length)
                .stringField(
                    'active_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? body.apps.active_docs
                        : ''
                )
                .stringField(
                    'active_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? appNamesActive.toString()
                        : ''
                )
                .stringField(
                    'active_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                        ? sessionAppNamesActive.toString()
                        : ''
                )
                .stringField(
                    'loaded_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? body.apps.loaded_docs
                        : ''
                )
                .stringField(
                    'loaded_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? appNamesLoaded.toString()
                        : ''
                )
                .stringField(
                    'loaded_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                        ? sessionAppNamesLoaded.toString()
                        : ''
                )
                .stringField(
                    'in_memory_docs',
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? body.apps.in_memory_docs
                        : ''
                )
                .stringField(
                    'in_memory_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? appNamesInMemory.toString()
                        : ''
                )
                .stringField(
                    'in_memory_session_docs_names',
                    globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                        globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                        ? sessionAppNamesInMemory.toString()
                        : ''
                )
                .uintField('calls', body.apps.calls)
                .uintField('selections', body.apps.selections),

            new Point('cpu').floatField('total', body.cpu.total),

            new Point('session')
                .uintField('active', body.session.active)
                .uintField('total', body.session.total),

            new Point('users')
                .uintField('active', body.users.active)
                .uintField('total', body.users.total),

            new Point('cache')
                .uintField('hits', body.cache.hits)
                .uintField('lookups', body.cache.lookups)
                .intField('added', body.cache.added)
                .intField('replaced', body.cache.replaced)
                .intField('bytes_added', body.cache.bytes_added),

            new Point('saturated').booleanField('saturated', body.saturated),
        ];

        await writeApi.writeAPI.writePoints(points);

        globals.logger.verbose(`HEALTH METRICS V2: Stored health data from server: ${serverName}`);
    } catch (err) {
        // Track error count
        await globals.errorTracker.incrementError('INFLUXDB_V2_WRITE', serverName);

        globals.logger.error(
            `HEALTH METRICS V2: Error saving health data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
