---
name: huntianling-generator
description: Implement a confirmed HuntianLing delivery contract in this repository. Use after Planner confirmation and environment ready. Self-check cannot mark the slice accepted.
---

# HuntianLing Generator

Role: implement. Depth default: 1.

## Covers

Code, tests, and bilingual docs in this repo that match the delivery contract. Follow `AGENTS.md`.

## Does not cover

Changing `REQ-*` scope, accepting the slice, recording probe lint/hygiene as pass.

## Output

Write `.agents/self-harness/slices/<id>/implementation-record.json`:

- `role`: `generator`
- `files`: paths touched
- `selfCheck`: `typecheck`, `test`, `docSync` as `pass` | `fail` | `skipped`; `lint` and `hygiene` as `blocked` while they probe-fail
- no `accepted` or `delivered` key

Validate the file. Failed self-check → repair or stop. Handoff `evaluate`.

When `repair-handoff.json` exists in the slice directory, apply those failed criteria, then re-run `pnpm run self-harness:loop -- --slice <dir> --check <command>`. Do not mark the slice accepted.
