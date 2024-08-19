const { config, logger } = require('../globals');

// Function to categorise log events
//
//
// Parameters:
// - logLevel: The log level of the log event
// - logMessage: The message of the log event
//
// Output:
// - logEventCategory: The category of the log event. This is an object with the following properties:
//   - category: The category of the log event. Array of objects with the following properties:
//     - name: The name of the category
//     - value: The value of the category
//   - actionTaken: The action taken for the log event. Possible values are 'categorised', 'dropped'
function categoriseLogEvent(logLevel, logMessage) {
    const logEventCategory = [];

    try {
        let match = false;

        // Loop over all rules in the config file
        // eslint-disable-next-line no-restricted-syntax
        for (const rule of config.get('Butler-SOS.logEvents.categorise.rules')) {
            // Check if the log event matches any of the rule's log levels (which are found in the array 'logLevel' property)
            // Make the check case insensitive
            if (rule.logLevel.map((x) => x.toLowerCase()).includes(logLevel.toLowerCase())) {
                // Check if the log event message matches any of the rule's filters
                // The rule filters are found in the 'filter' property, which is an array of objects with the following properties:
                // - type: The type of the filter. Possible values are 'sw', 'ew', 'so'
                // - value: The value of the filter
                // Make the check case sensitive

                // eslint-disable-next-line no-restricted-syntax
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
                        logger.warn(
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
            config.get('Butler-SOS.logEvents.categorise.ruleDefault.enable') === true
        ) {
            // Deep copy the categories from the default rule to the log event
            uniqueCategories.push(
                ...config.get('Butler-SOS.logEvents.categorise.ruleDefault.category')
            );
        }

        // Return the log event category and the action taken
        return { category: uniqueCategories, actionTaken: 'categorised' };
    } catch (err) {
        logger.error(`LOG EVENT CATEGORISATION: Error processing log event: ${err}`);
        return null;
    }
}

module.exports = {
    categoriseLogEvent,
};
