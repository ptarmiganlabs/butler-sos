import { describe, expect, test } from '@jest/globals';

import { parseQlikUserIdentity } from '../user-identity.js';

describe('parseQlikUserIdentity', () => {
    test('parses canonical Qlik user directory/user id strings', () => {
        expect(parseQlikUserIdentity('UserDirectory=LAB; UserId=goran')).toEqual({
            user: 'UserDirectory=LAB; UserId=goran',
            userDirectory: 'LAB',
            userId: 'goran',
            canRequestQpsTicket: true,
        });
    });

    test('parses compact semicolon identities', () => {
        expect(parseQlikUserIdentity('LAB; UserId=goran')).toMatchObject({
            userDirectory: 'LAB',
            userId: 'goran',
            canRequestQpsTicket: true,
        });
    });

    test('parses backslash identities', () => {
        expect(parseQlikUserIdentity('LAB\\goran')).toMatchObject({
            userDirectory: 'LAB',
            userId: 'goran',
            canRequestQpsTicket: true,
        });
    });

    test('preserves unparseable identities without treating them as QPS-ticketable', () => {
        expect(parseQlikUserIdentity('user@example.com')).toEqual({
            user: 'user@example.com',
            userDirectory: null,
            userId: null,
            canRequestQpsTicket: false,
        });
    });
});
