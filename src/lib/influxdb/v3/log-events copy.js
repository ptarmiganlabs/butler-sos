import { Point as Point3 } from '@influxdata/influxdb3-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Clean tag values for InfluxDB v3 line protocol
 * Remove only characters that are explicitly not supported by the line protocol spec.
 * According to the spec, newlines are not supported in tag or field values.
 *
 * The Point3 class should handle required escaping for tag values:
 * - Comma (,) → \,
 * - Equals (=) → \=
 * - Space ( ) → \
 *
 * @param {string} value - The tag value to clean
 * @returns {string} The cleaned tag value
 */
function cleanTagValue(value) {
    if (!value || typeof value !== 'string') {
        return value;
    }
    return value.replace(/[\n\r]/g, ''); // Remove only newlines and carriage returns
}

/**
 * Post log event to InfluxDB v3
 *
 * @description
 * Handles log events from 5 different Qlik Sense sources:
 * - qseow-engine: Engine log events
 * - qseow-proxy: Proxy log events
 * - qseow-scheduler: Scheduler log events
 * - qseow-repository: Repository log events
 * - qseow-qix-perf: QIX performance metrics
 *
 * Each source has specific fields and tags that are written to InfluxDB.
 *
 * @param {object} msg - The log event message
 *
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 *
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function postLogEventToInfluxdbV3(msg) {
    globals.logger.debug(`LOG EVENT INFLUXDB V3: ${msg})`);

    try {
        // Only write to InfluxDB if the global influx object has been initialized
        if (!isInfluxDbEnabled()) {
            return;
        }

        // Verify the message source is valid
        if (
            msg.source !== 'qseow-engine' &&
            msg.source !== 'qseow-proxy' &&
            msg.source !== 'qseow-scheduler' &&
            msg.source !== 'qseow-repository' &&
            msg.source !== 'qseow-qix-perf'
        ) {
            globals.logger.warn(
                `LOG EVENT INFLUXDB V3: Unknown log event source: ${msg.source}. Skipping.`
            );
            return;
        }

        const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');
        let point;

        // Handle each message type with its specific fields
        if (msg.source === 'qseow-engine') {
            // Engine fields: message, exception_message, command, result_code_field, origin, context, session_id, raw_event
            // NOTE: result_code uses _field suffix to avoid conflict with result_code tag
            point = new Point3('log_event')
                .setTag('host', msg.host)
                .setTag('level', msg.level)
                .setTag('source', msg.source)
                .setTag('log_row', msg.log_row)
                .setTag('subsystem', msg.subsystem || 'n/a')
                .setStringField('message', msg.message)
                .setStringField('exception_message', msg.exception_message || '')
                .setStringField('command', msg.command || '')
                .setStringField('result_code_field', msg.result_code || '')
                .setStringField('origin', msg.origin || '')
                .setStringField('context', msg.context || '')
                .setStringField('session_id', msg.session_id || '')
                .setStringField('raw_event', JSON.stringify(msg));

            // Conditional tags
            if (msg?.user_full?.length > 0) point.setTag('user_full', cleanTagValue(msg.user_full));
            if (msg?.user_directory?.length > 0)
                point.setTag('user_directory', cleanTagValue(msg.user_directory));
            if (msg?.user_id?.length > 0) point.setTag('user_id', cleanTagValue(msg.user_id));
            if (msg?.result_code?.length > 0)
                point.setTag('result_code', cleanTagValue(msg.result_code));
            if (msg?.windows_user?.length > 0)
                point.setTag('windows_user', cleanTagValue(msg.windows_user));
            if (msg?.task_id?.length > 0) point.setTag('task_id', cleanTagValue(msg.task_id));
            if (msg?.task_name?.length > 0) point.setTag('task_name', cleanTagValue(msg.task_name));
            if (msg?.app_id?.length > 0) point.setTag('app_id', cleanTagValue(msg.app_id));
            if (msg?.app_name?.length > 0) point.setTag('app_name', cleanTagValue(msg.app_name));
            if (msg?.engine_exe_version?.length > 0)
                point.setTag('engine_exe_version', cleanTagValue(msg.engine_exe_version));
        } else if (msg.source === 'qseow-proxy') {
            // Proxy fields: message, exception_message, command, result_code_field, origin, context, raw_event
            // NOTE: result_code uses _field suffix to avoid conflict with result_code tag
            point = new Point3('log_event')
                .setTag('host', msg.host)
                .setTag('level', msg.level)
                .setTag('source', msg.source)
                .setTag('log_row', msg.log_row)
                .setTag('subsystem', msg.subsystem || 'n/a')
                .setStringField('message', msg.message)
                .setStringField('exception_message', msg.exception_message || '')
                .setStringField('command', msg.command || '')
                .setStringField('result_code_field', msg.result_code || '')
                .setStringField('origin', msg.origin || '')
                .setStringField('context', msg.context || '')
                .setStringField('raw_event', JSON.stringify(msg));

            // Conditional tags
            if (msg?.user_full?.length > 0) point.setTag('user_full', cleanTagValue(msg.user_full));
            if (msg?.user_directory?.length > 0)
                point.setTag('user_directory', cleanTagValue(msg.user_directory));
            if (msg?.user_id?.length > 0) point.setTag('user_id', cleanTagValue(msg.user_id));
            if (msg?.result_code?.length > 0)
                point.setTag('result_code', cleanTagValue(msg.result_code));
        } else if (msg.source === 'qseow-scheduler') {
            // Scheduler fields: message, exception_message, app_name_field, app_id_field, execution_id, raw_event
            // NOTE: app_name and app_id use _field suffix to avoid conflict with conditional tags
            point = new Point3('log_event')
                .setTag('host', msg.host)
                .setTag('level', msg.level)
                .setTag('source', msg.source)
                .setTag('log_row', msg.log_row)
                .setTag('subsystem', msg.subsystem || 'n/a')
                .setStringField('message', msg.message)
                .setStringField('exception_message', msg.exception_message || '')
                .setStringField('app_name_field', msg.app_name || '')
                .setStringField('app_id_field', msg.app_id || '')
                .setStringField('execution_id', msg.execution_id || '')
                .setStringField('raw_event', JSON.stringify(msg));

            // Conditional tags
            if (msg?.user_full?.length > 0) point.setTag('user_full', cleanTagValue(msg.user_full));
            if (msg?.user_directory?.length > 0)
                point.setTag('user_directory', cleanTagValue(msg.user_directory));
            if (msg?.user_id?.length > 0) point.setTag('user_id', cleanTagValue(msg.user_id));
            if (msg?.task_id?.length > 0) point.setTag('task_id', cleanTagValue(msg.task_id));
            if (msg?.task_name?.length > 0) point.setTag('task_name', cleanTagValue(msg.task_name));
        } else if (msg.source === 'qseow-repository') {
            // Repository fields: message, exception_message, command, result_code_field, origin, context, raw_event
            // NOTE: result_code uses _field suffix to avoid conflict with result_code tag
            point = new Point3('log_event')
                .setTag('host', msg.host)
                .setTag('level', msg.level)
                .setTag('source', msg.source)
                .setTag('log_row', msg.log_row)
                .setTag('subsystem', msg.subsystem || 'n/a')
                .setStringField('message', msg.message)
                .setStringField('exception_message', msg.exception_message || '')
                .setStringField('command', msg.command || '')
                .setStringField('result_code_field', msg.result_code || '')
                .setStringField('origin', msg.origin || '')
                .setStringField('context', msg.context || '')
                .setStringField('raw_event', JSON.stringify(msg));

            // Conditional tags
            if (msg?.user_full?.length > 0) point.setTag('user_full', cleanTagValue(msg.user_full));
            if (msg?.user_directory?.length > 0)
                point.setTag('user_directory', cleanTagValue(msg.user_directory));
            if (msg?.user_id?.length > 0) point.setTag('user_id', cleanTagValue(msg.user_id));
            if (msg?.result_code?.length > 0)
                point.setTag('result_code', cleanTagValue(msg.result_code));
        } else if (msg.source === 'qseow-qix-perf') {
            // QIX Performance fields: app_id, process_time, work_time, lock_time, validate_time, traverse_time, handle, net_ram, peak_ram, raw_event
            point = new Point3('log_event')
                .setTag('host', cleanTagValue(msg.host || '<Unknown>'))
                .setTag('level', cleanTagValue(msg.level || '<Unknown>'))
                .setTag('source', cleanTagValue(msg.source || '<Unknown>'))
                .setTag('log_row', msg.log_row || '-1')
                .setTag('subsystem', cleanTagValue(msg.subsystem || '<Unknown>'))
                .setTag('method', cleanTagValue(msg.method || '<Unknown>'))
                .setTag('object_type', cleanTagValue(msg.object_type || '<Unknown>'))
                .setTag('proxy_session_id', msg.proxy_session_id || '-1')
                .setTag('session_id', msg.session_id || '-1')
                .setTag(
                    'event_activity_source',
                    cleanTagValue(msg.event_activity_source || '<Unknown>')
                )
                .setStringField('app_id_field', msg.app_id || '');

            // Add numeric fields with validation to prevent NaN
            const processTime = parseFloat(msg.process_time);
            if (!isNaN(processTime)) {
                point.setFloatField('process_time', processTime);
            } else {
                globals.logger.debug(
                    `LOG EVENT INFLUXDB V3: Invalid process_time value: ${msg.process_time}`
                );
            }

            const workTime = parseFloat(msg.work_time);
            if (!isNaN(workTime)) {
                point.setFloatField('work_time', workTime);
            } else {
                globals.logger.debug(
                    `LOG EVENT INFLUXDB V3: Invalid work_time value: ${msg.work_time}`
                );
            }

            const lockTime = parseFloat(msg.lock_time);
            if (!isNaN(lockTime)) {
                point.setFloatField('lock_time', lockTime);
            } else {
                globals.logger.debug(
                    `LOG EVENT INFLUXDB V3: Invalid lock_time value: ${msg.lock_time}`
                );
            }

            const validateTime = parseFloat(msg.validate_time);
            if (!isNaN(validateTime)) {
                point.setFloatField('validate_time', validateTime);
            } else {
                globals.logger.debug(
                    `LOG EVENT INFLUXDB V3: Invalid validate_time value: ${msg.validate_time}`
                );
            }

            const traverseTime = parseFloat(msg.traverse_time);
            if (!isNaN(traverseTime)) {
                point.setFloatField('traverse_time', traverseTime);
            } else {
                globals.logger.debug(
                    `LOG EVENT INFLUXDB V3: Invalid traverse_time value: ${msg.traverse_time}`
                );
            }

            const handle = parseInt(msg.handle, 10);
            if (!isNaN(handle)) {
                point.setIntegerField('handle', handle);
            } else {
                globals.logger.debug(`LOG EVENT INFLUXDB V3: Invalid handle value: ${msg.handle}`);
            }

            const netRam = parseInt(msg.net_ram, 10);
            if (!isNaN(netRam)) {
                point.setIntegerField('net_ram', netRam);
            } else {
                globals.logger.debug(
                    `LOG EVENT INFLUXDB V3: Invalid net_ram value: ${msg.net_ram}`
                );
            }

            const peakRam = parseInt(msg.peak_ram, 10);
            if (!isNaN(peakRam)) {
                point.setIntegerField('peak_ram', peakRam);
            } else {
                globals.logger.debug(
                    `LOG EVENT INFLUXDB V3: Invalid peak_ram value: ${msg.peak_ram}`
                );
            }

            // Remove newlines from raw event (not supported in line protocol field values)
            const cleanedRawEvent = JSON.stringify(msg).replace(/[\n\r]/g, '');
            point.setStringField('raw_event', cleanedRawEvent);

            // Conditional tags
            if (msg?.user_full?.length > 0) point.setTag('user_full', cleanTagValue(msg.user_full));
            if (msg?.user_directory?.length > 0)
                point.setTag('user_directory', cleanTagValue(msg.user_directory));
            if (msg?.user_id?.length > 0) point.setTag('user_id', cleanTagValue(msg.user_id));
            if (msg?.app_id?.length > 0) point.setTag('app_id', cleanTagValue(msg.app_id));
            if (msg?.app_name?.length > 0) point.setTag('app_name', cleanTagValue(msg.app_name));
            if (msg?.object_id?.length > 0) point.setTag('object_id', cleanTagValue(msg.object_id));
        }

        // Add log event categories to tags if available
        // The msg.category array contains objects with properties 'name' and 'value'
        if (msg?.category?.length > 0) {
            msg.category.forEach((category) => {
                point.setTag(category.name, cleanTagValue(category.value));
            });
        }

        // Add custom tags from config file
        if (
            globals.config.has('Butler-SOS.logEvents.tags') &&
            globals.config.get('Butler-SOS.logEvents.tags') !== null &&
            globals.config.get('Butler-SOS.logEvents.tags').length > 0
        ) {
            const configTags = globals.config.get('Butler-SOS.logEvents.tags');
            for (const item of configTags) {
                point.setTag(item.name, cleanTagValue(item.value));
            }
        }

        // Debug logging to troubleshoot line protocol issues
        console.log('LOG EVENT V3 MESSAGE:', JSON.stringify(msg, null, 2));
        console.log('LOG EVENT V3 LINE PROTOCOL:', point.toLineProtocol());

        await writeToInfluxWithRetry(
            async () => await globals.influx.write(point.toLineProtocol(), database),
            `Log event for ${msg.host}`,
            'v3',
            msg.host
        );

        globals.logger.debug(`LOG EVENT INFLUXDB V3: Wrote data to InfluxDB v3`);

        globals.logger.verbose('LOG EVENT INFLUXDB V3: Sent Butler SOS log event data to InfluxDB');
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V3_WRITE', msg.host);
        globals.logger.error(
            `LOG EVENT INFLUXDB V3: Error saving log event to InfluxDB! ${globals.getErrorMessage(err)}`
        );
    }
}
