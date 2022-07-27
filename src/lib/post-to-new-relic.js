/* eslint-disable prefer-destructuring */
/* eslint-disable no-unused-vars */

const { users } = require('systeminformation');
const axios = require('axios');
const crypto = require('crypto');

const globals = require('../globals');

const sessionAppPrefix = 'SessionApp';

/**
 *
 * @param {*} serverStarted
 * @returns
 */
function getFormattedTime(serverStarted) {
    const dateTime = Date.now();
    const timestamp = Math.floor(dateTime);

    const str = serverStarted;
    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);
    const hour = str.substring(9, 11);
    const minute = str.substring(11, 13);
    const second = str.substring(13, 15);
    const dateTimeStarted = new Date(year, month - 1, day, hour, minute, second);
    const timestampStarted = Math.floor(dateTimeStarted);

    const diff = timestamp - timestampStarted;

    // Create a new JavaScript Date object based on the timestamp
    // multiplied by 1000 so that the argument is in milliseconds, not seconds.
    const date = new Date(diff);

    const days = Math.trunc(diff / (1000 * 60 * 60 * 24));

    // Hours part from the timestamp
    const hours = date.getHours();

    // Minutes part from the timestamp
    const minutes = `0${date.getMinutes()}`;

    // Seconds part from the timestamp
    const seconds = `0${date.getSeconds()}`;

    // Will display time in 10:30:23 format
    return `${days} days, ${hours}h ${minutes.substr(-2)}m ${seconds.substr(-2)}s`;
}

/**
 *
 * @param {*} _host
 * @param {*} body
 * @param {*} tags
 */
