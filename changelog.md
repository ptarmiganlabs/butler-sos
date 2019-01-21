# Change log

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