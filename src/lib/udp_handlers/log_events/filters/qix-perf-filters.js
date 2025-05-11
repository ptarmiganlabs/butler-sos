/**
 * Filters for QIX performance log events
 *
 * Filter structure for app specific monitoring:
 * monitorFilterConfig.appSpecific is an array of objects, each with following properties:
 * - enable: boolean
 * - app: Array of objects, each with following properties:
 *   - include: Array of objects, each of which has one or more of the following properties:
 *     - appId: string
 *     - appName: string
 *   - objectType: Object with following properties:
 *     - allObjectTypes: boolean
 *     - allObjectTypesExclude: array of strings
 *     - someObjectTypesInclude: array of strings
 *   - appObject: Object with following properties:
 *     - allAppObjects: boolean
 *     - allAppObjectsExclude: array of objects, each of which has one or more of the following properties:
 *       - objectId: string
 *     - someAppObjectsInclude: array of objects, each of which has one or more of the following properties:
 *       - objectId: string
 *   - method: Objects with following properties:
 *     - allMethods: boolean
 *     - allMethodsExclude: array of strings
 *     - someMethodsInclude: array of strings
 *
 * If the include array is empty, no apps will be accepted.
 *
 * If allObjectTypes is true, all object types are included, unless they are in allObjectTypesExclude.
 * someObjectTypesInclude is ignored in this case.
 * If allObjectTypes is false, only events matching the object types in someObjectTypesInclude are accepted.
 *
 * If allAppObjects is true, all objects are included, unless they are in allAppObjectsExclude.
 * someAppObjectsInclude is ignored in this case.
 * If allAppObjects is false, only events matching the objects in someAppObjectsInclude are accepted.
 *
 * If allMethods is true, all methods are included, unless they are in allMethodsExclude.
 * someMethodsInclude is ignored in this case.
 * If allMethods is false, only events matching the methods in someMethodsInclude are accepted.
 *
 * Filter structure for all-app monitoring:
 * monitorFilterConfig.allApps is an array of objects, each with following properties:
 * - enable: boolean
 * - appExclude: array of objects, each of which has one or more of the following properties:
 *   - appId: string
 *   - appName: string
 * - objectType: Objects with following properties:
 *   - allObjectTypes: boolean
 *   - allObjectTypesExclude: array of strings
 *   - someObjectTypesInclude: array of strings
 * - method: Objects with following properties:
 *   - allMethods: boolean
 *   - allMethodsExclude: array of strings
 *   - someMethodsInclude: array of strings
 *
 * If appExclude is empty, all apps are included.
 * If appExclude has objects, only apps not in appExclude are included.
 * Matching is inclusive, i.e. if an object in the appExclude array has both appId and appName, both must match for the app to be excluded.
 *
 * If objectType.allObjectTypes is true, all object types are included, unless they are in allObjectTypesExclude.
 * someObjectTypesInclude is ignored in this case.
 * If objectType.allObjectTypes is false, only object types in someObjectTypesInclude are included.
 *
 * If method.allMethods is true, all methods are included, unless they are in allMethodsExclude.
 * someMethodsInclude is ignored in this case.
 * If method.allMethods is false, only methods in someMethodsInclude are included.
 */

import globals from '../../../../globals.js';

/**
 * Processes filters for app-specific monitoring configuration
 * @param {Object} eventData - The event data
 * @param {Array} appSpecificFilters - The app specific filter configuration
 * @returns {boolean} True if the event matches app-specific filters
 */
export function processAppSpecificFilters(eventData, appSpecificFilters) {
    if (!appSpecificFilters?.enable) {
        globals.logger.debug(
            'LOG EVENT: App specific monitoring is disabled in the configuration. Skipping app specific filters for this event.'
        );
        return false;
    }

    const { eventAppId, eventAppName, eventObjectId, eventObjectType, eventMethod } = eventData;

    // Process all app specific filters
    // If one or more filter matches, the event is accepted
    // If no filter matches, the event is rejected
    for (const appFilter of appSpecificFilters.app) {
        // Check if the app ID is in the list of apps to monitor
        const monitoredAppConfig = appFilter?.include?.find(
            (appInclude) =>
                (appInclude?.appId === undefined || appInclude.appId === eventAppId) &&
                (appInclude?.appName === undefined || appInclude.appName === eventAppName)
        );

        if (monitoredAppConfig === undefined) {
            // Event app ID does not match any app specific INCLUDE filters in the config file
            continue; // Try the next filter configuration
        }

        // App ID matches an app in the config file
        // Now check object type filtering
        let acceptEventAppSpecific = true;

        if (appFilter.objectType.allObjectTypes === true) {
            // Check if data in event matches the EXCLUDE object type filters in the config file
            const excludedObjectType = appFilter.objectType?.allObjectTypesExclude?.find(
                (objectTypeExclude) => objectTypeExclude === eventObjectType
            );
            if (excludedObjectType !== undefined) {
                // Object type matches an EXCLUDE object type in the config file
                acceptEventAppSpecific = false;
            }
        } else {
            // Check if data in event matches the INCLUDE object type filters in the config file
            const monitoredObjectType = appFilter.objectType?.someObjectTypesInclude?.find(
                (objectTypeInclude) => objectTypeInclude === eventObjectType
            );
            if (monitoredObjectType === undefined) {
                // Object type does not match an INCLUDE object type in the config file
                acceptEventAppSpecific = false;
            } else {
                // Object type matches an INCLUDE object type in the config file
                globals.logger.debug(
                    'LOG EVENT: Qix performance event matches object type filters in the configuration'
                );
            }
        }

        // Only check object ID if the event has not been rejected so far
        if (acceptEventAppSpecific === true) {
            acceptEventAppSpecific = processObjectIdFilters(appFilter.appObject, eventObjectId);
        }

        // Only check methods if the event has not been rejected so far
        if (acceptEventAppSpecific === true) {
            acceptEventAppSpecific = processMethodFilters(appFilter.method, eventMethod);
        }

        // If we've accepted this event through this filter, return true
        if (acceptEventAppSpecific === true) {
            globals.logger.debug(
                'LOG EVENT: Qix performance event matches app-specific filters in the configuration'
            );
            return true;
        }
    }

    // No filter matched
    return false;
}

