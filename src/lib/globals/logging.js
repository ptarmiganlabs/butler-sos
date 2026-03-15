import winston from 'winston';
import 'winston-daily-rotate-file';
import upath from 'path';

/**
 * Initializes the logger and its transports.
 *
 * @param {object} settings - The settings object to populate
 */
export function initLogging(settings) {
    // Set up logger with timestamps and colors, and optional logging to disk file
    settings.logTransports = [];

    settings.logTransports.push(
        new winston.transports.Console({
            name: 'console',
            level: settings.config.get('Butler-SOS.logLevel'),
            format: winston.format.combine(
                winston.format.errors({ stack: true }),
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
            ),
        })
    );

    if (
        settings.config['Butler-SOS'].logLevel === 'verbose' ||
        settings.config['Butler-SOS'].logLevel === 'debug' ||
        settings.config['Butler-SOS'].logLevel === 'silly'
    ) {
        // Are we in a packaged app?
        if (settings.isSea) {
            console.log(`Running in packaged app. Executable path: ${settings.execPath}`);
        } else {
            console.log(
                `Running in non-packaged environment. Executable path: ${settings.execPath}`
            );
        }

        console.log(
            `Log file directory: ${upath.join(settings.execPath, settings.config.get('Butler-SOS.logDirectory'))}`
        );

        console.log(`upath.dirname(process.execPath): ${upath.dirname(process.execPath)}`);
        console.log(`process.cwd(): ${process.cwd()}`);
    }

    if (settings.config.get('Butler-SOS.fileLogging')) {
        settings.logTransports.push(
            new winston.transports.DailyRotateFile({
                dirname: upath.join(
                    settings.execPath,
                    settings.config.get('Butler-SOS.logDirectory')
                ),
                filename: 'butler-sos.%DATE%.log',
                level: settings.config.get('Butler-SOS.logLevel'),
                datePattern: 'YYYY-MM-DD',
                maxFiles: '30d',
            })
        );
    }

    settings.logger = winston.createLogger({
        transports: settings.logTransports,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
        ),
    });

    // Show contents of environment variables controlling config file location and name
    settings.logger.debug(`NODE_CONFIG_DIR: ${process.env.NODE_CONFIG_DIR}`);
    settings.logger.debug(`NODE_ENV: ${process.env.NODE_ENV}`);

    // Output config file name and path to log
    settings.logger.info(`Using config file: ${settings.configFile}`);

    /**
     * Returns the current logging level.
     *
     * @returns {string} The current logging level.
     */
    settings.getLoggingLevel = () =>
        settings.logTransports.find((transport) => transport.name === 'console').level;
}
