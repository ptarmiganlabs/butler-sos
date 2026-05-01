/**
 * Handler for qseow-repository log events
 */

import { processGenericLogEvent } from '../utils/common-utils.js';

/**
 * Process repository log events.
 *
 * Repository log messages share the standard 16-field QSEoW log layout, so
 * this handler simply delegates to the shared generic log-event processor.
 *
 * @param {Array} msg - The message parts
 * @returns {object} Processed message object
 */
export function processRepositoryEvent(msg) {
    return processGenericLogEvent(msg);
}
