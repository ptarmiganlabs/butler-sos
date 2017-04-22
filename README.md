# Butler SOS
Butler SenseOps Stats ("Butler SOS") is a Node.js service publishing operational Qlik Sense Enterprise metrics to MQTT and Influxdb.  
It uses the Sense healthcheck API to gather operational metrics for the Sense servers specified in the JSON config file.


## Install and setup
* Clone the repository from GitHub to desired location.  
* Make sure Node.js is installed. Butler-SOS has been tested with Node.js 6.10.0. 
* Run "npm install" from within the main butler-sos directory to download and install all Node.js dependencies.
* Make a copy of the config/default_template.json configuration file. Edit the file as needed, save it as "default.json".
Butler SOS will read config settings from default.json.
* Install Influxdb (only needed if data is to be stored in Influxdb, of course).
* Install Mosquitto or another MQTT broker (only needed if data is to be forwarded to MQTT).

### Virtual proxies
Butler SOS relies on a Sense virtual proxy to be available for each Sense server that is to be monitored.  
Existing virtual proxies or new ones can be used - just make sure authentication etc work, and that the host name in the config file points to the correct virtual proxy of each server.
  
For example, let's say the config/default.json config file contains 

    "serversToMonitor": {
        "servers": [{
                "host": "server1.my.domain/virtualproxyname",
                "serverName": "Server 1",
                "availableRAM": 32000
            }]

Butler SOS will then query https://server1.my.domain/virtualproxyname/engine/healthcheck to get operational metrics for the Qlik Sense engine on server1.my.domain.
Make sure that the "virtualproxyname" virtual proxy has authentication suitable to your Qlik Sense setup.

Future versions of Butler SOS may not need these virtual proxies - maybe the needed data can be retrieved straight from the engine. Further work needed to make this happen though.


## Usage
Start Influxdb and Mosquitto (or other MQTT broker).   
Both Influxdb and Mosquitto should work right after installation - for production use their respective config files should of course be edited as needed, to ensure they work as desired.

Starting Influxdb on OSX will look something like this:

![Starting Influxdb](img/influxdb-1.png "Starting Influxdb")



Then start Butler SOS itself from the main butler-sos directory:  
"node butler-sos.js".  
  
If the Influxdb database specified in the config file does not exist, it will be created:

![Starting Butler SOS](img/butler-sos-1.png "Starting Butler SOS")


## Real-time dashboards using Grafana
Once the data exists in Influxdb it can be visualised using Grafana, creating dashboards like this one:

![Grafana dashboard](img/senseops-1.png "SenseOps dashboard using Grafana")
  
A sample dashboard is included in the Grafana directory - it should work out of the box when imported into your Grafana environment.  
Grafana is extremely powerful. Creating automatically updating dashboards for any number of servers is a matter of a few minutes work. Tutorials and docs can be found on their site.


## References
  
Please see https://ptarmiganlabs.com and https://github.com/mountaindude/butler for more in-depth info on the Butler family of micro services.
