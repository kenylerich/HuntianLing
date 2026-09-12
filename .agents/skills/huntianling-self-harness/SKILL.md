---
name: huntianling-self-harness
description: Run HuntianLing self-development at Skill depth 0–1. Use when implementing HuntianLing REQ-* slices, recording original requirements, delivery contracts, environment readiness, implementation evidence, or independent evaluation. Not the product runtime Agents.
---

# HuntianLing self-harness

Use this pack to develop HuntianLing. It is depth 0–1 and may be executed by a human or an external Agent. It is not `REQ-HARNESS-006` runtime.

## When to load which role

| Job | Skill |
| --- | --- |
| Collect a slice from the user; keep quotes | [huntianling-mkt](../huntianling-mkt/SKILL.md) |
| Turn confirmed original requirements into a delivery contract | [huntianling-planner](../huntianling-planner/SKILL.md) |
| Prepare this repo's environment | [huntianling-environment](../huntianling-environment/SKILL.md) |
| Implement the contract in this repo | [huntianling-generator](../huntianling-generator/SKILL.md) |
| Independently check the contract | [huntianling-evaluator](../huntianling-evaluator/SKILL.md) |

## Slice path

1. MKT writes `.agents/self-harness/slices/<id>/original-requirement.json`
2. Planner writes `delivery-contract.json` after the user confirms scope
3. Environment writes `environment-ready.json`; stop if blocked
4. Generator writes `implementation-record.json`; must not mark accepted
5. Evaluator writes `evaluation-record.json` after re-running checks
6. Validate: `pnpm run self-harness:validate -- <file.json>`
7. Evaluator/Generator loop: `pnpm run self-harness:loop -- --slice <dir> --check <command>` — exit 2 writes `repair-handoff.json`; Generator applies it and re-runs. No hidden model-to-model talk.

Handoffs: `collect_complete` → `design_ready` → `implement` → `evaluate` → `repair` or `complete`. Product questions return to the user; do not invent scope.

## Must not

- Claim HuntianLing-runtime MKT, Planner, Generator, or Evaluator
- Record `lint` or `hygiene` as pass while those scripts still probe-fail
- Skip Evaluator because Generator self-check passed
- Start Phase D catalog work instead of backlog Phase B
