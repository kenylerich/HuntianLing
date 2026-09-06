#!/usr/bin/env bash
# Build the four vendored cordis-family packages in topological order.
# The vendored tsconfig.json files extend `../../tsconfig.base.json`,
# which only exists in the host dsh repo. This script synthesises a
# minimal `.tsconfig.cordis-base.json` at the workspace root, rewrites
# each vendored tsconfig's `extends` to point at it, runs `tsc -b` and
# (for packages that ship one) `tsdown`, and restores the original
# tsconfig content from an in-memory snapshot so the commit is not
# modified.
#
# Required:
#   - pnpm on PATH (run pnpm/action-setup before invoking this script)
#   - typescript@5.7 (the first version to recognise target: es2024
#     and rewriteRelativeImportExtensions, both used by the dsh
#     root tsconfig.base.json)
#   - @types/node (added to the HuntianLing root devDependencies so
#     node module resolution finds it from the vendored packages)
#
# Notes:
#   - The vendored tsconfig rewrite lives in a companion Python file
#     (scripts/rewrite-vendored-tsconfig.py) because embedding a
#     multi-line python -c block inside a bash script inlined in a
#     workflow YAML literal block was unreliable across bash versions.
#   - We force `composite: true` on every vendored tsconfig because
#     cordis references cosmokit, and tsc -b refuses a project
#     reference whose target is not composite.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# 1. Synthesise a stand-in for dsh's tsconfig.base.json.
cat > .tsconfig.cordis-base.json <<'BASE'
{
  "compilerOptions": {
    "target": "es2024",
    "module": "esnext",
    "moduleResolution": "bundler",
    "declaration": true,
    "composite": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["node"]
  }
}
BASE

# 2. Rewrite each vendored tsconfig and build.
for pkg in cosmokit cordis include loader; do
  echo "=== vendor/$pkg ==="
  cd "vendor/$pkg"

  # Capture the original tsconfig content, write a modified copy.
  ORIGINAL=$(cat tsconfig.json)
  python3 "$REPO_ROOT/scripts/rewrite-vendored-tsconfig.py"

  pnpm install --ignore-scripts --no-frozen-lockfile
  # --force ensures tsc re-reads the rewritten tsconfig rather than
  # serving the previous build from its .tsbuildinfo cache.
  pnpm dlx --package typescript@5.7 -- tsc -b --force tsconfig.json
  if [ -f tsdown.config.ts ] || [ -f tsdown.config.js ]; then
    pnpm dlx tsdown@latest
  fi

  # Restore the original tsconfig verbatim.
  printf '%s' "$ORIGINAL" > tsconfig.json

  cd "$REPO_ROOT"
done

# 3. Remove the synthesised base (it is also gitignored).
rm -f .tsconfig.cordis-base.json