async function postHealthMetricsToNewRelic(_host, body, tags) {
    // Calculate server uptime
    const formattedTime = getFormattedTime(body.started);

    // Build tags structure that will be passed to InfluxDB
    globals.logger.debug(
        `HEALTH METRICS NEW RELIC: Health data: Tags sent to InfluxDB: ${JSON.stringify(tags)}`
    );

    globals.logger.debug(
        `HEALTH METRICS NEW RELIC: Number of apps active: ${body.apps.active_docs.length}`
    );
    globals.logger.debug(
        `HEALTH METRICS NEW RELIC: Number of apps loaded: ${body.apps.loaded_docs.length}`
    );
    globals.logger.debug(
        `HEALTH METRICS NEW RELIC: Number of apps in memory: ${body.apps.in_memory_docs.length}`
    );
    // Get app names

    let app;

    // Prepare message to New Relic
    try {
        const payload = [];
        const metrics = [];
        const attributes = { ...tags };
        const ts = new Date().getTime(); // Timestamp in millisec

        // Add static fields to attributes
        if (globals.config.has('Butler-SOS.newRelic.metric.attribute.static')) {
            const staticAttributes = globals.config.get(
                'Butler-SOS.newRelic.metric.attribute.static'
            );

            // eslint-disable-next-line no-restricted-syntax
            for (const item of staticAttributes) {
                attributes[item.name] = item.value;
            }
        }

        // Add Butler SOS version to attributes
        if (
            globals.config.has(
                'Butler-SOS.newRelic.metric.attribute.dynamic.butlerSosVersion.enable'
            ) &&
            globals.config.get(
                'Butler-SOS.newRelic.metric.attribute.dynamic.butlerSosVersion.enable'
            ) === true
        ) {
            attributes.butlerSosVersion = globals.appVersion;
        }

        const common = {
            timestamp: ts,
            'interval.ms': globals.config.get('Butler-SOS.serversToMonitor.pollingInterval'),
            attributes,
        };

        // Add engine metrics
        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.engine.memory.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.engine.memory.enable') === true
        ) {
            metrics.push({
                name: 'qs_memCommited',
                type: 'gauge',
                value: body.mem.committed * 1048576, // Memory returned in MB from Sense API, send as bytes
            });

            metrics.push({
                name: 'qs_memAllocated',
                type: 'gauge',
                value: body.mem.allocated * 1048576, // Memory returned in MB from Sense API, send as bytes
            });

            metrics.push({
                name: 'qs_memFree',
                type: 'gauge',
                value: body.mem.free * 1048576, // Memory returned in MB from Sense API, send as bytes
            });
        }

        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.engine.cpu.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.engine.cpu.enable') === true
        ) {
            metrics.push({
                name: 'qs_cpuTotal',
                type: 'gauge',
                value: body.cpu.total,
            });
        }

        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.engine.calls.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.engine.calls.enable') === true
        ) {
            metrics.push({
                name: 'qs_engineCalls',
                type: 'gauge',
                value: body.apps.calls,
            });
        }

        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.engine.selections.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.engine.selections.enable') ===
                true
        ) {
            metrics.push({
                name: 'qs_engineSelections',
                type: 'gauge',
                value: body.apps.selections,
            });
        }

        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.engine.sessions.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.engine.sessions.enable') === true
        ) {
            metrics.push({
                name: 'qs_engineSessionsActive',
                type: 'gauge',
                value: body.session.active,
            });

            metrics.push({
                name: 'qs_engineSessionsTotal',
                type: 'gauge',
                value: body.session.total,
            });
        }

        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.engine.users.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.engine.users.enable') === true
        ) {
            metrics.push({
                name: 'qs_engineUsersActive',
                type: 'gauge',
                value: body.users.active,
            });

            metrics.push({
                name: 'qs_engineUsersTotal',
                type: 'gauge',
                value: body.users.total,
            });
        }

        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.engine.saturated.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.engine.saturated.enable') ===
                true
        ) {
            metrics.push({
                name: 'qs_engineSaturated',
                type: 'gauge',
                value: body.saturated,
            });
        }

        // Add app metrics
        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.apps.docCount.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.apps.docCount.enable') === true
        ) {
            metrics.push({
                name: 'qs_docsActiveCount',
                type: 'gauge',
                value: body.apps.active_docs.length,
            });

            metrics.push({
                name: 'qs_docsLoadedCount',
                type: 'gauge',
                value: body.apps.loaded_docs.length,
            });

            metrics.push({
                name: 'qs_docsInMemoryCount',
                type: 'gauge',
                value: body.apps.in_memory_docs.length,
            });
        }

        // Add cache metrics
        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.cache.cache.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.cache.cache.enable') === true
        ) {
            metrics.push({
                name: 'qs_cacheHits',
                type: 'gauge',
                value: body.cache.hits,
            });

            metrics.push({
                name: 'qs_cacheLookups',
                type: 'gauge',
                value: body.cache.lookups,
            });

            metrics.push({
                name: 'qs_cacheaAdded',
                type: 'gauge',
                value: body.cache.added,
            });

            metrics.push({
                name: 'qs_cacheReplaced',
                type: 'gauge',
                value: body.cache.replaced,
            });

            metrics.push({
                name: 'qs_cacheBytesAdded',
                type: 'gauge',
                value: body.cache.bytes_added,
            });
        }

        // Build final payload
        payload.push({
            common,
            metrics,
        });

        globals.logger.debug(
            `HEALTH METRICS NEW RELIC: Payload: ${JSON.stringify(payload, null, 2)}`
        );

        // Preapare call to remote host
        const remoteUrl = globals.config.get('Butler-SOS.newRelic.metric.url');

        // Add headers
        const headers = {
            'Content-Type': 'application/json',
            'Api-Key': globals.config.get(
                'Butler-SOS.thirdPartyToolsCredentials.newRelic.insertApiKey'
            ),
        };

        // eslint-disable-next-line no-restricted-syntax
        for (const header of globals.config.get('Butler-SOS.newRelic.metric.header')) {
            headers[header.name] = header.value;
        }

        const res = await axios.post(remoteUrl, payload, { headers });
        if (res.status !== 202) {
            globals.logger.warn(
                `UPTIME NEW RELIC: Failed sending engine health metrics to New Relic: ${res.status}, ${res.statusText}`
            );
        }
    } catch (error) {
        // handle error
        globals.logger.error(`HEALTH METRICS NEW RELIC: Error sending proxy sessions: ${error}`);
    }
}

