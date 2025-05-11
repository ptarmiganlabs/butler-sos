import Fastify from 'fastify';
import FastifyRateLimit from '@fastify/rate-limit';
import FastifyStatic from '@fastify/static';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import handlebars from 'handlebars';

import globals from '../globals.js';
import configObfuscate from './config-obfuscate.js';

/**
 * Serves the custom 404 error page
 *
 * @param {object} request - The Fastify request object
 * @param {object} reply - The Fastify reply object
 * @returns {void}
 */
async function serve404Page(request, reply) {
    try {
        let template404;
        const host = globals.config.get('Butler-SOS.configVisualisation.host');
        const port = globals.config.get('Butler-SOS.configVisualisation.port');

        if (globals.isSea) {
            // In SEA mode, get the 404 template via sea.getAsset
            globals.logger.verbose(`CONFIG VIS: Getting 404.html template via sea.getAsset`);
            template404 = sea.getAsset('/404.html', 'utf8');
            if (!template404) {
                globals.logger.error(`CONFIG VIS: Could not find 404.html template in SEA assets`);
                reply.code(404).send({ error: 'Page not found' });
                return;
            }
        } else {
            // In Node.js mode, read from filesystem
            const filePath = path.resolve(globals.appBasePath, 'static', '404.html');
            globals.logger.verbose(`CONFIG VIS: Reading 404.html template from ${filePath}`);
            template404 = fs.readFileSync(filePath, 'utf8');
        }

        // Compile handlebars template and replace variables
        const compiledTemplate = handlebars.compile(template404);
        const renderedHtml = compiledTemplate({
            visTaskHost: host,
            visTaskPort: port,
        });

        // Send 404 response with custom page
        reply.code(404).header('Content-Type', 'text/html; charset=utf-8').send(renderedHtml);
    } catch (err) {
        globals.logger.error(`CONFIG VIS: Error serving 404 page: ${err.message}`);
        reply.code(404).send({ error: 'Page not found' });
    }
}

/**
 * Sets up and starts a web server for visualizing Butler SOS configuration.
 *
 * This function creates a Fastify server that serves a web interface where users can
 * view the current Butler SOS configuration in a more readable format. It includes:
 * - Rate limiting to prevent abuse
 * - Optional obfuscation of sensitive configuration values
 * - Serving static files for the web interface
 * - Rendering the configuration as both JSON and YAML
 *
 * @param {object} [logger] - Optional logger object (not used in this function)
 * @param {object} [config] - Optional configuration object (not used in this function)
 * @returns {Promise<void>} A promise that resolves when the server is set up
 * @throws {Error} If there's an error setting up the server
 */
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

        // Handle static files differently depending on whether we're running in SEA mode or not
        if (globals.isSea) {
            // Running as standalone SEA app
            // In SEA mode, we need to manually handle each static file route
            // since files don't exist on disk
            globals.logger.info(
                `CONFIG VIS: Running in SEA mode, setting up custom static file handlers`
            );

            // Define MIME types for different file extensions
            const mimeTypes = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.map': 'application/json',
                '.ico': 'image/x-icon',
            };

            // Set up routes for the static files listed in sea-config.json
            configVisServer.get('/:filename', async (request, reply) => {
                try {
                    const filename = request.params.filename;
                    const assetPath = `/configvis/${filename}`;
                    const fileExtension = path.extname(filename);
                    const contentType = mimeTypes[fileExtension] || 'application/octet-stream';

                    // Get the asset from SEA
                    const content = sea.getAsset(
                        assetPath,
                        fileExtension === '.png' || fileExtension === '.ico' ? null : 'utf8'
                    );

                    if (!content) {
                        // File not found - serve custom 404 page
                        await serve404Page(request, reply);
                        return;
                    }

                    reply.code(200).header('Content-Type', contentType).send(content);
                } catch (err) {
                    globals.logger.error(
                        `CONFIG VIS: Error serving static file in SEA mode: ${err.message}`
                    );
                    await serve404Page(request, reply);
                }
            });

            // Add specific handler for the butler-sos.png file at the root path
            configVisServer.get('/butler-sos.png', async (request, reply) => {
                try {
                    // Get the asset from SEA
                    const logoContent = sea.getAsset('/butler-sos.png');

                    if (!logoContent) {
                        globals.logger.error(
                            `CONFIG VIS: Could not find butler-sos.png in SEA assets`
                        );
                        reply.code(404).send({ error: 'Logo not found' });
                        return;
                    }

                    reply.code(200).header('Content-Type', 'image/png').send(logoContent);
                } catch (err) {
                    globals.logger.error(
                        `CONFIG VIS: Error serving logo in SEA mode: ${err.message}`
                    );
                    reply.code(500).send({ error: 'Internal server error' });
                }
            });

            globals.logger.info(`CONFIG VIS: Custom static file handlers set up for SEA mode`);
        } else {
            // Running Node.js script
            const STATIC_PATH = path.join(globals.appBasePath, './static');

            // Get directory contents of static directory (for debugging)
            try {
                const dirContents = fs.readdirSync(STATIC_PATH);
                globals.logger.verbose(
                    `CONFIG VIS: Directory contents of "${STATIC_PATH}": ${dirContents}`
                );
            } catch (err) {
                globals.logger.error(`CONFIG VIS: Error reading static directory: ${err.message}`);
            }

            const htmlDir = path.resolve(STATIC_PATH, 'configvis');
            globals.logger.info(`CONFIG VIS: Serving static files from ${htmlDir}`);

            // Use FastifyStatic plugin to serve static files in Node.js mode
            await configVisServer.register(FastifyStatic, {
                root: htmlDir,
                // prefix: '/configvis/',
                constraints: {}, // optional: default {}. Example: { host: 'example.com' }
                redirect: true, // Redirect to trailing '/' when the pathname is a dir
            });
        }

        // Set up a global 404 handler for both running modes
        configVisServer.setNotFoundHandler(serve404Page);

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

            // Read index.html - depending on whether we're in SEA mode or not
            // dirname points to the directory where this file (app.js) is located, taking into account
            // if the app is running as a packaged app or as a Node.js app.
            globals.logger.verbose(`----------------: ${globals.appBasePath}`);

            let template;
            if (globals.isSea) {
                // In SEA mode, get the template via sea.getAsset
                globals.logger.verbose(`CONFIG VIS: Getting index.html template via sea.getAsset`);
                template = sea.getAsset('/configvis/index.html', 'utf8');
                if (!template) {
                    globals.logger.error(
                        `CONFIG VIS: Could not find index.html template in SEA assets`
                    );
                    reply.code(500).send({ error: 'Internal server error: Template not found' });
                    return;
                }
            } else {
                // In Node.js mode, read from filesystem
                const filePath = path.resolve(
                    globals.appBasePath,
                    'static/configvis',
                    'index.html'
                );
                globals.logger.verbose(`CONFIG VIS: Reading index.html template from ${filePath}`);
                template = fs.readFileSync(filePath, 'utf8');
            }

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
