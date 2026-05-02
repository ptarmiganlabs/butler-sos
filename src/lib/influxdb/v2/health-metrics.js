import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry, writePointsToInfluxV2 } from '../shared/utils.js';
import { buildHealthMetricDatapoints } from '../shared/health-metrics-builder.js';

/**
 * Posts health metrics data from Qlik Sense to InfluxDB v2.
 *
 * This function processes health data from the Sense engine's healthcheck API and
 * formats it for storage in InfluxDB v2. It handles various metrics including:
 * - CPU usage
 * - Memory usage (committed, allocated, free)
 * - Cache metrics (hits, lookups, additions, replacements)
 * - Active/loaded/in-memory apps
 * - Session counts (active, total)
 * - User counts (active, total)
 * - Server version and uptime
 *
 * @param {string} serverName - The name of the Qlik Sense server
 * @param {string} host - The hostname or IP of the Qlik Sense server
 * @param {object} body - Health metrics data from Sense engine
 * @param {object} serverTags - Server-specific tags to add to datapoints
 * @returns {Promise<void>}
 */
export async function postHealthMetricsToInfluxdbV2(serverName, host, body, serverTags) {
    globals.logger.debug(`HEALTH METRICS V2: Health data: ${JSON.stringify(body, null, 2)}`);

    // Check if InfluxDB v2 is enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Validate input
    if (!body || typeof body !== 'object') {
        globals.logger.warn(`HEALTH METRICS V2: Invalid health data from server ${serverName}`);
        return;
    }

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    // Build shared metric datapoints
    const { formattedTime, appNames, config } = await buildHealthMetricDatapoints(
        body,
        'HEALTH METRICS'
    );

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
            .stringField('active_docs', config.includeActiveDocs ? body.apps.active_docs : '')
            .stringField(
                'active_docs_names',
                config.enableAppNameExtract && config.includeActiveDocs
                    ? appNames.active.toString()
                    : ''
            )
            .stringField(
                'active_session_docs_names',
                config.enableAppNameExtract && config.includeActiveDocs
                    ? appNames.activeSession.toString()
                    : ''
            )
            .stringField('loaded_docs', config.includeLoadedDocs ? body.apps.loaded_docs : '')
            .stringField(
                'loaded_docs_names',
                config.enableAppNameExtract && config.includeLoadedDocs
                    ? appNames.loaded.toString()
                    : ''
            )
            .stringField(
                'loaded_session_docs_names',
                config.enableAppNameExtract && config.includeLoadedDocs
                    ? appNames.loadedSession.toString()
                    : ''
            )
            .stringField(
                'in_memory_docs',
                config.includeInMemoryDocs ? body.apps.in_memory_docs : ''
            )
            .stringField(
                'in_memory_docs_names',
                config.enableAppNameExtract && config.includeInMemoryDocs
                    ? appNames.inMemory.toString()
                    : ''
            )
            .stringField(
                'in_memory_session_docs_names',
                config.enableAppNameExtract && config.includeInMemoryDocs
                    ? appNames.inMemorySession.toString()
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

    // Add server tags to all points
    if (serverTags && typeof serverTags === 'object') {
        for (const point of points) {
            for (const [key, value] of Object.entries(serverTags)) {
                if (value !== undefined && value !== null) {
                    point.tag(key, String(value));
                }
            }
        }
    }

    // Write all points to InfluxDB with retry logic
    await writeToInfluxWithRetry(
        () => writePointsToInfluxV2(globals.influx, org, bucketName, points),
        `Health metrics from ${serverName}`,
        'v2',
        serverName
    );

    globals.logger.verbose(`HEALTH METRICS V2: Stored health data from server: ${serverName}`);
}

// Re-export with old name for backward compatibility
export { postHealthMetricsToInfluxdbV2 as storeHealthMetricsV2 };