// function postProxySessionsToInfluxdb(host, virtualProxy, body, tags) {
async function postProxySessionsToNewRelic(userSessions) {
    globals.logger.debug(
        `PROXY SESSIONS NEW RELIC: User sessions: ${JSON.stringify(userSessions)}`
    );

    try {
        const payload = [];
        const metrics = [];
        let attributes = {};
        // const attributes =            userSessions.datapointNewRelic.butlersos_user_session_summary_total.attributes;
        const ts = new Date().getTime(); // Timestamp in millisec

        // Add attributes from session object
        attributes = {
            ...userSessions.datapointNewRelic.butlersos_user_session_summary_total.attributes,
        };

        // Add static fields to attributes
        if (globals.config.has('Butler-SOS.newRelic.metric.attribute.static')) {
            const staticAttributes = globals.config.get(
                'Butler-SOS.newRelic.metric.attribute.static'
            );

            // eslint-disable-next-line no-restricted-syntax
            for (const item of staticAttributes) {
                attributes[item.name] = item.value;
            }
        }

        // Add Butler SOS version to attributes
        if (
            globals.config.has(
                'Butler-SOS.newRelic.metric.attribute.dynamic.butlerSosVersion.enable'
            ) &&
            globals.config.get(
                'Butler-SOS.newRelic.metric.attribute.dynamic.butlerSosVersion.enable'
            ) === true
        ) {
            attributes.butlerSosVersion = globals.appVersion;
        }

        const common = {
            timestamp: ts,
            'interval.ms': globals.config.get('Butler-SOS.userSessions.pollingInterval'),
            attributes,
        };

        // Add metrics
        if (
            globals.config.has('Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable') &&
            globals.config.get('Butler-SOS.newRelic.metric.dynamic.proxy.sessions.enable') === true
        ) {
            metrics.push({
                name: 'qs_proxySessions',
                type: 'gauge',
                value: userSessions.datapointNewRelic.butlersos_user_session_summary_total.value,
            });
        }

        // Build final payload
        payload.push({
            common,
            metrics,
        });

        globals.logger.debug(
            `PROXY SESSIONS NEW RELIC: Payload: ${JSON.stringify(payload, null, 2)}`
        );

        // Preapare call to remote host
        const remoteUrl = globals.config.get('Butler-SOS.newRelic.metric.url');

        // Add headers
        const headers = {
            'Content-Type': 'application/json',
            'Api-Key': globals.config.get(
                'Butler-SOS.thirdPartyToolsCredentials.newRelic.insertApiKey'
            ),
        };

        // eslint-disable-next-line no-restricted-syntax
        for (const header of globals.config.get('Butler-SOS.newRelic.metric.header')) {
            headers[header.name] = header.value;
        }

        const res = await axios.post(remoteUrl, payload, { headers, timeout: 5000 });
        if (res.status !== 202) {
            globals.logger.warn(
                `UPTIME NEW RELIC: Failed sending proxy sessions metrics to New Relic: ${res.status}, ${res.statusText}`
            );
        }

        globals.logger.debug(
            `PROXY SESSIONS NEW RELIC: Proxy session count for server "${userSessions.host}", virtual proxy "${userSessions.virtualProxy}"": ${userSessions.sessionCount}`
        );
        globals.logger.debug(
            `PROXY SESSIONS NEW RELIC: Result code from posting to New Relic: ${res.status}, ${res.statusText}`
        );
        globals.logger.verbose(`PROXY SESSIONS NEW RELIC: Sent proxy sessions data to New Relic`);
    } catch (error) {
        // handle error
        globals.logger.error(`PROXY SESSIONS NEW RELIC: Error sending proxy sessions: ${error}`);
    }
}

