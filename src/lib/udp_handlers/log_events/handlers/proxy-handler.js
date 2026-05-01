/**
 * Handler for qseow-proxy log events
 */

import { processGenericLogEvent } from '../utils/common-utils.js';

/**
 * Process proxy log events.
 *
 * Proxy log messages share the standard 16-field QSEoW log layout, so this
 * handler simply delegates to the shared generic log-event processor.
 *
 * @param {Array} msg - The message parts
 * @returns {object} Processed message object
 */
export function processProxyEvent(msg) {
    return processGenericLogEvent(msg);
}
