#!/usr/bin/env bash
# Platform: macOS only
# Requires: tmux

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"
PID_FILE="$PROJECT_ROOT/.llm-stack.pids"

echo "=== Attaching to OpenWiki LLM Stack ==="
echo ""

if [ ! -f "$PID_FILE" ]; then
    echo "ERROR: PID file '$PID_FILE' not found."
    echo "The LLM stack may not be running, or was started from a different directory."
    exit 1
fi
get_pid_var() {
    local key="$1"
    local line
    line="$(grep -E "^${key}=" "$PID_FILE" | head -n 1 || true)"
    printf '%s' "${line#*=}"
}

USE_TMUX="$(get_pid_var USE_TMUX)"
SESSION_NAME="$(get_pid_var SESSION_NAME)"

if [ "${USE_TMUX:-false}" != true ]; then
    echo "ERROR: Stack is running in background mode."
    echo "Cannot attach to background processes. Use 'tail -f' on log files or stop/start with tmux mode."
    exit 1
fi

if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "ERROR: tmux session '$SESSION_NAME' not found."
    echo "The session may have been terminated. Run scripts/stop-openwiki-llm-stack.sh to clean up."
    exit 1
fi

echo "Attaching to tmux session '$SESSION_NAME'..."
echo "Use Ctrl+b then d to detach, or Ctrl+b then :kill-session to stop."
echo ""
tmux attach-session -t "$SESSION_NAME"