async function postButlerSOSUptimeToNewRelic(fields) {
    globals.logger.debug(
        `MEMORY USAGE NEW RELIC: Memory usage ${JSON.stringify(fields, null, 2)})`
    );

    try {
        const payload = [];
        const metrics = [];
        const attributes = {};
        const ts = new Date().getTime(); // Timestamp in millisec

        // Add static fields to attributes
        if (globals.config.has('Butler-SOS.uptimeMonitor.storeNewRelic.attribute.static')) {
            const staticAttributes = globals.config.get(
                'Butler-SOS.uptimeMonitor.storeNewRelic.attribute.static'
            );

            // eslint-disable-next-line no-restricted-syntax
            for (const item of staticAttributes) {
                attributes[item.name] = item.value;
            }
        }

        // Add version to attributes
        if (
            globals.config.has(
                'Butler-SOS.uptimeMonitor.storeNewRelic.attribute.dynamic.butlerVersion.enable'
            ) &&
            globals.config.get(
                'Butler-SOS.uptimeMonitor.storeNewRelic.attribute.dynamic.butlerVersion.enable'
            ) === true
        ) {
            attributes.version = globals.appVersion;
        }

        const common = {
            timestamp: ts,
            'interval.ms': fields.intervalMillisec,
            attributes,
        };

        // Add memory usage
        if (
            globals.config.has(
                'Butler-SOS.uptimeMonitor.storeNewRelic.metric.dynamic.butlerMemoryUsage.enable'
            ) &&
            globals.config.get(
                'Butler-SOS.uptimeMonitor.storeNewRelic.metric.dynamic.butlerMemoryUsage.enable'
            ) === true
        ) {
            metrics.push({
                name: 'qs_butlerSosHeapUsed',
                type: 'gauge',
                value: fields.heapUsed,
            });

            metrics.push({
                name: 'qs_butlerSosHeapTotal',
                type: 'gauge',
                value: fields.heapTotal,
            });

            metrics.push({
                name: 'qs_butlerSosExternalMem',
                type: 'gauge',
                value: fields.externalMemory,
            });

            metrics.push({
                name: 'qs_butlerSosProcessMem',
                type: 'gauge',
                value: fields.processMemory,
            });
        }

        // Add uptime
        if (
            globals.config.has(
                'Butler-SOS.uptimeMonitor.storeNewRelic.metric.dynamic.butlerUptime.enable'
            ) &&
            globals.config.get(
                'Butler-SOS.uptimeMonitor.storeNewRelic.metric.dynamic.butlerUptime.enable'
            ) === true
        ) {
            metrics.push({
                name: 'qs_butlerSosUptimeMillisec',
                type: 'gauge',
                value: fields.uptimeMilliSec,
            });
        }

        // Build final payload
        payload.push({
            common,
            metrics,
        });

        globals.logger.debug(`UPTIME NEW RELIC: Payload: ${JSON.stringify(payload, null, 2)}`);

        // Preapare call to remote host
        const remoteUrl = globals.config.get('Butler-SOS.newRelic.metric.url');

        // Add headers
        const headers = {
            'Content-Type': 'application/json',
            'Api-Key': globals.config.get(
                'Butler-SOS.thirdPartyToolsCredentials.newRelic.insertApiKey'
            ),
        };

        // eslint-disable-next-line no-restricted-syntax
        for (const header of globals.config.get('Butler-SOS.newRelic.metric.header')) {
            headers[header.name] = header.value;
        }

        const res = await axios.post(remoteUrl, payload, { headers });
        globals.logger.debug(
            `UPTIME NEW RELIC: Result code from posting to New Relic: ${res.status}, ${res.statusText}`
        );
        if (res.status !== 202) {
            globals.logger.warn(
                `UPTIME NEW RELIC: Failed sending Butler SOS uptime metrics to New Relic: ${res.status}, ${res.statusText}`
            );
        }
        globals.logger.verbose(`UPTIME NEW RELIC: Sent Butler SOS memory usage data to New Relic`);
    } catch (error) {
        // handle error
        globals.logger.error(`UPTIME NEW RELIC: Error sending uptime: ${error}`);
    }
}

