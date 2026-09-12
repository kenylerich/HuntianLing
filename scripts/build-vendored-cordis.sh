#!/usr/bin/env bash
# Build the four vendored cordis-family packages in topological order.
# The vendored tsconfig.json files extend `../../tsconfig.base.json`,
# which only exists in the host dsh repo. This script synthesises a
# minimal `.tsconfig.cordis-base.json` at the workspace root, rewrites
# each vendored tsconfig's `extends` to point at it, runs `tsc -b`,
# synthesises a tsdown config (when missing) and runs `tsdown` so the
# package emits the bundled `lib/index.js` that Node resolves through
# its `main` field, and restores the original tsconfig content from a
# temporary backup so the commit is not modified.
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
#   - `pnpm dlx tsdown@latest` fails because tsdown.config.ts does
#     `import { defineConfig } from 'tsdown'`, and Node ESM resolution
#     from the dlx sandbox cannot find the package on its search path.
#     We add `tsdown` as a devDependency to each vendored package
#     before running `pnpm exec tsdown`, so resolution succeeds.
#   - `cosmokit`, `cordis`, and `include` do not ship a tsdown config,
#     but each needs `lib/index.js` because the package's `main` and
#     `exports[".]".default` point at it. The HuntianLing e2e script
#     imports `Context` from `@deepseek-ai/cordis`, which would fail
#     without a bundled entry. We synthesise a minimal tsdown config
#     for any package missing one, mirroring the loader's settings.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Track every vendored tsconfig and package.json we mutate, plus every
# tsdown config we synthesise, so the EXIT trap can restore them even
# when an inner step fails. Per-package restore is required because
# the package references reach across siblings (cordis -> cosmokit,
# loader -> cordis), and a partially-restored tree would break a later
# `tsc -b`. `pnpm add` mutates package.json and pnpm-lock.yaml as a
# side effect; both must be reverted to keep the commit unmodified.
BACKUP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/huntianling-vendor-build.XXXXXX")
TSDOWN_SYNTHESIS_LIST="$BACKUP_DIR/tsdown-synthesis-dirs"
: > "$TSDOWN_SYNTHESIS_LIST"

cleanup() {
  for pkg in cosmokit cordis include loader; do
    if [ -f "$BACKUP_DIR/$pkg.tsconfig.json" ]; then
      cp "$BACKUP_DIR/$pkg.tsconfig.json" "$REPO_ROOT/vendor/$pkg/tsconfig.json"
    fi
    if [ -f "$BACKUP_DIR/$pkg.package.json" ]; then
      cp "$BACKUP_DIR/$pkg.package.json" "$REPO_ROOT/vendor/$pkg/package.json"
    fi
  done
  while IFS= read -r dir; do
    if [ -z "$dir" ]; then
      continue
    fi
    rm -f "$dir/tsdown.config.ts"
  done < "$TSDOWN_SYNTHESIS_LIST"
  rm -f "$REPO_ROOT/.tsconfig.cordis-base.json"
  rm -rf "$BACKUP_DIR"
  # `pnpm add` rewrites the workspace lockfile in place; restore it
  # from git so the commit is unchanged on a green run too.
  git -C "$REPO_ROOT" checkout -- pnpm-lock.yaml 2>/dev/null || true
}
trap cleanup EXIT

# 1. Synthesise a stand-in for dsh's tsconfig.base.json. The trap
#    above removes it on exit. `lib` includes ES2024 so vendored
#    sources can rely on AggregateError, WeakRef, Error.cause,
#    Object.hasOwn, and the rest of the modern runtime surface the
#    dsh family uses without per-package overrides.
cat > .tsconfig.cordis-base.json <<'BASE'
{
  "compilerOptions": {
    "target": "es2024",
    "lib": ["es2024"],
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

# 2. Capture every vendored tsconfig and package.json first, then
#    rewrite the tsconfigs in place so cross-package references
#    resolve to rewritten siblings before any `tsc -b` runs. A
#    per-iteration rewrite would leave a downstream package pointing
#    at an unrestored upstream.
for pkg in cosmokit cordis include loader; do
  cp "vendor/$pkg/tsconfig.json" "$BACKUP_DIR/$pkg.tsconfig.json"
  cp "vendor/$pkg/package.json" "$BACKUP_DIR/$pkg.package.json"
  python3 "$REPO_ROOT/scripts/rewrite-vendored-tsconfig.py" \
    "vendor/$pkg/tsconfig.json"
done

# 3. Install + build each package in topological order. tsconfig is
#    left rewritten between steps so `tsc -b` can read the upstream
#    composite flag; the EXIT trap restores everything.
for pkg in cosmokit cordis include loader; do
  echo "=== vendor/$pkg ==="
  cd "vendor/$pkg"

  # `pnpm install --ignore-scripts --no-frozen-lockfile` populates the
  # vendored package's node_modules from the workspace lockfile. Keep
  # the store under the repository so a sandboxed local run and an
  # escalated local run do not disagree on link ownership. We then
  # add `tsdown` and `typescript` as devDependencies so both binaries
  # resolve through the package's own node_modules: the bare
  # `import { defineConfig } from 'tsdown'` inside tsdown.config.ts
  # needs `tsdown` on disk, and `pnpm exec tsc` lets us reuse a pinned
  # 5.7 release that supports `rewriteRelativeImportExtensions`.
  pnpm install --store-dir "$REPO_ROOT/.pnpm-store" --ignore-scripts --no-frozen-lockfile >/dev/null
  pnpm add --store-dir "$REPO_ROOT/.pnpm-store" --save-dev tsdown@latest typescript@5.7 >/dev/null

  # --force ensures tsc re-reads the rewritten tsconfig rather than
  # serving the previous build from its .tsbuildinfo cache.
  pnpm exec tsc -b --force tsconfig.json

  # Synthesise a minimal tsdown config when the package does not ship
  # one. The settings mirror the loader's: bundle lib/types/index.js
  # to lib/index.js so Node's package.json `main` resolution finds it.
  if [ ! -f tsdown.config.ts ] && [ ! -f tsdown.config.js ]; then
    cat > tsdown.config.ts <<'TSDOWN'
import { defineConfig } from 'tsdown'

const shared = {
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  outputOptions: { codeSplitting: false },
  dts: false,
  clean: false,
} as const

export default defineConfig([
  { ...shared, entry: ['lib/types/index.js'] },
])
TSDOWN
    printf '%s\n' "$PWD" >> "$TSDOWN_SYNTHESIS_LIST"
  fi

  # `pnpm exec tsdown` runs the locally-installed binary so its config
  # file's bare `tsdown` import resolves through the package's
  # node_modules.
  pnpm exec tsdown

  cd "$REPO_ROOT"
done

# 4. All packages succeeded. The trap would restore everything on
#    exit; disable it and drop the synthesised artefacts explicitly
#    so the working tree is identical to the committed state.
trap - EXIT
for pkg in cosmokit cordis include loader; do
  cp "$BACKUP_DIR/$pkg.tsconfig.json" "vendor/$pkg/tsconfig.json"
  cp "$BACKUP_DIR/$pkg.package.json" "vendor/$pkg/package.json"
done
while IFS= read -r dir; do
  if [ -z "$dir" ]; then
    continue
  fi
  rm -f "$dir/tsdown.config.ts"
done < "$TSDOWN_SYNTHESIS_LIST"
rm -f .tsconfig.cordis-base.json
rm -rf "$BACKUP_DIR"
git checkout -- pnpm-lock.yaml 2>/dev/null || true
