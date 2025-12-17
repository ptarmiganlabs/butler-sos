import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Posts Butler SOS memory usage metrics to InfluxDB v3.
 *
 * This function captures memory usage metrics from the Butler SOS process itself
 * and stores them in InfluxDB v3.
 *
 * @param {object} memory - Memory usage data object
 * @param {string} memory.instanceTag - Instance identifier tag
 * @param {number} memory.heapUsedMByte - Heap used in MB
 * @param {number} memory.heapTotalMByte - Total heap size in MB
 * @param {number} memory.externalMemoryMByte - External memory usage in MB
 * @param {number} memory.processMemoryMByte - Process memory usage in MB
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function postButlerSOSMemoryUsageToInfluxdbV3(memory) {
    // Validate input
    if (!memory || typeof memory !== 'object') {
        globals.logger.warn(
            'MEMORY USAGE V3: Invalid memory data provided. Data will not be sent to InfluxDB'
        );
        return;
    }

    globals.logger.debug(`MEMORY USAGE V3: Memory usage ${JSON.stringify(memory, null, 2)})`);

    // Get Butler version
    const butlerVersion = globals.appVersion;

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    // Create point for v3
    const point = new Point3('butlersos_memory_usage')
        .setTag('butler_sos_instance', memory.instanceTag)
        .setTag('version', butlerVersion)
        .setFloatField('heap_used', memory.heapUsedMByte)
        .setFloatField('heap_total', memory.heapTotalMByte)
        .setFloatField('external', memory.externalMemoryMByte)
        .setFloatField('process_memory', memory.processMemoryMByte);

    try {
        // Convert point to line protocol and write directly with retry logic
        await writeToInfluxWithRetry(
            async () => await globals.influx.write(point.toLineProtocol(), database),
            'Memory usage metrics',
            'v3',
            '' // No specific server context for Butler memory
        );
        globals.logger.debug(`MEMORY USAGE V3: Wrote data to InfluxDB v3`);
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V3_WRITE', '');
        globals.logger.error(
            `MEMORY USAGE V3: Error saving memory usage data to InfluxDB v3! ${globals.getErrorMessage(err)}`
        );
    }

    globals.logger.verbose('MEMORY USAGE V3: Sent Butler SOS memory usage data to InfluxDB');
}
