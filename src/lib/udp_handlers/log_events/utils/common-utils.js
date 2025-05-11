/**
 * Common utility functions for log event handlers
 */

// Define a regex for ISO8601 date format
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}\+\d{4}$/;

// Define a regex for UUId format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Formats user directory and user id fields
 * @param {Object} msgObj - The message object to update
 */
export function formatUserFields(msgObj) {
    // Different log events deliver QSEoW user directory/user differently.
    // Create fields that are consistent across all log events
    if (msgObj.user_directory !== '' && msgObj.user_id !== '') {
        // User directory and user id available in separate fields.
        // Combine them into a single field
        msgObj.user_full = `${msgObj.user_directory}\\${msgObj.user_id}`;
    } else if (
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
