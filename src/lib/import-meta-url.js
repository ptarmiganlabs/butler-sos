/**
 * Utility module to provide a compatible import.meta.url equivalent in CommonJS modules.
 *
 * This module creates a URL object that represents the current file's path,
 * which can be used in a similar way to import.meta.url in ES modules.
 * This is necessary for CommonJS modules that need file path resolution
 * capabilities similar to those available in ES modules.
 *
 * @module import-meta-url
 */
const { createRequire } = require('node:module');
require = createRequire(__filename);
export var import_meta_url = require('url').pathToFileURL(__filename);
