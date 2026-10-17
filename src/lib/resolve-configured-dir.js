import path from 'path';

/**
 * Resolves a directory taken from the config file. An absolute path is used as given, a relative
 * one is resolved against baseDir, and an empty value means baseDir itself.
 *
 * Relative paths go through path.resolve rather than path.join, so a Windows drive-relative value
 * such as C:logs resolves instead of becoming the invalid C:\base\C:logs.
 *
 * @param {string} configuredDir - The directory from the config file, relative or absolute
 * @param {string} baseDir - Absolute directory that relative paths start from
 * @returns {string} The directory to use
 */
export function resolveConfiguredDir(configuredDir, baseDir) {
    if (!configuredDir || configuredDir.trim() === '') {
        return baseDir;
    }
    return path.isAbsolute(configuredDir) ? configuredDir : path.resolve(baseDir, configuredDir);
}
