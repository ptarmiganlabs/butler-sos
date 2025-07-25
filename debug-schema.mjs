import configFileSchema from './src/lib/config-file-schema.js';
console.log("MQTT Schema:", JSON.stringify(configFileSchema.properties['Butler-SOS'].properties.mqttConfig, null, 2));