async function postUserEventToNewRelic(msg) {
    globals.logger.debug(`USER EVENT NEW RELIC 1: ${JSON.stringify(msg, null, 2)})`);

    try {
        // First prepare tags relating to the actual user event, then add tags defined in the config file
        // The config file tags can for example be used to separate data from DEV/TEST/PROD environments
        const ts = new Date().getTime(); // Timestamp in millisec
        let attributes;
        // Scramble the data if needed before sending to New Relic
        if (
            globals.config.has('Butler-SOS.userEvents.sendToNewRelic.scramble') &&
            globals.config.get('Butler-SOS.userEvents.sendToNewRelic.scramble')
        ) {
            attributes = {
                timestamp: ts,
                qs_host: msg.host,
                qs_event_action: msg.command,
                qs_userFull: crypto
                    .createHash('shake256', { outputLength: 8 })
                    .update(`${msg.user_directory}\\${msg.user_id}`)
                    .digest('hex'),
                qs_userDirectory: crypto
                    .createHash('shake256', { outputLength: 8 })
                    .update(msg.user_directory)
                    .digest('hex'),
                qs_userId: crypto
                    .createHash('shake256', { outputLength: 8 })
                    .update(msg.user_id)
                    .digest('hex'),
                qs_origin: msg.origin,
            };
        } else {
            attributes = {
                timestamp: ts,
                qs_host: msg.host,
                qs_event_action: msg.command,
                qs_userFull: `${msg.user_directory}\\${msg.user_id}`,
                qs_userDirectory: msg.user_directory,
                qs_userId: msg.user_id,
                qs_origin: msg.origin,
            };
        }

        if (
            globals.config.has('Butler-SOS.userEvents.tags') &&
            globals.config.get('Butler-SOS.userEvents.tags') !== null &&
            globals.config.get('Butler-SOS.userEvents.tags').length > 0
        ) {
            const configTags = globals.config.get('Butler-SOS.userEvents.tags');
            // eslint-disable-next-line no-restricted-syntax
            for (const item of configTags) {
                attributes[item.tag] = item.value;
            }
        }

        // Build final payload
        const payload = { ...attributes };
        payload.eventType = 'qs_userEvent';

        globals.logger.debug(`USER EVENT NEW RELIC: Payload: ${JSON.stringify(payload, null, 2)}`);

        // Preapare call to remote host
        const tmpUrl =
            globals.config.get('Butler-SOS.newRelic.event.url').slice(-1) === '/'
                ? globals.config.get('Butler-SOS.newRelic.event.url')
                : `${globals.config.get('Butler-SOS.newRelic.event.url')}/`;

        // Build final URL
        const eventUrl = `${tmpUrl}v1/accounts/${globals.config.get(
            'Butler-SOS.thirdPartyToolsCredentials.newRelic.accountId'
        )}/events`;

        globals.logger.debug(`USER EVENT NEW RELIC: Event API url=${eventUrl}`);

        // Add headers
        const headers = {
            'Content-Type': 'application/json',
            'Api-Key': globals.config.get(
                'Butler-SOS.thirdPartyToolsCredentials.newRelic.insertApiKey'
            ),
        };

        // eslint-disable-next-line no-restricted-syntax
        for (const header of globals.config.get('Butler-SOS.newRelic.event.header')) {
            headers[header.name] = header.value;
        }

        const axiosRequest = {
            url: eventUrl,
            method: 'post',
            timeout: 10000,
            data: payload,
            headers,
        };

        const res = await axios.request(axiosRequest);

        globals.logger.debug(
            `USER EVENT NEW RELIC: Result code from posting to New Relic: ${res.status}, ${res.statusText}`
        );
        globals.logger.verbose(`USER EVENT NEW RELIC: Sent user event to New Relic`);
    } catch (err) {
        globals.logger.error(`USER EVENT NEW RELIC: Error saving user event to New Relic! ${err}`);
    }
}

/**
 *
 * @param {*} sourceService
 * @param {*} sourcelogLevel
 */
