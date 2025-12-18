import { Point } from '@influxdata/influxdb-client';
import globals from '../../../globals.js';
import { isInfluxDbEnabled, writeBatchToInfluxV2 } from '../shared/utils.js';
import { applyInfluxTags } from './utils.js';

/**
 * Store log event to InfluxDB v2
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
 * Note: Uses _field suffix for fields that conflict with tag names (e.g., result_code_field).
 *
 * @param {object} msg - Log event message containing the following properties:
 * @param {string} msg.host - Hostname of the Qlik Sense server
 * @param {string} msg.source - Event source (qseow-engine, qseow-proxy, qseow-scheduler, qseow-repository, qseow-qix-perf)
 * @param {string} msg.level - Log level (e.g., INFO, WARN, ERROR)
 * @param {string} msg.log_row - Log row identifier
 * @param {string} msg.subsystem - Subsystem generating the log
 * @param {string} msg.message - Log message text
 * @param {string} [msg.exception_message] - Exception message if applicable
 * @param {string} [msg.command] - Command being executed
 * @param {string} [msg.result_code] - Result code of operation
 * @param {string} [msg.origin] - Origin of the event
 * @param {string} [msg.context] - Context information
 * @param {string} [msg.session_id] - Session identifier
 * @param {string} [msg.user_full] - Full user name
 * @param {string} [msg.user_directory] - User directory
 * @param {string} [msg.user_id] - User ID
 * @param {string} [msg.windows_user] - Windows username
 * @param {string} [msg.task_id] - Task identifier
 * @param {string} [msg.task_name] - Task name
 * @param {string} [msg.app_id] - Application ID
 * @param {string} [msg.app_name] - Application name
 * @param {string} [msg.engine_exe_version] - Engine executable version
 * @param {string} [msg.execution_id] - Execution identifier (scheduler)
 * @param {string} [msg.method] - QIX method (qix-perf)
 * @param {string} [msg.object_type] - Object type (qix-perf)
 * @param {string} [msg.proxy_session_id] - Proxy session ID (qix-perf)
 * @param {string} [msg.event_activity_source] - Event activity source (qix-perf)
 * @param {number} [msg.process_time] - Process time in ms (qix-perf)
 * @param {number} [msg.work_time] - Work time in ms (qix-perf)
 * @param {number} [msg.lock_time] - Lock time in ms (qix-perf)
 * @param {number} [msg.validate_time] - Validate time in ms (qix-perf)
 * @param {number} [msg.traverse_time] - Traverse time in ms (qix-perf)
 * @param {string} [msg.handle] - Handle identifier (qix-perf)
 * @param {number} [msg.net_ram] - Net RAM usage (qix-perf)
 * @param {number} [msg.peak_ram] - Peak RAM usage (qix-perf)
 * @param {string} [msg.object_id] - Object identifier (qix-perf)
 * @param {Array<{name: string, value: string}>} [msg.category] - Array of category objects
 * @returns {Promise<void>} Promise that resolves when data has been posted to InfluxDB
 */
export async function storeLogEventV2(msg) {
    globals.logger.debug(`LOG EVENT V2: ${JSON.stringify(msg)}`);

    // Only write to InfluxDB if enabled
    if (!isInfluxDbEnabled()) {
        return;
    }

    // Validate source
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

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

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
            .stringField('exception_message', msg.exception_message || '')
            .stringField('command', msg.command || '')
            .stringField('result_code_field', msg.result_code || '')
            .stringField('origin', msg.origin || '')
            .stringField('context', msg.context || '')
            .stringField('session_id', msg.session_id || '')
            .stringField('raw_event', JSON.stringify(msg));

        // Conditional tags
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
            .stringField('exception_message', msg.exception_message || '')
            .stringField('command', msg.command || '')
            .stringField('result_code_field', msg.result_code || '')
            .stringField('origin', msg.origin || '')
            .stringField('context', msg.context || '')
            .stringField('raw_event', JSON.stringify(msg));

        // Conditional tags
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
            .stringField('exception_message', msg.exception_message || '')
            .stringField('app_name', msg.app_name || '')
            .stringField('app_id', msg.app_id || '')
            .stringField('execution_id', msg.execution_id || '')
            .stringField('raw_event', JSON.stringify(msg));

        // Conditional tags
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
            .stringField('exception_message', msg.exception_message || '')
            .stringField('command', msg.command || '')
            .stringField('result_code_field', msg.result_code || '')
            .stringField('origin', msg.origin || '')
            .stringField('context', msg.context || '')
            .stringField('raw_event', JSON.stringify(msg));

        // Conditional tags
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
            .stringField('app_id', msg.app_id || '')
            .floatField('process_time', parseFloat(msg.process_time))
            .floatField('work_time', parseFloat(msg.work_time))
            .floatField('lock_time', parseFloat(msg.lock_time))
            .floatField('validate_time', parseFloat(msg.validate_time))
            .floatField('traverse_time', parseFloat(msg.traverse_time))
            .stringField('handle', msg.handle || '')
            .intField('net_ram', parseInt(msg.net_ram))
            .intField('peak_ram', parseInt(msg.peak_ram))
            .stringField('raw_event', JSON.stringify(msg));

        // Conditional tags
        if (msg?.user_full?.length > 0) point.tag('user_full', msg.user_full);
        if (msg?.user_directory?.length > 0) point.tag('user_directory', msg.user_directory);
        if (msg?.user_id?.length > 0) point.tag('user_id', msg.user_id);
        if (msg?.app_id?.length > 0) point.tag('app_id', msg.app_id);
        if (msg?.app_name?.length > 0) point.tag('app_name', msg.app_name);
        if (msg?.object_id?.length > 0) point.tag('object_id', msg.object_id);
    }

    // Add log event categories to tags if available
    if (msg?.category?.length > 0) {
        msg.category.forEach((category) => {
            point.tag(category.name, category.value);
        });
    }

    // Add custom tags from config file
    const configTags = globals.config.get('Butler-SOS.logEvents.tags');
    applyInfluxTags(point, configTags);

    globals.logger.silly(`LOG EVENT V2: Influxdb datapoint: ${JSON.stringify(point, null, 2)}`);

    // Write to InfluxDB with retry logic
    await writeBatchToInfluxV2(
        [point],
        org,
        bucketName,
        `Log event for ${msg.host}`,
        msg.host,
        globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
    );

    globals.logger.verbose('LOG EVENT V2: Sent log event data to InfluxDB');
}
