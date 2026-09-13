---
doc_status: active
doc_version: 2026-09-13.1
created: 2026-09-13
last_reviewed: 2026-09-13
review_after: 2026-09-27
archive_after: 2026-12-13
---

# Customer Capability Acceptance Review

English | [中文](2026-09-13-customer-acceptance.zh.md)

## Summary

Acceptance of product commit `614dcd6` is **revision-required**. The customer cannot rely on a delivered label as proof of working software. A throwing candidate, forged CI evidence, and code changed after evaluation can all reach delivered. D16 and D18-D21 remain incomplete against the [backlog](../backlog.md); the narrow component pass in the D18-D21 slice record does not certify customer acceptance.

Verification used a real Cordis root composition, SQLite, authenticated HTTP, an isolated Chromium browser, and fresh temporary workspaces. The executor was an external coding agent with two read-only reviewers, not HuntianLing runtime Agents. No existing customer data or remote Issue was modified. Failed findings remain open; this review does not authorize release.

## Contents

- [Evidence](#evidence)
- [Blocking Findings](#blocking-findings)
- [Business Coverage](#business-coverage)
- [Repair Acceptance](#repair-acceptance)

## Evidence

| Check | Observed result | Limit |
| --- | --- | --- |
| Build and plugin smoke | Passed | Smoke validates loading and exports, with Web disabled; it does not exercise customer delivery. |
| Repository regression | 466 passed, 1 skipped, 0 failed | PostgreSQL live test skipped; mocks and HTML-string tests are included in the count. |
| Production HTTP acceptance | 10 passed, 3 failed | Customer developer-data isolation, forged-evidence rejection, and local CI execution failed. [Recorded results](2026-09-13-customer-http-results.json). |
| Runtime counterexamples | Five defects reproduced | A successful diagnostic exit means reproduction, not acceptance. |
| Browser | Login, project creation, clarification, candidate generation/approval, hierarchy, milestone creation, workspace navigation, template clone and dry-run exercised | Customer confirmation and default developer navigation have gaps; a dry-run is simulation. |
| Quality gates | Lint and hygiene blocked by probe scripts | Neither gate can be called passing. |

Run the checks from the repository root after building:

```sh
pnpm run build
pnpm run test:e2e
pnpm run test:e2e:customer
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs runtime
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs forged
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs stale
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs approval
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs demo
```

The HTTP suite exits 1 when a required behavior fails. It binds loopback port 0 and deletes its private workspace after disposing services. The runtime diagnostic retains its generated private directory and prints its path for inspection. Neither uses a remote repository or a configured customer database. Sandbox `listen EPERM` required a host retry; the retry passed repository regression and exposed the HTTP product failures above.

Browser artifacts from this run are local files under `output/playwright/`: `customer-confirmed.png`, `customer-mobile.png`, `developer-design-empty.png`, `backlog-approved.png`, `plans.png`, `team.png`, `runs.png`, `evidence.png`, `admin-board.png`, and `workflow-dry-run.png`. Desktop used 1440 by 1000 for board views; customer mobile used 390 by 844 and showed no document-width overflow. These observations are not a complete responsive or accessibility certification.

## Blocking Findings

| Priority | Reproduction and impact | Source and requirements |
| --- | --- | --- |
| P1 | `runtime`: a file containing the acceptance comment followed by a thrown error exits 1, but Evaluator passes and delivered persists after Board reload. No post-generation test commands run. | [runtime.ts](../../../src/host/agents/runtime.ts): candidate writer, `evaluateCandidate`, and generated execution references. `REQ-HARNESS-003`, `REQ-HARNESS-006`, `REQ-HARNESS-008`. |
| P1 | `forged` and the HTTP suite: `ci:never-executed` plus passing/executed labels permits delivered without any real CI or Git result. HTTP returns 200. | [executed-evidence.ts](../../../src/host/board/executed-evidence.ts), [server.ts](../../../src/host/web/server.ts): delivery-evidence write and status APIs. `REQ-EVIDENCE-001`, D16. |
| P1 | `stale`: replace candidate code after evaluation, reload Board, and transition to delivered. The code hash changes, but the evidence remains valid. | [executed-evidence.ts](../../../src/host/board/executed-evidence.ts): `workItemDesignRevision`. `REQ-HARNESS-002`, `REQ-HARNESS-003`, D20. |
| P1 | `approval`: no MKT session or candidate exists, source input is empty, and body says draft. Delivery supplies `confirmed: true` and completes. | [delivery/service.ts](../../../src/host/delivery/service.ts): Planner inputs. `REQ-MKT-001`, `REQ-HARNESS-006`, `REQ-HARNESS-008`. |
| P1 | `demo`: check commands use `process.exit(0)`; generated files contain marker templates. There is no source application, intake session, or self-development changeset reference, yet customer progress is delivered. | [harness/service.ts](../../../src/host/harness/service.ts): `demonstrateSelfDevelopment`. `REQ-HARNESS-005`, D21. |
| P1 | Customer GET of its own project's developer-board returns team, authority, design, and progress records. HTML shell denial does not protect the API. | [server.ts](../../../src/host/web/server.ts): developer-board handler. `REQ-WEB-007`, `REQ-AUTH-001`. |
| P1 | Production local CI returns pending checks with `runner not configured`; neither command writes its expected marker file. A registered tool does not establish command execution. | [ci/service.ts](../../../src/host/ci/service.ts): default runner; [ci/plugin.ts](../../../src/host/ci/plugin.ts). `REQ-CI-001`. |
| P1 | Read-only production-composition audit: OAuth start returns 302, callback returns 503 because exchange is not configured. Passing identity tests inject an exchange absent from plugin composition. No real provider login was verified. | [auth.ts](../../../src/host/web/auth.ts): `completeOAuth`; [web/plugin.ts](../../../src/host/web/plugin.ts). `REQ-AUTH-004`. |
| P1 | Browser: after confirmation and candidate generation, customer sees waiting-on-customer with no outstanding question or approval action. Developer default collect cannot open an unapproved candidate; design is empty. Approval works only after manually navigating to `/board` Intake. | [customer.ts](../../../src/host/web/pages/customer.ts), [developer.ts](../../../src/host/web/pages/developer.ts). `REQ-WEB-006`, `REQ-WEB-007`, `REQ-MKT-001`. |
| P2 | Browser: workflow-lab logout calls `/api/auth/password/logout`, receives 404, and leaves the user signed in. The working endpoint is `/api/auth/logout`. | [workflow-lab.ts](../../../src/host/web/pages/workflow-lab.ts): logout handler. `REQ-AUTH-001`, `REQ-WEB-002`. |

## Business Coverage

| Area | Demonstrated scope | Not accepted or not verified |
| --- | --- | --- |
| Intake / MKT | Customer chat and follow-ups; MD/TXT upload and parsed records; candidate approval | Business-specific analysis uses generic templates in this run. Live model, real OCR, and browser PDF/Word/image round trips remain unverified. |
| Backlog | Approved Epic/Feature/Story/Task hierarchy; API projections; desktop list | Customer scope confirmation, bulk edits, saved views, and complete acceptance coverage need scenario tests. First viewport still repeats headings and controls above actual rows. |
| Plans | Browser milestone creation; API listing; unplanned scope visible | Cross-milestone release acceptance and complete interactive scope assignment were not exercised. |
| Team / Chat | Capacity page and scoped member API reachable; regression covers roles, WIP, leases, and messages | Real concurrent Agents, multi-process resource conflicts, and durable chat recovery were not demonstrated. |
| Runs / workflows | Page navigation; static canvas API; browser clone and happy-path dry-run | No verified live three-Agent schedule, real failure/repair, or session recovery through the browser. |
| Evidence | Missing evidence blocks; forged evidence counterexample reproduced | Authenticity and candidate-version checks fail. The delivered label is not reliable. |
| Admin / auth | Password login/logout, project isolation, admin API denial, access page | Own-project developer data leaks. Membership shell reuses user listing; full management workflow and OAuth remain unaccepted. |
| Storage / SCM / CI | Real SQLite regression; local artifact storage; production CI failure observed | PostgreSQL, real remote push/PR/merge, hosted CI artifacts, and complete multi-service restart recovery remain unverified. |
| Governance / Skills / tools | Existing focused regressions and available API/catalog components | Legal/certification acceptance, live tool execution across skill stacks, and calibrated model capability are not established. |

The browser shows both a compact developer shell and a separate full board. Full-board workspaces exist; discoverability, terminology, scope confirmation, and action continuity between them need correction. An API or page being reachable is not proof that every CRUD operation or lifecycle criterion is complete.

## Repair Acceptance

The existing REQ ids retain ownership. First reject forged and stale evidence and prevent deterministic output from claiming executed delivery. Then connect dsh task/session/tool execution and real local CI, and verify customer behavior with an independent failing-then-passing check. Close customer API exposure and provide visible confirmation/approval navigation before repeating fresh-project acceptance.

Keep D18-D21 partial or revision-required until their full criteria pass. Retain the failing HTTP cases and these counterexamples as regression inputs. A repair must prove both rejected invalid evidence and accepted genuine execution on the exact candidate revision. Follow with isolated PostgreSQL, real OAuth/provider integration, cross-milestone delivery, and concurrent-team scenarios before claiming complete customer capability.
