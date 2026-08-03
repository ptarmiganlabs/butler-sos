/**
 * Shared vocabulary of key names that identify credentials.
 *
 * Two places in Butler SOS have to recognise secrets, and they must not drift apart:
 * - `crash-dump.js` redacts `key=value` and JSON-style pairs out of error text and stack
 *   traces before writing a crash dump to disk.
 * - `config-obfuscate.js` masks config values before the config visualisation web server
 *   serves them over an unauthenticated HTTP endpoint.
 *
 * They previously carried two independent lists, and the config-obfuscate copy was the
 * weaker of the two — it omitted `passwd`, `pwd`, `api[_-]?key`, `api[_-]?token`,
 * `access[_-]?key`, `auth` and `client[_-]?secret`. The visible symptom was that a Qlik
 * server header named `X-Api-Key` received only a 5-character prefix mask in the config UI
 * while `X-Auth-Token` was fully masked, and that the same value would be redacted from a
 * crash dump but disclosed by the web UI.
 *
 * Keep this file as the single source of truth. Adding a keyword here strengthens both
 * consumers at once.
 */

/**
 * Alternation source shared by every secret-detection regex below.
 *
 * `[_-]?` makes the multi-word keywords tolerate `api_key`, `api-key` and `apikey`. Ordering
 * matters for the longer alternatives: `api[_-]?token` must precede a bare `token` match in
 * the key=value patterns so the captured group reports the more specific name.
 */
export const SECRET_KEYWORD_SOURCE =
    'password|passwd|pwd|secret|credential|token|api[_-]?key|api[_-]?token|access[_-]?key|auth|passphrase|client[_-]?secret';

/**
 * Keywords used to identify a *config key name* as holding a credential.
 *
 * Deliberately narrower than {@link SECRET_KEYWORD_SOURCE}. The free-text matchers above run
 * against `key=value` pairs, where a bare `auth` or `credential` is unambiguous. Config key
 * names are matched as substrings (so camelCase `insertApiKey` and header-style
 * `X-Auth-Token` are caught), and at that looseness those two words match container and flag
 * names rather than credentials:
 *
 * - `auth` matches `serversToMonitor.rejectUnauthorized` (a boolean) and the
 *   `influxdbConfig.v1Config.auth` container, whose `username` is meant to keep a readable
 *   prefix and whose `password` is already matched on its own name.
 * - `credential` matches the `thirdPartyToolsCredentials` container, whose `accountName` is
 *   not sensitive and whose `accountId` is meant to keep a readable prefix. The credential
 *   inside it, `insertApiKey`, is matched by `api[_-]?key`.
 *
 * Masking those containers wholesale destroys booleans and over-masks fields with deliberate
 * partial rules, so both words are omitted here. The schema-completeness test
 * (`config-obfuscate-coverage.test.js`) is the backstop: it fails CI if any config leaf ends
 * up neither masked nor explicitly classified as safe, which is what would surface a real
 * credential these two words would otherwise have caught.
 */
export const SECRET_KEY_NAME_SOURCE =
    'password|passwd|pwd|secret|token|api[_-]?key|api[_-]?token|access[_-]?key|passphrase|client[_-]?secret';

/**
 * Matches a config key *name* that identifies a credential.
 *
 * Deliberately unanchored and case-insensitive: config keys are camelCase (`apiToken`,
 * `clientCertPassphrase`, `insertApiKey`) or header-style (`X-Auth-Token`), so a substring
 * match is what is wanted. Used by `config-obfuscate.js` to decide whether a value must be
 * fully masked.
 *
 * Note this is a *name* matcher, not a value matcher — it never inspects the value.
 *
 * @type {RegExp}
 */
export const SECRET_KEY_NAME_REGEX = new RegExp(`(${SECRET_KEY_NAME_SOURCE})`, 'i');

/**
 * Builds the `key=value` / `key: value` matcher used to redact secrets from free text.
 *
 * A fresh RegExp is returned on every call because these carry the `g` flag, and a shared
 * global regex would leak `lastIndex` state between callers.
 *
 * @returns {RegExp} Matcher for `secretName=value` and `secretName: value` pairs.
 */
export function buildSecretKeyValueRegex() {
    return new RegExp(`\\b(${SECRET_KEYWORD_SOURCE})\\s*[=:]\\s*[^\\s&,;"'[\\]{}()]+`, 'gi');
}

/**
 * Builds the JSON-style quoted-pair matcher used to redact secrets from free text.
 *
 * e.g. `"password": "mysecret"` or `'token': 'abc123'`.
 *
 * @returns {RegExp} Matcher for quoted secret key/value pairs.
 */
export function buildSecretJsonPairRegex() {
    return new RegExp(`["'](${SECRET_KEYWORD_SOURCE})["']\\s*:\\s*["'][^"']+["']`, 'gi');
}
