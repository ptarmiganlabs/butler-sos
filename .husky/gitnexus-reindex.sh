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

command -v node >/dev/null 2>&1 || exit 0

# The pinned version, the analyze flags and the npx invocation all live in
# scripts/gitnexus.js — one definition shared by this hook and the gitnexus:* npm
# scripts, so there is no second copy to keep in sync.
#
# `check` probes for an already-installed copy without fetching one. Nothing on this
# path may download: a hook that installed and executed a package after every commit
# would be a supply-chain surface (SonarCloud shell:S6505, and a fair point). GitNexus
# is not a devDependency either — ~40 MB unpacked with native tree-sitter builds is a
# lot to add to every CI install for a local developer convenience — so it is fetched
# once, deliberately, by `npm run gitnexus:install`.
if ! node scripts/gitnexus.js check >/dev/null 2>&1; then
    echo "gitnexus: not installed — run 'npm run gitnexus:install' to enable auto-reindexing." >&2
    exit 0
fi

# Retried once: the KuzuDB index is held open by the GitNexus MCP server when an
# agent session is running, and a write from here can lose that lock race. A silent
# stale index defeats the whole point, so give it a second chance before giving up.
reindex() {
    node scripts/gitnexus.js index >/dev/null 2>&1
}

if ! reindex; then
    sleep 2
    if ! reindex; then
        echo "gitnexus: index refresh failed twice; run 'npm run gitnexus:index' manually." >&2
        exit 0
    fi
fi

exit 0
