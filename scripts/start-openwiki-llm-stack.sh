#!/usr/bin/env bash
# Platform: macOS only
# Requires: tmux, llama-server, lsof, python3 (venv), litellm, and one of iTerm2/Ghostty/Terminal.app (plus osascript for iTerm2/Terminal integration)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"
PID_FILE="$PROJECT_ROOT/.llm-stack.pids"
LITELLM_DIR="${LITELLM_DIR:-"$HOME/code/litellm_config"}"
USE_TMUX=true
SPLIT_DIR="horizontal"
SESSION_NAME="llm"
ATTACH_MODE="new-window"

detect_terminal() {
    if [ -d "/Applications/iTerm.app" ]; then echo "iterm2"
    elif [ -d "/Applications/Ghostty.app" ]; then echo "ghostty"
    elif [ -d "/Applications/Utilities/Terminal.app" ]; then echo "terminal"
    else echo "none"
    fi
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --background) USE_TMUX=false; shift ;;
        --split) SPLIT_DIR="$2"; shift 2 ;;
        --session) SESSION_NAME="$2"; shift 2 ;;
        --attach) ATTACH_MODE="attach"; shift ;;
        --detach) ATTACH_MODE="detach"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

LLAMA_PID=0
LITELLM_PID=0

cleanup() {
    if [ $LLAMA_PID -ne 0 ] && kill -0 $LLAMA_PID 2>/dev/null; then
        echo "Interrupted during startup. Stopping llama-server (PID $LLAMA_PID)..."
        kill $LLAMA_PID 2>/dev/null || true
        wait $LLAMA_PID 2>/dev/null || true
    fi
    if [ $LITELLM_PID -ne 0 ] && kill -0 $LITELLM_PID 2>/dev/null; then
        echo "Interrupted during startup. Stopping litellm (PID $LITELLM_PID)..."
        kill $LITELLM_PID 2>/dev/null || true
        wait $LITELLM_PID 2>/dev/null || true
    fi
    exit 1
}

trap cleanup SIGINT SIGTERM

echo "=== Starting OpenWiki LLM Stack ==="
echo ""

if [ -f "$PID_FILE" ]; then
    echo "WARNING: .llm-stack.pids file exists. Services may already be running."
    echo "Run scripts/stop-openwiki-llm-stack.sh first if you want to restart."
    echo ""
fi

echo "Checking port availability..."
if lsof -ti:8080 >/dev/null 2>&1; then
    echo "ERROR: Port 8080 is already in use."
    exit 1
fi

if lsof -ti:4000 >/dev/null 2>&1; then
    echo "ERROR: Port 4000 is already in use."
    exit 1
fi

echo "✓ Ports 8080 and 4000 are available"
echo ""

if ! command -v llama-server >/dev/null 2>&1; then
    echo "ERROR: llama-server command not found. Please install llama.cpp first."
    exit 1
fi

if [ ! -d "$LITELLM_DIR/.venv" ]; then
    echo "Creating Python virtual environment in $LITELLM_DIR..."
    python3 -m venv "$LITELLM_DIR/.venv"
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists in $LITELLM_DIR"
fi

echo "Activating virtual environment..."
source "$LITELLM_DIR/.venv/bin/activate"

if ! command -v litellm >/dev/null 2>&1; then
    echo "ERROR: litellm is not installed in the virtual environment."
    echo "Install it with: pip install litellm"
    exit 1
fi

echo "✓ litellm is available"
echo ""

if [ "$USE_TMUX" = true ]; then
    if ! command -v tmux >/dev/null 2>&1; then
        echo "ERROR: tmux is not installed. Please install tmux first."
        exit 1
    fi

    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo "Session '$SESSION_NAME' already exists."
        echo "[a] Attach to existing session"
        echo "[k] Kill existing session and start new"
        echo "[c] Cancel"
        read -p "Choose option: " -n 1 -r
        echo ""
        
        case $REPLY in
            [aA])
                echo "Attaching to existing session..."
                tmux attach-session -t "$SESSION_NAME"
                exit 0
                ;;
            [kK])
                echo "Killing existing session..."
                tmux kill-session -t "$SESSION_NAME"
                ;;
            [cC]|*)
                echo "Cancelled."
                exit 0
                ;;
        esac
    fi

    echo "Creating tmux session '$SESSION_NAME'..."
    tmux new-session -d -s "$SESSION_NAME"

    if [ "$SPLIT_DIR" = "horizontal" ]; then
        echo "Splitting window horizontally (top/bottom)..."
        tmux split-window -v -t "$SESSION_NAME"
    else
        echo "Splitting window vertically (left/right)..."
        tmux split-window -h -t "$SESSION_NAME"
    fi

    echo "Starting llama-server in pane 0..."
    tmux send-keys -t "$SESSION_NAME":0.0 'llama-server --hf-repo unsloth/Qwen3.6-27B-MTP-GGUF --hf-file "Qwen3.6-27B-Q8_0.gguf" --spec-type draft-mtp -ngl 999 -fa on -c 262144 --port 8080' C-m

    echo "Starting litellm in pane 1..."
    tmux send-keys -t "$SESSION_NAME":0.1 'cd /Users/goran/code/litellm_config && source .venv/bin/activate && litellm --config /Users/goran/code/litellm_config/litellm_config.yaml --port 4000' C-m

