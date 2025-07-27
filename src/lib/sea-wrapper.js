// Wrapper for node:sea module to make it more testable
// This allows us to mock the sea module functionality in tests

let seaModule = null;

try {
    // Try to import the sea module
    seaModule = await import('node:sea');
} catch (error) {
    // If sea module is not available (e.g., in test environments), 
    // create a mock implementation
    seaModule = {
        default: {
            isSea: () => false,
            getAsset: () => undefined,
        }
    };
}

export default seaModule.default;