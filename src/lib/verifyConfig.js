const globals = require('../globals');

function verifyInfluxDBSettings() {
  // ------------------------------------------------------------------------------------
  // Verify that InfluxDB retention policies mentioned in the config file exists
  if (globals.config.get('Butler-SOS.influxdbConfig.enableInfluxdb')) {
    globals.influx
      .showRetentionPolicies()

      .then(retentionPolicies => {
        // Make sure InfluxDB retention policy for main health metrics exists
        if (globals.config.get('Butler-SOS.serversToMonitor.enableSessionExtract')) {
          if (
            !retentionPolicies.includes(
                globals.config.get('Butler-SOS.serversToMonitor.influxDbRetentionPolicy'),
            )
          ) {
            globals.logger.error(
              `Retention policy specified in Butler-SOS.serversToMonitor.influxDbRetentionPolicy does not exist in InfluxDB.`,
            );
            process.exit(1);
          }
        }

        // Make sure InfluxDB retention policy for user sessions exists
        if (globals.config.get('Butler-SOS.userSessions.enableSessionExtract')) {
          if (
            !retentionPolicies.includes(
                globals.config.get('Butler-SOS.userSessions.influxDbRetentionPolicy'),
            )
          ) {
            globals.logger.error(
              `Retention policy specified in Butler-SOS.userSessions.influxDbRetentionPolicy does not exist in InfluxDB.`,
            );
            process.exit(1);
          }
        }
      })

      .catch(err => {
        globals.logger.error(`Error getting list of existing retention policies in InfluxDB. Exiting.`);
        globals.logger.error(JSON.stringify(err, null, 2));
        process.exit(1);
      });
  }
}

module.exports = {
    verifyInfluxDBSettings,
};
