import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Posts Butler SOS memory usage metrics to InfluxDB v2.
 *
 * This function captures memory usage metrics from the Butler SOS process itself
 * and stores them in InfluxDB v2.
 *
 * @param {object} memory - Memory usage data object
 * @param {string} memory.instanceTag - Instance identifier tag
 * @param {number} memory.heapUsedMByte - Heap used in MB
 * @param {number} memory.heapTotalMByte - Total heap size in MB
 * @param {number} memory.externalMemoryMByte - External memory usage in MB
 * @param {number} memory.processMemoryMByte - Process memory usage in MB
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeButlerMemoryV2(memory) {
    globals.logger.debug(`MEMORY USAGE V2: Memory usage ${JSON.stringify(memory, null, 2)}`);

    // Check if InfluxDB v2 is enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Validate input
    if (!memory || typeof memory !== 'object') {
        globals.logger.warn('MEMORY USAGE V2: Invalid memory data provided');
        return;
    }

    const butlerVersion = globals.appVersion;
    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    // Create point using v2 Point class
    const point = new Point('butlersos_memory_usage')
        .tag('butler_sos_instance', memory.instanceTag)
        .tag('version', butlerVersion)
        .floatField('heap_used', memory.heapUsedMByte)
        .floatField('heap_total', memory.heapTotalMByte)
        .floatField('external', memory.externalMemoryMByte)
        .floatField('process_memory', memory.processMemoryMByte);

    globals.logger.silly(
        `MEMORY USAGE V2: Influxdb datapoint for Butler SOS memory usage: ${JSON.stringify(
            point,
            null,
            2
        )}`
    );

    // Write to InfluxDB with retry logic
    await writeToInfluxWithRetry(
        async () => {
            const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', {
                flushInterval: 5000,
                maxRetries: 0,
            });
            try {
                await writeApi.writePoint(point);
                await writeApi.close();
            } catch (err) {
                try {
                    await writeApi.close();
                } catch (closeErr) {
                    // Ignore close errors
                }
                throw err;
            }
        },
        'Memory usage metrics',
        'v2',
        ''
    );

    globals.logger.verbose('MEMORY USAGE V2: Sent Butler SOS memory usage data to InfluxDB');
}
