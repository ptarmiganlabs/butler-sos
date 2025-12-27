import * as commonUtils from '../common-utils.js';

describe('Log Events Common Utils', () => {
    describe('formatUserFields', () => {
        test('should combine directory and id into user_full', () => {
            const msg = {
                user_directory: 'DIR',
                user_id: 'USER',
            };
            commonUtils.formatUserFields(msg);
            expect(msg.user_full).toBe('DIR\\USER');
        });

        test('should split user_full into directory and id', () => {
            const msg = {
                user_full: 'DIR\\USER',
                user_directory: '',
                user_id: '',
            };
            commonUtils.formatUserFields(msg);
            expect(msg.user_directory).toBe('DIR');
            expect(msg.user_id).toBe('USER');
        });

        test('should set user_full to empty if no info available', () => {
            const msg = {
                user_directory: '',
                user_id: '',
            };
            commonUtils.formatUserFields(msg);
            expect(msg.user_full).toBe('');
        });

        test('should handle user_full without backslash', () => {
            const msg = {
                user_full: 'USER_ONLY',
                user_directory: '',
                user_id: '',
            };
            commonUtils.formatUserFields(msg);
            expect(msg.user_full).toBe('');
        });
    });

    describe('Regex', () => {
        test('isoDateRegex should match valid ISO dates', () => {
            expect(commonUtils.isoDateRegex.test('2021-11-09T15:37:26.028+0200')).toBe(true);
            expect(commonUtils.isoDateRegex.test('invalid')).toBe(false);
        });

        test('uuidRegex should match valid UUIDs', () => {
            expect(commonUtils.uuidRegex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
            expect(commonUtils.uuidRegex.test('invalid')).toBe(false);
        });
    });
});
