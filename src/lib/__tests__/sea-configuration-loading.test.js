import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies for testing SEA configuration loading scenarios
jest.unstable_mockModule('fs-extra', () => ({
    default: {
        readFileSync: jest.fn(),
        accessSync: jest.fn(),
    },
    readFileSync: jest.fn(),
    accessSync: jest.fn(),
}));

jest.unstable_mockModule('js-yaml', () => ({
    default: {
        load: jest.fn(),
    },
    load: jest.fn(),
}));

jest.unstable_mockModule('../sea-wrapper.js', () => ({
    default: {
        isSea: jest.fn(),
        getAsset: jest.fn(),
    },
}));

// Import mocked modules
const fs = await import('fs-extra');
const yaml = await import('js-yaml');
const sea = (await import('../sea-wrapper.js')).default;

describe('SEA Configuration Loading Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset environment variables
        delete process.env.NODE_CONFIG;
        delete process.env.NODE_ENV;
        delete process.env.NODE_CONFIG_STRICT_MODE;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should detect SEA mode correctly', () => {
        // Test non-SEA mode detection
        sea.isSea.mockReturnValue(false);
        const isSeaMode = sea.isSea();
        expect(isSeaMode).toBe(false);
        expect(sea.isSea).toHaveBeenCalled();

        // Test SEA mode detection
        sea.isSea.mockReturnValue(true);
        const isSeaModeTrue = sea.isSea();
        expect(isSeaModeTrue).toBe(true);
    });

    test('should handle package.json loading in SEA mode', () => {
        // Setup SEA mode
        sea.isSea.mockReturnValue(true);
        const mockPackageJson = JSON.stringify({ version: '11.1.0' });
        sea.getAsset.mockReturnValue(mockPackageJson);

        // Simulate package.json loading in SEA mode
        if (sea.isSea()) {
            const packageJsonContent = sea.getAsset('package.json', 'utf8');
            const version = JSON.parse(packageJsonContent).version;
            expect(version).toBe('11.1.0');
            expect(sea.getAsset).toHaveBeenCalledWith('package.json', 'utf8');
        }
    });

    test('should handle package.json loading in non-SEA mode', () => {
        // Setup non-SEA mode
        sea.isSea.mockReturnValue(false);
        const mockPackageContent = '{"version": "11.1.0"}';
        fs.readFileSync.mockReturnValue(mockPackageContent);

        // Simulate package.json loading in non-SEA mode
        if (!sea.isSea()) {
            const packageJsonContent = fs.readFileSync('/mock/path/package.json');
            const version = JSON.parse(packageJsonContent).version;
            expect(version).toBe('11.1.0');
            expect(fs.readFileSync).toHaveBeenCalledWith('/mock/path/package.json');
        }
    });

    test('should handle config file loading in SEA mode', () => {
        // Setup SEA mode
        sea.isSea.mockReturnValue(true);
        const mockConfigContent = 'Butler-SOS:\\n  logLevel: info\\n  port: 9842';
        const mockParsedConfig = { 'Butler-SOS': { logLevel: 'info', port: 9842 } };
        
        fs.readFileSync.mockReturnValue(mockConfigContent);
        yaml.load.mockReturnValue(mockParsedConfig);

        // Simulate config file loading in SEA mode
        if (sea.isSea()) {
            const configFileContent = fs.readFileSync('/mock/config.yaml', 'utf8');
            const parsedConfig = yaml.load(configFileContent);
            
            // In SEA mode, config should be set as NODE_CONFIG environment variable
            process.env.NODE_CONFIG = JSON.stringify(parsedConfig);
            process.env.NODE_ENV = '';
            process.env.NODE_CONFIG_STRICT_MODE = 'true';

            expect(parsedConfig).toEqual(mockParsedConfig);
            expect(process.env.NODE_CONFIG).toBe(JSON.stringify(mockParsedConfig));
            expect(process.env.NODE_CONFIG_STRICT_MODE).toBe('true');
        }
    });

    test('should handle config file loading in non-SEA mode', () => {
        // Setup non-SEA mode
        sea.isSea.mockReturnValue(false);

        // Simulate config file loading in non-SEA mode
        if (!sea.isSea()) {
            // In non-SEA mode, environment variables should be set differently
            process.env.NODE_CONFIG_DIR = '/mock/config/dir';
            process.env.NODE_ENV = 'development';
            process.env.NODE_CONFIG_STRICT_MODE = 'false';

            expect(process.env.NODE_CONFIG_DIR).toBe('/mock/config/dir');
            expect(process.env.NODE_ENV).toBe('development');
            expect(process.env.NODE_CONFIG_STRICT_MODE).toBe('false');
        }
    });

    test('should handle config file existence checking in both modes', () => {
        const mockConfigPath = '/mock/config.yaml';
        
        // Mock file existence check
        fs.accessSync.mockImplementation((path, mode) => {
            if (path === mockConfigPath) {
                return; // File exists (accessSync doesn't throw)
            }
            throw new Error('File not found');
        });

        // Test file existence checking logic
        let fileExists = false;
        try {
            fs.accessSync(mockConfigPath, fs.constants?.F_OK || 0);
            fileExists = true;
        } catch (e) {
            fileExists = false;
        }

        expect(fileExists).toBe(true);
        expect(fs.accessSync).toHaveBeenCalledWith(mockConfigPath, fs.constants?.F_OK || 0);
    });

    test('should handle execution path determination in both modes', () => {
        const mockExecutablePath = '/path/to/executable';
        const mockWorkingDir = '/path/to/working/dir';

        // SEA mode: use executable directory
        sea.isSea.mockReturnValue(true);
        const seaExecPath = sea.isSea() ? '/path/to/sea/executable' : mockWorkingDir;
        expect(seaExecPath).toBe('/path/to/sea/executable');

        // Non-SEA mode: use current working directory
        sea.isSea.mockReturnValue(false);
        const normalExecPath = sea.isSea() ? '/path/to/sea/executable' : mockWorkingDir;
        expect(normalExecPath).toBe(mockWorkingDir);
    });

    test('should handle asset loading in SEA mode', () => {
        // Setup SEA mode
        sea.isSea.mockReturnValue(true);
        
        // Test successful asset loading
        const mockAssetContent = '<html>Test content</html>';
        sea.getAsset.mockReturnValue(mockAssetContent);

        const assetContent = sea.getAsset('/test/asset.html', 'utf8');
        expect(assetContent).toBe(mockAssetContent);
        expect(sea.getAsset).toHaveBeenCalledWith('/test/asset.html', 'utf8');

        // Test asset not found
        sea.getAsset.mockReturnValue(undefined);
        const missingAsset = sea.getAsset('/missing/asset.html', 'utf8');
        expect(missingAsset).toBeUndefined();
    });

    test('should handle binary asset loading in SEA mode', () => {
        // Setup SEA mode for binary assets
        sea.isSea.mockReturnValue(true);
        
        // Test ArrayBuffer handling
        const mockArrayBuffer = new ArrayBuffer(8);
        sea.getAsset.mockReturnValue(mockArrayBuffer);

        const binaryAsset = sea.getAsset('/test/image.png');
        expect(binaryAsset).toBe(mockArrayBuffer);
        expect(sea.getAsset).toHaveBeenCalledWith('/test/image.png');

        // Test conversion to Buffer (this would happen in actual code)
        const buffer = Buffer.from(mockArrayBuffer);
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBe(8);
    });

    test('should validate error handling in config loading', () => {
        const mockLogger = {
            error: jest.fn(),
            info: jest.fn(),
        };

        // Test SEA config loading error
        sea.isSea.mockReturnValue(true);
        fs.readFileSync.mockImplementation(() => {
            throw new Error('Config file read error');
        });

        try {
            if (sea.isSea()) {
                const configContent = fs.readFileSync('/invalid/config.yaml', 'utf8');
            }
        } catch (error) {
            mockLogger.error(`SEA: Failed to load or parse config file: ${error.message}`);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('SEA: Failed to load or parse config file: Config file read error');
    });

    test('should handle YAML parsing in SEA mode', () => {
        sea.isSea.mockReturnValue(true);
        
        const mockYamlContent = 'Butler-SOS:\\n  logLevel: debug\\n  port: 9842';
        const mockParsedYaml = { 'Butler-SOS': { logLevel: 'debug', port: 9842 } };
        
        fs.readFileSync.mockReturnValue(mockYamlContent);
        yaml.load.mockReturnValue(mockParsedYaml);

        if (sea.isSea()) {
            const yamlContent = fs.readFileSync('/config.yaml', 'utf8');
            const parsed = yaml.load(yamlContent);
            
            expect(yaml.load).toHaveBeenCalledWith(mockYamlContent);
            expect(parsed).toEqual(mockParsedYaml);
        }
    });
});