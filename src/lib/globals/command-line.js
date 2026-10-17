import { styleText } from 'node:util';
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

    // Check if config file is provided - if not, show help, say what is missing and exit with
    // a failure code, so that restart policies and scripts can tell Butler SOS did not start
    if (!settings.options.configfile || settings.options.configfile.length === 0) {
        program.outputHelp({ error: true });
        program.error(formatErrorBlock(missingConfigFileMessage(process.env), process.stderr), {
            code: 'butler-sos.missingConfigFile',
        });
    }
}

/**
 * Frames an error message with rules above and below, so it stands out at the end of the help
 * text, and shows its first line in bold red.
 *
 * Colour is only used when the stream is a terminal that supports it, as its hasColors() reports
 * (which also honours NO_COLOR, FORCE_COLOR=0 and TERM=dumb), so logs and redirected output stay
 * plain text. The decision is made here rather than left to util.styleText, which colours any
 * stream at all when FORCE_COLOR is set.
 *
 * @param {string} message - The error message; its first line is the headline
 * @param {object} stream - The stream the message will be written to, normally process.stderr
 * @returns {string} The framed message
 */
export function formatErrorBlock(message, stream) {
    const lines = message.split('\n');
    const longestLine = Math.max(...lines.map((line) => line.length));
    const width = Math.min(longestLine, stream.columns || 100);

    const useColour =
        stream.isTTY === true && typeof stream.hasColors === 'function' && stream.hasColors();
    /**
     * Applies a style when colour is used, and returns the text unchanged otherwise.
     *
     * @param {string|string[]} format - util.styleText format(s)
     * @param {string} text - The text to style
     * @returns {string} The text, styled or not
     */
    const style = (format, text) =>
        useColour ? styleText(format, text, { validateStream: false }) : text;

    const rule = style('red', '='.repeat(width));
    const headline = style(['bold', 'red'], lines[0]);

    return ['', rule, headline, ...lines.slice(1), rule].join('\n');
}

/**
 * Builds the error shown when no config file was given on the command line.
 *
 * `npm run butler-sos -c <file>` is an easy mistake to make: npm reads `-c` as its own `--call`
 * option, so neither the option nor the file name reach Butler SOS. npm leaves the value it took
 * in the npm_config_call environment variable, which is used here to explain what happened.
 *
 * @param {object} env - Environment variables, normally process.env
 * @param {string} [platform] - Operating system, as process.platform; decides how the file name
 *   is quoted in the suggested command
 * @returns {string} The error message
 */
export function missingConfigFileMessage(env, platform = process.platform) {
    let message = `Error: No config file specified.
Use -c <file> or --configfile <file> to point Butler SOS at one.`;

    // npm_command is checked too, as `npm exec -c '<command>'` also sets npm_config_call
    if (env.npm_config_call && ['run', 'run-script'].includes(env.npm_command)) {
        const scriptName = env.npm_lifecycle_event || 'butler-sos';
        message += `

npm read "-c ${env.npm_config_call}" as one of its own options,
so the config file never reached Butler SOS.
Add -- after the script name to pass options on to Butler SOS:
  npm run ${scriptName} -- -c ${quoteShellArgument(env.npm_config_call, platform)}`;
    }

    return message;
}

/**
 * Quotes a command-line argument for a command shown to the user to copy, if it needs quoting.
 *
 * npm keeps a file name without the quotes it was typed with, so `-c "my config.yaml"` reaches
 * us as `my config.yaml`. Shown unquoted, it would be split into two arguments. Single quotes
 * keep everything literal in macOS and Linux shells. Windows' cmd.exe has no single quotes, but
 * double quotes work there and in PowerShell, and Windows file names cannot contain a double
 * quote.
 *
 * @param {string} value - The argument
 * @param {string} platform - Operating system, as process.platform
 * @returns {string} The argument, quoted if needed
 */
function quoteShellArgument(value, platform) {
    if (/^[\w./\\:@+=,-]+$/.test(value)) {
        return value;
    }

    if (platform === 'win32') {
        return `"${value}"`;
    }

    return `'${value.replaceAll("'", `'\\''`)}'`;
}
