/**
 * Handler for qseow-scheduler log events
 */

import globals from '../../../../globals.js';
import { isoDateRegex, uuidRegex, formatUserFields } from '../utils/common-utils.js';
import { sanitizeField } from '../../../udp-queue-manager.js';

/**
 * Process scheduler log events
 *
 * Message parts for log messages from scheduler service:
 * 0:  Message type. Always /qseow-scheduler/
 * 1:  Row number. Ex: 14
 * 2:  ISO8601 formatted timestamp. Example: 20211109T193744.331+0100
 * 3:  Local timezone timestamp. Example: 2021-11-09 19:37:44,331
 * 4:  Log level. Possible values are: WARN, ERROR, FATAL
 * 5:  Hostname where the log event occured
 * 6:  QSEoW subsystem where log event occured. Example: System.Scheduler.Scheduler.Slave.Tasks.ReloadTask
 * 7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
 * 8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Message from ReloadProvider: Reload failed in Engine. Check engine or script logs.
 * 9:  Exception message. Empty unless an exception/fault occured in QSEoW.
 * 10: QSEoW user directory of the user associated with the event. Note: For some log events this field is empty. Field #14 is then populated instead. Ex: LAB
 * 11: QSEoW user id of the user associated with the event. Note: For some log events this field is empty. Field #14 is then populated instead. Ex: goran
 * 12: QSEoW directory and userID associated with the event. Note: For some log events this field is empty. Fields #12 and #13 are then populated instead. Ex: LAB\goran
 * 13: Task name associated with the event. Ex: Manually triggered reload of Test failing reloads 2
 * 14: App name associated with the event. Ex: Test failing reloads 2
 * 15: Task ID associated with the event. Ex: dec2a02a-1680-44ef-8dc2-e2bfb180af87
 * 16: App ID associated with the event. Ex: e7af59a0-c243-480d-9571-08727551a66f
 * 17: Execution ID associated with the event. Ex: 4831c6a5-34f6-45bb-9d40-73a6e6992670
 *
 * @param {Array} msg - The message parts
 * @returns {object} Processed message object
 */
export function processSchedulerEvent(msg) {
    globals.logger.verbose(`LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, Msg: ${msg[8]}`);

    const msgObj = {
        source: sanitizeField(msg[0], 100),
        log_row: Number.isInteger(parseInt(msg[1], 10)) ? parseInt(msg[1], 10) : -1,
        ts_iso: isoDateRegex.test(msg[2]) ? sanitizeField(msg[2], 50) : '',
        ts_local: isoDateRegex.test(msg[3]) ? sanitizeField(msg[3], 50) : '',
        level: sanitizeField(msg[4], 20),
        host: sanitizeField(msg[5], 100),
        subsystem: sanitizeField(msg[6], 200),
        windows_user: sanitizeField(msg[7], 100),
        message: sanitizeField(msg[8], 1000),
        exception_message: sanitizeField(msg[9], 1000),
        user_directory: sanitizeField(msg[10], 100),
        user_id: sanitizeField(msg[11], 100),
        user_full: sanitizeField(msg[12], 200),
        task_name: sanitizeField(msg[13], 200),
        app_name: sanitizeField(msg[14], 200),
        task_id: uuidRegex.test(msg[15]) ? msg[15] : '',
        app_id: uuidRegex.test(msg[16]) ? msg[16] : '',
        execution_id: uuidRegex.test(msg[17]) ? msg[17] : '',
    };

    formatUserFields(msgObj);

    return msgObj;
}
