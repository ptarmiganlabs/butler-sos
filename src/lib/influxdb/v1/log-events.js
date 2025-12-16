import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeToInfluxWithRetry } from '../shared/utils.js';

/**
 * Post log event to InfluxDB v1
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
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 * @throws {Error} Error if unable to write data to InfluxDB
 */
export async function storeLogEventV1(msg) {
    globals.logger.debug(`LOG EVENT V1: ${JSON.stringify(msg)}`);

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
        globals.logger.warn(`LOG EVENT V1: Unsupported log event source: ${msg.source}`);
        return;
    }

    try {
        let tags;
        let fields;

        // Process each source type
        if (msg.source === 'qseow-engine') {
            tags = {
                host: msg.host,
                level: msg.level,
                source: msg.source,
                log_row: msg.log_row,
                subsystem: msg.subsystem,
            };

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
            if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
            if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
            if (msg?.result_code?.length > 0) tags.result_code = msg.result_code;
            if (msg?.windows_user?.length > 0) tags.windows_user = msg.windows_user;
            if (msg?.task_id?.length > 0) tags.task_id = msg.task_id;
            if (msg?.task_name?.length > 0) tags.task_name = msg.task_name;
            if (msg?.app_id?.length > 0) tags.app_id = msg.app_id;
            if (msg?.app_name?.length > 0) tags.app_name = msg.app_name;
            if (msg?.engine_exe_version?.length > 0)
                tags.engine_exe_version = msg.engine_exe_version;

            fields = {
                message: msg.message,
                exception_message: msg.exception_message,
                command: msg.command,
                result_code: msg.result_code,
                origin: msg.origin,
                context: msg.context,
                session_id: msg.session_id,
                raw_event: JSON.stringify(msg),
            };
        } else if (msg.source === 'qseow-proxy') {
            tags = {
                host: msg.host,
                level: msg.level,
                source: msg.source,
                log_row: msg.log_row,
                subsystem: msg.subsystem,
            };

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
            if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
            if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
            if (msg?.result_code?.length > 0) tags.result_code = msg.result_code;

            fields = {
                message: msg.message,
                exception_message: msg.exception_message,
                command: msg.command,
                result_code: msg.result_code,
                origin: msg.origin,
                context: msg.context,
                raw_event: JSON.stringify(msg),
            };
        } else if (msg.source === 'qseow-scheduler') {
            tags = {
                host: msg.host,
                level: msg.level,
                source: msg.source,
                log_row: msg.log_row,
                subsystem: msg.subsystem,
            };

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
            if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
            if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
            if (msg?.task_id?.length > 0) tags.task_id = msg.task_id;
            if (msg?.task_name?.length > 0) tags.task_name = msg.task_name;

            fields = {
                message: msg.message,
                exception_message: msg.exception_message,
                app_name: msg.app_name,
                app_id: msg.app_id,
                execution_id: msg.execution_id,
                raw_event: JSON.stringify(msg),
            };
        } else if (msg.source === 'qseow-repository') {
            tags = {
                host: msg.host,
                level: msg.level,
                source: msg.source,
                log_row: msg.log_row,
                subsystem: msg.subsystem,
            };

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
            if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
            if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
            if (msg?.result_code?.length > 0) tags.result_code = msg.result_code;

            fields = {
                message: msg.message,
                exception_message: msg.exception_message,
                command: msg.command,
                result_code: msg.result_code,
                origin: msg.origin,
                context: msg.context,
                raw_event: JSON.stringify(msg),
            };
        } else if (msg.source === 'qseow-qix-perf') {
            tags = {
                host: msg.host?.length > 0 ? msg.host : '<Unknown>',
                level: msg.level?.length > 0 ? msg.level : '<Unknown>',
                source: msg.source?.length > 0 ? msg.source : '<Unknown>',
                log_row: msg.log_row?.length > 0 ? msg.log_row : '-1',
                subsystem: msg.subsystem?.length > 0 ? msg.subsystem : '<Unknown>',
                method: msg.method?.length > 0 ? msg.method : '<Unknown>',
                object_type: msg.object_type?.length > 0 ? msg.object_type : '<Unknown>',
                proxy_session_id: msg.proxy_session_id?.length > 0 ? msg.proxy_session_id : '-1',
                session_id: msg.session_id?.length > 0 ? msg.session_id : '-1',
                event_activity_source:
                    msg.event_activity_source?.length > 0 ? msg.event_activity_source : '<Unknown>',
            };

            // Tags that are empty in some cases. Only add if they are non-empty
            if (msg?.user_full?.length > 0) tags.user_full = msg.user_full;
            if (msg?.user_directory?.length > 0) tags.user_directory = msg.user_directory;
            if (msg?.user_id?.length > 0) tags.user_id = msg.user_id;
            if (msg?.app_id?.length > 0) tags.app_id = msg.app_id;
            if (msg?.app_name?.length > 0) tags.app_name = msg.app_name;
            if (msg?.object_id?.length > 0) tags.object_id = msg.object_id;

            fields = {
                app_id: msg.app_id,
                process_time: msg.process_time,
                work_time: msg.work_time,
                lock_time: msg.lock_time,
                validate_time: msg.validate_time,
                traverse_time: msg.traverse_time,
                handle: msg.handle,
                net_ram: msg.net_ram,
                peak_ram: msg.peak_ram,
                raw_event: JSON.stringify(msg),
            };
        }

        // Add log event categories to tags if available
        // The msg.category array contains objects with properties 'name' and 'value'
        if (msg?.category?.length > 0) {
            msg.category.forEach((category) => {
                tags[category.name] = category.value;
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
                tags[item.name] = item.value;
            }
        }

        const datapoint = [
            {
                measurement: 'log_event',
                tags,
                fields,
            },
        ];

        globals.logger.silly(
            `LOG EVENT V1: Influxdb datapoint: ${JSON.stringify(datapoint, null, 2)}`
        );

        // Write with retry logic
        await writeToInfluxWithRetry(
            async () => await globals.influx.writePoints(datapoint),
            `Log event from ${msg.source}`,
            'v1',
            msg.host
        );

        globals.logger.verbose('LOG EVENT V1: Sent log event data to InfluxDB');
    } catch (err) {
        globals.logger.error(
            `LOG EVENT V1: Error saving log event: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}
