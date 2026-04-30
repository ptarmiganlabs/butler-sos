/**
 * Common utility functions for log event handlers
 */

import globals from '../../../../globals.js';
import { sanitizeField } from '../../../udp-queue-manager.js';

/**
 * Regular expression that matches the hyphenated ISO8601 date format used by most QSEoW services.
 * Matches patterns like "2021-11-09T15:37:26.028+0200".
 *
 * @type {RegExp}
 */
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}\+\d{4}$/;

/**
 * Regular expression that matches the compact ISO8601 date format used by some QSEoW services.
 * Matches patterns like "20211109T153726.028+0200" (no dashes or colons in the date/time part).
 *
 * @type {RegExp}
 */
const isoDateCompactRegex = /^\d{8}T\d{6}\.\d{3}\+\d{4}$/;

/**
 * Regular expression that matches the local timestamp format used in QSEoW log fields.
 * Matches patterns like "2021-11-09 15:37:26,028" (space separator, comma before milliseconds).
 *
 * @type {RegExp}
 */
const localTimestampRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}$/;

/**
 * Regular expression that matches UUID format strings.
 * Matches standard UUID patterns like "550e8400-e29b-41d4-a716-446655440000".
 *
 * @type {RegExp}
 */
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Formats and normalizes user directory and user ID fields in log events.
 *
 * This function ensures consistent representation of user information across different
 * log event sources by either combining separate user directory and ID fields into a
 * full user name, or splitting a full user name into its component parts.
 *
 * @param {object} msgObj - The message object to update
 * @param {string} [msgObj.user_directory] - The user directory component
 * @param {string} [msgObj.user_id] - The user ID component
 * @param {string} [msgObj.user_full] - The combined user name in "directory\id" format
 * @returns {void} - The function updates the provided object directly
 */
export function formatUserFields(msgObj) {
    // Different log events deliver QSEoW user directory/user differently.
    // Create fields that are consistent across all log events
    if (msgObj.user_directory !== '' && msgObj.user_id !== '') {
        // User directory and user id available in separate fields.
        // Combine them into a single field
        msgObj.user_full = `${msgObj.user_directory}\\${msgObj.user_id}`;
    } else if (
        msgObj.user_full &&
        msgObj.user_full !== '' &&
        msgObj.user_directory === '' &&
        msgObj.user_id === '' &&
        msgObj.user_full.includes('\\')
    ) {
        // Combined user directory/id field is available.
        // Split it into separate fields
        msgObj.user_directory = msgObj.user_full.split('\\')[0];
        msgObj.user_id = msgObj.user_full.split('\\')[1];
    } else {
        msgObj.user_full = '';
    }
}

/**
 * Process a generic 16-field QSEoW log event message produced by the proxy
 * and repository services.
 *
 * Both services emit log lines with an identical 16-position field layout, so
 * the per-handler processors can delegate to this shared parser.
 *
 * Message parts:
 * 0:  Message type. Example: /qseow-proxy/ or /qseow-repository/
 * 1:  Row number
 * 2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
 * 3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
 * 4:  Log level. Possible values are: WARN, ERROR, FATAL
 * 5:  Hostname where the log event occurred
 * 6:  QSEoW subsystem where log event occurred
 * 7:  Windows username running the originating QSEoW service
 * 8:  Message
 * 9:  Exception message (empty unless an exception/fault occurred)
 * 10: QSEoW user directory associated with the event
 * 11: QSEoW user id associated with the event
 * 12: Command carried out when log event occurred
 * 13: Result code for command
 * 14: Origin of log event
 * 15: Context where the log event occurred
 *
 * @param {Array} msg - The message parts
 * @returns {object} Processed message object
 */
export function processGenericLogEvent(msg) {
    globals.logger.verbose(`LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, Msg: ${msg[8]}`);

    const msgObj = {
        source: sanitizeField(msg[0], 100),
        log_row: Number.isInteger(parseInt(msg[1], 10)) ? parseInt(msg[1], 10) : -1,
        ts_iso:
            isoDateRegex.test(msg[2]) || isoDateCompactRegex.test(msg[2])
                ? sanitizeField(msg[2], 50)
                : '',
        ts_local: isoDateRegex.test(msg[3]) || localTimestampRegex.test(msg[3])
            ? sanitizeField(msg[3], 50)
            : '',
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

export { isoDateRegex, isoDateCompactRegex, localTimestampRegex, uuidRegex };
