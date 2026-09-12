---
doc_status: active
doc_version: 2026-09-12.2
created: 2026-09-12
last_reviewed: 2026-09-12
review_after: 2026-09-26
archive_after: 2026-12-12
---

# Harness Runtime Alignment Review

English | [中文](2026-09-12-runtime-alignment.zh.md)

## Summary

The inspected working-tree snapshot contained D2 workflow templates and D3 implementation/evaluation artifacts. In that snapshot, the default Story delivery path reported completion and produced customer-visible delivery evidence without creating application code or executing acceptance checks. This dated reproduction does not establish whether subsequent D6 or later changes fixed the findings. [Backlog D16–D21](../backlog.md#d16d21--defect-correction-acceptance) owns the follow-up slices and acceptance obligations.

This review covers the shared working tree on 2026-09-12, including uncommitted files, rather than a released build or a fixed commit. It preserves the internal WorkItem model, board shells, requirement records, workflow persistence, and scoped D2/D3 results. It does not re-evaluate every D2/D3 criterion or certify those slices. The intended implementation recipient is Grok, identified by the user as having reached D6; an independent Evaluator must verify each correction before completion is recorded. A repository handoff document does not prove that the recipient has received or acknowledged it.

## Contents

- [Reproduction](#reproduction)
- [Open findings](#open-findings)
- [Handoff and acceptance](#handoff-and-acceptance)
- [Verification limits](#verification-limits)

## Reproduction

From the repository root, build the current source and run the isolated diagnostic:

```sh
pnpm run build
node docs/requirements/reviews/2026-09-12-runtime-repro.mjs
```

The diagnostic creates a temporary project with no application code and with `typecheck` and `test` scripts set to `exit 1`. It uses the production service constructors, supplies the same `environmentReady: true` declaration as the developer start action, and removes its temporary project afterward. It prints observations; a zero exit status is not an acceptance result. It does not call a live model or exercise browser authentication.

| Observation | Result on 2026-09-12 | Required behavior |
| --- | --- | --- |
| Default environment preparation | `ready: false` | Required checks must execute or block preparation. |
| `canStartImplementation` | `true` despite failing scripts | The call must not manufacture passing checks. |
| Story delivery | `completed` | No completion without actual implementation and independent evaluation. |
| Claimed generated file | `src/login-application.ts` does not exist | The implementation must identify actual produced artifacts. |
| Generator self-check | Typecheck and test are `pass` | Status must come from executed checks. |
| Evaluator | Criterion is `pass`, evidence is `deterministic-evaluator` | Evaluation must inspect the candidate and retain reproducible evidence. |
| Delivery evidence and transition | Executed evidence recognized; `delivered` allowed | Simulated output must not satisfy a production delivery gate. |
| Customer progress | `delivered` | Progress must reflect verified customer behavior. |

## Open findings

| Priority | Finding and source | Affected requirements |
| --- | --- | --- |
| P0 | [Agent runtime](../../../src/host/agents/runtime.ts) fabricates Generator file names and passing self-checks. Evaluator maps acceptance strings to passing criteria unless the caller supplies failures. [Evidence persistence](../../../src/host/agents/evidence.ts) marks these results `executed`, and [delivery evidence checks](../../../src/host/board/executed-evidence.ts) accept them. | `REQ-HARNESS-003`, `REQ-HARNESS-006`, `REQ-HARNESS-008`, `REQ-WEB-007` |
| P0 | [Environment service](../../../src/host/environment/service.ts) defaults to skipped checks but injects an always-passing runner in `canStartImplementation`. [Developer start](../../../src/host/web/pages/developer.ts) supplies `environmentReady: true`. Production readiness is not established by those declarations. | `REQ-HARNESS-001`, `REQ-HARNESS-005` |
| P1 | [Story delivery](../../../src/host/delivery/service.ts) invokes deterministic task functions. Its inputs do not connect a real candidate revision, evaluator findings, and subsequent code repair. Planner input declares `confirmed: true`; it must instead preserve the actual scope decision and its authority. | `REQ-HARNESS-006`, `REQ-HARNESS-007`, `REQ-HARNESS-008` |
| P1 | [Coding Skills](../../../src/host/skills/coding-pack.ts) declare `valid`, depth steps, and trivial examples. The Story path does not select the existing method. This does not prove that Skill instructions, sensors, and depth choices control actual coding tasks. MKT's separate validation work is outside this finding. | `REQ-SKILL-005`, `REQ-SKILL-006`, `REQ-HARNESS-007` |
| P1 | [Delivery checkpoints](../../../src/host/delivery/service.ts) persist stages but initialize `repositoryRevision` to an empty string. [Evidence revision](../../../src/host/board/executed-evidence.ts) hashes requirement/design fields, not the candidate code. Real session recovery and evidence invalidation after code changes require separate acceptance. | `REQ-HARNESS-002`, `REQ-HARNESS-003` |
| P1 | [Self-development demonstration](../../../src/host/harness/service.ts) uses `demoRunner` and a forced first evaluator failure. The recorded deterministic/live-model caveat is useful, but a scripted demonstration cannot certify fresh-project onboarding or real Agent delivery. | `REQ-HARNESS-005`, `REQ-HARNESS-008` |

## Handoff and acceptance

Grok should retain the existing D1–D15 sequence and current progress, then execute the appended D16–D21 correction slices. Recheck each finding against the latest source and attach independent evidence for any fix already present; this dated review does not require interrupting the current slice. Do not remove delivered board/template capabilities, blanket-reset requirements, or expand a competing model runtime. Resolve the actual dsh host task/session/tool APIs and make missing integration capabilities explicit dependencies.

For each correction, use the repository self-harness pack to record the affected requirements, reviewed design, testable acceptance, implementation evidence, and independent evaluation. Label external-Agent, manual, deterministic demonstration, and HuntianLing-runtime execution accurately. An `independent: true` field or a schema-valid evaluation file alone is not proof that a separate evaluator executed checks.

The first acceptance must exercise a production entry path with the negative case above: no application and failing checks must block both completion and customer delivery. The positive case must start from a fresh project, collect and confirm requirements, execute the three Agents through dsh, create running code, fail a real acceptance criterion, repair from the finding, and pass independent evaluation. Repeat environment preparation on a second project. Interrupt a real run and reconcile its code, session, and pending effects before resuming. Preserve command/session/artifact references for the independent reviewer.

## Verification limits

The review reproduced the default service-path false completion. The earlier focused run of Agent, environment, Story delivery, customer progress, and harness measurement tests passed 36 tests; those deterministic tests did not detect this counterexample. No live three-Agent coding run or end-to-end fresh-project customer acceptance was verified by this review. Remaining findings identify code-level gaps and required acceptance, not new claims of runtime completion.
