## Modules

<dl>
<dt><a href="#module_import-meta-url">import-meta-url</a></dt>
<dd><p>Utility module to provide a compatible import.meta.url equivalent in CommonJS modules.</p>
<p>This module creates a URL object that represents the current file&#39;s path,
which can be used in a similar way to import.meta.url in ES modules.
This is necessary for CommonJS modules that need file path resolution
capabilities similar to those available in ES modules.</p>
</dd>
</dl>

## Classes

<dl>
<dt><a href="#Settings">Settings</a></dt>
<dd></dd>
<dt><a href="#UdpEvents">UdpEvents</a></dt>
<dd><p>Class for tracking counts of UDP events received from Qlik Sense.</p>
<p>This class provides thread-safe methods to track different types of events:</p>
<ul>
<li>Log events (from various Qlik Sense services)</li>
<li>User events (user session related events)</li>
<li>Rejected log events (events that didn&#39;t match filtering criteria)</li>
</ul>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#requestHealth">requestHealth</a></dt>
<dd><p>Creates and executes an HTTP request to check if the application is healthy.
Used for Docker health checks to determine container health status.
Exits with code 0 if health check succeeds, 1 otherwise.</p>
</dd>
<dt><a href="#confifgFileSchema">confifgFileSchema</a> : <code>object</code></dt>
<dd><p>Schema definition for Butler SOS configuration file validation.</p>
<p>This schema is used with AJV (Another JSON Validator) to validate the
structure and content of the Butler SOS YAML configuration file.
It defines all possible configuration options, their data types,
validation rules, and which options are required.</p>
<p>The schema includes validation for:</p>
<ul>
<li>General application settings (logging, telemetry, etc.)</li>
<li>Server connection details</li>
<li>Integration configurations (InfluxDB, MQTT, etc.)</li>
<li>User event and log event handling</li>
<li>Monitoring options and filters</li>
<li>Prometheus metrics</li>
<li>Third-party tool credentials</li>
</ul>
</dd>
<dt><a href="#callRemoteURL">callRemoteURL</a> ⇒ <code>void</code></dt>
<dd><p>Sends anonymous telemetry data to PostHog.</p>
<p>This function collects information about the Butler SOS instance, its environment,
and which features are enabled/disabled. This data helps the developers understand
how Butler SOS is being used and prioritize development efforts accordingly.</p>
<p>The telemetry includes:</p>
<ul>
<li>System information (OS, architecture, Node.js version)</li>
<li>Enabled/disabled features</li>
<li>Configuration settings (without sensitive information)</li>
<li>Whether the app is running in Docker</li>
</ul>
<p>No personally identifiable information or sensitive configuration data is collected.</p>
</dd>
<dt><a href="#isoDateRegex">isoDateRegex</a> : <code>RegExp</code></dt>
<dd><p>Regular expression that matches ISO8601 date format strings.
Matches patterns like &quot;2021-11-09T15:37:26.028+0200&quot;.</p>
</dd>
<dt><a href="#uuidRegex">uuidRegex</a> : <code>RegExp</code></dt>
<dd><p>Regular expression that matches UUID format strings.
Matches standard UUID patterns like &quot;550e8400-e29b-41d4-a716-446655440000&quot;.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#sleep">sleep(ms)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Delays execution for the specified amount of time.</p>
</dd>
<dt><a href="#mainScript">mainScript()</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Main application entry point that initializes and starts all Butler SOS services.</p>
<p>This function initializes globals, sets up logging, starts UDP servers for user events
and log events, and initializes various metrics collection services based on configuration.</p>
</dd>
<dt><a href="#getAppNames">getAppNames()</a> ⇒ <code>void</code></dt>
<dd><p>Retrieves application names from the Qlik Repository Service (QRS) API.</p>
<p>This function connects to the Qlik Sense repository database and fetches
information about all available applications. It stores the app information
(id, name, description) in the global appNames variable for use throughout
the Butler SOS application.</p>
</dd>
<dt><a href="#setupAppNamesExtractTimer">setupAppNamesExtractTimer()</a> ⇒ <code>void</code></dt>
<dd><p>Sets up a timer for periodically retrieving app names from the Qlik Repository Service.</p>
<p>This function initializes a timer that calls getAppNames() at regular intervals
specified by the Butler-SOS.appNames.extractInterval configuration setting.
This ensures that the Butler SOS application always has up-to-date information
about Qlik Sense applications.</p>
</dd>
<dt><a href="#verifyConfigFileSchema">verifyConfigFileSchema(configFile)</a> ⇒ <code>Promise.&lt;boolean&gt;</code></dt>
<dd><p>Verifies that the config file has the correct format.
Use yaml-validator to validate the config file</p>
</dd>
<dt><a href="#verifyAppConfig">verifyAppConfig(cfg)</a> ⇒ <code>Promise.&lt;boolean&gt;</code></dt>
<dd><p>Verifies application-specific settings and relationships between configuration settings.</p>
<p>This function performs validation beyond simple schema validation, checking:</p>
<ol>
<li>If InfluxDB is enabled, verifies that version is valid (must be 1 or 2)</li>
<li>Validates server tag configuration:<ul>
<li>All tags defined in serverTagsDefinition must be set for each server</li>
<li>All tags specified for each server must be present in serverTagsDefinition</li>
</ul>
</li>
</ol>
</dd>
<dt><a href="#configObfuscate">configObfuscate(config)</a> ⇒ <code>object</code></dt>
<dd><p>Obfuscates sensitive information in the Butler SOS configuration object.</p>
<p>This function creates a copy of the configuration object and replaces sensitive
information with masked strings to prevent leaking sensitive data when displaying
the configuration through the web interface. It typically keeps a small prefix
of the original value (e.g., first 3-10 characters) and replaces the rest with
asterisks.</p>
<p>Obfuscated fields include:</p>
<ul>
<li>Server hostnames and IP addresses</li>
<li>API keys and passwords</li>
<li>Certificate paths and passphrases</li>
<li>MQTT topics</li>
<li>InfluxDB credentials and parameters</li>
<li>Headers containing authentication information</li>
<li>Application IDs and names</li>
</ul>
</dd>
<dt><a href="#setupConfigVisServer">setupConfigVisServer([logger], [config])</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Sets up and starts a web server for visualizing Butler SOS configuration.</p>
<p>This function creates a Fastify server that serves a web interface where users can
view the current Butler SOS configuration in a more readable format. It includes:</p>
<ul>
<li>Rate limiting to prevent abuse</li>
<li>Optional obfuscation of sensitive configuration values</li>
<li>Serving static files for the web interface</li>
<li>Rendering the configuration as both JSON and YAML</li>
</ul>
</dd>
<dt><a href="#getCertificates">getCertificates(options)</a> ⇒ <code>object</code></dt>
<dd><p>Loads TLS certificates from the filesystem based on the provided options.</p>
</dd>
<dt><a href="#getHealthStatsFromSense">getHealthStatsFromSense(serverName, host, tags, headers)</a> ⇒ <code>void</code></dt>
<dd><p>Retrieves health statistics from Qlik Sense server via the engine healthcheck API.</p>
<p>This function makes an HTTPS request to the Sense engine healthcheck API and
distributes the data to configured destinations (MQTT, InfluxDB, New Relic, Prometheus).</p>
</dd>
<dt><a href="#setupHealthMetricsTimer">setupHealthMetricsTimer()</a> ⇒ <code>void</code></dt>
<dd><p>Sets up a timer that periodically collects health metrics from all configured Sense servers.</p>
<p>This function creates an interval that runs every pollingInterval milliseconds (as defined in config)
and calls getHealthStatsFromSense for each server in the serverList global variable.</p>
</dd>
<dt><a href="#callRemoteURL">callRemoteURL(remoteURL, logger)</a> ⇒ <code>void</code></dt>
<dd><p>Sends a heartbeat GET request to a remote URL.</p>
</dd>
<dt><a href="#setupHeartbeatTimer">setupHeartbeatTimer(config, logger)</a> ⇒ <code>void</code></dt>
<dd><p>Sets up a scheduled timer for sending heartbeat requests to a remote URL.</p>
<p>This function configures a scheduled timer based on the frequency specified in the
configuration. It also performs an initial heartbeat request immediately.</p>
</dd>
<dt><a href="#categoriseLogEvent">categoriseLogEvent(logLevel, logMessage)</a> ⇒ <code>object</code></dt>
<dd><p>Categorizes log events based on configured rules.</p>
<p>This function analyzes log events from Qlik Sense services and categorizes them
based on matching rules defined in the configuration. Rules can match on log level
and message content using different filters (starts with, ends with, contains).
Rules can also specify if a matched log event should be dropped.</p>
<p>The function returns an object with two properties:</p>
<ul>
<li>category: An array of objects, each representing a category.
Each category object has two properties: name and value.</li>
<li>actionTaken: A string indicating the action taken on the log event.
Possible values are &#39;categorised&#39; and &#39;dropped&#39;.</li>
</ul>
<p>If no rule matches, then the function uses the default category
(if enabled in the config file) and sets actionTaken to &#39;categorised&#39;.</p>
<p>If an error occurs while processing the log event, then the function
logs an error message and returns null.</p>
</dd>
<dt><a href="#getFormattedTime">getFormattedTime(serverStarted)</a> ⇒ <code>string</code></dt>
<dd><p>Calculates and formats the uptime of a Qlik Sense engine.</p>
<p>This function takes the server start time from the engine healthcheck API
and calculates how long the server has been running, returning a formatted string.</p>
</dd>
<dt><a href="#postHealthMetricsToInfluxdb">postHealthMetricsToInfluxdb(serverName, host, body, serverTags)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts health metrics data from Qlik Sense to InfluxDB.</p>
<p>This function processes health data from the Sense engine&#39;s healthcheck API and
formats it for storage in InfluxDB. It handles various metrics including:</p>
<ul>
<li>CPU usage</li>
<li>Memory usage</li>
<li>Cache metrics</li>
<li>Active/loaded/in-memory apps</li>
<li>Session counts</li>
<li>User counts</li>
</ul>
</dd>
<dt><a href="#storeLoadedDoc">storeLoadedDoc(docID)</a> ⇒ <code>Promise</code></dt>
<dd><p>Stores a loaded app name in memory.</p>
</dd>
<dt><a href="#storeInMemoryDoc">storeInMemoryDoc(docID)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Stores a document ID in either the sessionAppNamesInMemory or appNamesInMemory arrays.</p>
</dd>
<dt><a href="#postProxySessionsToInfluxdb">postProxySessionsToInfluxdb(userSessions)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts proxy sessions data to InfluxDB.</p>
<p>This function takes user session data from Qlik Sense proxy and formats it for storage
in InfluxDB. It handles different versions of InfluxDB (1.x and 2.x) and includes
error handling with detailed logging.</p>
</dd>
<dt><a href="#postButlerSOSMemoryUsageToInfluxdb">postButlerSOSMemoryUsageToInfluxdb(memory)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts Butler SOS memory usage metrics to InfluxDB.</p>
<p>This function captures memory usage metrics from the Butler SOS process itself
and stores them in InfluxDB. It handles both InfluxDB v1 and v2 formats.</p>
</dd>
<dt><a href="#postUserEventToInfluxdb">postUserEventToInfluxdb(msg)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts a user event to InfluxDB.</p>
</dd>
<dt><a href="#postLogEventToInfluxdb">postLogEventToInfluxdb(msg)</a></dt>
<dd><p>Posts a log event to InfluxDB</p>
</dd>
<dt><a href="#storeEventCountInfluxDB">storeEventCountInfluxDB()</a></dt>
<dd><p>This function retrieves arrays of log and user events, and stores the data in InfluxDB.
If the InfluxDB version is 1.x, it uses the v1 API to write data points for each event.
If the InfluxDB version is 2.x, it uses the v2 API to write data points for each event.
Static tags from the configuration file are added to each data point.
The function logs messages at various stages to provide debugging and status information.
No data is stored if there are no events present.</p>
</dd>
<dt><a href="#storeRejectedEventCountInfluxDB">storeRejectedEventCountInfluxDB()</a></dt>
<dd><p>This function reads an array of rejected log events from the <code>rejectedEvents</code> object,
and stores the data in InfluxDB. The data is written to a measurement named after
the <code>Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName</code> config setting.
The function uses the InfluxDB v1 or v2 API depending on the <code>Butler-SOS.influxdbConfig.version</code>
config setting.</p>
</dd>
<dt><a href="#postHealthToMQTT">postHealthToMQTT(_host, serverName, body)</a> ⇒ <code>void</code></dt>
<dd><p>Posts health metrics from Qlik Sense engine healthcheck API to MQTT.</p>
<p>This function publishes various metrics (memory usage, CPU usage, sessions, cache, etc.)
to MQTT topics based on the configuration in Butler-SOS.mqttConfig.</p>
</dd>
<dt><a href="#postUserSessionsToMQTT">postUserSessionsToMQTT(host, virtualProxy, body)</a> ⇒ <code>void</code></dt>
<dd><p>Posts user session information to MQTT.</p>
<p>This function publishes information about user sessions to MQTT topics
based on the configuration in Butler-SOS.mqttConfig.</p>
</dd>
<dt><a href="#postUserEventToMQTT">postUserEventToMQTT(msg)</a> ⇒ <code>void</code></dt>
<dd><p>Posts user events from Qlik Sense to MQTT.</p>
<p>This function processes user events (session start/stop, connection open/close)
and publishes them to configured MQTT topics. It supports both general event topics
and specific topics for different event types.</p>
</dd>
<dt><a href="#postLogEventToMQTT">postLogEventToMQTT(msg)</a> ⇒ <code>void</code></dt>
<dd><p>Posts log events from Qlik Sense to MQTT.</p>
<p>This function processes log events from various Qlik Sense services
and publishes them to configured MQTT topics. It supports both generic
topics and specific topics for different log levels.</p>
</dd>
<dt><a href="#getFormattedTime">getFormattedTime(serverStarted)</a> ⇒ <code>string</code></dt>
<dd><p>Calculates and formats the uptime of a Qlik Sense engine.</p>
<p>This function takes the server start time from the engine healthcheck API
and calculates how long the server has been running, returning a formatted string.</p>
</dd>
<dt><a href="#postHealthMetricsToNewRelic">postHealthMetricsToNewRelic(_host, body, tags)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts health metrics data from Qlik Sense to New Relic.</p>
<p>This function processes health data from the Sense engine&#39;s healthcheck API and
formats it for posting to New Relic. It handles various metrics including:</p>
<ul>
<li>CPU usage</li>
<li>Memory usage</li>
<li>Cache metrics</li>
<li>Active/loaded/in-memory apps</li>
<li>Session counts</li>
<li>User counts</li>
</ul>
</dd>
<dt><a href="#postProxySessionsToNewRelic">postProxySessionsToNewRelic(userSessions)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts user session metrics data from Qlik Sense to New Relic.</p>
<p>This function processes user session data from the Sense Proxy API and
formats it for posting to New Relic. It includes session counts and
attributes such as virtual proxy and host information.</p>
</dd>
<dt><a href="#postButlerSOSUptimeToNewRelic">postButlerSOSUptimeToNewRelic(fields)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts Butler SOS uptime data to New Relic.</p>
<p>This function processes memory usage data from Butler SOS and
formats it for posting to New Relic.</p>
</dd>
<dt><a href="#postUserEventToNewRelic">postUserEventToNewRelic(msg)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts a user event to New Relic.</p>
</dd>
<dt><a href="#sendNRLogEventYesNo">sendNRLogEventYesNo(sourceService, sourceLogLevel)</a> ⇒ <code>boolean</code></dt>
<dd><p>Checks if a log event from a given Qlik Sense service should be sent to New Relic.</p>
<p>This function checks the Butler SOS configuration to determine if a log event
from a given Qlik Sense service should be sent to New Relic based on the log level
and the service name.</p>
</dd>
<dt><a href="#postLogEventToNewRelic">postLogEventToNewRelic(msg)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Posts a log event to New Relic.</p>
</dd>
<dt><a href="#setupPromClient">setupPromClient(promServer, promPort, promHost)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Sets up the Prometheus client and metrics endpoints.</p>
<p>This function initializes all Prometheus metrics gauges for Butler SOS
and starts an HTTP server that exposes these metrics.</p>
</dd>
<dt><a href="#saveHealthMetricsToPrometheus">saveHealthMetricsToPrometheus(host, data, labels)</a> ⇒ <code>void</code></dt>
<dd><p>Stores health metrics data from Qlik Sense in Prometheus gauges.</p>
<p>This function takes the health data received from the Sense engine&#39;s health check API
and populates the Prometheus gauges with appropriate values, including app metrics,
cache metrics, CPU usage, memory usage, session counts, and user counts.</p>
</dd>
<dt><a href="#saveUserSessionMetricsToPrometheus">saveUserSessionMetricsToPrometheus(userSessionsData)</a> ⇒ <code>void</code></dt>
<dd><p>Stores user session metrics data in Prometheus gauges.</p>
<p>This function takes the user session data collected from Sense Proxy API
and populates the Prometheus gauges with appropriate values.</p>
</dd>
<dt><a href="#getCertificates">getCertificates(options)</a> ⇒ <code>object</code></dt>
<dd><p>Loads TLS certificates from the filesystem based on the provided options.</p>
</dd>
<dt><a href="#prepUserSessionMetrics">prepUserSessionMetrics(serverName, host, virtualProxy, body, tags)</a> ⇒ <code>Promise.&lt;object&gt;</code></dt>
<dd><p>Prepares user session metrics data for storage/forwarding to various destinations.</p>
<p>This function processes raw session data from Qlik Sense and formats it into
structures suitable for InfluxDB, Prometheus, and New Relic.</p>
</dd>
<dt><a href="#getProxySessionStatsFromSense">getProxySessionStatsFromSense(serverName, host, virtualProxy, influxTags)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Retrieves user session statistics from Qlik Sense Proxy Service.</p>
<p>This function makes an API call to the Qlik Sense Proxy API to get information about
active user sessions. It then processes this data and sends it to configured destinations
(MQTT, InfluxDB, New Relic, Prometheus).</p>
</dd>
<dt><a href="#setupUserSessionsTimer">setupUserSessionsTimer()</a> ⇒ <code>void</code></dt>
<dd><p>Sets up a timer to periodically retrieve user session information from Qlik Sense.</p>
<p>This function configures a periodic task that polls all configured Sense servers
and their virtual proxies for user session information. The gathered data is then
processed and sent to the configured destinations.</p>
</dd>
<dt><a href="#getServerHeaders">getServerHeaders(server)</a> ⇒ <code>object</code> | <code>Array</code></dt>
<dd><p>Extracts HTTP headers from a server configuration object.</p>
<p>This function processes a server configuration object and extracts any custom HTTP headers
defined in the server&#39;s headers property. These headers can be used when making API requests
to the server.</p>
</dd>
<dt><a href="#getServerTags">getServerTags(logger, server)</a> ⇒ <code>object</code> | <code>Array</code></dt>
<dd><p>Extracts tag values from a server configuration object.</p>
<p>This function processes a server configuration object and extracts tags that can be
used to tag metrics in time series databases or monitoring systems. It always includes
host, server_name, and server_description tags, plus any custom tags defined in the
server&#39;s serverTags property.</p>
</dd>
<dt><a href="#serviceUptimeStart">serviceUptimeStart()</a> ⇒ <code>void</code></dt>
<dd><p>Starts monitoring and reporting of Butler SOS service uptime and memory usage.</p>
<p>This function sets up a timer to periodically log Butler SOS uptime and memory usage statistics.
It also optionally sends this data to InfluxDB and/or New Relic for long-term storage and analysis.
The function uses the frequency and log level settings from the Butler SOS config file.</p>
<p>Data tracked includes:</p>
<ul>
<li>Uptime duration (formatted as months, days, hours, minutes, seconds)</li>
<li>Heap memory usage (used and total)</li>
<li>External (off-heap) memory</li>
<li>Total process memory allocation</li>
</ul>
</dd>
<dt><a href="#setupAnonUsageReportTimer">setupAnonUsageReportTimer([logger], [hostInfo])</a> ⇒ <code>void</code></dt>
<dd><p>Sets up a timer to periodically send anonymous usage telemetry.</p>
<p>This function initializes the PostHog client and configures a timer to send
anonymous telemetry data every 12 hours. It also sends an initial telemetry
report immediately upon setup.</p>
</dd>
<dt><a href="#udpInitLogEventServer">udpInitLogEventServer()</a> ⇒ <code>void</code></dt>
<dd><p>Initializes the UDP server for handling Qlik Sense log events.</p>
<p>This function sets up event handlers for the UDP server that listens for
log events from Qlik Sense services (such as engine, proxy, repository,
and scheduler services).</p>
</dd>
<dt><a href="#udpInitUserActivityServer">udpInitUserActivityServer()</a> ⇒ <code>void</code></dt>
<dd><p>Initializes the UDP server for handling Qlik Sense user activity events.</p>
<p>This function sets up event handlers for the UDP server that listens for
user activity events from Qlik Sense (such as session start/stop and
connection open/close events).</p>
</dd>
<dt><a href="#processAppSpecificFilters">processAppSpecificFilters(eventData, appSpecificFilters)</a> ⇒ <code>boolean</code></dt>
<dd><p>Processes filters for app-specific monitoring configuration</p>
</dd>
<dt><a href="#processAllAppsFilters">processAllAppsFilters(eventData, allAppsFilters)</a> ⇒ <code>boolean</code></dt>
<dd><p>Processes filters for all-apps monitoring configuration</p>
</dd>
<dt><a href="#processObjectIdFilters">processObjectIdFilters(objectConfig, eventObjectId)</a> ⇒ <code>boolean</code></dt>
<dd><p>Process object ID filters</p>
</dd>
<dt><a href="#processMethodFilters">processMethodFilters(methodConfig, eventMethod)</a> ⇒ <code>boolean</code></dt>
<dd><p>Process method filters</p>
</dd>
<dt><a href="#processEngineEvent">processEngineEvent(msg)</a> ⇒ <code>Object</code></dt>
<dd><p>Process engine log events</p>
<p>Message parts for log messages from engine service:
0:  Message type. Always /qseow-engine/
1:  Row number
2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Message. Can contain single quotes and semicolon - handle with care.
9:  Proxy session ID (uuid)
10: QSEoW user directory associated with the event
11: QSEoW user id associated with the event
12: Engine timestamp (ISO8601 date)
13: Process ID (uuid)
14: Engine exe version
15: Server started (ISO8601 date)
16: Entry type
17: Session ID (uuid)
18: App ID (uuid)</p>
</dd>
<dt><a href="#processProxyEvent">processProxyEvent(msg)</a> ⇒ <code>object</code></dt>
<dd><p>Process proxy log events</p>
<p>Message parts for log messages from proxy service:
0:  Message type. Always /qseow-proxy/
1:  Row number
2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured. Example: Service.Repository.Repository.Core.Status.ServiceStatusWorker
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Method: &#39;SendRimQrsStatusRequest&#39;. Failed to retrieve service status from &#39;<a href="http://pro2-win2.lab.ptarmiganlabs.net:4444/status/">http://pro2-win2.lab.ptarmiganlabs.net:4444/status/</a>&#39;. Server host &#39;pro2-win2.lab.ptarmiganlabs.net&#39;. Error message: &#39;Unable to connect to the remote server&#39;
9:  Exception message. Empty unless an exception/fault occured in QSEoW.
10: QSEoW user directory associated with the event
11: QSEoW user id associated with the event
12: Command carried out when log event occured
13: Result code for command
14: Origin of log event
15: Context where the log event occured</p>
</dd>
<dt><a href="#processQixPerfEvent">processQixPerfEvent(msg)</a> ⇒ <code>object</code> | <code>null</code></dt>
<dd><p>Process QIX performance log events</p>
<p>Message parts for log messages with Qix performance information:
0:  Message type. Always /qseow-qix-perf/
1:  Row number. Ex: 14
2:  ISO8601 formatted timestamp. Example: 20211109T193744.331+0100
3:  Local timezone timestamp. Example: 2021-11-09 19:37:44,331
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured. Example: System.Scheduler.Scheduler.Slave.Tasks.ReloadTask
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Proxy session ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
9:  User directory of the user associated with the event. Ex: LAB
10: User ID of the user associated with the event. Ex: goran
11: Engine timestamp. Example: 2021-11-09T19:37:44.331+01:00
12: Session ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
13: Document ID (=app ID). Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
14: Request ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
15: Method. Ex: Global::OpenApp, Doc::GetAppLayout, GenericObject::GetLayout
16: Process time in milliseconds. Ex: 123
17: Work time in milliseconds. Ex: 123
18: Lock time in milliseconds. Ex: 123
19: Validate time in milliseconds. Ex: 123
20: Traverse time in milliseconds. Ex: 123
21: Handle. Ex: -1, 123
22: Object ID. Ex: df68e14d-1ed0-47c9-bcb6-b37a900441d8, <Unknown>, rwPjBk
23: Net RAM. Ex: 123456 bytes
24: Peak RAM. Ex: 123456 byets
25: Object type. Ex: <Unknown>, AppPropsList, SheetList, StoryList, VariableList, linechart, barchart, map, listbox, CurrentSelection</p>
</dd>
<dt><a href="#processRepositoryEvent">processRepositoryEvent(msg)</a> ⇒ <code>Object</code></dt>
<dd><p>Process repository log events</p>
<p>Message parts for log messages from repository service:
0:  Message type. Always /qseow-repository/
1:  Row number
2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured. Example: Service.Repository.Repository.Core.Status.ServiceStatusWorker
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Method: &#39;SendRimQrsStatusRequest&#39;. Failed to retrieve service status from &#39;<a href="http://pro2-win2.lab.ptarmiganlabs.net:4444/status/">http://pro2-win2.lab.ptarmiganlabs.net:4444/status/</a>&#39;. Server host &#39;pro2-win2.lab.ptarmiganlabs.net&#39;. Error message: &#39;Unable to connect to the remote server&#39;
9:  Exception message. Empty unless an exception/fault occured in QSEoW.
10: QSEoW user directory associated with the event. Ex: INTERNAL
11: QSEoW user id associated with the event. Ex: System
12: Command carried out when log event occured. Ex: Check service status
13: Result code for command. Ex: 500
14: Origin of log event. Ex: Not available
15: Context where the log event occured. Ex: /qps/servicestatusworker</p>
</dd>
<dt><a href="#processSchedulerEvent">processSchedulerEvent(msg)</a> ⇒ <code>object</code></dt>
<dd><p>Process scheduler log events</p>
<p>Message parts for log messages from scheduler service:
0:  Message type. Always /qseow-scheduler/
1:  Row number. Ex: 14
2:  ISO8601 formatted timestamp. Example: 20211109T193744.331+0100
3:  Local timezone timestamp. Example: 2021-11-09 19:37:44,331
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured. Example: System.Scheduler.Scheduler.Slave.Tasks.ReloadTask
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Message from ReloadProvider: Reload failed in Engine. Check engine or script logs.
9:  Exception message. Empty unless an exception/fault occured in QSEoW.
10: QSEoW user directory of the user associated with the event. Note: For some log events this field is empty. Field #14 is then populated instead. Ex: LAB
11: QSEoW user id of the user associated with the event. Note: For some log events this field is empty. Field #14 is then populated instead. Ex: goran
12: QSEoW directory and userID associated with the event. Note: For some log events this field is empty. Fields #12 and #13 are then populated instead. Ex: LAB\goran
13: Task name associated with the event. Ex: Manually triggered reload of Test failing reloads 2
14: App name associated with the event. Ex: Test failing reloads 2
15: Task ID associated with the event. Ex: dec2a02a-1680-44ef-8dc2-e2bfb180af87
16: App ID associated with the event. Ex: e7af59a0-c243-480d-9571-08727551a66f
17: Execution ID associated with the event. Ex: 4831c6a5-34f6-45bb-9d40-73a6e6992670</p>
</dd>
<dt><a href="#listeningEventHandler">listeningEventHandler(_message, _remote)</a> ⇒ <code>void</code></dt>
<dd><p>Handler for UDP server startup event for log events.</p>
<p>This function is called when the UDP server for log events starts listening.
It logs information about the server&#39;s address and port.</p>
</dd>
<dt><a href="#messageEventHandler">messageEventHandler(message, _remote)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Handler for UDP messages containing Qlik Sense log events.</p>
<p>This function processes incoming UDP messages from Qlik Sense Enterprise on Windows (QSEoW)
log events. It supports different log sources:</p>
<ul>
<li>qseow-engine: Engine service logs</li>
<li>qseow-proxy: Proxy service logs</li>
<li>qseow-repository: Repository service logs</li>
<li>qseow-scheduler: Scheduler service logs</li>
<li>qseow-qix-perf: QIX performance logs</li>
</ul>
<p>Each log event type is processed by a specialized handler function, then categorized
(if enabled), and finally forwarded to configured destinations (MQTT, InfluxDB, New Relic).</p>
</dd>
<dt><a href="#formatUserFields">formatUserFields(msgObj)</a> ⇒ <code>void</code></dt>
<dd><p>Formats and normalizes user directory and user ID fields in log events.</p>
<p>This function ensures consistent representation of user information across different
log event sources by either combining separate user directory and ID fields into a
full user name, or splitting a full user name into its component parts.</p>
</dd>
<dt><a href="#listeningEventHandler">listeningEventHandler(_message, _remote)</a> ⇒ <code>void</code></dt>
<dd><p>Handler for UDP server startup event for user events.</p>
<p>This function is called when the UDP server for user events starts listening.
It logs information about the server&#39;s address and port.</p>
</dd>
<dt><a href="#messageEventHandler">messageEventHandler(message, _remote)</a> ⇒ <code>Promise.&lt;void&gt;</code></dt>
<dd><p>Handler for UDP messages relating to user events from Qlik Sense Proxy service.</p>
<p>This function processes incoming UDP messages containing user activity information,
parses the message format, extracts relevant information such as user, app, browser details,
and forwards the processed data to configured destinations (MQTT, InfluxDB, New Relic).</p>
<p>Message format expected:</p>
<ul>
<li>Field 0: Message type (/qseow-proxy-connection/ or /qseow-proxy-session/)</li>
<li>Field 1: Host</li>
<li>Field 2: Command (Start session, Stop session, Open connection, Close connection)</li>
<li>Field 3: User directory</li>
<li>Field 4: User ID</li>
<li>Field 5: Origin</li>
<li>Field 6: Context</li>
<li>Field 7: Message (may contain UserAgent information)</li>
</ul>
</dd>
<dt><a href="#setupUdpEventsStorage">setupUdpEventsStorage([callbackForTest])</a> ⇒ <code>number</code> | <code>undefined</code></dt>
<dd><p>Sets up periodic storage of UDP events statistics to InfluxDB.</p>
<p>This function creates a timer that periodically:</p>
<ol>
<li>Stores event counts (log and user events) to InfluxDB</li>
<li>Stores rejected event counts to InfluxDB</li>
<li>Clears event counters after they&#39;ve been stored</li>
</ol>
</dd>
</dl>

<a name="module_import-meta-url"></a>

## import-meta-url
Utility module to provide a compatible import.meta.url equivalent in CommonJS modules.

This module creates a URL object that represents the current file's path,
which can be used in a similar way to import.meta.url in ES modules.
This is necessary for CommonJS modules that need file path resolution
capabilities similar to those available in ES modules.

<a name="Settings"></a>

## Settings
**Kind**: global class  

* [Settings](#Settings)
    * [new Settings()](#new_Settings_new)
    * _instance_
        * [.init()](#Settings+init) ⇒ <code>Object</code>
        * [.initInfluxDB()](#Settings+initInfluxDB)
        * [.initHostInfo()](#Settings+initHostInfo) ⇒ <code>Object</code> \| <code>null</code>
    * _static_
        * [.checkFileExistsSync(filepath)](#Settings.checkFileExistsSync) ⇒ <code>boolean</code>
        * [.sleep(ms)](#Settings.sleep) ⇒ <code>Promise</code>
        * [.isRunningInDocker()](#Settings.isRunningInDocker) ⇒ <code>boolean</code>

<a name="new_Settings_new"></a>

### new Settings()
Creates a new Settings instance or returns the existing singleton instance.
Implements the singleton pattern for global application settings.

<a name="Settings+init"></a>

### settings.init() ⇒ <code>Object</code>
Initializes the Settings object with configuration from the environment and config files.
Sets up logging, database connections, MQTT clients, and other application services.

**Kind**: instance method of [<code>Settings</code>](#Settings)  
**Returns**: <code>Object</code> - The singleton instance of the Settings class after initialization  
<a name="Settings+initInfluxDB"></a>

### settings.initInfluxDB()
Initializes the InfluxDB connection based on configuration settings.
Sets up databases, retention policies, and write APIs depending on InfluxDB version.

**Kind**: instance method of [<code>Settings</code>](#Settings)  
<a name="Settings+initHostInfo"></a>

### settings.initHostInfo() ⇒ <code>Object</code> \| <code>null</code>
Gathers and returns information about the host system where Butler SOS is running.
Includes OS details, network info, hardware details, and a unique ID.

**Kind**: instance method of [<code>Settings</code>](#Settings)  
**Returns**: <code>Object</code> \| <code>null</code> - Object containing host information or null if an error occurs  
<a name="Settings.checkFileExistsSync"></a>

### Settings.checkFileExistsSync(filepath) ⇒ <code>boolean</code>
Checks if a file exists at the specified file path.

**Kind**: static method of [<code>Settings</code>](#Settings)  
**Returns**: <code>boolean</code> - True if the file exists, false otherwise  

| Param | Type | Description |
| --- | --- | --- |
| filepath | <code>string</code> | Path to the file to check |

<a name="Settings.sleep"></a>

### Settings.sleep(ms) ⇒ <code>Promise</code>
Creates a Promise that resolves after a specified time in milliseconds.
Used for implementing delays in asynchronous code.

**Kind**: static method of [<code>Settings</code>](#Settings)  
**Returns**: <code>Promise</code> - A promise that resolves after the specified delay  

| Param | Type | Description |
| --- | --- | --- |
| ms | <code>number</code> | The number of milliseconds to sleep |

<a name="Settings.isRunningInDocker"></a>

### Settings.isRunningInDocker() ⇒ <code>boolean</code>
Detects if Butler SOS is running inside a Docker container.

**Kind**: static method of [<code>Settings</code>](#Settings)  
**Returns**: <code>boolean</code> - True if running in Docker, false otherwise  
<a name="requestHealth"></a>

## requestHealth
Creates and executes an HTTP request to check if the application is healthy.
Used for Docker health checks to determine container health status.
Exits with code 0 if health check succeeds, 1 otherwise.

**Kind**: global constant  
<a name="confifgFileSchema"></a>

## confifgFileSchema : <code>object</code>
Schema definition for Butler SOS configuration file validation.

This schema is used with AJV (Another JSON Validator) to validate the
structure and content of the Butler SOS YAML configuration file.
It defines all possible configuration options, their data types,
validation rules, and which options are required.

The schema includes validation for:
- General application settings (logging, telemetry, etc.)
- Server connection details
- Integration configurations (InfluxDB, MQTT, etc.)
- User event and log event handling
- Monitoring options and filters
- Prometheus metrics
- Third-party tool credentials

**Kind**: global constant  
<a name="callRemoteURL"></a>

## callRemoteURL ⇒ <code>void</code>
Sends anonymous telemetry data to PostHog.

This function collects information about the Butler SOS instance, its environment,
and which features are enabled/disabled. This data helps the developers understand
how Butler SOS is being used and prioritize development efforts accordingly.

The telemetry includes:
- System information (OS, architecture, Node.js version)
- Enabled/disabled features
- Configuration settings (without sensitive information)
- Whether the app is running in Docker

No personally identifiable information or sensitive configuration data is collected.

**Kind**: global constant  
<a name="isoDateRegex"></a>

## isoDateRegex : <code>RegExp</code>
Regular expression that matches ISO8601 date format strings.
Matches patterns like "2021-11-09T15:37:26.028+0200".

**Kind**: global constant  
<a name="uuidRegex"></a>

## uuidRegex : <code>RegExp</code>
Regular expression that matches UUID format strings.
Matches standard UUID patterns like "550e8400-e29b-41d4-a716-446655440000".

**Kind**: global constant  
<a name="sleep"></a>

## sleep(ms) ⇒ <code>Promise.&lt;void&gt;</code>
Delays execution for the specified amount of time.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - A promise that resolves after the specified time has elapsed.  

| Param | Type | Description |
| --- | --- | --- |
| ms | <code>number</code> | The number of milliseconds to sleep. |

<a name="mainScript"></a>

## mainScript() ⇒ <code>Promise.&lt;void&gt;</code>
Main application entry point that initializes and starts all Butler SOS services.

This function initializes globals, sets up logging, starts UDP servers for user events
and log events, and initializes various metrics collection services based on configuration.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - A promise that resolves when initialization is complete.  
<a name="mainScript..sleepLocal"></a>

### mainScript~sleepLocal(ms) ⇒ <code>Promise.&lt;void&gt;</code>
Helper function for sleeping/delaying within the mainScript function.

**Kind**: inner method of [<code>mainScript</code>](#mainScript)  
**Returns**: <code>Promise.&lt;void&gt;</code> - A promise that resolves after the specified time has elapsed.  

| Param | Type | Description |
| --- | --- | --- |
| ms | <code>number</code> | The number of milliseconds to sleep. |

<a name="getAppNames"></a>

## getAppNames() ⇒ <code>void</code>
Retrieves application names from the Qlik Repository Service (QRS) API.

This function connects to the Qlik Sense repository database and fetches
information about all available applications. It stores the app information
(id, name, description) in the global appNames variable for use throughout
the Butler SOS application.

**Kind**: global function  
<a name="setupAppNamesExtractTimer"></a>

## setupAppNamesExtractTimer() ⇒ <code>void</code>
Sets up a timer for periodically retrieving app names from the Qlik Repository Service.

This function initializes a timer that calls getAppNames() at regular intervals
specified by the Butler-SOS.appNames.extractInterval configuration setting.
This ensures that the Butler SOS application always has up-to-date information
about Qlik Sense applications.

**Kind**: global function  
<a name="verifyConfigFileSchema"></a>

## verifyConfigFileSchema(configFile) ⇒ <code>Promise.&lt;boolean&gt;</code>
Verifies that the config file has the correct format.
Use yaml-validator to validate the config file

**Kind**: global function  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - true if the config file is valid, false otherwise  

| Param | Type | Description |
| --- | --- | --- |
| configFile | <code>string</code> | path to the config file to verify |

<a name="verifyAppConfig"></a>

## verifyAppConfig(cfg) ⇒ <code>Promise.&lt;boolean&gt;</code>
Verifies application-specific settings and relationships between configuration settings.

This function performs validation beyond simple schema validation, checking:
1. If InfluxDB is enabled, verifies that version is valid (must be 1 or 2)
2. Validates server tag configuration:
   - All tags defined in serverTagsDefinition must be set for each server
   - All tags specified for each server must be present in serverTagsDefinition

**Kind**: global function  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - A promise that resolves to true if all checks pass, false otherwise  

| Param | Type | Description |
| --- | --- | --- |
| cfg | <code>object</code> | The configuration object to verify |

<a name="configObfuscate"></a>

## configObfuscate(config) ⇒ <code>object</code>
Obfuscates sensitive information in the Butler SOS configuration object.

This function creates a copy of the configuration object and replaces sensitive
information with masked strings to prevent leaking sensitive data when displaying
the configuration through the web interface. It typically keeps a small prefix
of the original value (e.g., first 3-10 characters) and replaces the rest with
asterisks.

Obfuscated fields include:
- Server hostnames and IP addresses
- API keys and passwords
- Certificate paths and passphrases
- MQTT topics
- InfluxDB credentials and parameters
- Headers containing authentication information
- Application IDs and names

**Kind**: global function  
**Returns**: <code>object</code> - A new configuration object with sensitive information masked  
**Throws**:

- <code>Error</code> If there's an error during the obfuscation process


| Param | Type | Description |
| --- | --- | --- |
| config | <code>object</code> | The original configuration object to obfuscate |

<a name="setupConfigVisServer"></a>

## setupConfigVisServer([logger], [config]) ⇒ <code>Promise.&lt;void&gt;</code>
Sets up and starts a web server for visualizing Butler SOS configuration.

This function creates a Fastify server that serves a web interface where users can
view the current Butler SOS configuration in a more readable format. It includes:
- Rate limiting to prevent abuse
- Optional obfuscation of sensitive configuration values
- Serving static files for the web interface
- Rendering the configuration as both JSON and YAML

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - A promise that resolves when the server is set up  
**Throws**:

- <code>Error</code> If there's an error setting up the server


| Param | Type | Description |
| --- | --- | --- |
| [logger] | <code>object</code> | Optional logger object (not used in this function) |
| [config] | <code>object</code> | Optional configuration object (not used in this function) |

<a name="getCertificates"></a>

## getCertificates(options) ⇒ <code>object</code>
Loads TLS certificates from the filesystem based on the provided options.

**Kind**: global function  
**Returns**: <code>object</code> - Object containing cert, key, and ca properties with certificate contents  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> | Certificate options |
| options.Certificate | <code>string</code> | Path to the client certificate file |
| options.CertificateKey | <code>string</code> | Path to the client certificate key file |
| options.CertificateCA | <code>string</code> | Path to the certificate authority file |
| [options.CertificatePassphrase] | <code>string</code> | Optional passphrase for the certificate |

<a name="getHealthStatsFromSense"></a>

## getHealthStatsFromSense(serverName, host, tags, headers) ⇒ <code>void</code>
Retrieves health statistics from Qlik Sense server via the engine healthcheck API.

This function makes an HTTPS request to the Sense engine healthcheck API and
distributes the data to configured destinations (MQTT, InfluxDB, New Relic, Prometheus).

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| serverName | <code>string</code> | The name of the server as defined in the config. |
| host | <code>string</code> | The hostname or IP address of the Sense server. |
| tags | <code>object</code> | Tags/metadata to associate with the server metrics. |
| headers | <code>object</code> \| <code>null</code> | Additional headers to include in the request. |

<a name="setupHealthMetricsTimer"></a>

## setupHealthMetricsTimer() ⇒ <code>void</code>
Sets up a timer that periodically collects health metrics from all configured Sense servers.

This function creates an interval that runs every pollingInterval milliseconds (as defined in config)
and calls getHealthStatsFromSense for each server in the serverList global variable.

**Kind**: global function  
<a name="callRemoteURL"></a>

## callRemoteURL(remoteURL, logger) ⇒ <code>void</code>
Sends a heartbeat GET request to a remote URL.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| remoteURL | <code>string</code> | The URL to send the heartbeat request to |
| logger | <code>object</code> | Logger object for logging success or errors |

<a name="setupHeartbeatTimer"></a>

## setupHeartbeatTimer(config, logger) ⇒ <code>void</code>
Sets up a scheduled timer for sending heartbeat requests to a remote URL.

This function configures a scheduled timer based on the frequency specified in the
configuration. It also performs an initial heartbeat request immediately.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>object</code> | Configuration object with heartbeat settings |
| logger | <code>object</code> | Logger object for logging debug info and errors |

<a name="categoriseLogEvent"></a>

## categoriseLogEvent(logLevel, logMessage) ⇒ <code>object</code>
Categorizes log events based on configured rules.

This function analyzes log events from Qlik Sense services and categorizes them
based on matching rules defined in the configuration. Rules can match on log level
and message content using different filters (starts with, ends with, contains).
Rules can also specify if a matched log event should be dropped.

The function returns an object with two properties:
- category: An array of objects, each representing a category.
  Each category object has two properties: name and value.
- actionTaken: A string indicating the action taken on the log event.
  Possible values are 'categorised' and 'dropped'.

If no rule matches, then the function uses the default category
(if enabled in the config file) and sets actionTaken to 'categorised'.

If an error occurs while processing the log event, then the function
logs an error message and returns null.

**Kind**: global function  
**Returns**: <code>object</code> - An object with category and actionTaken properties  

| Param | Type | Description |
| --- | --- | --- |
| logLevel | <code>string</code> | The log level of the log event |
| logMessage | <code>string</code> | The log message of the log event |

<a name="getFormattedTime"></a>

## getFormattedTime(serverStarted) ⇒ <code>string</code>
Calculates and formats the uptime of a Qlik Sense engine.

This function takes the server start time from the engine healthcheck API
and calculates how long the server has been running, returning a formatted string.

**Kind**: global function  
**Returns**: <code>string</code> - A formatted string representing uptime (e.g. "5 days, 3h 45m 12s")  

| Param | Type | Description |
| --- | --- | --- |
| serverStarted | <code>string</code> | The server start time in format "YYYYMMDDThhmmss" |

<a name="postHealthMetricsToInfluxdb"></a>

## postHealthMetricsToInfluxdb(serverName, host, body, serverTags) ⇒ <code>Promise.&lt;void&gt;</code>
Posts health metrics data from Qlik Sense to InfluxDB.

This function processes health data from the Sense engine's healthcheck API and
formats it for storage in InfluxDB. It handles various metrics including:
- CPU usage
- Memory usage
- Cache metrics
- Active/loaded/in-memory apps
- Session counts
- User counts

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when data has been posted to InfluxDB  

| Param | Type | Description |
| --- | --- | --- |
| serverName | <code>string</code> | The name of the Qlik Sense server |
| host | <code>string</code> | The hostname or IP of the Qlik Sense server |
| body | <code>object</code> | The health metrics data from Sense engine healthcheck API |
| serverTags | <code>object</code> | Tags to associate with the metrics |

<a name="postHealthMetricsToInfluxdb..storeActivedDoc"></a>

### postHealthMetricsToInfluxdb~storeActivedDoc(docID) ⇒ <code>Promise.&lt;void&gt;</code>
Stores a document ID in either the sessionAppNamesActive or appNamesActive arrays

**Kind**: inner method of [<code>postHealthMetricsToInfluxdb</code>](#postHealthMetricsToInfluxdb)  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when the document ID has been processed  

| Param | Type | Description |
| --- | --- | --- |
| docID | <code>string</code> | The ID of the document |

<a name="storeLoadedDoc"></a>

## storeLoadedDoc(docID) ⇒ <code>Promise</code>
Stores a loaded app name in memory.

**Kind**: global function  
**Returns**: <code>Promise</code> - - Resolves when the docID has been stored.  

| Param | Type | Description |
| --- | --- | --- |
| docID | <code>string</code> | The ID of the app to store. |

<a name="storeInMemoryDoc"></a>

## storeInMemoryDoc(docID) ⇒ <code>Promise.&lt;void&gt;</code>
Stores a document ID in either the sessionAppNamesInMemory or appNamesInMemory arrays.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when the document ID has been processed.  

| Param | Type | Description |
| --- | --- | --- |
| docID | <code>string</code> | The ID of the document to store. |

<a name="postProxySessionsToInfluxdb"></a>

## postProxySessionsToInfluxdb(userSessions) ⇒ <code>Promise.&lt;void&gt;</code>
Posts proxy sessions data to InfluxDB.

This function takes user session data from Qlik Sense proxy and formats it for storage
in InfluxDB. It handles different versions of InfluxDB (1.x and 2.x) and includes
error handling with detailed logging.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when data has been posted to InfluxDB  

| Param | Type | Description |
| --- | --- | --- |
| userSessions | <code>object</code> | User session data containing information about active sessions |
| userSessions.host | <code>string</code> | The hostname of the server |
| userSessions.virtualProxy | <code>string</code> | The virtual proxy name |
| userSessions.datapointInfluxdb | <code>Array.&lt;object&gt;</code> | Data points formatted for InfluxDB |
| [userSessions.serverName] | <code>string</code> | Server name (for InfluxDB v2) |
| [userSessions.sessionCount] | <code>number</code> | Number of sessions |
| [userSessions.uniqueUserList] | <code>Array.&lt;string&gt;</code> | List of unique users |

<a name="postButlerSOSMemoryUsageToInfluxdb"></a>

## postButlerSOSMemoryUsageToInfluxdb(memory) ⇒ <code>Promise.&lt;void&gt;</code>
Posts Butler SOS memory usage metrics to InfluxDB.

This function captures memory usage metrics from the Butler SOS process itself
and stores them in InfluxDB. It handles both InfluxDB v1 and v2 formats.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when data has been posted to InfluxDB  

| Param | Type | Description |
| --- | --- | --- |
| memory | <code>object</code> | Memory usage data object |
| memory.instanceTag | <code>string</code> | Instance identifier tag |
| memory.heapUsedMByte | <code>number</code> | Heap used in MB |
| memory.heapTotalMByte | <code>number</code> | Total heap size in MB |
| memory.externalMemoryMByte | <code>number</code> | External memory usage in MB |
| memory.processMemoryMByte | <code>number</code> | Process memory usage in MB |

<a name="postUserEventToInfluxdb"></a>

## postUserEventToInfluxdb(msg) ⇒ <code>Promise.&lt;void&gt;</code>
Posts a user event to InfluxDB.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - - A promise that resolves when the event has been posted to InfluxDB.  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>object</code> | The event to be posted to InfluxDB. The object should contain the following properties:   - host: The hostname of the Qlik Sense server that the user event originated from.   - command: The command (e.g. OpenApp, CreateApp, etc.) that the user event corresponds to.   - user_directory: The user directory of the user who triggered the event.   - user_id: The user ID of the user who triggered the event.   - origin: The origin of the event (e.g. Qlik Sense, QlikView, etc.).   - appId: The ID of the app that the event corresponds to (if applicable).   - appName: The name of the app that the event corresponds to (if applicable).   - ua: An object containing user agent information (if available). The object should contain the following properties:     - browser: An object containing information about the user's browser (if available). The object should contain the following properties:       - name: The name of the browser.       - major: The major version of the browser.     - os: An object containing information about the user's OS (if available). The object should contain the following properties:       - name: The name of the OS.       - version: The version of the OS. |

<a name="postLogEventToInfluxdb"></a>

## postLogEventToInfluxdb(msg)
Posts a log event to InfluxDB

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>object</code> | Log event from Butler SOS |

<a name="storeEventCountInfluxDB"></a>

## storeEventCountInfluxDB()
This function retrieves arrays of log and user events, and stores the data in InfluxDB.
If the InfluxDB version is 1.x, it uses the v1 API to write data points for each event.
If the InfluxDB version is 2.x, it uses the v2 API to write data points for each event.
Static tags from the configuration file are added to each data point.
The function logs messages at various stages to provide debugging and status information.
No data is stored if there are no events present.

**Kind**: global function  
**Throws**:

- <code>Error</code> Logs an error message if unable to write data to InfluxDB.

<a name="storeRejectedEventCountInfluxDB"></a>

## storeRejectedEventCountInfluxDB()
This function reads an array of rejected log events from the `rejectedEvents` object,
and stores the data in InfluxDB. The data is written to a measurement named after
the `Butler-SOS.qlikSenseEvents.rejectedEventCount.influxdb.measurementName` config setting.
The function uses the InfluxDB v1 or v2 API depending on the `Butler-SOS.influxdbConfig.version`
config setting.

**Kind**: global function  
**Throws**:

- <code>Error</code> Error if unable to get write API or write data to InfluxDB

<a name="postHealthToMQTT"></a>

## postHealthToMQTT(_host, serverName, body) ⇒ <code>void</code>
Posts health metrics from Qlik Sense engine healthcheck API to MQTT.

This function publishes various metrics (memory usage, CPU usage, sessions, cache, etc.)
to MQTT topics based on the configuration in Butler-SOS.mqttConfig.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| _host | <code>string</code> | The host name or IP (not used) |
| serverName | <code>string</code> | The name of the server, used in MQTT topic path |
| body | <code>object</code> | The health metrics data from Sense engine healthcheck API |

<a name="postUserSessionsToMQTT"></a>

## postUserSessionsToMQTT(host, virtualProxy, body) ⇒ <code>void</code>
Posts user session information to MQTT.

This function publishes information about user sessions to MQTT topics
based on the configuration in Butler-SOS.mqttConfig.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| host | <code>string</code> | The host name of the Qlik Sense server |
| virtualProxy | <code>string</code> | The virtual proxy prefix |
| body | <code>string</code> | JSON string containing user session information |

<a name="postUserEventToMQTT"></a>

## postUserEventToMQTT(msg) ⇒ <code>void</code>
Posts user events from Qlik Sense to MQTT.

This function processes user events (session start/stop, connection open/close)
and publishes them to configured MQTT topics. It supports both general event topics
and specific topics for different event types.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>object</code> | The user event message object |
| msg.messageType | <code>string</code> | The type of message |
| msg.host | <code>string</code> | The host name of the Qlik Sense server |
| msg.command | <code>string</code> | The command (Start session, Stop session, etc.) |
| msg.user_directory | <code>string</code> | The user directory |
| msg.user_id | <code>string</code> | The user ID |
| msg.origin | <code>string</code> | The origin of the event |
| msg.context | <code>string</code> | The context of the event |
| msg.message | <code>string</code> | The message content |
| [msg.appId] | <code>string</code> | Optional app ID |
| [msg.appName] | <code>string</code> | Optional app name |
| [msg.ua] | <code>object</code> | Optional user agent information |

<a name="postLogEventToMQTT"></a>

## postLogEventToMQTT(msg) ⇒ <code>void</code>
Posts log events from Qlik Sense to MQTT.

This function processes log events from various Qlik Sense services
and publishes them to configured MQTT topics. It supports both generic
topics and specific topics for different log levels.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>object</code> | The log event message object |
| msg.source | <code>string</code> | The source of the log event |
| msg.level | <code>string</code> | The log level (e.g., ERROR, WARN, FATAL) |
| msg.message | <code>string</code> | The log message content |
| [msg.timestamp] | <code>string</code> | The timestamp of the log event |
| [msg.hostname] | <code>string</code> | The hostname where the log event occurred |

<a name="getFormattedTime"></a>

## getFormattedTime(serverStarted) ⇒ <code>string</code>
Calculates and formats the uptime of a Qlik Sense engine.

This function takes the server start time from the engine healthcheck API
and calculates how long the server has been running, returning a formatted string.

**Kind**: global function  
**Returns**: <code>string</code> - A formatted string representing uptime (e.g. "5 days, 3h 45m 12s")  

| Param | Type | Description |
| --- | --- | --- |
| serverStarted | <code>string</code> | The server start time in format "YYYYMMDDThhmmss" |

<a name="postHealthMetricsToNewRelic"></a>

## postHealthMetricsToNewRelic(_host, body, tags) ⇒ <code>Promise.&lt;void&gt;</code>
Posts health metrics data from Qlik Sense to New Relic.

This function processes health data from the Sense engine's healthcheck API and
formats it for posting to New Relic. It handles various metrics including:
- CPU usage
- Memory usage
- Cache metrics
- Active/loaded/in-memory apps
- Session counts
- User counts

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when data has been posted to New Relic  

| Param | Type | Description |
| --- | --- | --- |
| _host | <code>string</code> | The hostname or IP of the Qlik Sense server (unused parameter) |
| body | <code>object</code> | The health metrics data from Sense engine healthcheck API |
| tags | <code>object</code> | Tags to associate with the metrics |

<a name="postProxySessionsToNewRelic"></a>

## postProxySessionsToNewRelic(userSessions) ⇒ <code>Promise.&lt;void&gt;</code>
Posts user session metrics data from Qlik Sense to New Relic.

This function processes user session data from the Sense Proxy API and
formats it for posting to New Relic. It includes session counts and
attributes such as virtual proxy and host information.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when data has been posted to New Relic  

| Param | Type | Description |
| --- | --- | --- |
| userSessions | <code>object</code> | Object containing user session metrics data |
| userSessions.serverName | <code>string</code> | Name of the server |
| userSessions.host | <code>string</code> | Hostname of the server |
| userSessions.virtualProxy | <code>string</code> | Virtual proxy prefix |
| userSessions.datapointNewRelic | <code>object</code> | Data formatted for New Relic |
| userSessions.tags | <code>object</code> | Tags associated with the metrics |

<a name="postButlerSOSUptimeToNewRelic"></a>

## postButlerSOSUptimeToNewRelic(fields) ⇒ <code>Promise.&lt;void&gt;</code>
Posts Butler SOS uptime data to New Relic.

This function processes memory usage data from Butler SOS and
formats it for posting to New Relic.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when data has been posted to New Relic  

| Param | Type | Description |
| --- | --- | --- |
| fields | <code>object</code> | Fields to post to New Relic |
| fields.intervalMillisec | <code>number</code> | Interval in milliseconds between posting data to New Relic |
| fields.heapUsed | <code>number</code> | Used heap memory in bytes |
| fields.heapTotal | <code>number</code> | Total heap memory in bytes |
| fields.externalMemory | <code>number</code> | External memory usage in bytes |
| fields.processMemory | <code>number</code> | Process memory usage in bytes |
| fields.uptimeMilliSec | <code>number</code> | Uptime of Butler SOS in milliseconds |

<a name="postUserEventToNewRelic"></a>

## postUserEventToNewRelic(msg) ⇒ <code>Promise.&lt;void&gt;</code>
Posts a user event to New Relic.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when data has been posted to New Relic  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>object</code> | User event from Qlik Sense, Butler-SOS or other sources. |

<a name="sendNRLogEventYesNo"></a>

## sendNRLogEventYesNo(sourceService, sourceLogLevel) ⇒ <code>boolean</code>
Checks if a log event from a given Qlik Sense service should be sent to New Relic.

This function checks the Butler SOS configuration to determine if a log event
from a given Qlik Sense service should be sent to New Relic based on the log level
and the service name.

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the log event should be sent to New Relic, false otherwise  

| Param | Type | Description |
| --- | --- | --- |
| sourceService | <code>string</code> | The name of the Qlik Sense service that generated the log event |
| sourceLogLevel | <code>string</code> | The log level of the log event |

<a name="postLogEventToNewRelic"></a>

## postLogEventToNewRelic(msg) ⇒ <code>Promise.&lt;void&gt;</code>
Posts a log event to New Relic.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>object</code> | Log event from Qlik Sense, Butler-SOS or other sources. |

<a name="setupPromClient"></a>

## setupPromClient(promServer, promPort, promHost) ⇒ <code>Promise.&lt;void&gt;</code>
Sets up the Prometheus client and metrics endpoints.

This function initializes all Prometheus metrics gauges for Butler SOS
and starts an HTTP server that exposes these metrics.

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - A promise that resolves when the setup is complete  

| Param | Type | Description |
| --- | --- | --- |
| promServer | <code>object</code> | The Fastify server instance for the metrics endpoint |
| promPort | <code>number</code> | The port number for the metrics endpoint |
| promHost | <code>string</code> | The host to bind the metrics endpoint to |

<a name="saveHealthMetricsToPrometheus"></a>

## saveHealthMetricsToPrometheus(host, data, labels) ⇒ <code>void</code>
Stores health metrics data from Qlik Sense in Prometheus gauges.

This function takes the health data received from the Sense engine's health check API
and populates the Prometheus gauges with appropriate values, including app metrics,
cache metrics, CPU usage, memory usage, session counts, and user counts.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| host | <code>string</code> | The hostname or IP address of the Sense server |
| data | <code>object</code> | The health metrics data from Sense engine healthcheck API |
| labels | <code>object</code> | Labels to associate with the metrics |

<a name="saveUserSessionMetricsToPrometheus"></a>

## saveUserSessionMetricsToPrometheus(userSessionsData) ⇒ <code>void</code>
Stores user session metrics data in Prometheus gauges.

This function takes the user session data collected from Sense Proxy API
and populates the Prometheus gauges with appropriate values.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| userSessionsData | <code>object</code> | Object containing user session metrics |
| userSessionsData.host | <code>string</code> | The hostname of the Sense server |
| userSessionsData.virtualProxy | <code>string</code> | The virtual proxy name |
| userSessionsData.datapointPrometheus | <code>object</code> | The metrics data formatted for Prometheus |
| userSessionsData.tags | <code>object</code> | Tags to associate with the metrics |

<a name="getCertificates"></a>

## getCertificates(options) ⇒ <code>object</code>
Loads TLS certificates from the filesystem based on the provided options.

**Kind**: global function  
**Returns**: <code>object</code> - Object containing cert, key, and ca properties with certificate contents  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> | Certificate options |
| options.Certificate | <code>string</code> | Path to the client certificate file |
| options.CertificateKey | <code>string</code> | Path to the client certificate key file |
| options.CertificateCA | <code>string</code> | Path to the certificate authority file |

<a name="prepUserSessionMetrics"></a>

## prepUserSessionMetrics(serverName, host, virtualProxy, body, tags) ⇒ <code>Promise.&lt;object&gt;</code>
Prepares user session metrics data for storage/forwarding to various destinations.

This function processes raw session data from Qlik Sense and formats it into
structures suitable for InfluxDB, Prometheus, and New Relic.

**Kind**: global function  
**Returns**: <code>Promise.&lt;object&gt;</code> - Promise resolving to an object containing formatted metrics data  

| Param | Type | Description |
| --- | --- | --- |
| serverName | <code>string</code> | Name of the server |
| host | <code>string</code> | Host name or IP of the server |
| virtualProxy | <code>string</code> | Virtual proxy prefix |
| body | <code>Array</code> | Array of session objects from Qlik Sense |
| tags | <code>object</code> | Tags to associate with the metrics |

<a name="getProxySessionStatsFromSense"></a>

## getProxySessionStatsFromSense(serverName, host, virtualProxy, influxTags) ⇒ <code>Promise.&lt;void&gt;</code>
Retrieves user session statistics from Qlik Sense Proxy Service.

This function makes an API call to the Qlik Sense Proxy API to get information about
active user sessions. It then processes this data and sends it to configured destinations
(MQTT, InfluxDB, New Relic, Prometheus).

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - Promise that resolves when the operation is complete  

| Param | Type | Description |
| --- | --- | --- |
| serverName | <code>string</code> | Name of the Qlik Sense server |
| host | <code>string</code> | Host name or IP of the Qlik Sense server |
| virtualProxy | <code>string</code> | Virtual proxy prefix |
| influxTags | <code>object</code> | Tags to associate with metrics in InfluxDB |

<a name="setupUserSessionsTimer"></a>

## setupUserSessionsTimer() ⇒ <code>void</code>
Sets up a timer to periodically retrieve user session information from Qlik Sense.

This function configures a periodic task that polls all configured Sense servers
and their virtual proxies for user session information. The gathered data is then
processed and sent to the configured destinations.

**Kind**: global function  
<a name="getServerHeaders"></a>

## getServerHeaders(server) ⇒ <code>object</code> \| <code>Array</code>
Extracts HTTP headers from a server configuration object.

This function processes a server configuration object and extracts any custom HTTP headers
defined in the server's headers property. These headers can be used when making API requests
to the server.

**Kind**: global function  
**Returns**: <code>object</code> \| <code>Array</code> - Object with all headers if successful, empty array on error  

| Param | Type | Description |
| --- | --- | --- |
| server | <code>object</code> | Server configuration object |
| server.serverName | <code>string</code> | Name of the server |
| [server.headers] | <code>object</code> | Optional HTTP headers to use with this server |

<a name="getServerTags"></a>

## getServerTags(logger, server) ⇒ <code>object</code> \| <code>Array</code>
Extracts tag values from a server configuration object.

This function processes a server configuration object and extracts tags that can be
used to tag metrics in time series databases or monitoring systems. It always includes
host, server_name, and server_description tags, plus any custom tags defined in the
server's serverTags property.

**Kind**: global function  
**Returns**: <code>object</code> \| <code>Array</code> - Object with all tags if successful, empty array on error  

| Param | Type | Description |
| --- | --- | --- |
| logger | <code>object</code> | Logger object for logging debug and error information |
| server | <code>object</code> | Server configuration object |
| server.host | <code>string</code> | Hostname of the server (may include port) |
| server.serverName | <code>string</code> | Name of the server |
| server.serverDescription | <code>string</code> | Description of the server |
| [server.serverTags] | <code>object</code> | Optional additional tags for the server |

<a name="serviceUptimeStart"></a>

## serviceUptimeStart() ⇒ <code>void</code>
Starts monitoring and reporting of Butler SOS service uptime and memory usage.

This function sets up a timer to periodically log Butler SOS uptime and memory usage statistics.
It also optionally sends this data to InfluxDB and/or New Relic for long-term storage and analysis.
The function uses the frequency and log level settings from the Butler SOS config file.

Data tracked includes:
- Uptime duration (formatted as months, days, hours, minutes, seconds)
- Heap memory usage (used and total)
- External (off-heap) memory
- Total process memory allocation

**Kind**: global function  
<a name="setupAnonUsageReportTimer"></a>

## setupAnonUsageReportTimer([logger], [hostInfo]) ⇒ <code>void</code>
Sets up a timer to periodically send anonymous usage telemetry.

This function initializes the PostHog client and configures a timer to send
anonymous telemetry data every 12 hours. It also sends an initial telemetry
report immediately upon setup.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| [logger] | <code>object</code> | Optional logger object (not used in the function) |
| [hostInfo] | <code>object</code> | Optional host information (not used in the function) |

<a name="udpInitLogEventServer"></a>

## udpInitLogEventServer() ⇒ <code>void</code>
Initializes the UDP server for handling Qlik Sense log events.

This function sets up event handlers for the UDP server that listens for
log events from Qlik Sense services (such as engine, proxy, repository,
and scheduler services).

**Kind**: global function  
<a name="udpInitUserActivityServer"></a>

## udpInitUserActivityServer() ⇒ <code>void</code>
Initializes the UDP server for handling Qlik Sense user activity events.

This function sets up event handlers for the UDP server that listens for
user activity events from Qlik Sense (such as session start/stop and
connection open/close events).

**Kind**: global function  
<a name="processAppSpecificFilters"></a>

## processAppSpecificFilters(eventData, appSpecificFilters) ⇒ <code>boolean</code>
Processes filters for app-specific monitoring configuration

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the event matches app-specific filters  

| Param | Type | Description |
| --- | --- | --- |
| eventData | <code>object</code> | The event data |
| appSpecificFilters | <code>Array</code> | The app specific filter configuration |

<a name="processAllAppsFilters"></a>

## processAllAppsFilters(eventData, allAppsFilters) ⇒ <code>boolean</code>
Processes filters for all-apps monitoring configuration

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the event matches all-apps filters  

| Param | Type | Description |
| --- | --- | --- |
| eventData | <code>object</code> | The event data |
| allAppsFilters | <code>Object</code> | The all-apps filter configuration |

<a name="processObjectIdFilters"></a>

## processObjectIdFilters(objectConfig, eventObjectId) ⇒ <code>boolean</code>
Process object ID filters

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the event passes the filter  

| Param | Type | Description |
| --- | --- | --- |
| objectConfig | <code>object</code> | The object filter configuration |
| eventObjectId | <code>string</code> | The object ID from the event |

<a name="processMethodFilters"></a>

## processMethodFilters(methodConfig, eventMethod) ⇒ <code>boolean</code>
Process method filters

**Kind**: global function  
**Returns**: <code>boolean</code> - True if the event passes the filter  

| Param | Type | Description |
| --- | --- | --- |
| methodConfig | <code>object</code> | The method filter configuration |
| eventMethod | <code>string</code> | The method from the event |

<a name="processEngineEvent"></a>

## processEngineEvent(msg) ⇒ <code>Object</code>
Process engine log events

Message parts for log messages from engine service:
0:  Message type. Always /qseow-engine/
1:  Row number
2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Message. Can contain single quotes and semicolon - handle with care.
9:  Proxy session ID (uuid)
10: QSEoW user directory associated with the event
11: QSEoW user id associated with the event
12: Engine timestamp (ISO8601 date)
13: Process ID (uuid)
14: Engine exe version
15: Server started (ISO8601 date)
16: Entry type
17: Session ID (uuid)
18: App ID (uuid)

**Kind**: global function  
**Returns**: <code>Object</code> - Processed message object  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>Array</code> | The message parts |

<a name="processProxyEvent"></a>

## processProxyEvent(msg) ⇒ <code>object</code>
Process proxy log events

Message parts for log messages from proxy service:
0:  Message type. Always /qseow-proxy/
1:  Row number
2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured. Example: Service.Repository.Repository.Core.Status.ServiceStatusWorker
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Method: 'SendRimQrsStatusRequest'. Failed to retrieve service status from 'http://pro2-win2.lab.ptarmiganlabs.net:4444/status/'. Server host 'pro2-win2.lab.ptarmiganlabs.net'. Error message: 'Unable to connect to the remote server'
9:  Exception message. Empty unless an exception/fault occured in QSEoW.
10: QSEoW user directory associated with the event
11: QSEoW user id associated with the event
12: Command carried out when log event occured
13: Result code for command
14: Origin of log event
15: Context where the log event occured

**Kind**: global function  
**Returns**: <code>object</code> - Processed message object  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>Array</code> | The message parts |

<a name="processQixPerfEvent"></a>

## processQixPerfEvent(msg) ⇒ <code>object</code> \| <code>null</code>
Process QIX performance log events

Message parts for log messages with Qix performance information:
0:  Message type. Always /qseow-qix-perf/
1:  Row number. Ex: 14
2:  ISO8601 formatted timestamp. Example: 20211109T193744.331+0100
3:  Local timezone timestamp. Example: 2021-11-09 19:37:44,331
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured. Example: System.Scheduler.Scheduler.Slave.Tasks.ReloadTask
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Proxy session ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
9:  User directory of the user associated with the event. Ex: LAB
10: User ID of the user associated with the event. Ex: goran
11: Engine timestamp. Example: 2021-11-09T19:37:44.331+01:00
12: Session ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
13: Document ID (=app ID). Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
14: Request ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
15: Method. Ex: Global::OpenApp, Doc::GetAppLayout, GenericObject::GetLayout
16: Process time in milliseconds. Ex: 123
17: Work time in milliseconds. Ex: 123
18: Lock time in milliseconds. Ex: 123
19: Validate time in milliseconds. Ex: 123
20: Traverse time in milliseconds. Ex: 123
21: Handle. Ex: -1, 123
22: Object ID. Ex: df68e14d-1ed0-47c9-bcb6-b37a900441d8, <Unknown>, rwPjBk
23: Net RAM. Ex: 123456 bytes
24: Peak RAM. Ex: 123456 byets
25: Object type. Ex: <Unknown>, AppPropsList, SheetList, StoryList, VariableList, linechart, barchart, map, listbox, CurrentSelection

**Kind**: global function  
**Returns**: <code>object</code> \| <code>null</code> - Processed message object or null if event should be skipped  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>Array</code> | The message parts |

<a name="processRepositoryEvent"></a>

## processRepositoryEvent(msg) ⇒ <code>Object</code>
Process repository log events

Message parts for log messages from repository service:
0:  Message type. Always /qseow-repository/
1:  Row number
2:  ISO8601 formatted timestamp. Example: 20211109T153726.028+0200
3:  Local timezone timestamp. Example: 2021-11-09 15:37:26,028
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured. Example: Service.Repository.Repository.Core.Status.ServiceStatusWorker
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Method: 'SendRimQrsStatusRequest'. Failed to retrieve service status from 'http://pro2-win2.lab.ptarmiganlabs.net:4444/status/'. Server host 'pro2-win2.lab.ptarmiganlabs.net'. Error message: 'Unable to connect to the remote server'
9:  Exception message. Empty unless an exception/fault occured in QSEoW.
10: QSEoW user directory associated with the event. Ex: INTERNAL
11: QSEoW user id associated with the event. Ex: System
12: Command carried out when log event occured. Ex: Check service status
13: Result code for command. Ex: 500
14: Origin of log event. Ex: Not available
15: Context where the log event occured. Ex: /qps/servicestatusworker

**Kind**: global function  
**Returns**: <code>Object</code> - Processed message object  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>Array</code> | The message parts |

<a name="processSchedulerEvent"></a>

## processSchedulerEvent(msg) ⇒ <code>object</code>
Process scheduler log events

Message parts for log messages from scheduler service:
0:  Message type. Always /qseow-scheduler/
1:  Row number. Ex: 14
2:  ISO8601 formatted timestamp. Example: 20211109T193744.331+0100
3:  Local timezone timestamp. Example: 2021-11-09 19:37:44,331
4:  Log level. Possible values are: WARN, ERROR, FATAL
5:  Hostname where the log event occured
6:  QSEoW subsystem where log event occured. Example: System.Scheduler.Scheduler.Slave.Tasks.ReloadTask
7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
8:  Message. Can contain single quotes and semicolon - handle with care. Ex: Message from ReloadProvider: Reload failed in Engine. Check engine or script logs.
9:  Exception message. Empty unless an exception/fault occured in QSEoW.
10: QSEoW user directory of the user associated with the event. Note: For some log events this field is empty. Field #14 is then populated instead. Ex: LAB
11: QSEoW user id of the user associated with the event. Note: For some log events this field is empty. Field #14 is then populated instead. Ex: goran
12: QSEoW directory and userID associated with the event. Note: For some log events this field is empty. Fields #12 and #13 are then populated instead. Ex: LAB\goran
13: Task name associated with the event. Ex: Manually triggered reload of Test failing reloads 2
14: App name associated with the event. Ex: Test failing reloads 2
15: Task ID associated with the event. Ex: dec2a02a-1680-44ef-8dc2-e2bfb180af87
16: App ID associated with the event. Ex: e7af59a0-c243-480d-9571-08727551a66f
17: Execution ID associated with the event. Ex: 4831c6a5-34f6-45bb-9d40-73a6e6992670

**Kind**: global function  
**Returns**: <code>object</code> - Processed message object  

| Param | Type | Description |
| --- | --- | --- |
| msg | <code>Array</code> | The message parts |

<a name="listeningEventHandler"></a>

## listeningEventHandler(_message, _remote) ⇒ <code>void</code>
Handler for UDP server startup event for log events.

This function is called when the UDP server for log events starts listening.
It logs information about the server's address and port.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| _message | <code>\*</code> | The message received (unused in this handler) |
| _remote | <code>\*</code> | Information about the remote sender (unused in this handler) |

<a name="messageEventHandler"></a>

## messageEventHandler(message, _remote) ⇒ <code>Promise.&lt;void&gt;</code>
Handler for UDP messages containing Qlik Sense log events.

This function processes incoming UDP messages from Qlik Sense Enterprise on Windows (QSEoW)
log events. It supports different log sources:
- qseow-engine: Engine service logs
- qseow-proxy: Proxy service logs
- qseow-repository: Repository service logs
- qseow-scheduler: Scheduler service logs
- qseow-qix-perf: QIX performance logs

Each log event type is processed by a specialized handler function, then categorized
(if enabled), and finally forwarded to configured destinations (MQTT, InfluxDB, New Relic).

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - A promise that resolves when processing is complete  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>Buffer</code> | The raw UDP message buffer containing the log event |
| _remote | <code>object</code> | Information about the remote sender (unused in this handler) |

<a name="formatUserFields"></a>

## formatUserFields(msgObj) ⇒ <code>void</code>
Formats and normalizes user directory and user ID fields in log events.

This function ensures consistent representation of user information across different
log event sources by either combining separate user directory and ID fields into a
full user name, or splitting a full user name into its component parts.

**Kind**: global function  
**Returns**: <code>void</code> - - The function updates the provided object directly  

| Param | Type | Description |
| --- | --- | --- |
| msgObj | <code>object</code> | The message object to update |
| [msgObj.user_directory] | <code>string</code> | The user directory component |
| [msgObj.user_id] | <code>string</code> | The user ID component |
| [msgObj.user_full] | <code>string</code> | The combined user name in "directory\id" format |

<a name="listeningEventHandler"></a>

## listeningEventHandler(_message, _remote) ⇒ <code>void</code>
Handler for UDP server startup event for user events.

This function is called when the UDP server for user events starts listening.
It logs information about the server's address and port.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| _message | <code>\*</code> | The message received (unused in this handler) |
| _remote | <code>\*</code> | Information about the remote sender (unused in this handler) |

<a name="messageEventHandler"></a>

## messageEventHandler(message, _remote) ⇒ <code>Promise.&lt;void&gt;</code>
Handler for UDP messages relating to user events from Qlik Sense Proxy service.

This function processes incoming UDP messages containing user activity information,
parses the message format, extracts relevant information such as user, app, browser details,
and forwards the processed data to configured destinations (MQTT, InfluxDB, New Relic).

Message format expected:
- Field 0: Message type (/qseow-proxy-connection/ or /qseow-proxy-session/)
- Field 1: Host
- Field 2: Command (Start session, Stop session, Open connection, Close connection)
- Field 3: User directory
- Field 4: User ID
- Field 5: Origin
- Field 6: Context
- Field 7: Message (may contain UserAgent information)

**Kind**: global function  
**Returns**: <code>Promise.&lt;void&gt;</code> - A promise that resolves when processing is complete  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>Buffer</code> | The raw UDP message buffer |
| _remote | <code>object</code> | Information about the remote sender (unused) |

<a name="setupUdpEventsStorage"></a>

## setupUdpEventsStorage([callbackForTest]) ⇒ <code>number</code> \| <code>undefined</code>
Sets up periodic storage of UDP events statistics to InfluxDB.

This function creates a timer that periodically:
1. Stores event counts (log and user events) to InfluxDB
2. Stores rejected event counts to InfluxDB
3. Clears event counters after they've been stored

**Kind**: global function  
**Returns**: <code>number</code> \| <code>undefined</code> - The interval ID if the timer was set up, or undefined if disabled  

| Param | Type | Description |
| --- | --- | --- |
| [callbackForTest] | <code>function</code> | Optional callback function used for testing |

