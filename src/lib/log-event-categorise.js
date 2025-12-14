import globals from '../globals.js';
import { logError } from './log-error.js';

/**
 * Categorizes log events based on configured rules.
 *
 * This function analyzes log events from Qlik Sense services and categorizes them
 * based on matching rules defined in the configuration. Rules can match on log level
 * and message content using different filters (starts with, ends with, contains).
 * Rules can also specify if a matched log event should be dropped.
 *
 * The function returns an object with two properties:
 * - category: An array of objects, each representing a category.
 *   Each category object has two properties: name and value.
 * - actionTaken: A string indicating the action taken on the log event.
 *   Possible values are 'categorised' and 'dropped'.
 *
 * If no rule matches, then the function uses the default category
 * (if enabled in the config file) and sets actionTaken to 'categorised'.
 *
 * If an error occurs while processing the log event, then the function
 * logs an error message and returns null.
 *
 * @param {string} logLevel - The log level of the log event
 * @param {string} logMessage - The log message of the log event
 * @returns {object} An object with category and actionTaken properties
 */
export function categoriseLogEvent(logLevel, logMessage) {
    const logEventCategory = [];

    try {
        let match = false;

        // Loop over all rules in the config file

        for (const rule of globals.config.get('Butler-SOS.logEvents.categorise.rules')) {
            // Check if the log event matches any of the rule's log levels (which are found in the array 'logLevel' property)
            // Make the check case insensitive
            if (rule.logLevel.map((x) => x.toLowerCase()).includes(logLevel.toLowerCase())) {
                // Check if the log event message matches any of the rule's filters
                // The rule filters are found in the 'filter' property, which is an array of objects with the following properties:
                // - type: The type of the filter. Possible values are 'sw', 'ew', 'so'
                // - value: The value of the filter
                // Make the check case sensitive

                for (const filter of rule.filter) {
                    // More than one filter may match
                    if (filter.type === 'sw') {
                        if (logMessage.startsWith(filter.value)) {
                            // If action is 'drop', then drop the log event
                            if (rule.action === 'drop') {
                                return { category: [], actionTaken: 'dropped' };
                            }
                            match = true;
                            // Deep copy the categories from the rule to the log event
                            logEventCategory.push(...rule.category);
                            break;
                        }
                    }
                    if (filter.type === 'ew') {
                        if (logMessage.endsWith(filter.value)) {
                            // If action is 'drop', then drop the log event
                            if (rule.action === 'drop') {
                                return { category: [], actionTaken: 'dropped' };
                            }
                            match = true;
                            // Deep copy the categories from the rule to the log event
                            logEventCategory.push(...rule.category);
                            break;
                        }
                    }
                    if (filter.type === 'so') {
                        if (logMessage.includes(filter.value)) {
                            // If action is 'drop', then drop the log event
                            if (rule.action === 'drop') {
                                return { category: [], actionTaken: 'dropped' };
                            }
                            match = true;
                            // Deep copy the categories from the rule to the log event
                            logEventCategory.push(...rule.category);
                            break;
                        }
                    }

                    // Warn if the filter type is not recognised
                    if (!['sw', 'ew', 'so'].includes(filter.type)) {
                        globals.logger.warn(
                            `LOG EVENT CATEGORISATION: Filter type '${filter.type}' is not recognised`
                        );
                    }
                }
            }
        }

        // Remove any duplicate categories
        // Both name and value must match for the category to be considered a duplicate
        const uniqueCategories = [];
        logEventCategory.forEach((category) => {
            if (
                !uniqueCategories.some(
                    (x) => x.name === category.name && x.value === category.value
                )
            ) {
                uniqueCategories.push(category);
            }
        });

        // If no rule matched, then use default rule (if enabled in the config file)
        if (
            match === false &&
            globals.config.get('Butler-SOS.logEvents.categorise.ruleDefault.enable') === true
        ) {
            // Deep copy the categories from the default rule to the log event
            uniqueCategories.push(
                ...globals.config.get('Butler-SOS.logEvents.categorise.ruleDefault.category')
            );
        }

        // Return the log event category and the action taken
        return { category: uniqueCategories, actionTaken: 'categorised' };
    } catch (err) {
        logError('LOG EVENT CATEGORISATION: Error processing log event', err);
        return null;
    }
}
