/**
 * Common utility functions for log event handlers
 */

/**
 * Regular expression that matches ISO8601 date format strings.
 * Matches patterns like "2021-11-09T15:37:26.028+0200".
 *
 * @type {RegExp}
 */
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}\+\d{4}$/;

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

export { isoDateRegex, uuidRegex };
