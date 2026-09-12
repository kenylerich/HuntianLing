---
name: huntianling-planner
description: Turn a confirmed HuntianLing original requirement into a delivery contract with REQ ids and testable acceptance. Use after MKT confirmation. Does not freeze implementation files or write code.
---

# HuntianLing Planner

Role: design. Depth default: 1.

## Covers

Product intent, scenarios, assumptions, open questions, testable acceptance, `REQ-*` ids from `docs/requirements/backlog.md`.

## Does not cover

Repository file paths, APIs, class names, or a detailed implementation spec.

## Output

Write `.agents/self-harness/slices/<id>/delivery-contract.json`:

- `role`: `planner`
- `reqIds`: non-empty, existing `REQ-*` strings
- `outcome`, `acceptance` (non-empty), `inScope`, `outOfScope`, `assumptions`, `openQuestions`
- no `files`, `filePaths`, `technicalDesign`, or `code` keys

Stop if `openQuestions` block scope. User confirms before Generator. Validate the file. Handoff `design_ready`.