function sendNRLogEventYesNo(sourceService, sourceLogLevel) {
    // Engine log event
    if (
        sourceService.toLowerCase() === 'engine' &&
        globals.config.has('Butler-SOS.logEvents.sendToNewRelic.source.engine.enable') &&
        globals.config.get('Butler-SOS.logEvents.sendToNewRelic.source.engine.enable') === true
    ) {
        if (
            (globals.config.has(
                'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error'
            ) &&
                globals.config.get(
                    'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.error'
                ) === true &&
                sourceLogLevel.toLowerCase() === 'error') ||
            (globals.config.has(
                'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.warn'
            ) &&
                globals.config.get(
                    'Butler-SOS.logEvents.sendToNewRelic.source.engine.logLevel.warn'
                ) === true &&
                sourceLogLevel.toLowerCase() === 'warn')
        ) {
            return true;
        }
    }

    // Proxy log event
    if (
        sourceService.toLowerCase() === 'proxy' &&
        globals.config.has('Butler-SOS.logEvents.sendToNewRelic.source.proxy.enable') &&
        globals.config.get('Butler-SOS.logEvents.sendToNewRelic.source.proxy.enable') === true
    ) {
        if (
            (globals.config.has(
                'Butler-SOS.logEvents.sendToNewRelic.source.proxy.logLevel.error'
            ) &&
                globals.config.get(
                    'Butler-SOS.logEvents.sendToNewRelic.source.proxy.logLevel.error'
                ) === true &&
                sourceLogLevel.toLowerCase() === 'error') ||
            (globals.config.has('Butler-SOS.logEvents.sendToNewRelic.source.proxy.logLevel.warn') &&
                globals.config.get(
                    'Butler-SOS.logEvents.sendToNewRelic.source.proxy.logLevel.warn'
                ) === true &&
                sourceLogLevel.toLowerCase() === 'warn')
        ) {
            return true;
        }
    }

    // Repository log event
    if (
        sourceService.toLowerCase() === 'repository' &&
        globals.config.has('Butler-SOS.logEvents.sendToNewRelic.source.repository.enable') &&
        globals.config.get('Butler-SOS.logEvents.sendToNewRelic.source.repository.enable') === true
    ) {
        if (
            (globals.config.has(
                'Butler-SOS.logEvents.sendToNewRelic.source.repository.logLevel.error'
            ) &&
                globals.config.get(
                    'Butler-SOS.logEvents.sendToNewRelic.source.repository.logLevel.error'
                ) === true &&
                sourceLogLevel.toLowerCase() === 'error') ||
            (globals.config.has(
                'Butler-SOS.logEvents.sendToNewRelic.source.repository.logLevel.warn'
            ) &&
                globals.config.get(
                    'Butler-SOS.logEvents.sendToNewRelic.source.repository.logLevel.warn'
                ) === true &&
                sourceLogLevel.toLowerCase() === 'warn')
        ) {
            return true;
        }
    }

    // Scheduler log event
    if (
        sourceService.toLowerCase() === 'scheduler' &&
        globals.config.has('Butler-SOS.logEvents.sendToNewRelic.source.scheduler.enable') &&
        globals.config.get('Butler-SOS.logEvents.sendToNewRelic.source.scheduler.enable') === true
    ) {
        if (
            (globals.config.has(
                'Butler-SOS.logEvents.sendToNewRelic.source.scheduler.logLevel.error'
            ) &&
                globals.config.get(
                    'Butler-SOS.logEvents.sendToNewRelic.source.scheduler.logLevel.error'
                ) === true &&
                sourceLogLevel.toLowerCase() === 'error') ||
            (globals.config.has(
                'Butler-SOS.logEvents.sendToNewRelic.source.scheduler.logLevel.warn'
            ) &&
                globals.config.get(
                    'Butler-SOS.logEvents.sendToNewRelic.source.scheduler.logLevel.warn'
                ) === true &&
                sourceLogLevel.toLowerCase() === 'warn')
        ) {
            return true;
        }
    }

    return false;
}

/**
 *
 * @param {*} msg
 */
