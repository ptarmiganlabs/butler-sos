# Change log

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