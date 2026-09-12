---
name: huntianling-environment
description: Prepare and record HuntianLing repo environment readiness. Use before Generator on a slice. Marks lint and hygiene blocked while they still probe-fail.
---

# HuntianLing environment

Role: environment. Depth default: 0 (run commands, record results).

## Covers

This repository's Node/pnpm toolchain: install, `typecheck`, `test`, `doc-sync`.

## Does not cover

Remote fleets, other project stacks, treating probe scripts as passing gates.

## Output

Write `.agents/self-harness/slices/<id>/environment-ready.json` after running:

- `pnpm run typecheck`
- `pnpm run test` (or the slice's focused tests)
- `pnpm run doc-sync` when docs change

Record each command as `pass`, `fail`, or `blocked`. `lint` and `hygiene` must be `blocked` while `package.json` still probe-exits. `ready` is true only when required commands passed and none of the required ones failed.

Validate the file. If not ready, Generator must not start.
