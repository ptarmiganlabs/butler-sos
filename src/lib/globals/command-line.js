import { Command, Option } from 'commander';

/**
 * Initializes command line parameters and parses them.
 *
 * @param {object} settings - The settings object to populate
 */
export function initCommandLine(settings) {
    const program = new Command();
    program
        .version(settings.appVersion)
        .name('butler-sos')
        .description(
            `Version: ${settings.appVersion}

Butler SenseOps Stats ("Butler-SOS") is a tool publishing operational Qlik Sense metrics to InfluxDB, Prometheus, New Relic and other destinations.

User events and log events can be forwarded from Sense to Butler SOS and then acted upon there.
Events can be stored in InfluxDB and sent to New Relic.

Add Grafana for great looking dashboards and you get real-time monitoring of what happens inside a Qlik Sense environment.

More info at https://butler-sos.ptarmiganlabs.com`
        )
        .addHelpText(
            'after',
            `
Configuration File:
  Butler SOS requires a configuration file to run. You must specify one using the -c option.
  
  Example config files are included in the distribution ZIP file, as well as online at:
    https://github.com/ptarmiganlabs/butler-sos/tree/master/src/config
  
  For more information visit: https://butler-sos.ptarmiganlabs.com`
        )
        .option('-c, --configfile <file>', 'path to config file (REQUIRED)')
        .addOption(
            new Option('-l, --loglevel <level>', 'log level').choices([
                'error',
                'warn',
                'info',
                'verbose',
                'debug',
                'silly',
            ])
        )
        .option(
            '--new-relic-account-name  <name...>',
            'New Relic account name. Used within Butler SOS to differentiate between different target New Relic accounts'
        )
        .option('--new-relic-api-key <key...>', 'insert API key to use with New Relic')
        .option('--new-relic-account-id <id...>', 'New Relic account ID')
        .option('--skip-config-verification', 'Disable config file verification', false);

    // Parse command line params
    program.parse(process.argv);
    settings.options = program.opts();

    // Check if config file is provided - if not, show help and exit
    if (!settings.options.configfile || settings.options.configfile.length === 0) {
        program.help();
    }
}
