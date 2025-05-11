import Fastify from 'fastify';
import FastifyRateLimit from '@fastify/rate-limit';
import FastifyStatic from '@fastify/static';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import handlebars from 'handlebars';

import globals from '../globals.js';
import configObfuscate from './config-obfuscate.js';

export async function setupConfigVisServer(logger, config) {
    try {
        // Register rate limit for API
        // 0 means no rate limit

        // This code registers the FastifyRateLimit plugin.
        // The plugin limits the number of API requests that
        // can be made from a given IP address within a given
        // time window.

        const configVisServer = Fastify({ logger: true });

        // Set Fastify log level based on log level in Butler config file
        const currLogLevel = globals.getLoggingLevel();
        if (currLogLevel === 'debug' || currLogLevel === 'silly') {
            configVisServer.log.level = 'info';
        } else {
            configVisServer.log.level = 'silent';
        }

        // 30 requests per minute
        await configVisServer.register(FastifyRateLimit, {
            max: 300,
            timeWindow: '1 minute',
        });

        // Add custom error handler for 429 errors (rate limit exceeded)
        configVisServer.setErrorHandler((error, request, reply) => {
            if (error.statusCode === 429) {
                globals.logger.warn(
                    `CONFIG VIS: Rate limit exceeded for source IP address ${request.ip}. Method=${request.method}, endpoint=${request.url}`
                );
            }
            reply.send(error);
        });

        // This loads all plugins defined in plugins.
        // Those should be support plugins that are reused through your application
        await configVisServer.register(import('../plugins/sensible.js'), { options: {} });
        await configVisServer.register(import('../plugins/support.js'), { options: {} });

        // Create absolute path to the html directory
        // appBasePath points to the directory where this file (app.js) is located, taking into account
        // if the app is running as a packaged app or as a Node.js app.
        globals.logger.verbose(`----------------2: ${globals.appBasePath}`);

        // Get directory contents of dirname
        const dirContents = fs.readdirSync(globals.appBasePath);
        globals.logger.verbose(
            `CONFIG VIS: Directory contents of "${globals.appBasePath}": ${dirContents}`
        );

        const htmlDir = path.resolve(globals.appBasePath, 'static/configvis');
        globals.logger.info(`CONFIG VIS: Serving static files from ${htmlDir}`);

        await configVisServer.register(FastifyStatic, {
            root: htmlDir,
            constraints: {}, // optional: default {}. Example: { host: 'example.com' }
            redirect: true, // Redirect to trailing '/' when the pathname is a dir
        });

        configVisServer.get('/', async (request, reply) => {
            // Obfuscate the config object before sending it to the client
            // First get clean copy of the config object
            let newConfig = JSON.parse(JSON.stringify(globals.config));

            if (globals.config.get('Butler-SOS.configVisualisation.obfuscate')) {
                // Obfuscate config file before presenting it to the user
                // This is done to avoid leaking sensitive information
                // to users who should not have access to it.
                // The obfuscation is done by replacing parts of the
                // config file with masked strings.
                newConfig = configObfuscate(newConfig);
            }

            // Convert the (potentially obfuscated) config object to YAML format (=string)
            const butlerConfigYaml = yaml.dump(newConfig);

            // Read index.html from disk
            // dirname points to the directory where this file (app.js) is located, taking into account
            // if the app is running as a packaged app or as a Node.js app.
            globals.logger.verbose(`----------------: ${globals.appBasePath}`);
            const filePath = path.resolve(globals.appBasePath, 'static/configvis', 'index.html');
            const template = fs.readFileSync(filePath, 'utf8');

            // Compile handlebars template
            const compiledTemplate = handlebars.compile(template);

            // Get config as HTML encoded JSON string
            const butlerSosConfigJsonEncoded = JSON.stringify(newConfig);

            // Render the template
            const renderedText = compiledTemplate({ butlerSosConfigJsonEncoded, butlerConfigYaml });

            globals.logger.debug(`CONFIG VIS: Rendered text: ${renderedText}`);

            // Send reply as HTML
            reply.code(200).header('Content-Type', 'text/html; charset=utf-8').send(renderedText);
        });

        configVisServer.listen(
            {
                host: globals.config.get('Butler-SOS.configVisualisation.host'),
                port: globals.config.get('Butler-SOS.configVisualisation.port'),
            },
            (err, address) => {
                if (err) {
                    globals.logger.error(
                        `CONFIG VIS: Could not set up config visualisation server on ${address}`
                    );
                    globals.logger.error(`CONFIG VIS: ${err.stack}`);
                    configVisServer.log.error(err);
                    process.exit(1);
                }
                globals.logger.info(
                    `CONFIG VIS: Config visualisation server listening on ${address}`
                );

                configVisServer.ready((err2) => {
                    if (err2) throw err;
                });
            }
        );
    } catch (err) {
        globals.logger.error(
            `CONFIG VIS: Error setting up config visualisation server: ${err.message}`
        );
        if (err.stack) {
            globals.logger.error(`CONFIG VIS: ${err.stack}`);
        }
        throw err;
    }
}
