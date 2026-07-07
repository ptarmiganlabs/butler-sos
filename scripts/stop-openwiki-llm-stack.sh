#!/usr/bin/env bash
# Platform: macOS only
# Requires: tmux (if stack was started in tmux mode)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"
PID_FILE="$PROJECT_ROOT/.llm-stack.pids"

echo "=== Stopping OpenWiki LLM Stack ==="
echo ""

if [ ! -f "$PID_FILE" ]; then
    echo "ERROR: PID file '$PID_FILE' not found."
    echo "The LLM stack may not be running, or was started from a different directory."
    exit 1
fi

echo "Reading $PID_FILE..."

get_pid_var() {
    local key="$1"
    local line
    line="$(grep -E "^${key}=" "$PID_FILE" | head -n 1 || true)"
    printf '%s' "${line#*=}"
}

USE_TMUX="$(get_pid_var USE_TMUX)"
SESSION_NAME="$(get_pid_var SESSION_NAME)"
LLAMA_SERVER_PID="$(get_pid_var LLAMA_SERVER_PID)"
LITELLM_PID="$(get_pid_var LITELLM_PID)"
if [ "${USE_TMUX:-false}" = true ]; then
    echo "Stopping tmux session '$SESSION_NAME'..."
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        tmux kill-session -t "$SESSION_NAME"
        echo "✓ tmux session '$SESSION_NAME' stopped"
    else
        echo "⚠ tmux session '$SESSION_NAME' not found (already stopped?)"
    fi
else
    if [ -z "${LLAMA_SERVER_PID:-}" ] || [ -z "${LITELLM_PID:-}" ]; then
        echo "ERROR: PID file is malformed or missing required variables."
        exit 1
    fi

    echo "Stopping llama-server (PID: $LLAMA_SERVER_PID)..."
    if kill -0 $LLAMA_SERVER_PID 2>/dev/null; then
        kill $LLAMA_SERVER_PID
        echo "✓ llama-server stopped"
    else
        echo "⚠ llama-server (PID $LLAMA_SERVER_PID) is not running"
    fi

    echo "Stopping litellm (PID: $LITELLM_PID)..."
    if kill -0 $LITELLM_PID 2>/dev/null; then
        kill $LITELLM_PID
        echo "✓ litellm stopped"
    else
        echo "⚠ litellm (PID $LITELLM_PID) is not running"
    fi
fi

rm "$PID_FILE"
echo "✓ PID file removed"
echo ""
echo "=== OpenWiki LLM Stack Stopped ==="
