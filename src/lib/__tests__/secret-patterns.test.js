import { describe, test, expect } from '@jest/globals';

import { isSecretConfigPath, SECRET_CONFIG_PATHS } from '../secret-patterns.js';

describe('isSecretConfigPath', () => {
    test('is true for a setting whose name looks like a credential', () => {
        expect(isSecretConfigPath('Butler-SOS.influxdbConfig.v2Config.token')).toBe(true);
        expect(isSecretConfigPath('Butler-SOS.cert.clientCertPassphrase')).toBe(true);
        expect(
            isSecretConfigPath('Butler-SOS.thirdPartyToolsCredentials.newRelic[0].insertApiKey')
        ).toBe(true);
    });

    test('is true for anything inside a section whose name looks like a credential', () => {
        expect(isSecretConfigPath('Butler-SOS.secretStore.value')).toBe(true);
        expect(isSecretConfigPath('Butler-SOS.apiTokens[1]')).toBe(true);
    });

    test('is true at and under the paths the config page masks by path', () => {
        expect(isSecretConfigPath('Butler-SOS.newRelic.event.header[0].value')).toBe(true);
        expect(isSecretConfigPath('Butler-SOS.newRelic.metric.header[3].value')).toBe(true);
        expect(isSecretConfigPath('Butler-SOS.serversToMonitor.servers[2].headers.Cookie')).toBe(
            true
        );
        // A header name may contain dots.
        expect(isSecretConfigPath('Butler-SOS.serversToMonitor.servers[0].headers.X.Custom')).toBe(
            true
        );
    });

    test('is false for ordinary settings, including the same shape elsewhere', () => {
        expect(isSecretConfigPath('Butler-SOS.influxdbConfig.port')).toBe(false);
        // Same {name, value} shape as a New Relic header, but not a credential.
        expect(isSecretConfigPath('Butler-SOS.newRelic.event.attribute.static[0].value')).toBe(
            false
        );
        // The headers section itself, as opposed to a header in it.
        expect(isSecretConfigPath('Butler-SOS.serversToMonitor.servers[0].headers')).toBe(false);
        expect(isSecretConfigPath(null)).toBe(false);
    });

    test('lists every path the config page masks', () => {
        expect([...SECRET_CONFIG_PATHS]).toEqual([
            'newRelic.event.header[].value',
            'newRelic.metric.header[].value',
            'serversToMonitor.servers[].headers.*',
        ]);
    });
});
