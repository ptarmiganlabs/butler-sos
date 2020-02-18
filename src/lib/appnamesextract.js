// Get app names from the Qlik Repository Service (QRS) API

const globals = require('../globals');
const qrsInteract = require('qrs-interact');
const clonedeep = require('lodash.clonedeep');
// var fs = require('fs');
var path = require('path'),
  certPath = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCert')),
  keyPath = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertKey'));
// caFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertCA'));

function setupAppNamesExtractTimer() {
  // Configure timer for getting app names data
  setInterval(function() {
    globals.logger.verbose('APP NAMES: Event started: Get app names');

    getAppNames();
  }, globals.config.get('Butler-SOS.appNames.extractInterval'));
}

function getAppNames() {
  // globals.logger.debug(`APP NAMES: `);

  // Set up Sense repository service configuration
  const configQRS = {
    hostname: globals.config.get('Butler-SOS.appNames.hostIP'),
    certificates: {
      certFile: certPath,
      keyFile: keyPath,
    },
  };

  configQRS.headers = {
    'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
  };

  var qrsInteractInstance = new qrsInteract(configQRS);

  var appList = [];

  qrsInteractInstance
    .Get(`app`)
    .then(result => {
      logger.debug('APP NAMES: result from QRS call=' + result);

      result.body.forEach(function(element) {
        appList.push({
          id: element.id,
          name: element.name,
          description: element.description,
        });
      }, this);

      logger.verbose('APP NAMES: Number of apps: ' + appList.length);
      logger.debug('APP NAMES: App list JSON: ' + JSON.stringify(appList));

      // Only set the global app names variable once all app names have been successfully retrieved
      globals.appNames = clonedeep(appList);

      logger.info('APP NAMES: Done getting app names');
    })
    .catch(err => {
      // Return error msg
      logger.error('APP NAMES: Error: ' + err);
    });
}

module.exports = {
  setupAppNamesExtractTimer,
  getAppNames,
};
