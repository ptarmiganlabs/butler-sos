import upath from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import sea from '../sea-wrapper.js';
import { verifyConfigFileSchema, verifyAppConfig } from '../config-file-verify.js';

/**
 * Initializes the configuration by loading and verifying the config file.
 *
 * @param {object} settings - The settings object to populate
 */
export async function initConfig(settings) {
    // Is there a config file specified on the command line?
    let configFileOption;
    settings.configFile = null;
    let configFilePath;
    let configFileBasename;
    let configFileExtension;

    if (settings.options.configfile && settings.options.configfile.length > 0) {
        configFileOption = settings.options.configfile;

        // Full path to config file
        settings.configFile = upath.resolve(settings.options.configfile);
        configFilePath = upath.dirname(settings.configFile);
        configFileExtension = upath.extname(settings.configFile);
        configFileBasename = upath.basename(settings.configFile, configFileExtension);

        if (configFileExtension.toLowerCase() !== '.yaml') {
            console.error('Error: Config file extension must be yaml');
            process.exit(1);
        }

        if (settings.checkFileExistsSync(settings.configFile)) {
            // When running as a packaged app, we need different configuration handling
            if (sea.isSea()) {
                try {
                    // For SEA packages, read the YAML file directly and parse it
                    const yaml = await import('js-yaml');
                    const configFileContent = fs.readFileSync(settings.configFile, 'utf8');

                    // Parse YAML content
                    const parsedConfig = yaml.load(configFileContent);

                    // Set NODE_CONFIG with stringified JSON version of the parsed YAML
                    process.env.NODE_CONFIG = JSON.stringify(parsedConfig);

                    // Prevent config package from looking for deployment config files
                    process.env.NODE_ENV = '';

                    console.log(`SEA: Loaded and parsed YAML config from ${settings.configFile}`);
                } catch (err) {
                    console.error(`SEA: Failed to load or parse config file: ${err.message}`);
                    process.exit(1);
                }
            } else {
                // Standard non-packaged approach
                process.env.NODE_CONFIG_DIR = configFilePath;
                process.env.NODE_ENV = configFileBasename;
            }
        } else {
            console.log('Error: Specified config file does not exist');
            process.exit(1);
        }
    } else {
        // No config file specified on command line.
        // Get value of env variable NODE_ENV
        const env = process.env.NODE_ENV;

        // Get path to config file
        const filename = fileURLToPath(import.meta.url);
        const dirname = upath.dirname(filename);
        // Note: Since this file is now in src/lib/globals, we need to go up 2 levels to reach src
        settings.configFile = upath.resolve(dirname, `../../config/${env}.yaml`);
    }

    // Full path to config file in settings.configFile
    // Verify schema of config file
    if (settings.options.skipConfigVerification) {
        console.warn('MAIN: Skipping config file verification');
    } else {
        const configFileVerify = await verifyConfigFileSchema(settings.configFile);

        if (!configFileVerify) {
            console.error('MAIN: Config file verification failed. Exiting.');
            process.exit(1);
        }
    }

    // Set config strict mode if we're running in SEA mode
    if (settings.isSea) {
        process.env.NODE_CONFIG_STRICT_MODE = 'true';
    } else {
        process.env.NODE_CONFIG_STRICT_MODE = 'false';
    }

    // Load config file
    try {
        settings.config = (await import('config')).default;
    } catch (err) {
        // If SEA we expect this to fail, so just continue.
        // Otherwise, log the error and exit.
        if (!settings.isSea) {
            console.error(`MAIN: Failed to load config file: ${err.message}`);
            process.exit(1);
        }
    }

    // Verify application specific settings and relationships between settings
    if (settings.options.skipConfigVerification) {
        console.warn('MAIN: Skipping application specific config verification');
    } else {
        const appConfigVerify = await verifyAppConfig(settings.config);

        if (!appConfigVerify) {
            console.error('MAIN: Application specific config verification failed. Exiting.');
            process.exit(1);
        }
    }

    // Are we running as standalone app or not?
    settings.isSea = sea.isSea();
    settings.execPath = settings.isSea ? upath.dirname(process.execPath) : process.cwd();

    if (settings.isSea && configFileOption === undefined) {
        // Show help if running as standalone app and mandatory options (e.g. config file) are not specified
        // This part might need access to the 'program' object from command-line.js,
        // but we can just check the options here.
    }

    // Is there a log level file specified on the command line?
    if (settings.options.loglevel && settings.options.loglevel.length > 0) {
        settings.config['Butler-SOS'].logLevel = settings.options.loglevel;
    }
}
