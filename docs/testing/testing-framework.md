# Testing Framework Guide for Butler SOS

This document provides a comprehensive guide for Butler SOS developers on how the testing framework is set up, how to write tests, and how to run them effectively.

## Overview

Butler SOS uses **Jest v30.0.5** as its primary testing framework. The project is configured to work with ES modules and provides comprehensive test coverage across all major components.

## Test Framework Configuration

### Jest Configuration

The Jest configuration is defined in `jest.config.mjs` with the following key settings:

- **Test Environment**: `node` - All tests run in a Node.js environment
- **ES Module Support**: Fully configured for ES modules with `type: "module"` in package.json
- **Coverage Collection**: Enabled by default with V8 coverage provider
- **Coverage Directory**: `./coverage/`
- **Clear Mocks**: Automatically clears mocks between tests

### Package.json Scripts

The following npm scripts are available for testing:

```bash
# Run Jest tests only
npm run jest

# Run full test suite (Jest + Snyk + formatting)
npm run test

# Run only unit tests (alias for jest)
npm run test:unit
```

### ES Module Configuration

Butler SOS runs Jest with specific Node.js flags to support ES modules:

```bash
node --experimental-vm-modules --no-warnings node_modules/jest/bin/jest.js
```

This configuration:
- Enables experimental VM modules support
- Suppresses warnings for experimental features
- Allows Jest to work seamlessly with ES modules

## Test File Organization

### Directory Structure

Tests are organized using the `__tests__` directory pattern throughout the codebase:

```
src/
├── lib/
│   └── __tests__/
│       ├── heartbeat.test.js
│       ├── post-to-mqtt.test.js
│       ├── config-file-schema.test.js
│       └── ...
├── lib/config-schemas/
│   └── __tests__/
│       ├── destinations.test.js
│       ├── credentials.test.js
│       └── ...
├── lib/udp_handlers/user_events/
│   └── __tests__/
│       └── message-event.test.js
└── plugins/
    └── __tests__/
        ├── sensible.test.js
        └── support.test.js
```

### Naming Conventions

- Test files use the `.test.js` extension
- Test files are named after the module they test (e.g., `heartbeat.js` → `heartbeat.test.js`)
- Test files are placed in `__tests__` directories alongside or near the code they test

## Writing Tests

### Basic Test Structure

All test files follow this ES module import pattern:

```javascript
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { moduleToTest } from '../module-to-test.js';

describe('module-to-test', () => {
    test('should do something', () => {
        // Test implementation
        expect(result).toBe(expected);
    });
});
```

### Mocking Dependencies

Butler SOS uses Jest's ES module mocking capabilities. Here are the common patterns:

#### External Dependencies

```javascript
// Mock external modules before importing them
jest.unstable_mockModule('axios', () => ({
    default: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

// Import after mocking
const axios = (await import('axios')).default;
```

#### Internal Modules

```javascript
// Mock internal globals module
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        },
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
    },
}));

const globals = (await import('../../globals.js')).default;
```

### Configuration Testing

Many tests verify configuration schema validation:

```javascript
import Ajv from 'ajv';
import addKeywords from 'ajv-keywords';
import addFormats from 'ajv-formats';
import configFileSchema from '../config-file-schema.js';

describe('config-file-schema', () => {
    let ajv;

    beforeEach(() => {
        ajv = new Ajv({
            strict: true,
            allErrors: true,
            allowUnionTypes: true,
        });
        addKeywords(ajv, ['transform']);
        addFormats(ajv);
    });

    test('should validate against minimal config', () => {
        const minimalConfig = { /* config object */ };
        const validate = ajv.compile(configFileSchema);
        const valid = validate(minimalConfig);
        
        expect(valid).toBe(true);
    });
});
```

## Running Tests

### Running All Tests

```bash
# Run all tests with coverage
npm run test

# Run only Jest tests
npm run jest
npm run test:unit
```

