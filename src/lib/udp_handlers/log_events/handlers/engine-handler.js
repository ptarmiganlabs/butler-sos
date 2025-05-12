/**
 * Handler for qseow-engine log events
 */

import globals from '../../../../globals.js';
import { isoDateRegex, uuidRegex, formatUserFields } from '../utils/common-utils.js';

/**
 * Process engine log events
 *
 * Message parts for log messages from engine service:
 * 0:  Message type. Always /qseow-engine/
 * 1:  Row number
 * 2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
 * 3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
 * 4:  Log level. Possible values are: WARN, ERROR, FATAL
 * 5:  Hostname where the log event occured
 * 6:  QSEoW subsystem where log event occured
 * 7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
 * 8:  Message. Can contain single quotes and semicolon - handle with care.
 * 9:  Proxy session ID (uuid)
 * 10: QSEoW user directory associated with the event
 * 11: QSEoW user id associated with the event
 * 12: Engine timestamp (ISO8601 date)
 * 13: Process ID (uuid)
 * 14: Engine exe version
 * 15: Server started (ISO8601 date)
 * 16: Entry type
 * 17: Session ID (uuid)
 * 18: App ID (uuid)
 *
 * @param {Array} msg - The message parts
 * @returns {object} Processed message object
 */
export function processEngineEvent(msg) {
    globals.logger.verbose(`LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, Msg: ${msg[8]}`);

    // log_row: numeric
    // ts_iso: ISO8601 date
    // ts_local: ISO8601 date
    // level: string
    // host: string
    // subsystem: string
    // windows_user: string
    // message: string
    // proxy_session_id: uuid
    // user_directory: string
    // user_id: string
    // engine_ts: ISO8601 date
    // process_id: uuid
    // engine_exe_version: string
    // server_started: ISO8601 date
    // entry_type: string
    // session_id: uuid
    // app_id: uuid
    const msgObj = {
        source: msg[0],
        log_row:
            Number.isInteger(parseInt(msg[1], 10)) && parseInt(msg[1], 10) > 0
                ? parseInt(msg[1], 10)
                : -1,
        ts_iso: isoDateRegex.test(msg[2]) ? msg[2] : '',
        ts_local: isoDateRegex.test(msg[3]) ? msg[3] : '',
        level: msg[4],
        host: msg[5],
        subsystem: msg[6],
        windows_user: msg[7],
        message: msg[8],
        proxy_session_id: uuidRegex.test(msg[9]) ? msg[9] : '',
        user_directory: msg[10],
        user_id: msg[11],
        engine_ts: msg[12],
        process_id: uuidRegex.test(msg[13]) ? msg[13] : '',
        engine_exe_version: msg[14],
        server_started: msg[15],
        entry_type: msg[16],
        session_id: uuidRegex.test(msg[17]) ? msg[17] : '',
        app_id: uuidRegex.test(msg[18]) ? msg[18] : '',
    };

    formatUserFields(msgObj);

    return msgObj;
}
