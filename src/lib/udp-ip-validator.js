import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

/**
 * Validate IPv4 address format.
 *
 * @param {string} ip - The string to validate as an IPv4 address
 * @returns {boolean} True if the string is a valid IPv4 address, false otherwise
 */
export function isIPv4(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((part) => {
        if (!/^\d+$/.test(part)) return false;
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

/**
 * Resolve a hostname to its IPv4 addresses.
 *
 * @param {string} hostname - The hostname to resolve
 * @returns {Promise<string[]>} Array of resolved IPv4 addresses, or empty array on failure
 */
async function resolveHostname(hostname) {
    try {
        const addresses = await resolve4(hostname);
        return addresses;
    } catch {
        return [];
    }
}

/**
 * Parse and resolve allowed sources from config.
 *
 * Each entry may be a literal IPv4 address or a hostname that will be resolved
 * via DNS. Any entry that cannot be resolved is reported as an error.
 *
 * @param {string[]} sources - Array of IPv4 addresses or hostnames
 * @returns {Promise<{ allowedIPs: string[], errors: string[] }>} Resolved IPs and any error messages
 */
export async function parseAllowedSources(sources) {
    const allowedIPs = [];
    const errors = [];

    for (const source of sources) {
        if (isIPv4(source)) {
            allowedIPs.push(source);
        } else {
            // Treat as hostname, try to resolve
            const resolved = await resolveHostname(source);
            if (resolved.length > 0) {
                allowedIPs.push(...resolved);
            } else {
                errors.push(`Cannot resolve hostname or invalid IPv4: "${source}"`);
            }
        }
    }

    return { allowedIPs, errors };
}

/**
 * Check if an IP address is in the allowed list.
 *
 * When the allowed list is empty or null/undefined, all IPs are considered allowed
 * (i.e. no restriction is applied).
 *
 * @param {string} ip - The IP address to check
 * @param {string[]} allowedIPs - Array of allowed IP addresses
 * @returns {boolean} True if the IP is allowed (or no restriction is configured), false otherwise
 */
export function isIpAllowed(ip, allowedIPs) {
    if (!allowedIPs || allowedIPs.length === 0) {
        return true; // No restrictions
    }

    return allowedIPs.includes(ip);
}
