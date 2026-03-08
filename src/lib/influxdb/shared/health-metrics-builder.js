import globals from '../../../globals.js';
import { getFormattedTime, processAppDocuments } from './utils.js';

/**
 * Builds canonical health metric datapoints from Qlik Sense health data.
 *
 * This function extracts the shared logic for processing health metrics that is
 * common across all InfluxDB versions (v1, v2, v3). It handles:
 * - Processing app documents (active, loaded, in-memory)
 * - Computing server uptime
 * - Reading configuration flags for field inclusion
 * - Logging app document counts
 *
 * Each InfluxDB version-specific module calls this builder and maps the returned
 * structure to its respective InfluxDB client API format.
 *
 * @param {object} body - The health metrics data from Sense engine healthcheck API
 * @param {object} body.version - Qlik Sense version
 * @param {string} body.started - Server start time
 * @param {object} body.mem - Memory metrics (committed, allocated, free)
 * @param {object} body.apps - App metrics including active_docs, loaded_docs, in_memory_docs, calls, selections
 * @param {object} body.cpu - CPU metrics (total)
 * @param {object} body.session - Session metrics (active, total)
 * @param {object} body.users - User metrics (active, total)
 * @param {object} body.cache - Cache metrics (hits, lookups, added, replaced, bytes_added)
 * @param {boolean} body.saturated - Saturation status
 * @param {string} logPrefix - Prefix for log messages (e.g., 'HEALTH METRICS V1')
 * @returns {Promise<object>} Object containing processed metrics data, app names, and config flags
 */
export async function buildHealthMetricDatapoints(body, logPrefix) {
    // Log app document counts
    globals.logger.debug(`${logPrefix}: Number of apps active: ${body.apps.active_docs.length}`);
    globals.logger.debug(`${logPrefix}: Number of apps loaded: ${body.apps.loaded_docs.length}`);
    globals.logger.debug(
        `${logPrefix}: Number of apps in memory: ${body.apps.in_memory_docs.length}`
    );

    // Process app names for different document types
    const { appNames: appNamesActive, sessionAppNames: sessionAppNamesActive } =
        await processAppDocuments(body.apps.active_docs, logPrefix, 'active');

    const { appNames: appNamesLoaded, sessionAppNames: sessionAppNamesLoaded } =
        await processAppDocuments(body.apps.loaded_docs, logPrefix, 'loaded');

    const { appNames: appNamesInMemory, sessionAppNames: sessionAppNamesInMemory } =
        await processAppDocuments(body.apps.in_memory_docs, logPrefix, 'in memory');

    // Compute server uptime
    const formattedTime = getFormattedTime(body.started);

    // Read configuration flags
    const includeActiveDocs = globals.config.get(
        'Butler-SOS.influxdbConfig.includeFields.activeDocs'
    );
    const includeLoadedDocs = globals.config.get(
        'Butler-SOS.influxdbConfig.includeFields.loadedDocs'
    );
    const includeInMemoryDocs = globals.config.get(
        'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs'
    );
    const enableAppNameExtract = globals.config.get('Butler-SOS.appNames.enableAppNameExtract');

    return {
        formattedTime,
        appNames: {
            active: appNamesActive,
            activeSession: sessionAppNamesActive,
            loaded: appNamesLoaded,
            loadedSession: sessionAppNamesLoaded,
            inMemory: appNamesInMemory,
            inMemorySession: sessionAppNamesInMemory,
        },
        config: {
            includeActiveDocs,
            includeLoadedDocs,
            includeInMemoryDocs,
            enableAppNameExtract,
        },
    };
}
