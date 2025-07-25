/**
 * Test conditional validation against realistic configuration scenarios
 */

import { jest } from '@jest/globals';
import { dump, load } from 'js-yaml';
import fs from 'fs/promises';
import { verifyConfigFileSchema } from '../config-file-verify.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Realistic Config Conditional Validation', () => {
    let tempConfigPath;

    afterEach(async () => {
        if (tempConfigPath) {
            try {
                await fs.unlink(tempConfigPath);
            } catch (err) {
                // Ignore if file doesn't exist
            }
            tempConfigPath = null;
        }
    });

    async function createTempConfig(configObject) {
        const tempDir = path.join(__dirname, '../../../tmp');
        await fs.mkdir(tempDir, { recursive: true });
        tempConfigPath = path.join(tempDir, `test-config-${Date.now()}.yaml`);
        const yamlContent = dump(configObject);
        await fs.writeFile(tempConfigPath, yamlContent);
        return tempConfigPath;
    }

    test('should allow placeholder/invalid values when MQTT is disabled', async () => {
        // Load the production template
        const templatePath = path.join(__dirname, '../../../src/config/production_template.yaml');
        const templateContent = await fs.readFile(templatePath, 'utf8');
        const templateConfig = load(templateContent);

        // Modify the MQTT config to have disabled feature with invalid placeholders
        templateConfig['Butler-SOS'].mqttConfig = {
            enable: false,
            brokerHost: '<IP of MQTT broker/server>',  // Placeholder from template - should be allowed when disabled
            brokerPort: 1883,
            baseTopic: 'butler-sos/'
        };

        // Also disable other features that might have validation issues in the template
        templateConfig['Butler-SOS'].newRelic.enable = false;
        templateConfig['Butler-SOS'].userEvents.enable = false;
        templateConfig['Butler-SOS'].prometheus.enable = false;
        templateConfig['Butler-SOS'].configVisualisation.enable = false;
        templateConfig['Butler-SOS'].heartbeat.enable = false;
        templateConfig['Butler-SOS'].dockerHealthCheck.enable = false;

        const configPath = await createTempConfig(templateConfig);
        
        // This should pass validation because features are disabled
        const result = await verifyConfigFileSchema(configPath);
        expect(result).toBe(true);
    });

    test('should fail validation when MQTT is enabled with placeholder values', async () => {
        // Load the production template
        const templatePath = path.join(__dirname, '../../../src/config/production_template.yaml');
        const templateContent = await fs.readFile(templatePath, 'utf8');
        const templateConfig = load(templateContent);

        // Enable MQTT but leave placeholder values that should be invalid
        templateConfig['Butler-SOS'].mqttConfig = {
            enable: true,  // Enable MQTT
            brokerHost: '<IP of MQTT broker/server>',  // Invalid placeholder - should cause validation to fail
            brokerPort: 1883,
            baseTopic: 'butler-sos/'
        };

        const configPath = await createTempConfig(templateConfig);
        
        // This should fail validation because MQTT is enabled with invalid config
        const result = await verifyConfigFileSchema(configPath);
        expect(result).toBe(false);
    });
});