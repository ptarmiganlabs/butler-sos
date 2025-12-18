/**
 * Tests for input sanitization in log event handlers
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { sanitizeField } from '../../../udp-queue-manager.js';

// Mock globals before importing handlers
jest.unstable_mockModule('../../../../globals.js', () => ({
    default: {
        logger: {
            verbose: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        },
        config: {
            get: jest.fn().mockReturnValue(false), // Disable performance monitor by default
        },
        appNames: [],
    },
}));

// Import handlers after mocking
const { processEngineEvent } = await import('../handlers/engine-handler.js');
const { processProxyEvent } = await import('../handlers/proxy-handler.js');
const { processRepositoryEvent } = await import('../handlers/repository-handler.js');
const { processSchedulerEvent } = await import('../handlers/scheduler-handler.js');
const { processQixPerfEvent } = await import('../handlers/qix-perf-handler.js');

describe('Log Event Handler Sanitization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('Engine Event Handler', () => {
        it('should sanitize control characters in message field', () => {
            const msg = [
                '/qseow-engine/',
                '1',
                '2021-11-09T15:37:26.028+0200',
                '2021-11-09 15:37:26,028',
                'ERROR',
                'hostname.example.com',
                'System.Engine',
                'DOMAIN\\user',
                'Test message with\x00control\x1Fcharacters\x7F', // Field 8: message
                '550e8400-e29b-41d4-a716-446655440000',
                'INTERNAL',
                'sa_scheduler',
                '2021-11-09T15:37:26.028+0200',
                '550e8400-e29b-41d4-a716-446655440000',
                '12.345.0',
                '2021-11-09T15:37:26.028+0200',
                'Traffic',
                '550e8400-e29b-41d4-a716-446655440000',
                '550e8400-e29b-41d4-a716-446655440000',
            ];

            const result = processEngineEvent(msg);
            expect(result.message).not.toContain('\x00');
            expect(result.message).not.toContain('\x1F');
            expect(result.message).not.toContain('\x7F');
            expect(result.message).toBe('Test message withcontrolcharacters');
        });

        it('should limit message length to 1000 characters', () => {
            const longMessage = 'x'.repeat(2000);
            const msg = [
                '/qseow-engine/',
                '1',
                '2021-11-09T15:37:26.028+0200',
                '2021-11-09 15:37:26,028',
                'ERROR',
                'hostname.example.com',
                'System.Engine',
                'DOMAIN\\user',
                longMessage,
                '550e8400-e29b-41d4-a716-446655440000',
                'INTERNAL',
                'sa_scheduler',
                '2021-11-09T15:37:26.028+0200',
                '550e8400-e29b-41d4-a716-446655440000',
                '12.345.0',
                '2021-11-09T15:37:26.028+0200',
                'Traffic',
                '550e8400-e29b-41d4-a716-446655440000',
                '550e8400-e29b-41d4-a716-446655440000',
            ];

            const result = processEngineEvent(msg);
            expect(result.message).toHaveLength(1000);
        });

        it('should sanitize all string fields', () => {
            const msg = [
                '/qseow-engine/\x00',
                '1',
                '2021-11-09T15:37:26.028+0200',
                '2021-11-09 15:37:26,028',
                'ERROR\x01',
                'hostname\x02.example.com',
                'System.Engine\x03',
                'DOMAIN\\user\x04',
                'Message\x05',
                '550e8400-e29b-41d4-a716-446655440000',
                'INTERNAL\x06',
                'sa_scheduler\x07',
                '2021-11-09T15:37:26.028+0200',
                '550e8400-e29b-41d4-a716-446655440000',
                '12.345.0\x08',
                '2021-11-09T15:37:26.028+0200',
                'Traffic\x09',
                '550e8400-e29b-41d4-a716-446655440000',
                '550e8400-e29b-41d4-a716-446655440000',
            ];

            const result = processEngineEvent(msg);

            // Check no control characters remain
            expect(result.source).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.level).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.host).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.subsystem).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.windows_user).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.message).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.user_directory).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.user_id).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.engine_exe_version).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.entry_type).not.toMatch(/[\x00-\x1F\x7F]/);
        });
    });

    describe('Proxy Event Handler', () => {
        it('should sanitize exception message field', () => {
            const msg = [
                '/qseow-proxy/',
                '1',
                '2021-11-09T15:37:26.028+0200',
                '2021-11-09 15:37:26,028',
                'ERROR',
                'hostname.example.com',
                'Service.Proxy',
                'DOMAIN\\user',
                'Test message',
                'Exception:\x00Test\x1FError\x7F', // Field 9: exception_message
                'INTERNAL',
                'sa_scheduler',
                'TestCommand',
                '500',
                'Origin',
                '/context',
            ];

            const result = processProxyEvent(msg);
            expect(result.exception_message).not.toContain('\x00');
            expect(result.exception_message).not.toContain('\x1F');
            expect(result.exception_message).not.toContain('\x7F');
        });
    });

    describe('Repository Event Handler', () => {
        it('should sanitize command and result_code fields', () => {
            const msg = [
                '/qseow-repository/',
                '1',
                '2021-11-09T15:37:26.028+0200',
                '2021-11-09 15:37:26,028',
                'WARN',
                'hostname.example.com',
                'Service.Repository',
                'DOMAIN\\user',
                'Test message',
                'Exception message',
                'INTERNAL',
                'sa_scheduler',
                'Check\x00service\x01status', // Field 12: command
                '500\x02', // Field 13: result_code
                'Origin',
                '/context',
            ];

            const result = processRepositoryEvent(msg);
            expect(result.command).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.result_code).not.toMatch(/[\x00-\x1F\x7F]/);
        });
    });

    describe('Scheduler Event Handler', () => {
        it('should sanitize task and app names', () => {
            const msg = [
                '/qseow-scheduler/',
                '1',
                '2021-11-09T19:37:44.331+0100',
                '2021-11-09 19:37:44,331',
                'ERROR',
                'hostname.example.com',
                'System.Scheduler',
                'DOMAIN\\user',
                'Reload failed',
                'Exception',
                'LAB',
                'goran',
                'LAB\\goran',
                'Task\x00Name\x01Test', // Field 13: task_name
                'App\x02Name\x03Test', // Field 14: app_name
                'dec2a02a-1680-44ef-8dc2-e2bfb180af87',
                'e7af59a0-c243-480d-9571-08727551a66f',
                '4831c6a5-34f6-45bb-9d40-73a6e6992670',
            ];

            const result = processSchedulerEvent(msg);
            expect(result.task_name).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.app_name).not.toMatch(/[\x00-\x1F\x7F]/);
            expect(result.task_name).toBe('TaskNameTest');
            expect(result.app_name).toBe('AppNameTest');
        });
    });

    describe('QIX Performance Event Handler', () => {
        it('should sanitize method and object_type fields', async () => {
            const msg = [
                '/qseow-qix-perf/',
                '1',
                '2021-11-09T19:37:44.331+0100',
                '2021-11-09 19:37:44,331',
                'INFO',
                'hostname.example.com',
                'System.Engine',
                'DOMAIN\\user',
                '550e8400-e29b-41d4-a716-446655440000',
                'LAB',
                'goran',
                '2021-11-09T19:37:44.331+01:00',
                '550e8400-e29b-41d4-a716-446655440000',
                '550e8400-e29b-41d4-a716-446655440000',
                '123',
                'Global::\x00OpenApp\x01', // Field 15: method
                '100',
                '90',
                '5',
                '3',
                '2',
                '1',
                'objId123',
                '1024000',
                '2048000',
                'linechart\x02', // Field 25: object_type
            ];

            const result = await processQixPerfEvent(msg);
            if (result) {
                expect(result.method).not.toMatch(/[\x00-\x1F\x7F]/);
                expect(result.object_type).not.toMatch(/[\x00-\x1F\x7F]/);
            }
        });
    });

    describe('sanitizeField edge cases', () => {
        it('should handle null values', () => {
            const result = sanitizeField(null);
            expect(result).toBe('null');
        });

        it('should handle undefined values', () => {
            const result = sanitizeField(undefined);
            expect(result).toBe('undefined');
        });

        it('should handle numbers', () => {
            const result = sanitizeField(12345);
            expect(result).toBe('12345');
        });

        it('should handle objects by converting to string', () => {
            const result = sanitizeField({ test: 'value' });
            expect(result).toContain('[object Object]');
        });

        it('should handle arrays by converting to string', () => {
            const result = sanitizeField([1, 2, 3]);
            expect(result).toBe('1,2,3');
        });

        it('should remove tab characters', () => {
            const result = sanitizeField('text\twith\ttabs');
            expect(result).toBe('textwithtabs');
        });

        it('should remove all ASCII control characters', () => {
            // Test characters from 0x00 to 0x1F and 0x7F
            let input = '';
            for (let i = 0; i <= 0x1f; i++) {
                input += String.fromCharCode(i);
            }
            input += String.fromCharCode(0x7f);
            input += 'ValidText';

            const result = sanitizeField(input);
            expect(result).toBe('ValidText');
        });

        it('should preserve unicode characters', () => {
            const result = sanitizeField('Hello 世界 🌍 Привет');
            expect(result).toBe('Hello 世界 🌍 Привет');
        });

        it('should handle very long strings efficiently', () => {
            const longString = 'a'.repeat(10000);
            const result = sanitizeField(longString, 500);
            expect(result).toHaveLength(500);
        });
    });

    describe('Field length limits', () => {
        it('should respect different max lengths for different fields', () => {
            // Source: 100 chars
            expect(sanitizeField('x'.repeat(200), 100)).toHaveLength(100);

            // Message: 1000 chars
            expect(sanitizeField('x'.repeat(2000), 1000)).toHaveLength(1000);

            // Subsystem: 200 chars
            expect(sanitizeField('x'.repeat(300), 200)).toHaveLength(200);

            // Level: 20 chars
            expect(sanitizeField('x'.repeat(50), 20)).toHaveLength(20);
        });
    });
});
