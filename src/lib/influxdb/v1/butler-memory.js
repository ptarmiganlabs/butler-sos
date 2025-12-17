import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Posts Butler SOS memory usage metrics to InfluxDB v1.
 *
 * This function captures memory usage metrics from the Butler SOS process itself
 * and stores them in InfluxDB v1.
 *
 * @param {object} memory - Memory usage data object
 * @param {string} memory.instanceTag - Instance identifier tag
 * @param {number} memory.heapUsedMByte - Heap used in MB
 * @param {number} memory.heapTotalMByte - Total heap size in MB
 * @param {number} memory.externalMemoryMByte - External memory usage in MB
 * @param {number} memory.processMemoryMByte - Process memory usage in MB
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeButlerMemoryV1(memory) {
    globals.logger.debug(`MEMORY USAGE V1: Memory usage ${JSON.stringify(memory, null, 2)}`);

    // Only write to InfluxDB if the global influx object has been initialized
    if (!isInfluxDbEnabled()) {
        return;
    }

    try {
        const butlerVersion = globals.appVersion;

        const datapoint = [
            {
                measurement: 'butlersos_memory_usage',
                tags: {
                    butler_sos_instance: memory.instanceTag,
                    version: butlerVersion,
                },
                fields: {
                    heap_used: memory.heapUsedMByte,
                    heap_total: memory.heapTotalMByte,
                    external: memory.externalMemoryMByte,
                    process_memory: memory.processMemoryMByte,
                },
            },
        ];

        globals.logger.silly(
            `MEMORY USAGE V1: Influxdb datapoint for Butler SOS memory usage: ${JSON.stringify(
                datapoint,
                null,
                2
            )}`
        );

        // Write with retry logic
        await writeToInfluxWithRetry(
            async () => await globals.influx.writePoints(datapoint),
            'Memory usage metrics',
            'v1',
            '' // No specific error category for butler memory
        );

        globals.logger.verbose('MEMORY USAGE V1: Sent Butler SOS memory usage data to InfluxDB');
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', '');
        globals.logger.error(
            `MEMORY USAGE V1: Error saving Butler SOS memory data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
