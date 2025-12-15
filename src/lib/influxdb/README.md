# InfluxDB Module Refactoring

This directory contains the refactored InfluxDB integration code, organized by version for better maintainability and testability.

## Structure

```text
influxdb/
├── shared/           # Shared utilities and helpers
│   └── utils.js      # Common functions used across all versions
├── v1/               # InfluxDB 1.x implementations
├── v2/               # InfluxDB 2.x implementations
├── v3/               # InfluxDB 3.x implementations
│   └── health-metrics.js  # Health metrics for v3
├── factory.js        # Version router that delegates to appropriate implementation
└── index.js          # Main facade providing backward compatibility
```

## Feature Flag

The refactored code is controlled by the `Butler-SOS.influxdbConfig.useRefactoredCode` configuration flag:

```yaml
Butler-SOS:
    influxdbConfig:
        enable: true
        useRefactoredCode: false # Set to true to use refactored code
        version: 3
        # ... other config
```

**Default:** `false` (uses original code for backward compatibility)

## Migration Status

### Completed

- ✅ Directory structure
- ✅ Shared utilities (`getFormattedTime`, `processAppDocuments`, etc.)
- ✅ V3 health metrics implementation
- ✅ Factory router with feature flag
- ✅ Backward-compatible facade
- ✅ Configuration schema updated

### In Progress

- 🚧 V3 remaining modules (sessions, log events, user events, queue metrics)
- 🚧 V2 implementations
- 🚧 V1 implementations

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
