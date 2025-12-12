import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';

/**
 * Store log event to InfluxDB v2
 * Handles log events from different Sense sources
 *
 * @param {object} msg - Log event message
 * @returns {Promise<void>}
 */
export async function storeLogEventV2(msg) {
    try {
        globals.logger.debug(`LOG EVENT V2: ${JSON.stringify(msg)}`);

        // Check if this is a supported source
        if (
            msg.source !== 'qseow-engine' &&
            msg.source !== 'qseow-proxy' &&
            msg.source !== 'qseow-scheduler' &&
            msg.source !== 'qseow-repository' &&
            msg.source !== 'qseow-qix-perf'
        ) {
            globals.logger.warn(`LOG EVENT V2: Unsupported log event source: ${msg.source}`);
            return;
        }

        // Create write API with options
        const writeOptions = {
            flushInterval: 5000,
            maxRetries: 2,
        };

        const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
        const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

        const writeApi = globals.influx.getWriteApi(org, bucketName, 'ns', writeOptions);

        if (!writeApi) {
            globals.logger.warn('LOG EVENT V2: Influxdb write API object not found');
            return;
        }

        let point;

        // Process each source type
        if (msg.source === 'qseow-engine') {
            point = new Point('log_event')
                .tag('host', msg.host)
                .tag('level', msg.level)
                .tag('source', msg.source)
                .tag('log_row', msg.log_row)
                .tag('subsystem', msg.subsystem)
                .stringField('message', msg.message)
                .stringField('exception_message', msg.exception_message)
                .stringField('command', msg.command)
                .stringField('result_code', msg.result_code)
                .stringField('origin', msg.origin)
                .stringField('context', msg.context)
                .stringField('session_id', msg.session_id)
                .stringField('raw_event', JSON.stringify(msg));

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
            if (msg?.user_directory?.length > 0) point.tag('user_directory', msg.user_directory);
            if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
            if (msg?.result_code?.length > 0) point.tag('result_code', msg.result_code);
            if (msg?.windows_user?.length > 0) point.tag('windows_user', msg.windows_user);
            if (msg?.task_id?.length > 0) point.tag('task_id', msg.task_id);
            if (msg?.task_name?.length > 0) point.tag('task_name', msg.task_name);
            if (msg?.app_id?.length > 0) point.tag('app_id', msg.app_id);
            if (msg?.app_name?.length > 0) point.tag('app_name', msg.app_name);
            if (msg?.engine_exe_version?.length > 0)
                point.tag('engine_exe_version', msg.engine_exe_version);
        } else if (msg.source === 'qseow-proxy') {
            point = new Point('log_event')
                .tag('host', msg.host)
                .tag('level', msg.level)
                .tag('source', msg.source)
                .tag('log_row', msg.log_row)
                .tag('subsystem', msg.subsystem)
                .stringField('message', msg.message)
                .stringField('exception_message', msg.exception_message)
                .stringField('command', msg.command)
                .stringField('result_code', msg.result_code)
                .stringField('origin', msg.origin)
                .stringField('context', msg.context)
                .stringField('raw_event', JSON.stringify(msg));

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
            if (msg?.user_directory?.length > 0) point.tag('user_directory', msg.user_directory);
            if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
            if (msg?.result_code?.length > 0) point.tag('result_code', msg.result_code);
        } else if (msg.source === 'qseow-scheduler') {
            point = new Point('log_event')
                .tag('host', msg.host)
                .tag('level', msg.level)
                .tag('source', msg.source)
                .tag('log_row', msg.log_row)
                .tag('subsystem', msg.subsystem)
                .stringField('message', msg.message)
                .stringField('exception_message', msg.exception_message)
                .stringField('app_name', msg.app_name)
                .stringField('app_id', msg.app_id)
                .stringField('execution_id', msg.execution_id)
                .stringField('raw_event', JSON.stringify(msg));

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
            if (msg?.user_directory?.length > 0) point.tag('user_directory', msg.user_directory);
            if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
            if (msg?.task_id?.length > 0) point.tag('task_id', msg.task_id);
            if (msg?.task_name?.length > 0) point.tag('task_name', msg.task_name);
        } else if (msg.source === 'qseow-repository') {
            point = new Point('log_event')
                .tag('host', msg.host)
                .tag('level', msg.level)
                .tag('source', msg.source)
                .tag('log_row', msg.log_row)
                .tag('subsystem', msg.subsystem)
                .stringField('message', msg.message)
                .stringField('exception_message', msg.exception_message)
                .stringField('command', msg.command)
                .stringField('result_code', msg.result_code)
                .stringField('origin', msg.origin)
                .stringField('context', msg.context)
                .stringField('raw_event', JSON.stringify(msg));

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
            if (msg?.user_directory?.length > 0) point.tag('user_directory', msg.user_directory);
            if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
            if (msg?.result_code?.length > 0) point.tag('result_code', msg.result_code);
        } else if (msg.source === 'qseow-qix-perf') {
            point = new Point('log_event')
                .tag('host', msg.host)
                .tag('level', msg.level)
                .tag('source', msg.source)
                .tag('log_row', msg.log_row)
                .tag('subsystem', msg.subsystem)
                .tag('method', msg.method)
                .tag('object_type', msg.object_type)
                .tag('proxy_session_id', msg.proxy_session_id)
                .tag('session_id', msg.session_id)
                .tag('event_activity_source', msg.event_activity_source)
                .stringField('app_id', msg.app_id)
                .floatField('process_time', parseFloat(msg.process_time))
                .floatField('work_time', parseFloat(msg.work_time))
                .floatField('lock_time', parseFloat(msg.lock_time))
                .floatField('validate_time', parseFloat(msg.validate_time))
                .floatField('traverse_time', parseFloat(msg.traverse_time))
                .stringField('handle', msg.handle)
                .intField('net_ram', parseInt(msg.net_ram))
                .intField('peak_ram', parseInt(msg.peak_ram))
                .stringField('raw_event', JSON.stringify(msg));

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
            if (msg?.user_directory?.length > 0) point.tag('user_directory', msg.user_directory);
            if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
            if (msg?.app_id?.length > 0) point.tag('app_id', msg.app_id);
            if (msg?.app_name?.length > 0) point.tag('app_name', msg.app_name);
            if (msg?.object_id?.length > 0) point.tag('object_id', msg.object_id);
        }

        // Add log event categories to tags if available
        // The msg.category array contains objects with properties 'name' and 'value'
        if (msg?.category?.length > 0) {
            msg.category.forEach((category) => {
                point.tag(category.name, category.value);
            });
        }

        // Add custom tags from config file to payload
        if (
            globals.config.has('Butler-SOS.logEvents.tags') &&
            globals.config.get('Butler-SOS.logEvents.tags') !== null &&
            globals.config.get('Butler-SOS.logEvents.tags').length > 0
        ) {
            const configTags = globals.config.get('Butler-SOS.logEvents.tags');
            for (const item of configTags) {
                point.tag(item.name, item.value);
            }
        }

        globals.logger.silly(`LOG EVENT V2: Influxdb datapoint: ${JSON.stringify(point, null, 2)}`);

        await writeApi.writePoint(point);

        globals.logger.verbose('LOG EVENT V2: Sent log event data to InfluxDB');
    } catch (err) {
        globals.logger.error(
            `LOG EVENT V2: Error saving log event: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
