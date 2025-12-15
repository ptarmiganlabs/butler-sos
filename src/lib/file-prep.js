import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'node:stream';
import sea from './sea-wrapper.js';
import handlebars from 'handlebars';

import globals from '../globals.js';
import { logError } from './log-error.js';

// Define MIME types for different file extensions
const MIME_TYPES = {
    default: 'application/octet-stream',
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

/**
 * Determines if a file is a binary file based on its extension
 *
 * @param {string} fileExtension - The file extension to check
 * @returns {boolean} - True if the file is binary, false otherwise
 */
function isBinaryFile(fileExtension) {
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.bin', '.exe', '.pdf'];
    return binaryExtensions.includes(fileExtension.toLowerCase());
}

/**
 * Prepares a file for serving, handling both filesystem and SEA assets.
 * This function handles different file types and returns a stream with the file contents.
 *
 * @param {string} filePath - The path to the file to prepare
 * @param {string} [encoding] - Optional encoding for text files, defaults to 'utf8' for text files
 * @returns {Promise<object>} - An object containing the file extension, a stream of the file contents, and a found flag
 */
export async function prepareFile(filePath, encoding) {
    globals.logger.verbose(`FILE PREP: Preparing file ${filePath}`);

    // Get file extension to determine how to handle the file
    const fileExtension = path.extname(filePath).toLowerCase();
    const isTextFile = !isBinaryFile(fileExtension);

    // Default encoding to utf8 for text files if not provided
    if (encoding === undefined) {
        encoding = isTextFile ? 'utf8' : undefined;
    }

    let exists = false;
    let stream;
    let content;

    try {
        if (globals.isSea) {
            // In SEA mode, get the asset via sea.getAsset
            globals.logger.verbose(
                `FILE PREP: Getting ${filePath} via sea.getAsset with encoding ${encoding || 'binary'}`
            );
            content = sea.getAsset(filePath, encoding);
            exists = content !== undefined && content !== null;

            if (!exists) {
                globals.logger.error(`FILE PREP: Could not find ${filePath} in SEA assets`);
            } else if (content instanceof ArrayBuffer) {
                // Convert ArrayBuffer to Buffer for proper handling
                content = Buffer.from(content);
            }
        } else {
            // In Node.js mode, read from filesystem
            if (fs.existsSync(filePath)) {
                globals.logger.verbose(
                    `FILE PREP: Reading ${filePath} from filesystem with encoding ${encoding || 'binary'}`
                );
                content = encoding
                    ? fs.readFileSync(filePath, encoding)
                    : fs.readFileSync(filePath);
                exists = true;
            } else {
                globals.logger.error(`FILE PREP: File not found: ${filePath}`);
            }
        }

        // If content exists, create a readable stream
        if (exists && content) {
            stream = Readable.from([content]);
        }
    } catch (err) {
        logError('FILE PREP: Error preparing file', err);
        exists = false;
    }

    // Return file information
    return {
        found: exists,
        ext: fileExtension.substring(1), // Remove the dot from the extension
        stream,
        content,
        mimeType: MIME_TYPES[fileExtension] || MIME_TYPES.default,
    };
}

/**
 * Compiles a Handlebars template with the provided data
 *
 * @param {string} templateContent - The template content as a string
 * @param {object} data - The data to use when rendering the template
 * @returns {string} - The compiled template
 */
export function compileTemplate(templateContent, data) {
    try {
        const template = handlebars.compile(templateContent);
        return template(data);
    } catch (err) {
        logError('FILE PREP: Error compiling handlebars template', err);
        throw err;
    }
}

/**
 * Gets a file from either the filesystem or SEA assets
 *
 * @param {string} filePath - The path to the file
 * @param {string} [encoding] - Optional encoding, defaults to 'utf8' for text files
 * @returns {Promise<string|Buffer>} - The file content as a string or buffer
 */
export async function getFileContent(filePath, encoding) {
    const result = await prepareFile(filePath, encoding);
    if (!result.found) {
        throw new Error(`File not found: ${filePath}`);
    }
    return result.content;
}

/**
 * Gets the MIME type for a file based on its extension
 *
 * @param {string} filePath - The path to the file
 * @returns {string} - The MIME type
 */
export function getMimeType(filePath) {
    const fileExtension = path.extname(filePath).toLowerCase();
    return MIME_TYPES[fileExtension] || MIME_TYPES.default;
}
