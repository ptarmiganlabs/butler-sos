# Operations

## Docker

### Dockerfile

The `Dockerfile` uses a **multi-stage build** with `node:24-bookworm-slim`:

**Stage 1 (build):** Copies `package.json` + `package-lock.json`, runs `npm ci --omit=dev` (production-only dependencies).

**Stage 2 (runtime):**
- Copies `node_modules` from build stage + all source files
- Runs as non-root `node` user
- **HEALTHCHECK:** Runs `node src/docker-healthcheck.js` every 12s (12s timeout, 30s start period)
- **CMD:** `node src/butler-sos.js`

The healthcheck script (`src/docker-healthcheck.js`) makes an HTTP GET to `localhost:12398/health` and exits 0 on success, 1 on failure.

### Docker Compose Stacks

Full-stack Docker Compose configurations are available in `docs/docker-compose/`:

| Stack | File | Includes |
|---|---|---|
| InfluxDB v1 | `docker-compose_fullstack_influxdb_v1.yml` | Butler SOS + InfluxDB v1 + Grafana |
| InfluxDB v2 | `docker-compose_fullstack_influxdb_v2.yml` | Butler SOS + InfluxDB v2 + Grafana |
| InfluxDB v3 | `docker-compose_fullstack_influxdb_v3.yml` | Butler SOS + InfluxDB v3 + Grafana |
| Prometheus | `docker-compose_fullstack_prometheus.yml` | Butler SOS + Prometheus + Grafana |

Each stack includes sample production configs in `docs/docker-compose/config/` and Grafana provisioning in `docs/docker-compose/grafana/`.

### Grafana Dashboards

- `docs/grafana/senseops_15-0_dashboard_influxql.json` — Standalone Grafana dashboard for Butler SOS metrics
- `docs/docker-compose/grafana/` — Dashboard and datasource provisioning for Docker Compose stacks

## Binary Builds (SEA)

Butler SOS can be built as a **Single Executable Application (SEA)** — a standalone binary that embeds the Node.js runtime + application code.

### Build Pipeline

All builds follow the same 4-step core pipeline:

1. **Bundle with esbuild** — `src/bundle.js` → `build.cjs` (CommonJS, Node 22 target)
2. **Generate SEA blob** — `node --experimental-sea-config src/sea-config.json` produces `sea-prep.blob` + draft binary
3. **Copy Node.js executable** — Fresh copy of the running `node` binary as the host
4. **Inject blob** — `npx postject` embeds the JavaScript application into the Node binary

`src/bundle.js` is a 2-line entry point that sets `NODE_ENV=production` and requires `./butler-sos`.

`src/sea-config.json` maps `build.cjs` as the main blob and embeds static assets (404.html, logo, config visualization HTML/JS/CSS).

### Platform-Specific Extras

| Platform | Script | Extras |
|---|---|---|
| **Linux** | `scripts/build-binary-linux.sh` | `chmod +x` |
| **macOS** | `scripts/build-binary-macos.sh` | Remove codesign → inject → ad-hoc sign |
| **Windows** | `scripts/build-binary-win.ps1` | No signing |

## Releases

Release builds use separate scripts in `scripts/` with three tiers:

| Tier | Scripts | Versioning | Signing |
|---|---|---|---|
| **Local dev** | `build-binary-*` | `butler-sos--local--DATE--SHA` | Ad-hoc (macOS only) |
| **Insider (CI)** | `insider-build-*` | `butler-sos--platform--GITHUB_SHA.zip` | Full (macOS: codesign + notarize) |
| **Release (CI)** | `release-*` | `butler-sos-VERSION-platform.zip` | Full (macOS: codesign + notarize) |

### macOS Signing

macOS CI scripts (`insider-build-mac.sh`, `release-macos.sh`) perform:

1. **Keychain setup** — Create temporary keychain, import `.p12` certificate from `$MACOS_CERTIFICATE`
2. **Codesign** — Uses `release-config/butler-sos.entitlements` with runtime options, deep/strict verification
3. **Notarization** — Submit via `xcrun notarytool submit --wait`

The entitlements file (`release-config/butler-sos.entitlements`) grants permissions required for Node.js V8 JIT (`allow-jit`, `allow-unsigned-executable-memory`, `disable-executable-page-protection`).

### Windows Signing

Windows CI scripts use `signtool.exe` to remove the Authenticode signature from the copied `node.exe` before SEA blob injection. The signing commands are currently commented out, with a TODO noting the dual-signing sequence (SHA-1 then SHA-256) no longer matches current signtool behavior.

### Release-Please

Automated release PRs and changelog generation are configured via `release-please-config.json`:

- **Type:** `node` (semantic versioning)
- **Commit types:** `feat` → Features, `fix` → Bug Fixes, `refactor` → Refactoring, `docs` → Documentation
- **Draft releases:** Enabled (creates draft GitHub releases)

## License Compliance

`scripts/check-licenses.js` scans all dependencies using `license-checker-rseidelsohn`. It fails if any package uses a license not in the allowlist (MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, BlueOak, Unlicense, CC0, CC-BY).

## Change Guidance

| If you change... | Watch for... |
|---|---|
| `Dockerfile` | Ensure `npm ci --omit=dev` picks up any new runtime dependencies |
| `src/sea-config.json` | Static asset paths must match `static/` directory structure |
| `src/bundle.js` | esbuild output is `build.cjs`; any changes should keep it as a minimal entry point |
| Build scripts | All three platforms must be updated consistently |
| `release-config/butler-sos.entitlements` | Entitlement changes require re-signing for all macOS builds |
