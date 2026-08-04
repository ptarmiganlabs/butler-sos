#!/bin/sh
#
# Refresh the GitNexus knowledge-graph index after git changes the working tree.
#
# Why a hook rather than documentation: CLAUDE.md already tells agents to re-index
# when the index goes stale, and it still went stale (indexed at b9838d0 while
# master sat at eff55fc). Instructions are a backstop; the hook is the mechanism.
#
# This runs SYNCHRONOUSLY because an incremental index is fast. Running in the
# background would buy little and risks concurrent writers corrupting KuzuDB.
#
# It never blocks a git operation: every failure path exits 0.

set -u

# A missing index means a FULL build, which is far too slow to run inside a hook.
# Leave it to the developer and say so once.
if [ ! -d ".gitnexus" ]; then
    echo "gitnexus: no index in this checkout — run 'npm run gitnexus:refresh' to build one." >&2
    exit 0
fi

command -v npx >/dev/null 2>&1 || exit 0

# Pinned deliberately. This hook runs automatically after routine git operations,
# so an unpinned `npx gitnexus` would execute whatever the registry serves at that
# moment — a new major, or a compromised release — with no repository change and no
# review. Keep this in sync with the gitnexus:* scripts in package.json.
GITNEXUS_VERSION=1.6.5

# --skip-agents-md stops gitnexus rewriting the managed block in CLAUDE.md and
# AGENTS.md. Both files also carry hand-written sections, and the generated block
# is not merely regenerated but *reduced* without --skills: running a bare
# `analyze` here deleted all 20 rows of the generated-skills table from both files.
# --no-stats is kept as belt-and-braces for anyone who runs analyze without the skip.
#
# No --embeddings: it is the slow part, and a plain analyze preserves any
# embeddings already in the index. Use `npm run gitnexus:refresh` to regenerate
# them together with the generated skill files.
#
# Retried once: the KuzuDB index is held open by the GitNexus MCP server when an
# agent session is running, and a write from here can lose that lock race. A silent
# stale index defeats the whole point, so give it a second chance before giving up.
reindex() {
    npx --yes "gitnexus@${GITNEXUS_VERSION}" analyze --no-stats --skip-agents-md >/dev/null 2>&1
}

if ! reindex; then
    sleep 2
    if ! reindex; then
        echo "gitnexus: index refresh failed twice; run 'npm run gitnexus:index' manually." >&2
        exit 0
    fi
fi

exit 0
