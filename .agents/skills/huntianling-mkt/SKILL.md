---
name: huntianling-mkt
description: Collect a HuntianLing development slice as original requirements with source quotes. Use when the user states a need for this repository. Does not design, code, or accept delivery.
---

# HuntianLing MKT

Role: collect. Depth default: 1 (fill schema, validate, human confirm). Depth 0: human fills the same schema.

## Covers

Customer or maintainer talk about what HuntianLing should do. Output: `original-requirement.json` with quotes.

## Does not cover

Technical design, file lists, code, Task splits, acceptance of a slice.

## Output

Write `.agents/self-harness/slices/<id>/original-requirement.json`:

- `role`: `mkt`
- `rawQuotes`: at least one `{ text, source }`
- `goal`, optional `actors`, `scenarios`, `constraints`, `nonGoals`, `openQuestions`
- `confirmed`: true only after the user agrees
- no `technicalDesign`, `files`, or `code` keys

Validate: `pnpm run self-harness:validate -- <file>`. Missing quotes fail. Extra design fields fail.

Load [the self-harness router](../huntianling-self-harness/SKILL.md) for handoff `collect_complete`.
