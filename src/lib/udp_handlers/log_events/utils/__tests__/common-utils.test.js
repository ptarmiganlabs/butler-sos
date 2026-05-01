import { describe, test, expect, jest } from '@jest/globals';

// Mock globals before importing the module under test
jest.unstable_mockModule('../../../../../globals.js', () => ({
    default: {
        logger: {
            verbose: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        },
    },
}));

const commonUtils = await import('../common-utils.js');

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
            expect(commonUtils.isoDateRegex.test('2021-11-09T15:37:26x028+0200')).toBe(false);
            expect(commonUtils.isoDateRegex.test('invalid')).toBe(false);
        });

        test('uuidRegex should match valid UUIDs', () => {
            expect(commonUtils.uuidRegex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
            expect(commonUtils.uuidRegex.test('invalid')).toBe(false);
        });
    });

    describe('processGenericLogEvent', () => {
        /**
         * Build a standard 16-element proxy message array, optionally overriding individual fields.
         *
         * @param {Array<[number, string]>} overrides - Pairs of [fieldIndex, value] to override
         * @returns {Array<string>} The message array
         */
        const makeMsg = (overrides = []) => {
            const base = [
                'qseow-proxy',
                '42',
                '2021-11-09T15:37:26.028+0200',
                '2021-11-09 15:37:26,028',
                'ERROR',
                'hostname.example.com',
                'Service.Proxy',
                'DOMAIN\\svc_user',
                'Something went wrong',
                'NullPointerException',
                'INTERNAL',
                'sa_scheduler',
                'OpenApp',
                '0',
                'Browser',
                '/qlik/sense',
            ];
            overrides.forEach(([idx, val]) => {
                base[idx] = val;
            });
            return base;
        };

        test('should return an object with all 16 standard fields', () => {
            const result = commonUtils.processGenericLogEvent(makeMsg());
            expect(result).toMatchObject({
                source: 'qseow-proxy',
                log_row: 42,
                ts_iso: '2021-11-09T15:37:26.028+0200',
                ts_local: '2021-11-09 15:37:26,028',
                level: 'ERROR',
                host: 'hostname.example.com',
                subsystem: 'Service.Proxy',
                windows_user: 'DOMAIN\\svc_user',
                message: 'Something went wrong',
                exception_message: 'NullPointerException',
                user_directory: 'INTERNAL',
                user_id: 'sa_scheduler',
                command: 'OpenApp',
                result_code: '0',
                origin: 'Browser',
                context: '/qlik/sense',
            });
        });

        test('should set log_row to -1 when field is not a valid integer', () => {
            const result = commonUtils.processGenericLogEvent(makeMsg([[1, 'not-a-number']]));
            expect(result.log_row).toBe(-1);
        });

        test('should set ts_iso to empty string when timestamp is invalid', () => {
            const result = commonUtils.processGenericLogEvent(makeMsg([[2, 'invalid-date']]));
            expect(result.ts_iso).toBe('');
        });

        test('should accept compact ISO timestamp in ts_iso field', () => {
            const result = commonUtils.processGenericLogEvent(
                makeMsg([[2, '20211109T153726.028+0200']])
            );
            expect(result.ts_iso).toBe('20211109T153726.028+0200');
        });

        test('should set ts_local to empty string when timestamp is invalid', () => {
            const result = commonUtils.processGenericLogEvent(makeMsg([[3, 'invalid']]));
            expect(result.ts_local).toBe('');
        });

        test('should populate user_full by combining user_directory and user_id', () => {
            const result = commonUtils.processGenericLogEvent(makeMsg());
            expect(result.user_full).toBe('INTERNAL\\sa_scheduler');
        });

        test('should call globals.logger.verbose', async () => {
            const globals = (await import('../../../../../globals.js')).default;
            globals.logger.verbose.mockClear();
            commonUtils.processGenericLogEvent(makeMsg());
            expect(globals.logger.verbose).toHaveBeenCalledTimes(1);
        });
    });
});
