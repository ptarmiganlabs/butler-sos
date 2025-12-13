import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';

/**
 * Store Butler SOS memory usage to InfluxDB v2
 *
 * @param {object} memory - Memory usage data
 * @returns {Promise<void>}
 */
export async function storeButlerMemoryV2(memory) {
    try {
        const butlerVersion = globals.appVersion;

        // Create write API with options
        const writeOptions = {
            flushInterval: 5000,
            maxRetries: 2,
        };

        const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

        const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

        if (!writeApi) {
            globals.logger.warn('MEMORY USAGE V2: Influxdb write API object not found');
            return;
        }

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

        await writeApi.writePoint(point);

        globals.logger.verbose('MEMORY USAGE V2: Sent Butler SOS memory usage data to InfluxDB');
    } catch (err) {
        globals.logger.error(
            `MEMORY USAGE V2: Error saving Butler SOS memory data: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
