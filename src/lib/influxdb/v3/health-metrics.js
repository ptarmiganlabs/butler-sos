import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import {
    getFormattedTime,
    processAppDocuments,
    isInfluxDbEnabled,
    applyTagsToPoint3,
    writeToInfluxV3WithRetry,
} from '../shared/utils.js';

/**
 * Posts health metrics data from Qlik Sense to InfluxDB v3.
 *
 * This function processes health data from the Sense engine's healthcheck API and
 * formats it for storage in InfluxDB v3. It handles various metrics including:
 * - CPU usage
 * - Memory usage
 * - Cache metrics
 * - Active/loaded/in-memory apps
 * - Session counts
 * - User counts
 *
 * @param {string} serverName - The name of the Qlik Sense server
 * @param {string} host - The hostname or IP of the Qlik Sense server
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @param {object} serverTags - Tags to associate with the metrics
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postHealthMetricsToInfluxdbV3(serverName, host, body, serverTags) {
    // Calculate server uptime
    const formattedTime = getFormattedTime(body.started);

    // Build tags structure that will be passed to InfluxDB
    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB V3: Health data: Tags sent to InfluxDB: ${JSON.stringify(
            serverTags
        )}`
    );

    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB V3: Number of apps active: ${body.apps.active_docs.length}`
    );
    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB V3: Number of apps loaded: ${body.apps.loaded_docs.length}`
    );
    globals.logger.debug(
        `HEALTH METRICS TO INFLUXDB V3: Number of apps in memory: ${body.apps.in_memory_docs.length}`
    );

    // Get active app names
    const { appNames: appNamesActive, sessionAppNames: sessionAppNamesActive } =
        await processAppDocuments(body.apps.active_docs, 'HEALTH METRICS TO INFLUXDB V3', 'active');

    // Get loaded app names
    const { appNames: appNamesLoaded, sessionAppNames: sessionAppNamesLoaded } =
        await processAppDocuments(body.apps.loaded_docs, 'HEALTH METRICS TO INFLUXDB V3', 'loaded');

    // Get in memory app names
    const { appNames: appNamesInMemory, sessionAppNames: sessionAppNamesInMemory } =
        await processAppDocuments(
            body.apps.in_memory_docs,
            'HEALTH METRICS TO INFLUXDB V3',
            'in memory'
        );

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Only write to InfluxDB if the global influxWriteApi object has been initialized
    if (!globals.influxWriteApi) {
        globals.logger.warn(
            'HEALTH METRICS V3: Influxdb write API object not initialized. Data will not be sent to InfluxDB'
        );
        return;
    }

    // Find writeApi for the server specified by serverName
    const writeApi = globals.influxWriteApi.find((element) => element.serverName === serverName);

    // Ensure that the writeApi object was found
    if (!writeApi) {
        globals.logger.warn(
            `HEALTH METRICS V3: Influxdb write API object not found for host ${host}. Data will not be sent to InfluxDB`
        );
        return;
    }

    // Get database from config
    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    // Create a new point with the data to be written to InfluxDB v3
    const points = [
        new Point3('sense_server')
            .setStringField('version', body.version)
            .setStringField('started', body.started)
            .setStringField('uptime', formattedTime),

        new Point3('mem')
            .setFloatField('comitted', body.mem.committed)
            .setFloatField('allocated', body.mem.allocated)
            .setFloatField('free', body.mem.free),

        new Point3('apps')
            .setIntegerField('active_docs_count', body.apps.active_docs.length)
            .setIntegerField('loaded_docs_count', body.apps.loaded_docs.length)
            .setIntegerField('in_memory_docs_count', body.apps.in_memory_docs.length)
            .setStringField(
                'active_docs',
                globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                    ? body.apps.active_docs
                    : ''
            )
            .setStringField(
                'active_docs_names',
                globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                    ? appNamesActive.toString()
                    : ''
            )
            .setStringField(
                'active_session_docs_names',
                globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.activeDocs')
                    ? sessionAppNamesActive.toString()
                    : ''
            )
            .setStringField(
                'loaded_docs',
                globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                    ? body.apps.loaded_docs
                    : ''
            )
            .setStringField(
                'loaded_docs_names',
                globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                    ? appNamesLoaded.toString()
                    : ''
            )
            .setStringField(
                'loaded_session_docs_names',
                globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.loadedDocs')
                    ? sessionAppNamesLoaded.toString()
                    : ''
            )
            .setStringField(
                'in_memory_docs',
                globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                    ? body.apps.in_memory_docs
                    : ''
            )
            .setStringField(
                'in_memory_docs_names',
                globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                    ? appNamesInMemory.toString()
                    : ''
            )
            .setStringField(
                'in_memory_session_docs_names',
                globals.config.get('Butler-SOS.appNames.enableAppNameExtract') &&
                    globals.config.get('Butler-SOS.influxdbConfig.includeFields.inMemoryDocs')
                    ? sessionAppNamesInMemory.toString()
                    : ''
            )
            .setIntegerField('calls', body.apps.calls)
            .setIntegerField('selections', body.apps.selections),

        new Point3('cpu').setIntegerField('total', body.cpu.total),

        new Point3('session')
            .setIntegerField('active', body.session.active)
            .setIntegerField('total', body.session.total),

        new Point3('users')
            .setIntegerField('active', body.users.active)
            .setIntegerField('total', body.users.total),

        new Point3('cache')
            .setIntegerField('hits', body.cache.hits)
            .setIntegerField('lookups', body.cache.lookups)
            .setIntegerField('added', body.cache.added)
            .setIntegerField('replaced', body.cache.replaced)
            .setIntegerField('bytes_added', body.cache.bytes_added),

        new Point3('saturated').setBooleanField('saturated', body.saturated),
    ];

    // Write to InfluxDB
    try {
        for (const point of points) {
            // Apply server tags to each point
            applyTagsToPoint3(point, serverTags);
            await writeToInfluxV3WithRetry(
                async () => await globals.influx.write(point.toLineProtocol(), database),
                `Health metrics for ${host}`
            );
        }
        globals.logger.debug(`HEALTH METRICS V3: Wrote data to InfluxDB v3`);
    } catch (err) {
        globals.logger.error(
            `HEALTH METRICS V3: Error saving health data to InfluxDB v3! ${globals.getErrorMessage(err)}`
        );
    }
}
