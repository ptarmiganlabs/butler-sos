# Change log

Releases are [available on Github](https://github.com/ptarmiganlabs/butler-sos/releases).

## 5.6.0

### New features

1. . ([#150](https://github.com/ptarmiganlabs/butler/issues/150))

### Fixes and patches

1. Dependencies updated to stay sharp and secure.

### Changed behavior and/or breaking changes

## 5.5.3

- Dependencies updated to stay sharp and secure.

## v5.5.2

- Minor release to bring used libraries and dependencies up to date.

## v5.5.1

- Minor release to bring used libraries and dependencies up to date.

## v5.5.0

- Adding **Docker images for Arm**. Arm CPUs are no longer just something used in mobile gadgets, they are quickly becoming a real option also for server workloads.
For that reason Butler SOS now builds Docker images for the Arm64 and Arm architectures, and publish these on Docker Hub.

## v5.4

* **Sample dashboards** are now built using the brand new, shiny and all together awesome Grafana 7. Did we mention that Grafana 7 is awesome? Awesome.
* Ever wondered how long Butler SOS has been running or how much memory it uses? The new **uptime messages** have you covered. 
* You are properly impressed with the uptime messages - good. Why not store them to Influxdb, so you can also **visualize Butler SOS' own memory use**? It's just a couple of changes in the config file away.
* Don't want to use the **Docker healthchecks**? No reason to if you don't user Docker. You can now turn it off in the config file.
* Ah, you are a serious Sense user and have separate DEV and PROD environments? Good - now Butler SOS tags its own memory use so you can **monitor each Butler SOS instance separately**.
* Who will monitor the monitor? Butler SOS can now **send heartbeats** to customizable URLs at desired intervals. Perfect if you want to monitor Butler SOS using for example [healthchecks.io](https://healthchecks.io). Very, very cool actually.
* **Bugs, bugs and bugs**. The known ones have been fixed. Keep reporting new ones!
* **Update all dependencies** to latest versions, to ensure security concerns are adressed.

## v5.0

This release focuses on features requested by various people over the past couple of years.
They thus have their origins in real-life scenarios at various organisations around the world - hopefully they will also find wider use.

* **FEATURE:** Extract data on what users have open sessions, broken down by virtual proxies.  
This information is quite useful, it for example makes it easier to understand what users are affected by ongoing issues with a particular server, or for notifying all users connected to a particular virtual proxy about a pending server reboot etc. Another use case is to quickly identify when users have unreasonably many open sessions - which may be indicative of a Sense proxy that needs a restart.
The session information is stored in InfluxDB and/or sent as MQTT messages.

* **FEATURE**: More flexible use of InfluxDB, including authenticated (using InfluxDB's standard username/password authentication) access, and configurable port InfluxDB listens on.

* **FEATURE**: When starting Butler SOS for the first time, it will create a new database in InfluxDB. A new, default retention policy will also be created, based on info in Butler SOS' config file.

* **IMPROVEMENT**: When running in a Docker container, there is now a configurable limit to how many and large log files Docker will keep for the Butler SOS container.

* **BUG**: Fixed a couple of minor bugs around how tags are associated with Sense servers. The tagging feature is now pretty robust, and makes it possible to categorise Sense servers in a very flexible way. Those tags can then be used when creatign Grafana dashboards, making it easy to create and/or filter dashboards for all finance servers, all servers in Asia, all development servers etc. Very useful if you have many Sense servers!

* **MISC**: General cleanup of the source code to make it easier to add new features in the future. Docker image is now based on Node 12 (vs Node 8 previously).

## v4.0

**Breaking change!!**

Butler SOS is going through very active development, with significant new features added. Once again, the format of the both the config file and the Influxdb schema is incompatible with previous versions.

The upside is that this version adds several features that make Butler SOS easier to use in large Qlik Sense Enterprise environments with separated development, QA/acceptance, and production environments.

Due to several new settings in the config file, it is recommended to completely review and update the file before deploying v3.2.

* Added optional logging to disk file. If enabled, log files are rotated daily and stored for 30 days, after which they are automatically deleted.
* Improved tagging of data logged in Influxdb. Data can now be tagged with any number of user defined tags. This makes it possible to create much more refined dashboards in Grafana.
NOTE: these configurable tags are not compatible with previous Influx database schemas. The SenseOps database in Influxdb must be deleted before deploying Butler SOS v3.2. Next time Butler SOS is started a new SenseOps database in Influxdb will be created.
* Let the user control (by means of properties in the config file) which entries are extracted from Qlik Sense log db. This is configured on a per log level basis, for example "extract warning and errors, but not info messages".

## v3.1

**Breaking change!!**

Once again some changes that require change in the underlyding database used by Butler SOS.
The procedure for upgrading is the same as for V3.0: The simplest option is to drop the InfluxDB database and start anew with an empty database. You will loose past logging history, but as Butler SOS deals with *operational* monitoring that should in most cases be fine.

* FEATURE: New options influxdbConfig.includeFields.* control whether Butler SOS should store lists of currently loaded, active and in_memory apps in InfluxDB. Storing this data can be increadibly helpful when trying to understand what apps cause issues (e.g. exessive RAM usage). **NOTE** that enabling these features may significantly increase the amount of data stored in InfluxDB!

## v3.0

**Breaking change!!**

The format of the database where Butler SOS stores the data it retreives has been slightly modified. v3.0 will not work properly with a database created by earlier Butler SOS versions. See [readme file](https://github.com/ptarmiganlabs/butler-sos/blob/master/README.md) for further info on dealing with this.

v3.0 is a major rewrite of Butler SOS. Most changes are under the hood, with a couple of exceptions:

* FEATURE: New per-server config option "serverGroup". Use this to group or categorize servers, for example as being part of a production vs development Qlik Sense cluster.
* FEATURE: New config option "queryPeriod" for controlling how far back querying for Sense log entries should be done.

## v2.6

This release focuses on Docker.
When running as a Docker container, Butler SOS will now use Docker health checks to let Docker know that all is well.

* FEATURE: Add support for Docker health checks.
* BUG: Only attempt Influxdb connection when Influxdb is actually enabled in Butler SOS config file.
* Misc upgrades of dependencies.

## v2.5

Improved logging.

## v2.3 - v2.5

Various minor changes, for example making reading data from Sense's log db optional, and inclusion of the "saturated" metric from the health API.

## v2.2

1. Running Butler SOS in a Docker container
2. Documentation refactoring
3. Updated all dependencies to (at the time) latest versions

## v1

First version. Works with Qlik Sense Enterprise pre Feb 2018.

---

For information please visit the [releases page](https://github.com/ptarmiganlabs/butler-sos/releases).