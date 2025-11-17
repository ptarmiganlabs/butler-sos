/**
 * Handler for qseow-repository log events
 */

import globals from '../../../../globals.js';
import { isoDateRegex, formatUserFields } from '../utils/common-utils.js';
import { sanitizeField } from '../../../udp-queue-manager.js';

/**
 * Process repository log events
 *
 * Message parts for log messages from repository service:
 * 0:  Message type. Always /qseow-repository/
 * 1:  Row number
 * 2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
 * 3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
 * 4:  Log level. Possible values are: WARN, ERROR, FATAL
 * 5:  Hostname where the log event occured
 * 6:  QSEoW subsystem where log event occured. Example: Service.Repository.Repository.Core.Status.ServiceStatusWorker
 * 7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
 * 8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Method: 'SendRimQrsStatusRequest'. Failed to retrieve service status from 'http://pro2-win2.lab.ptarmiganlabs.net:4444/status/'. Server host 'pro2-win2.lab.ptarmiganlabs.net'. Error message: 'Unable to connect to the remote server'
 * 9:  Exception message. Empty unless an exception/fault occured in QSEoW.
 * 10: QSEoW user directory associated with the event. Ex: INTERNAL
 * 11: QSEoW user id associated with the event. Ex: System
 * 12: Command carried out when log event occured. Ex: Check service status
 * 13: Result code for command. Ex: 500
 * 14: Origin of log event. Ex: Not available
 * 15: Context where the log event occured. Ex: /qps/servicestatusworker
 *
 * @param {Array} msg - The message parts
 * @returns {object} Processed message object
 */
export function processRepositoryEvent(msg) {
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
        command: sanitizeField(msg[12], 200),
        result_code: sanitizeField(msg[13], 50),
        origin: sanitizeField(msg[14], 200),
        context: sanitizeField(msg[15], 200),
    };

    formatUserFields(msgObj);

    return msgObj;
}
