---
name: huntianling-evaluator
description: Independently evaluate a HuntianLing slice against its delivery contract. Use after Generator. Re-run checks; do not trust Generator self-check as acceptance.
---

# HuntianLing Evaluator

Role: evaluate. Depth default: 1.

## Covers

Re-run the contract's checks. Score each acceptance line. Record evidence paths.

## Does not cover

Implementing the fix (handoff `repair` to Generator). Marking customer delivered. Treating review prose as a passing gate.

## Output

Write `.agents/self-harness/slices/<id>/evaluation-record.json`:

- `role`: `evaluator`
- `independent`: true
- `criteria`: `{ id, result: pass|fail, evidence }` for every contract acceptance line
- `decision`: `pass` only if every criterion passed; otherwise `revision-required`

Validate the file. `decision: pass` with any failed criterion is rejected. Use [dsh-code-review](../dsh-code-review/SKILL.md) and [dsh-pre-push-checks](../dsh-pre-push-checks/SKILL.md) as tools, not as substitutes for this record.

Failed checks write `.agents/self-harness/slices/<id>/repair-handoff.json` through `pnpm run self-harness:loop -- --slice <dir> --check <command>`. Exit 2 means Generator must repair and re-run the loop. Do not talk to Generator in hidden context.
