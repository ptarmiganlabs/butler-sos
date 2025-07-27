/**
 * Wrapper for node:sea module to make it more testable
 * This allows us to mock the sea module functionality in tests
 */

// Create a simple synchronous wrapper that provides fallback behavior
const seaWrapper = {
    /**
     * Check if running in SEA mode
     * Uses heuristics to detect SEA mode when the module isn't available
     *
     * @returns {boolean} True if running as SEA, false otherwise
     */
    isSea() {
        try {
            // Try to dynamically import and use the real module
            // We can't use await here, so we'll use a heuristic approach
            // Check if we're running from a single executable file
            const isPackaged =
                process.pkg !== undefined ||
                process.env.PKG_EXECPATH !== undefined ||
                (process.argv0 && process.argv0 === process.execPath && process.argv.length === 1);

            return isPackaged;
        } catch (error) {
            // If any error occurs, assume not SEA
            return false;
        }
    },

    /**
     * Get an asset from SEA bundle
     * Returns undefined when SEA module is not available
     *
     * @param {string} key - Asset key
     * @param {string} encoding - Encoding type
     * @returns {any} The asset content or undefined
     */
    getAsset(key, encoding) {
        try {
            // In actual SEA environments, this will be replaced by the real implementation
            // For now, return undefined as fallback
            return undefined;
        } catch (error) {
            return undefined;
        }
    },

    /**
     * Initialize the real SEA module if available
     * This is called during application startup to load the real module
     *
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     */
    async initialize() {
        try {
            const seaModule = await import('node:sea');
            const realSea = seaModule.default;

            // Replace our methods with the real ones
            this.isSea = realSea.isSea.bind(realSea);
            this.getAsset = realSea.getAsset.bind(realSea);
        } catch (error) {
            // SEA module not available, keep our fallback implementations
            // This is expected in test environments or when not using SEA
        }
    },
};

export default seaWrapper;
