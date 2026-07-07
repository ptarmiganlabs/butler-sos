# Scripts

This directory contains build, release, and utility scripts for Butler SOS and the OpenWiki LLM Stack.

## LLM Stack Scripts

### start-openwiki-llm-stack.sh

Starts llama-server and litellm proxy in a tmux session.

**Platform:** macOS only

**Usage:**

```bash
./scripts/start-openwiki-llm-stack.sh [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--attach` | Attach to tmux session in the current terminal (default: open new window) |
| `--detach` | Start tmux session without attaching |
| `--background` | Run without tmux (background processes, old behavior) |
| `--split DIRECTION` | Window split direction: `horizontal` (default) or `vertical` |
| `--session NAME` | tmux session name (default: `llm`) |

**Examples:**

```bash
./scripts/start-openwiki-llm-stack.sh                           # New terminal window
./scripts/start-openwiki-llm-stack.sh --attach                  # Attach in current terminal
./scripts/start-openwiki-llm-stack.sh --detach                  # Headless
./scripts/start-openwiki-llm-stack.sh --split vertical          # Left/right layout
./scripts/start-openwiki-llm-stack.sh --session my-llm          # Custom session name
./scripts/start-openwiki-llm-stack.sh --background              # Old behavior (no tmux)
```

**Services:**

- llama-server: http://localhost:8080
- litellm proxy: http://localhost:4000

**Notes:**

- When opening a new terminal window, the script checks for installed terminal applications in this order: iTerm2 (preferred), Ghostty, or Terminal.app (fallback).
- The new terminal window closes automatically when the tmux session ends.
- If no supported terminal is detected, use `--detach` or `--attach` instead.

---

### stop-openwiki-llm-stack.sh

Stops the LLM stack. Works for both tmux and background modes.

**Platform:** macOS only

**Usage:**

```bash
./scripts/stop-openwiki-llm-stack.sh
```

---

### attach-openwiki-llm-stack.sh

Reattach to a running tmux session.

**Platform:** macOS only

**Usage:**

```bash
./scripts/attach-openwiki-llm-stack.sh
```

**Notes:**

- Only works when the stack was started in tmux mode (default, `--attach`, or `--detach`).
- Will error if the stack is running in `--background` mode.

---

## Build Scripts

### build-binary-macos.sh

Builds a standalone Butler SOS binary for macOS (arm64) for local use.

**Platform:** macOS only

**Usage:**

```bash
./scripts/build-binary-macos.sh
```

**Output:**

Binary placed in the repository root with a date and commit SHA suffix, e.g. `./butler-sos--local--2025-Jan-31--a1b2c3d`.

**Notes:**

- Code signing and notarization are NOT performed (CI-only steps).
- Binary has an ad-hoc signature for local use only.

### build-binary-linux.sh

Builds a standalone Butler SOS binary for Linux.

**Platform:** Linux only

**Usage:**

```bash
./scripts/build-binary-linux.sh
```

### build-binary-win.ps1

Builds a standalone Butler SOS binary for Windows (PowerShell script).

**Platform:** Windows only

**Usage:**

```powershell
.\scripts\build-binary-win.ps1
```

---

## Release Scripts

### release-macos.sh

Builds, signs, and notarizes a Butler SOS binary for macOS release distribution.

**Platform:** macOS only

**Usage:**

```bash
./scripts/release-macos.sh
```

**Notes:**

- Requires macOS signing certificates and notarization credentials (set as environment variables).
- Intended for CI/CD use.

### release-linux.sh

Builds a Butler SOS binary for Linux release distribution.

**Platform:** Linux only

**Usage:**

```bash
./scripts/release-linux.sh
```

### release-win.ps1

Builds a Butler SOS binary for Windows release distribution (PowerShell script).

**Platform:** Windows only

**Usage:**

```powershell
.\scripts\release-win.ps1
```

---

## Insider Build Scripts

### insider-build-mac.sh

Builds, signs, and notarizes a Butler SOS insider (pre-release) binary for macOS.

**Platform:** macOS only

**Usage:**

```bash
./scripts/insider-build-mac.sh
```

**Notes:**

- Injects git SHA and date into the version string.
- Requires macOS signing certificates and notarization credentials.
- Intended for CI/CD use.

### insider-build-linux.sh

Builds a Butler SOS insider binary for Linux.

**Platform:** Linux only

**Usage:**

```bash
./scripts/insider-build-linux.sh
```

### insider-build-win.ps1

Builds a Butler SOS insider binary for Windows (PowerShell script).

**Platform:** Windows only

**Usage:**

```powershell
.\scripts\insider-build-win.ps1
```

---

## Utility Scripts

### check-licenses.js

License compliance checker. Fails (exit code 1) if any dependency uses a license not in the allowlist.

**Platform:** Cross-platform (macOS, Linux, Windows)

**Usage:**

```bash
npm run license:check
```

**Notes:**

- Allowed licenses are defined in the `ALLOWED_LICENSES` array in the script.
- To add a new license, update the array in `scripts/check-licenses.js`.
