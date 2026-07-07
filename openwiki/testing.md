# Testing

## Test Framework

Butler SOS uses **Jest** with ESM support. The configuration is in `jest.config.mjs`.

### Running Tests

```bash
npm run test:unit          # Full test suite
npm run jest               # Alias for test:unit

# Single test file
node --experimental-vm-modules node_modules/jest/bin/jest.js src/__tests__/path/to/file.test.js
```

Jest runs with `--experimental-vm-modules` because the project uses ESM (`"type": "module"`).

### Full Quality Gate

```bash
npm run test:full          # Jest + Snyk security scan + Prettier formatting
npm run lint:fix           # ESLint + JSDoc + Prettier (run before committing)
```

## Test Organization

Test files live in `__tests__/` directories alongside the source code they test, using `*.test.js` naming. Tests use ESM imports from `@jest/globals`.

### Test Data

`src/testdata/` contains test fixtures used across the test suite.

## Testing Conventions

- **ESM imports** — Use `import { describe, test, expect } from '@jest/globals'`
- **Mocks** — Jest's built-in mocking for modules and dependencies
- **Test file naming** — `*.test.js` in `__tests__/` folders next to source code
- **No console.log** — Use `globals.logger` (winston-based) in production code; tests should use Jest's console mocking

### Existing Testing Documentation

Additional testing documentation exists in the repository:

- `docs/README.testing.md` — Brief testing guidance for AI assistants
- `docs/testing/testing-framework.md` — Full testing framework documentation
- `docs/testing/TEST_COVERAGE_SUMMARY.md` — Coverage analysis
- `docs/testing/INSIDER_BUILD_DEPLOYMENT_SETUP.md` — Insider build deployment testing
- `docs/testing/MACOS_RELEASE_SIGNING_RECOVERY.md` — macOS signing recovery procedures

## Code Style & Linting

- **ESLint** with `eslint-plugin-jsdoc` — Enforces JSDoc documentation on all functions
- **Prettier** — 100 printWidth, 4 tabWidth, single quotes
- **knip** — Detects unused dependencies and exports

Run `npm run lint` to check, `npm run lint:fix` to auto-fix.

## Change Guidance

| If you change... | What to test... |
|---|---|
| `src/lib/udp_handlers/*` | Message parsing with various UDP payloads; verify categorization rules |
| `src/lib/influxdb/*` | All three versions (v1/v2/v3) must produce correct data points |
| `src/lib/config-schemas/*` | Validate against `production_template.yaml` |
| `src/lib/audit-events-api.js` | Event validation, screenshot download, rate limiting |
| `src/lib/globals/*` | Initialization order and singleton behavior |
| Any destination module | Mock the external service (InfluxDB, MQTT, New Relic) and verify correct payloads |