/**
 * Processes filters for all-apps monitoring configuration
 * @param {Object} eventData - The event data
 * @param {Object} allAppsFilters - The all-apps filter configuration
 * @returns {boolean} True if the event matches all-apps filters
 */
export function processAllAppsFilters(eventData, allAppsFilters) {
    if (!allAppsFilters?.enable) {
        globals.logger.debug(
            'LOG EVENT: All-apps monitoring is disabled in the configuration. Skipping all-app filters for this event.'
        );
        return false;
    }

    const { eventAppId, eventAppName, eventObjectType, eventMethod } = eventData;

    // Check if data in event matches the EXCLUDE app filters in the config file
    if (allAppsFilters.appExclude?.length > 0) {
        // Any matching appExclude object will cause the event to be rejected
        const excludedApp = allAppsFilters.appExclude.find(
            (appExclude) =>
                (appExclude?.appId === undefined || appExclude.appId === eventAppId) &&
                (appExclude?.appName === undefined || appExclude.appName === eventAppName)
        );
        if (excludedApp !== undefined) {
            // App matches an excluded app in the config file
            return false;
        }
    }

    // Check object type filters
    let acceptEvent = true;

    if (allAppsFilters.objectType.allObjectTypes === true) {
        // Check if data in event matches the EXCLUDE object type filters in the config file
        const excludedObjectType = allAppsFilters.objectType?.allObjectTypesExclude?.find(
            (objectTypeExclude) => objectTypeExclude === eventObjectType
        );
        if (excludedObjectType !== undefined) {
            // Object type matches an excluded object type in the config file
            acceptEvent = false;
        }
    } else {
        // Check if data in event matches the INCLUDE object type filters in the config file
        const monitoredObjectType = allAppsFilters.objectType?.someObjectTypesInclude?.find(
            (objectTypeInclude) => objectTypeInclude === eventObjectType
        );
        if (monitoredObjectType === undefined) {
            // Object type does not match an included object type in the config file
            acceptEvent = false;
        }
    }

    // Only check methods if the event has not been rejected so far
    if (acceptEvent === true) {
        acceptEvent = processMethodFilters(allAppsFilters.method, eventMethod);
    }

    if (acceptEvent === true) {
        globals.logger.debug(
            'LOG EVENT: Qix performance event matches global filters in the configuration'
        );
    }

    return acceptEvent;
}

/**
 * Process object ID filters
 * @param {Object} objectConfig - The object filter configuration
 * @param {string} eventObjectId - The object ID from the event
 * @returns {boolean} True if the event passes the filter
 */
function processObjectIdFilters(objectConfig, eventObjectId) {
    if (objectConfig.allAppObjects === true) {
        // Check if data in event matches the EXCLUDE object ID filters in the config file
        const excludedAppObject = objectConfig?.allAppObjectsExclude?.find(
            (appObjectExclude) => appObjectExclude?.objectId === eventObjectId
        );
        if (excludedAppObject !== undefined) {
            // Object ID matches an EXCLUDE object ID in the config file
            return false;
        }
    } else {
        // Check if data in event matches the INCLUDE object ID filters in the config file
        const monitoredAppObject = objectConfig?.someAppObjectsInclude?.find(
            (appObjectInclude) => appObjectInclude?.objectId === eventObjectId
        );
        if (monitoredAppObject === undefined) {
            // Object ID does not match an INCLUDE object ID in the config file
            return false;
        }
    }

    return true;
}

/**
 * Process method filters
 * @param {Object} methodConfig - The method filter configuration
 * @param {string} eventMethod - The method from the event
 * @returns {boolean} True if the event passes the filter
 */
function processMethodFilters(methodConfig, eventMethod) {
    if (methodConfig.allMethods === true) {
        // Check if data in event matches the EXCLUDE method filters in the config file
        const excludedMethod = methodConfig?.allMethodsExclude?.find(
            (methodExclude) => methodExclude === eventMethod
        );
        if (excludedMethod !== undefined) {
            // Method matches an EXCLUDE method in the config file
            return false;
        }
    } else {
        // Check if data in event matches the INCLUDE method filters in the config file
        const monitoredMethod = methodConfig?.someMethodsInclude?.find(
            (methodInclude) => methodInclude === eventMethod
        );
        if (monitoredMethod === undefined) {
            // Method does not match an INCLUDE method in the config file
            return false;
        } else {
            // Method matches an INCLUDE method in the config file
            globals.logger.debug(
                'LOG EVENT: Qix performance event matches method filters in the configuration'
            );
        }
    }

    return true;
}