async function postLogEventToNewRelic(msg) {
    globals.logger.debug(`LOG EVENT NEW RELIC: ${msg})`);

    try {
        // Only send log events that are enabled in the confif file
        if (sendNRLogEventYesNo(msg.source, msg.level) === true) {
            // First prepare attributes relating to the actual log event, then add attributes defined in the config file
            // The config file attributes can for example be used to separate data from DEV/TEST/PROD environments
            const ts = new Date().getTime(); // Timestamp in millisec
            const attributes = {
                timestamp: ts,
                qs_ts_iso: msg.ts_iso,
                qs_ts_local: msg.ts_local,
                qs_log_source: msg.source,
                qs_log_level: msg.level,
                qs_host: msg.host,
                qs_subsystem: msg.subsystem,
                qs_windows_user: msg.windows_user,
                qs_message: msg.message,
                qs_exception_message: msg.exception_message,
                qs_user_full: `${msg.user_directory}\\${msg.user_id}`,
                qs_user_directory: msg.user_directory,
                qs_user_id: msg.user_id,
                qs_command: msg.command,
                qs_result_code: msg.result_code,
                qs_origin: msg.origin,
                qs_context: msg.context,
                qs_task_name: msg.task_name,
                qs_app_name: msg.app_name,
                qs_task_id: msg.task_id,
                qs_app_id: msg.app_id,
                qs_execution_id: msg.execution_id,
            };

            // Att log event tags as attributes
            if (
                globals.config.has('Butler-SOS.logEvents.tags') &&
                globals.config.get('Butler-SOS.logEvents.tags') !== null &&
                globals.config.get('Butler-SOS.logEvents.tags').length > 0
            ) {
                const configTags = globals.config.get('Butler-SOS.logEvents.tags');
                // eslint-disable-next-line no-restricted-syntax
                for (const item of configTags) {
                    attributes[item.tag] = item.value;
                }
            }

            // Add New Relic specific attributes
            if (
                globals.config.has('Butler-SOS.newRelic.event.attribute.static') &&
                globals.config.get('Butler-SOS.newRelic.event.attribute.static') !== null &&
                globals.config.get('Butler-SOS.newRelic.event.attribute.static').length > 0
            ) {
                const configTags = globals.config.get('Butler-SOS.newRelic.event.attribute.static');
                // eslint-disable-next-line no-restricted-syntax
                for (const item of configTags) {
                    attributes[item.name] = item.value;
                }
            }

            // Add dynamic, New Relic specifc attributes
            if (
                globals.config.has(
                    'Butler-SOS.newRelic.event.attribute.dynamic.butlerSosVersion.enable'
                ) &&
                globals.config.get(
                    'Butler-SOS.newRelic.event.attribute.dynamic.butlerSosVersion.enable'
                ) === true
            ) {
                attributes.butlerSosVersion = globals.appVersion;
            }

            // Build final payload
            const payload = { ...attributes };
            payload.eventType = 'qs_logEvent';

            globals.logger.debug(
                `LOG EVENT NEW RELIC: Payload: ${JSON.stringify(payload, null, 2)}`
            );

            // Preapare call to remote host
            const tmpUrl =
                globals.config.get('Butler-SOS.newRelic.event.url').slice(-1) === '/'
                    ? globals.config.get('Butler-SOS.newRelic.event.url')
                    : `${globals.config.get('Butler-SOS.newRelic.event.url')}/`;

            // Build final URL
            const eventUrl = `${tmpUrl}v1/accounts/${globals.config.get(
                'Butler-SOS.thirdPartyToolsCredentials.newRelic.accountId'
            )}/events`;

            globals.logger.debug(`LOG EVENT NEW RELIC: Event API url=${eventUrl}`);

            // Add headers
            const headers = {
                'Content-Type': 'application/json',
                'Api-Key': globals.config.get(
                    'Butler-SOS.thirdPartyToolsCredentials.newRelic.insertApiKey'
                ),
            };

            if (
                globals.config.has('Butler-SOS.newRelic.event.header') &&
                globals.config.get('Butler-SOS.newRelic.event.header') !== null &&
                globals.config.get('Butler-SOS.newRelic.event.header').length > 0
            ) {
                const configHeaders = globals.config.get('Butler-SOS.newRelic.event.header');
                // eslint-disable-next-line no-restricted-syntax
                for (const header of configHeaders) {
                    headers[header.name] = header.value;
                }
            }

            const axiosRequest = {
                url: eventUrl,
                method: 'post',
                timeout: 10000,
                data: payload,
                headers,
            };

            const res = await axios.request(axiosRequest);

            globals.logger.debug(
                `LOG EVENT NEW RELIC: Result code from posting to New Relic: ${res.status}, ${res.statusText}`
            );
            globals.logger.verbose(`LOG EVENT NEW RELIC: Sent event to New Relic`);
        }
    } catch (err) {
        globals.logger.error(`LOG EVENT NEW RELIC: Error saving event to New Relic! ${err}`);
    }
}

module.exports = {
    postHealthMetricsToNewRelic,
    postProxySessionsToNewRelic,
    postButlerSOSUptimeToNewRelic,
    postUserEventToNewRelic,
    postLogEventToNewRelic,
};
