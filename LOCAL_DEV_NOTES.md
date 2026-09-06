# Local development notes

> **Operator-only notes**, not part of the published bundle. Delete before
> publishing or release.

## Why `pnpm run typecheck` does not run end-to-end yet

The HuntianLing skeleton imports types from `@deepseek-ai/cordis`, which is
vendored at `../deepseek-harness/vendor/cordis` (see the host dsh repo's
`vendor/README.md`). cordis is *not* published to npm; it is consumed from
the vendor tree by the dsh workspace, where its `package.json` references
its siblings via `workspace:^`.

Two preconditions must hold before the HuntianLing typecheck can resolve
cordis types:

1. The cordis family is published (or linked via a pnpm workspace that
   declares every sibling). HuntianLing declares `@deepseek-ai/cordis` as
   a `file:` dependency in `package.json`; that requires the vendor cordis
   `lib/` to be built, **or** a `pnpm-workspace.yaml` that pulls the full
   family — but the latter needs symlinks inside the dsh vendor tree, which
   the read-only host sandbox forbids.
2. TypeScript is configured to resolve cordis via the package's `exports`
   map (`./lib/types/index.d.ts`).

Until then, the HuntianLing source uses the cordis public API (`Plugin`,
`Context`, `Service`) by name. The names match cordis's own exports
(see `../deepseek-harness/vendor/cordis/src/{context,registry,service}.ts`)
so the code is structurally correct; only the formal typecheck gate is
deferred.

## Plan to make `pnpm run typecheck` run

The host dsh repository must publish `@deepseek-ai/cordis` (or a sibling
CI job must build `vendor/cordis/lib/` and the package's `exports` map
must point to it). Once that artifact exists:

1. Drop the `file:` dependency on `@deepseek-ai/cordis` in `package.json`.
3. Pin to the published version.
4. `pnpm install && pnpm run typecheck` should pass.

## Sandbox failure mode observed

`pnpm install` against the dsh vendor tree failed with:

```
EPERM: operation not permitted, symlink
'../../../../../deepseek-harness-plugin/node_modules/.pnpm/@standard-schema+spec@1.0.0/node_modules/@standard-schema/spec'
-> '/Users/kenyle/workspace/agent/deepseek-harness/vendor/cordis/node_modules/@standard-schema/spec'
```

The host dsh `vendor/` directory is read-only under the current sandbox,
so pnpm cannot create the workspace-internal symlinks. This is a sandbox
constraint, not a bug in this repository; do not retry by deleting files
under `vendor/`.
