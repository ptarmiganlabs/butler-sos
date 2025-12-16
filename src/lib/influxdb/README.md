# InfluxDB Module - Refactored Architecture

This directory contains the refactored InfluxDB integration code, organized by version for better maintainability and testability.

## Structure

```text
influxdb/
├── shared/           # Shared utilities and helpers
│   └── utils.js      # Common functions (getFormattedTime, processAppDocuments, writeToInfluxWithRetry, etc.)
├── v1/               # InfluxDB 1.x implementations (InfluxQL)
├── v2/               # InfluxDB 2.x implementations (Flux)
├── v3/               # InfluxDB 3.x implementations (SQL)
├── factory.js        # Version router that delegates to appropriate implementation
└── index.js          # Main facade providing consistent API
```

## Refactoring Complete

All InfluxDB versions (v1, v2, v3) now use the refactored modular code.

**Benefits:**

- Modular, version-specific implementations
- Shared utilities reduce code duplication
- Unified retry logic with exponential backoff
- Comprehensive JSDoc documentation
- Better error handling and resource management
- Consistent patterns across all versions

## Implementation Status

### V1 (InfluxDB 1.x - InfluxQL)

✅ All modules complete:

- Health metrics
- Proxy sessions
- Butler memory usage
- User events
- Log events
- Event counts
- Queue metrics

### V2 (InfluxDB 2.x - Flux)

✅ All modules complete:

- Health metrics
- Proxy sessions
- Butler memory usage
- User events
- Log events
- Event counts
- Queue metrics

### V3 (InfluxDB 3.x - SQL)

✅ All modules complete:

- Health metrics
- Proxy sessions
- Butler memory usage
- User events
- Log events
- Event counts
- Queue metrics

### Pending

- ⏳ Complete test coverage for all modules
- ⏳ Integration tests
- ⏳ Performance benchmarking

## Usage

### For Developers

When the feature flag is enabled, the facade in `index.js` will route calls to the refactored implementations. If a version-specific implementation is not yet complete, it automatically falls back to the original code.

```javascript
// Imports work the same way
import { postHealthMetricsToInfluxdb } from './lib/influxdb/index.js';

// Function automatically routes based on feature flag
await postHealthMetricsToInfluxdb(serverName, host, body, serverTags);
```

### Adding New Implementations

1. Create the version-specific module (e.g., `v3/sessions.js`)
2. Import and export it in `factory.js`
3. Update the facade in `index.js` to use the factory
4. Add tests in the appropriate `__tests__` directory

## Benefits

1. **Maintainability**: Smaller, focused files instead of one 3000+ line file
2. **Testability**: Each module can be tested in isolation
3. **Code Reuse**: Shared utilities reduce duplication
4. **Version Management**: Easy to deprecate old versions when needed
5. **Safe Migration**: Feature flag allows gradual rollout

## Original Implementation

The original implementation remains in `/src/lib/post-to-influxdb.js` and continues to work as before. This ensures no breaking changes during migration.