### Running Specific Tests

```bash
# Run tests matching a pattern
npx jest heartbeat

# Run tests in a specific directory
npx jest src/lib/__tests__/

# Run a specific test file
npx jest src/lib/__tests__/heartbeat.test.js
```

### Running Tests with Options

```bash
# Run tests in watch mode
npx jest --watch

# Run tests with verbose output
npx jest --verbose

# Run tests with coverage report
npx jest --coverage
```

## Test Coverage

### Coverage Configuration

Coverage is automatically collected during test runs and includes:

- **Provider**: V8 (native Node.js coverage)
- **Output Directory**: `./coverage/`
- **Report Format**: Multiple formats including HTML, text, and LCOV

### Viewing Coverage Reports

After running tests, coverage reports are available in:

```
coverage/
├── lcov-report/
│   └── index.html    # Detailed HTML coverage report
├── lcov.info         # Machine-readable coverage data
└── coverage-final.json
```

Open `coverage/lcov-report/index.html` in a browser to view detailed coverage information.

## Jest v30 Specific Considerations

### ES Module Support

Jest v30 has improved ES module support but requires specific configuration:

1. **No `--runInBand` Flag**: Jest v30 has stricter ES module handling when running tests in band mode. Tests run in parallel by default.

2. **Dynamic Imports**: All dynamic imports (`import()`) in test files are strictly validated.

3. **Module Mocking**: Use `jest.unstable_mockModule()` for ES module mocking before importing modules.

### Breaking Changes from v29

- Removed `--runInBand` from npm scripts due to ES module compatibility issues
- Stricter dynamic import validation
- Improved parallel test execution performance

## Test Categories

### Unit Tests

Located throughout the codebase, these test individual modules:

- **Configuration validation** (`config-*.test.js`)
- **Data processing** (`post-to-*.test.js`)
- **Event handling** (`*-event.test.js`)
- **Utility functions** (`heartbeat.test.js`, `service_uptime.test.js`)

### Integration Tests

Tests that verify module interactions:

- **Plugin loading** (`plugins/__tests__/`)
- **Configuration schemas** (`config-schemas/__tests__/`)
- **Event message handling** (`udp_handlers/__tests__/`)

## Best Practices

### Test Organization

1. **Keep tests close to code**: Place tests in `__tests__` directories near the code they test
2. **One test file per module**: Each module should have a corresponding test file
3. **Descriptive test names**: Use clear, descriptive test and describe block names

### Mocking Strategy

1. **Mock external dependencies**: Always mock HTTP clients, databases, and external services
2. **Mock global state**: Mock the globals module for consistent test isolation
3. **Use beforeEach for setup**: Initialize mocks and test data in beforeEach blocks

### Test Structure

1. **Arrange, Act, Assert**: Structure tests with clear setup, execution, and verification phases
2. **Test edge cases**: Include tests for error conditions and boundary cases
3. **Keep tests focused**: Each test should verify one specific behavior

### Performance

1. **Parallel execution**: Jest v30 runs tests in parallel by default for better performance
2. **Selective test runs**: Use Jest's pattern matching to run only relevant tests during development
3. **Coverage optimization**: Focus coverage collection on areas under active development

## Troubleshooting

### Common Issues

1. **Module not found errors**: Ensure all imports use correct file extensions (`.js`)
2. **ES module import errors**: Check that mocks are set up before imports
3. **Timeout issues**: Increase Jest timeout for long-running async tests

### Debug Tips

1. **Use `--verbose` flag**: Get detailed output for failing tests
2. **Add `console.log`**: Temporary debugging in test files
3. **Run single tests**: Isolate failing tests to debug specific issues

## Continuous Integration

Tests run automatically in CI/CD pipelines with:

- Full test suite execution
- Coverage report generation
- Security scanning with Snyk
- Code formatting validation

The test suite must pass before any code can be merged to main branches.