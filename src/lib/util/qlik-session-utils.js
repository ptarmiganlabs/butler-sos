/**
 * Extracts the virtual proxy name from a Qlik Sense session cookie name.
 *
 * Qlik Sense session cookies typically follow the pattern:
 * - X-Qlik-Session-HTTP
 * - X-Qlik-Session-HTTPS
 * - X-Qlik-Session-virtualProxyName-HTTP
 * - X-Qlik-Session-virtualProxyName-HTTPS
 *
 * @param {string} cookieName The name of the cookie (e.g., 'X-Qlik-Session-vp-HTTPS').
 * @returns {string} The virtual proxy name, or an empty string if it's the default proxy.
 */
export function extractVirtualProxyFromSessionCookieName(cookieName) {
    if (!cookieName) {
        return '';
    }

    // Regex to match the session cookie pattern:
    // ^X-Qlik-Session-  : Starts with the standard prefix
    // (?:(.*)-)?        : Optional group capturing anything before the last hyphen (the virtual proxy)
    // HTTPS?            : Ends with HTTP or HTTPS
    // $                 : End of string
    const match = cookieName.match(/^X-Qlik-Session-(?:(.*)-)?HTTPS?$/i);

    if (match) {
        return match[1] || '';
    }

    return '';
}
