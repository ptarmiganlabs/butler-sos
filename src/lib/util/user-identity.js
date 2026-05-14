/**
 * Utilities for working with Qlik Sense user identity strings.
 */

/**
 * Normalizes a string value by trimming whitespace.
 *
 * @param {unknown} value Candidate string value.
 * @returns {string | null} Trimmed string, or null when empty/not a string.
 */
function readNonEmptyString(value) {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parses Qlik identity strings into their directory and user-id components.
 *
 * Supported self-hosted Qlik Sense formats include:
 * - `UserDirectory=LAB; UserId=goran`
 * - `LAB; UserId=goran`
 * - `LAB\\goran`
 *
 * Provider-specific identities such as Qlik Cloud email addresses are returned
 * as the full `user` value without parsed directory/id fields.
 *
 * @param {unknown} value Candidate full Qlik user identity.
 * @returns {{ user: string | null, userDirectory: string | null, userId: string | null, canRequestQpsTicket: boolean }} Parsed identity.
 */
export function parseQlikUserIdentity(value) {
    const user = readNonEmptyString(value);
    if (!user || user.toUpperCase() === 'N/A') {
        return {
            user: user || null,
            userDirectory: null,
            userId: null,
            canRequestQpsTicket: false,
        };
    }

    const result = {
        user,
        userDirectory: null,
        userId: null,
        canRequestQpsTicket: false,
    };

    if (user.includes(';')) {
        const parts = user
            .split(';')
            .map((part) => part.trim())
            .filter((part) => part.length > 0);

        for (const part of parts) {
            const separatorIndex = part.indexOf('=');
            if (separatorIndex === -1) {
                if (!result.userDirectory) {
                    result.userDirectory = readNonEmptyString(part);
                }
                continue;
            }

            const key = part.slice(0, separatorIndex).trim().toLowerCase();
            const parsedValue = readNonEmptyString(part.slice(separatorIndex + 1));

            if (key === 'userdirectory') result.userDirectory = parsedValue;
            if (key === 'userid') result.userId = parsedValue;
        }
    } else if (user.includes('\\')) {
        const separatorIndex = user.indexOf('\\');
        result.userDirectory = readNonEmptyString(user.slice(0, separatorIndex));
        result.userId = readNonEmptyString(user.slice(separatorIndex + 1));
    }

    result.canRequestQpsTicket = Boolean(result.userDirectory && result.userId);
    return result;
}
