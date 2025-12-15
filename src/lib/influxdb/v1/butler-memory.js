import globals from '../../../globals.js';

/**
 * Store Butler SOS memory usage to InfluxDB v1
 *
 * @param {object} memory - Memory usage data
 * @returns {Promise<void>}
 */
export async function storeButlerMemoryV1(memory) {
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

        await globals.influx.writePoints(datapoint);

        globals.logger.verbose('MEMORY USAGE V1: Sent Butler SOS memory usage data to InfluxDB');
    } catch (err) {
        globals.logger.error(
            `MEMORY USAGE V1: Error saving Butler SOS memory data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