cat > "$PID_FILE" <<EOF
USE_TMUX=true
SESSION_NAME=$SESSION_NAME
EOF

    echo ""
    echo "=== OpenWiki LLM Stack Started ==="
    echo ""
    echo "tmux session: $SESSION_NAME"
    echo "  Pane 0: llama-server (http://localhost:8080)"
    echo "  Pane 1: litellm proxy (http://localhost:4000)"
    echo ""
    echo "To stop the stack:"
    echo "  ./scripts/stop-openwiki-llm-stack.sh"
    echo ""
    echo "To reattach to this session:"
    echo "  ./scripts/attach-openwiki-llm-stack.sh"
    echo ""

    if [ "$ATTACH_MODE" = "attach" ]; then
        echo "Attaching to tmux session..."
        tmux attach-session -t "$SESSION_NAME"
    elif [ "$ATTACH_MODE" = "detach" ]; then
        echo "Session started in detached mode."
        echo "To attach: tmux attach-session -t $SESSION_NAME"
    else
        TERMINAL=$(detect_terminal)
        
        if [ "$TERMINAL" = "none" ]; then
            echo "ERROR: No supported terminal application found."
            echo "Please install iTerm2 (https://iterm2.com/) for the best experience."
            echo "Alternatively, use --detach or --attach flags."
            exit 1
        fi
        
        echo "Opening tmux session in new terminal window ($TERMINAL)..."
        
        case "$TERMINAL" in
            iterm2)
                if ! command -v osascript >/dev/null 2>&1; then
                    echo "ERROR: osascript not found. This is required for iTerm2 integration."
                    echo "Please install Xcode Command Line Tools or use --detach or --attach instead."
                    exit 1
                fi
                if ! osascript <<EOF 2>/dev/null
tell application "iTerm"
    set newWindow to (create window with default profile command "tmux attach-session -t '$SESSION_NAME' ; exit")
    tell current session of newWindow to set name to "OpenWiki LLM Stack"
end tell
EOF
                then
                    echo "ERROR: Failed to open iTerm2 window."
                    echo "Use --detach or --attach instead."
                    exit 1
                fi
                ;;
            ghostty)
                if ! command -v ghostty >/dev/null 2>&1; then
                    echo "ERROR: Ghostty CLI not found in PATH."
                    echo "Please install Ghostty CLI from https://ghostty.org/docs/install/binary"
                    echo "or use --detach or --attach instead."
                    exit 1
                fi
                if ! ghostty --title="OpenWiki LLM Stack" -e tmux attach-session -t "$SESSION_NAME" 2>/dev/null; then
                    echo "ERROR: Failed to open Ghostty window."
                    echo "Use --detach or --attach instead."
                    exit 1
                fi
                ;;
            terminal)
                if ! command -v osascript >/dev/null 2>&1; then
                    echo "ERROR: osascript not found. This is required for Terminal.app integration."
                    echo "Please install Xcode Command Line Tools or use --detach or --attach instead."
                    exit 1
                fi
                if ! osascript <<EOF 2>/dev/null
tell application "Terminal"
    set newTab to do script "tmux attach-session -t '$SESSION_NAME' ; exit"
    set custom title of front window to "OpenWiki LLM Stack"
end tell
EOF
                then
                    echo "ERROR: Failed to open Terminal window."
                    echo "Use --detach or --attach instead."
                    exit 1
                fi
                ;;
        esac
        
        echo "✓ New terminal window opened"
    fi
else
    echo "Starting llama-server..."
    echo "  Model: unsloth/Qwen3.6-27B-MTP-GGUF"
    echo "  Port: 8080"
    echo "  Context: 262144"

    llama-server \
      --hf-repo unsloth/Qwen3.6-27B-MTP-GGUF \
      --hf-file "Qwen3.6-27B-Q8_0.gguf" \
      --spec-type draft-mtp \
      -ngl 999 \
      -fa on \
      -c 262144 \
      --port 8080 \
      > /dev/null 2>&1 &

    LLAMA_PID=$!
    echo "✓ llama-server started (PID: $LLAMA_PID)"
    echo ""

    echo "Starting litellm proxy..."
    echo "  Config: /Users/goran/code/litellm_config/litellm_config.yaml"
    echo "  Port: 4000"

    litellm --config /Users/goran/code/litellm_config/litellm_config.yaml --port 4000 \
      > /dev/null 2>&1 &

    LITELLM_PID=$!
    echo "✓ litellm started (PID: $LITELLM_PID)"
    echo ""

    cat > .llm-stack.pids <<EOF
USE_TMUX=false
LLAMA_SERVER_PID=$LLAMA_PID
LITELLM_PID=$LITELLM_PID
EOF

    echo "=== OpenWiki LLM Stack Started ==="
    echo ""
    echo "Services:"
    echo "  llama-server: http://localhost:8080 (PID: $LLAMA_PID)"
    echo "  litellm proxy: http://localhost:4000 (PID: $LITELLM_PID)"
    echo ""
    echo "To stop the stack:"
    echo "  ./scripts/stop-openwiki-llm-stack.sh"
    echo ""
    echo "Or manually:"
    echo "  kill $LLAMA_PID $LITELLM_PID"
    echo ""
    echo "To update OpenWiki documentation:"
    echo "  openwiki --update \"<your prompt here>\""
    echo ""
fi
