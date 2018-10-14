# Butler SOS v2

[![NSP Status](https://nodesecurity.io/orgs/ptarmiganlabscom/projects/adfd09d2-140c-42ae-9f2f-6376c6d45f6d/badge)](https://nodesecurity.io/orgs/ptarmiganlabscom/projects/adfd09d2-140c-42ae-9f2f-6376c6d45f6d)
  
![Butler SOS](img/butler-sos-small.png)  

Butler SenseOps Stats ("Butler SOS") is a Node.js service publishing operational Qlik Sense Enterprise metrics to MQTT and Influxdb.  
It uses the [Sense healthcheck API](http://help.qlik.com/en-US/sense-developer/November2017/Subsystems/EngineAPI/Content/GettingSystemInformation/HealthCheckStatus.htm) to gather operational metrics for the Sense servers specified in the YAML config file.  
It also pulls warnings and errors from [Sense's Postgres logging database](http://help.qlik.com/en-US/sense/November2017/Subsystems/PlanningQlikSenseDeployments/Content/Deployment/Qlik-Logging-Service.htm), and forwards these to Influx and MQTT.

**Why a separate tool for this?**  
Good question. While Qlik Sense ships with a great Operations Monitor application, it is not useful or intended for real-time operational monitoring.  
It is great for retrospective analysis of what happened in a Qlik Sense environment, but for a real-time view something else is needed - enter Butler SOS.

The most interesting use of Butler SOS is probably to create real-time dashboards based on the data in the Influx database, showing operational metrics for a Qlik Sense Enterprise environment.  
A fully interactive demo dashboard is available [here](https://snapshot.raintank.io/dashboard/snapshot/1hNwAmi50lykKYXr6mswhKmll9myrH20?orgId=2).  
  
Sample screen shots:

![Grafana dashboard](img/SenseOps_dashboard_3.png "SenseOps dashboard showing errors and warnings, using Grafana")

![Grafana dashboard](img/SenseOps_dashboard_4.png "SenseOps dashboard showing Qlik Sense metrics, using Grafana")

Butler SOS can however also send the data to [MQTT](https://en.wikipedia.org/wiki/MQTT), for use in any MQTT enabled tool or system.

## What's new

Please see the [change log](https://github.com/ptarmiganlabs/butler-sos/blob/master/changelog.md) for a comprehensive list of changes.

Highlights in the recent releases are

### v2.2

* Added support for running Butler SOS in Docker.
* Updated package dependenies.

### v2.1 and v2.1.1

* Updated package dependecies
* Tested with Node.js 8.11.2 (LTS), Influxdb 1.5.2, Grafana 5.1.3

### v2

* Close to real-time metrics on warnings and errors appearing in the QLik Sense logs
* Improved posting of data to MQTT
* YAML config files instead of JSON
* New and more comprehensive sample Grafana dashboards
* A [demo dashboard](https://snapshot.raintank.io/dashboard/snapshot/1hNwAmi50lykKYXr6mswhKmll9myrH20?orgId=2) that anyone can try out

## Install and setup

* Butler SOS has been tested with Qlik Sense Enterprise up until and including September 2018. Butler SOS uses core Sense APIs that are unlikely to change in future Sense versions. For that reasons Butler SOS is likely to work also with future Sense versions.

### Running as a native Node.js app

* Clone [the repository](https://github.com/ptarmiganlabs/butler-sos) from GitHub to desired location.
* Make sure [Node.js](https://nodejs.org) is installed. Butler-SOS has been tested with Node.js 8.11.4.
* Run "npm install" from within the main butler-sos directory to download and install all Node.js dependencies.
* Make a copy of the [config/default_template.yaml](https://github.com/ptarmiganlabs/butler-sos/blob/master/config/default_template.yaml) configuration file. Edit the file as needed, save it as "production.yaml" in the ./config directory. Butler SOS will read its config settings from this file.
* [Export certificates](http://help.qlik.com/en-US/sense/November2017/Subsystems/ManagementConsole/Content/export-certificates.htm) from Qlik Sense QMC, then place them in the ./config/certificate folder under Butler SOS' main folder.
* Install [Influxdb](https://docs.influxdata.com/influxdb/v1.4/introduction) (only needed if data is to be stored in Influxdb).
* Install [Mosquitto](https://mosquitto.org) or another MQTT broker (only needed if data is to be forwarded to MQTT). If you already have an MQTT broker you do not need to install a new one, Butler SOS can use the existing one.

The `production.yaml` file can be named anything, as long as it matches the value of the `NODE_ENV` environment variable.  
For example, if the config file is called `production.yaml`, the NODE_ENV environment variable should be set to 'production':

Windows: `set NODE_ENV=production`  
Linux: `export NODE_ENV=production`

#### Configuration files

As of version 2 of Butler SOS there are several breaking changes in the configuration file:

* The configuration file format is now YAML rather than JSON. YAML is more human readable and compact  compared to JSON. It also allows comments to be used.  
* Virtual proxies are no longer used to get the Sense healthcheck data.  
Instead of virtual proxies the main Qlik Sense Engine Service (QES) is called on TCP port 4747  to get the health data of each Sense server that should be monitored.  
A consequence of this is that certificates are now used to authenticate with Qlik Sense, rather than the security-by-obscurity that was the most commonly used security solution in the past for Butler SOS.
Please note that the path to these certificates must be properly configured in the config file's Butler-SOS.cert section.  

When using certificates to authenticate with the Qlik engine, the ```serversToMonitor``` section of the config file could look like this:

``` yaml
serversToMonitor:
    # How often (milliseconds) should the healthcheck API be polled?
    pollingInterval: 5000

    # Sense Servers that should be queried for healthcheck data
    servers:
    - host: server1.company.net:4747
      serverName: Server1
      availableRAM: 32000
    - host: server2.company.net:4747
      serverName: Server2
      availableRAM: 24000

```

Pleae refer to the config/default_template.yaml file for further configuration instructions.

#### Where should Butler SOS run?

Given that Butler SOS can be deployed in so many different configurations, it is difficult to give precise instructions that will work for all configurations. Especially the fact that Butler SOS uses certificates to authenticate with Sense is a complicating factor. Certificates are (when correctly used) great for securing systems, but they can alse cause headaches.

First we must recognize that Sense uses [self signed certificates](https://en.wikipedia.org/wiki/Self-signed_certificate). This is fine, and as long as you work on a server where Sense Enterprise is installed, that server will have the Sense-provided Certificate Authority (CA) certificate installed.

This means that the easiest option for getting Butler SOS up and running is usually to install it on one of your Sense servers.

That said, it is probably better system design to run Butler SOS (and maybe other members of the [Butler family](https://github.com/ptarmiganlabs)) on their own server, maybe using some flavour of Linux (lower cost compared to Windows).  
In this case you might want to consider exporting the Sense CA certificate from one of your Sense servers, and then install it on the Linux server.
This *should* technically not be needed for Butler SOS to work correctly - as long as you specify the correct root.pem file in the Butler SOS config file, you should be ok.

If you specify an incorrect root CA certificate file in the ```clientCertCA``` config option, you will get an error like this:

``` bash
2018-05-23T20:36:44.393Z - error: Error: Error: unable to verify the first certificate
    at TLSSocket.<anonymous> (_tls_wrap.js:1105:38)
    at emitNone (events.js:106:13)
    at TLSSocket.emit (events.js:208:7)
    at TLSSocket._finishInit (_tls_wrap.js:639:8)
    at TLSWrap.ssl.onhandshakedone (_tls_wrap.js:469:38)
2018-05-23T20:36:49.164Z - verbose: Event started: Query log db
2018-05-23T20:36:49.180Z - verbose: Event started: Statistics collection
```

A general note on host names is also relevant.  
If you specify a server name of "myserver.company.com" while exporting certificates from the QMC, you **must** use that same server name in the Butler SOS config file.  Failing to do so will (most likely) result in an error:

``` bash
2018-05-23T19:51:03.087Z - error: Error: Error: Hostname/IP doesn't match certificate's altnames: "Host: serveralias.company.net. is not in the cert's altnames: DNS:myserver.company.com"
    at Object.checkServerIdentity (tls.js:223:17)
    at TLSSocket.<anonymous> (_tls_wrap.js:1111:29)
    at emitNone (events.js:106:13)
    at TLSSocket.emit (events.js:208:7)
    at TLSSocket._finishInit (_tls_wrap.js:639:8)
    at TLSWrap.ssl.onhandshakedone (_tls_wrap.js:469:38)
2018-05-23T19:51:07.701Z - verbose: Event started: Statistics collection
```

#### Postgres log database

The config file allows you to set how often Butler should query the Sense log database for warnings and errors. In order to get real-time (-ish) notifications of warnings and errors, you should set the polling frequency to a reasonably low level. On the other hand, this polling will consume server resources and put some load on the Sense logging database - i.e. you should poll too often...  
Experience shows that polling every 15-30 seconds work well and doesn't put too much load on the database.
  
There is one caveat to be aware of when it comes to the ```Butler-SOS.logdb.pollingInterval``` setting:  
By default Butler SOS will query the log database for any warnings and errors that have occured during the last 2 minutes. The reason for having such a limit is simply to limit the query load on the Postgres server.  
This however also means that you should **not** configure a polling frequency of 2 minutes or more, as such a setting would mean that Butler SOS would not capture all warnings and errors.  
  
If you need a log database polling frequency longer than 2 minutes, you also need to change the SQL query in the butler-sos.js file to a longer time window.

#### Running Butler SOS

Start Butler SOS itself from the main butler-sos directory:  

```node butler-sos.js```  
  
If the Influxdb database specified in the config file does not exist, it will be created.

![Starting Butler SOS](img/butler-sos-cli-1.png "Starting Butler SOS")

Here we see how two servers are queried for data.  
The responses are retrived asyncronously as they arrive from the different servers.  
Finally, the data is stored to Influxdb and sent as MQTT messages.


### Running in a Docker container

This is in most cases the preferred way of running Butler SOS:

* Very quick to get started. Usually it takes just a few minutes to set up a Butler SOS instance in Docker.
* No need to install Node.js on your server(s). Less security, performance and maintenance concerns.
* Make use of your existing Docker runtime environments, or use those offered by Amazon, Google, Microsoft etc.
* Benefit from the extremely comprehensive tools ecosystem (monitoring, deployment etc) that is available for Docker.
* Updating Butler SOS to the latest version is as easy as stopping the container, then doing a "docker pull ptarmiganlabs/butler-sos:latest", and finally starting the container again.

Installing and getting started with Butler SOS in Docker can look something like this:

Create a directory for Butler SOS. Config files and logs will be stored here.

```bash

proton:code goran$ mkdir -p butler-sos-docker/config/certificate
proton:code goran$ cd butler-sos-docker
proton:butler-sos-docker goran$

```

* Copy the [YAML config file](https://github.com/ptarmiganlabs/butler-sos/blob/master/config/default_template.yaml) from the GitHub repository into the ./config directory, rename it to `production.yaml` (or something else, as long as it matches the NODE_ENV environment variable) and edit it as needed. Note that for the Docker setup the path to certificates should be `/nodeapp/config/certificate/` (this is the Docker container's internal path to the certificate directory).
* Copy [docker-compose.yml](https://github.com/ptarmiganlabs/butler-sos/blob/master/docker-compose.yml) from the GitHub repository to the main Butler SOS directory.
* Export certifiates from the QMC in Qlik Sense Enterprise, place them in the `./config/certificate` directory.

Let's do this one step at a time.  
What files are there?

```bash

proton:butler-sos-docker goran$ ls -la
total 8
drwxr-xr-x   4 goran  staff   128 Oct 14 17:10 .
drwxr-xr-x  51 goran  staff  1632 Oct 14 17:08 ..
drwxr-xr-x   3 goran  staff    96 Oct 14 17:08 config
-rw-r--r--@  1 goran  staff   357 Oct 14 17:10 docker-compose.yml
proton:butler-sos-docker goran$
proton:butler-sos-docker goran$ ls -la config/
total 8
drwxr-xr-x  4 goran  staff   128 Oct 14 17:11 .
drwxr-xr-x  4 goran  staff   128 Oct 14 17:10 ..
drwxr-xr-x  2 goran  staff    64 Oct 14 17:08 certificate
-rw-r--r--@ 1 goran  staff  1335 Oct 14 17:11 production.yaml
proton:butler-sos-docker goran$
proton:butler-sos-docker goran$ ls -la config/certificate/
total 24
drwxr-xr-x  5 goran  staff   160 Oct 14 17:13 .
drwxr-xr-x  4 goran  staff   128 Oct 14 17:11 ..
-rw-r--r--@ 1 goran  staff  1166 Oct 14 17:13 client.pem
-rw-r--r--@ 1 goran  staff  1702 Oct 14 17:13 client_key.pem
-rw-r--r--@ 1 goran  staff  1192 Oct 14 17:13 root.pem
proton:butler-sos-docker goran$

```

What do the config files look like?

```bash

proton:butler-sos-docker goran$ cat config/production.yaml
Butler-SOS:
  # Possible log levels are silly, debug, verbose, info, warn, error
  logLevel: debug

  # Qlik Sense logging db config parameters
  logdb:
    # How often (milliseconds) should Postgres log db be queried for warnings and errors?
    pollingInterval: 15000
    host: <IP or FQDN of Qlik Sense logging db>
    port: 4432
    qlogsReaderUser: qlogs_reader
    qlogsReaderPwd: <pwd>

  # Certificates to use when querying Sense for healthcheck data. Get these from the Certificate Export in QMC.
  cert:
    clientCert: /nodeapp/config/certificate/client.pem
    clientCertKey: /nodeapp/config/certificate/client_key.pem
    clientCertCA: /nodeapp/config/certificate/root.pem

  # MQTT config parameters
  mqttConfig:
    enableMQTT: true
    brokerHost: <IP of MQTT server>
    brokerPort: 1883
    # Topic should end with /
    baseTopic: butler-sos/

  # Influx db config parameters
  influxdbConfig:
    enableInfluxdb: true
    hostIP: <IP or FQDN of Influxdb server>
    dbName: SenseOps

  serversToMonitor:
    # How often (milliseconds) should the healthcheck API be polled?
    pollingInterval: 5000

    # Sense Servers that should be queried for healthcheck data
    servers:
    - host: <server1.my.domain>
      serverName: <server1>
      availableRAM: 32000
    - host: <server2.my.domain>
      serverName: <server2>
      availableRAM: 24000
proton:butler-sos-docker goran$

```

What does the docker-compose.yml file look like?

```bash

proton:butler-sos-docker goran$ cat docker-compose.yml
# docker-compose.yml
version: '2.2'
services:
  butler-sos:
    image: ptarmiganlabs/butler-sos:latest
    init: true
    container_name: butler-sos
    restart: always
    volumes:
      # Make config file accessible outside of container
      - "./config:/nodeapp/config"
    environment:
      - "NODE_ENV=production"
    logging:
      driver: json-file
proton:butler-sos-docker goran$

```

Ok, all good. Let's start Butler SOS using docker-compose:

```bash

proton:butler-sos-docker goran$ docker-compose up
Pulling butler-sos (ptarmiganlabs/butler-sos:latest)...
latest: Pulling from ptarmiganlabs/butler-sos
f189db1b88b3: Already exists
3d06cf2f1b5e: Already exists
687ebdda822c: Already exists
99119ca3f34e: Already exists
e771d6006054: Already exists
b0cc28d0be2c: Already exists
7225c154ac40: Already exists
7659da3c5093: Already exists
0eb542f4d7f6: Pull complete
47df4c8bbfb8: Pull complete
12b6708ead49: Pull complete
d92f2cc6eee5: Pull complete
2565ce6638be: Pull complete
Digest: sha256:959f7d51e9bb60d55533921eb10c7da2c15438c0b87886dc9b6dd9824e4aa348
Status: Downloaded newer image for ptarmiganlabs/butler-sos:latest
Creating butler-sos ... done
Attaching to butler-sos
butler-sos    | 2018-10-14T18:27:54.794Z - info: Starting Butler SOS
butler-sos    | 2018-10-14T18:27:54.797Z - info: Log level is: debug
butler-sos    | 2018-10-14T18:27:54.855Z - info: Connected to Influx database.
butler-sos    | 2018-10-14T18:27:59.805Z - verbose: Event started: Statistics collection
butler-sos    | 2018-10-14T18:27:59.805Z - verbose: Getting stats for server: sense1
butler-sos    | 2018-10-14T18:27:59.808Z - debug: URL=https://sense1.int.ptarmiganlabs.net:4747/engine/healthcheck/
butler-sos    | 2018-10-14T18:27:59.876Z - verbose: Received ok response from sense1
butler-sos    | 2018-10-14T18:27:59.877Z - debug:  version=12.212.4, started=20181003T222957.000+0200, committed=212.2109375, allocated=444.609375, free=4737.62890625, total=0, active=0, total=0, active_docs=[], loaded_docs=[], in_memory_docs=[], calls=3642, selections=0, active=0, total=0, hits=0, lookups=0, added=0, replaced=0, bytes_added=0, saturated=false
butler-sos    | 2018-10-14T18:27:59.878Z - debug: Calling MQTT posting method
butler-sos    | 2018-10-14T18:27:59.881Z - debug: Calling Influxdb posting method
butler-sos    | 2018-10-14T18:27:59.981Z - verbose: Sent health Influxdb: sense1
butler-sos    | 2018-10-14T18:28:04.825Z - verbose: Event started: Statistics collection
butler-sos    | 2018-10-14T18:28:04.827Z - verbose: Getting stats for server: sense1
butler-sos    | 2018-10-14T18:28:04.828Z - debug: URL=https://sense1.int.ptarmiganlabs.net:4747/engine/healthcheck/
butler-sos    | 2018-10-14T18:28:04.860Z - verbose: Received ok response from sense1
butler-sos    | 2018-10-14T18:28:04.861Z - debug:  version=12.212.4, started=20181003T222957.000+0200, committed=212.2109375, allocated=444.609375, free=4737.62890625, total=0, active=0, total=0, active_docs=[], loaded_docs=[], in_memory_docs=[], calls=3642, selections=0, active=0, total=0, hits=0, lookups=0, added=0, replaced=0, bytes_added=0, saturated=false
butler-sos    | 2018-10-14T18:28:04.862Z - debug: Calling MQTT posting method
butler-sos    | 2018-10-14T18:28:04.864Z - debug: Calling Influxdb posting method
butler-sos    | 2018-10-14T18:28:04.915Z - verbose: Sent health Influxdb: sense1
...
...

```

Once everything everything looks good you can start the container in daemon mode (i.e. running unattended in the background):

```bash

proton:butler-sos-docker goran$ docker-compose up -d
Starting butler-sos ... done
proton:butler-sos-docker goran$

```


Setting the log level to info in the config file will reduce log output.

## Influxdb, Mosquitto & Grafana

Start Influxdb and Mosquitto (or other MQTT broker). Ideally these should start automatically on server boot, please refer to the documentation for those tools for details on how to achieve this.  
Both these tools can be run in Docker - this is actually a very good (and usually preferred) setup. Once again, please see the documentation for each tool for instructions.

Both Influxdb and Mosquitto should work right after installation - for production use their respective config files should be reviewed and edited as needed, with respect to use of https etc.

Starting Influxdb on OSX will look something like this (the screenshot is for an older Influx 1.2.3 version, the most recent version might output different logs):

![Starting Influxdb](img/influxdb-1.png "Starting Influxdb")

### Influxdb and Grafana Installation cheat sheet

By popular request, here are the commands needed to install Influx and Grafana.  
The commands below assume you are using a Mac and have the [Homebrew](https://brew.sh/) package manager installed.  
You can also install the software on a Linux server (apt-get install ... on Debian etc). Windows might be possible, but it is usually easier to spin up a small Linux server in a Docker container on your Windows PC, compared to installing the actual software on Windows...  
Using Docker containers is actually a great way to play around with software, without clogging down your own computer. Butler SOS is in fact developed using Influx, Grafana and MQTT running in Docker containers.
  
Install and start Influx:  

    brew install influxdb
    influxd -config /usr/local/etc/influxdb.conf

Install and start Grafana

    brew install grafana
    brew services start grafana

Connect to Grafana by visiting http://localhost:3000
Default username/pwd is admin/admin.

## Real-time dashboards using Grafana

Once the data exists in Influxdb it can be visualised using [Grafana](https://grafana.com).
  
A sample dashboard is included in the Grafana directory. Import it into your Grafana environment, then modify it to reflect your server host names, after which it should show real-time metrics for your Sense servers.  
Grafana is extremely powerful. Creating automatically updating dashboards for any number of servers is a matter of a few minutes work. Tutorials and docs can be found on their site.

## References
  
Please see [https://ptarmiganlabs.com](https://ptarmiganlabs.com/blog/2017/04/24/butler-sos-real-time-server-stats-qlik-sense/) and [https://github.com/ptarmiganlabs/butler](https://github.com/ptarmiganlabs/butler) for more in-depth info on the Butler family of micro services for Qlik Sense.
  
At [https://senseops.rocks](https://senseops.rocks) you also find thoughts on using DevOps best practices in the Qlik Sense ecosystem.
