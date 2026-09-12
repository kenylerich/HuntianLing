---
doc_status: active
doc_version: 2026-09-11.6
created: 2026-09-11
last_reviewed: 2026-09-11
review_after: 2026-10-11
archive_after: 2026-12-11
---

# Web Shell Refactor Plan

English | [中文](web-shell-refactor.zh.md)

## Summary

The current browser UI is one page that hides and shows seven agile workbenches. It does not split customer, developer, and admin. Features sit in one HTML document, so the page cannot say which job it is for. This plan records the code diagnosis and the slices that replace that shell. Product requirements stay in [the backlog](../requirements/backlog.md); this page owns the UI refactor sequence.

## Table of Contents

- [Code Diagnosis](#code-diagnosis)
- [Target Shells](#target-shells)
- [What Not To Do](#what-not-to-do)
- [Refactor Slices](#refactor-slices)
- [Tracking](#tracking)
- [Dev Note](#dev-note)

## Code Diagnosis

Observed in `src/host/web/page.ts` (about 12,200 lines: CSS, markup, and script in one `renderBoardPage()` string) and `src/host/web/server.ts` (about 5,200 lines of board aggregation).

| Problem | What the code does | Why it fails the product |
| --- | --- | --- |
| No audience shell | Login only sets `body.auth-locked`, which greys every rail button except Settings. Session principals have `roles` and `projectIds`, not `customer` / `developer` / `admin`. | `REQ-WEB-007` needs three shells after login. One cockpit is not that. |
| Classification is PM modules, not jobs | Rail: Intake, Backlog, Plans, Team, Runs, Evidence, Admin. Each area still shares header, health strip, board canvas, inspector, and sidebar. Switching area sets `hidden` on `data-area-panel` nodes; the rest of the page stays. | Users cannot tell whether they are collecting, designing, watching progress, or administering. |
| Features piled in one document | Create-WorkItem composer, intake session form, milestone form, team form, project form, login, API token, tree, health metrics, CRUD matrix, and audit live in the same markup. Inspector tab sets are long lists (summary, analysis, design, acceptance, source, children, audit). | Scan cost is high. Empty or unrelated controls remain in the layout. |
| Wrong labels for the product | Area owners are PO/BA, Scrum Master, QA. Stages are "Backlog refinement" and "E2E delivery run". Title is "HuntianLing Board". | The product is a vibe-coding harness with a standard development board, not an Azure Boards clone. |

`REQ-WEB-006` already split workspaces. That split is CSS visibility on one developer cockpit. It does not implement audience shells, MKT as the customer dialog, or the Agent Channel.

## Target Shells

One Web origin, one login, three documents or three routed shells. Same WorkItem records.

| Shell | Who | Primary jobs | Nav |
| --- | --- | --- | --- |
| Customer | `audience=customer` | Create own project; talk to MKT; see original requirements; see customer-safe progress | Project, Dialog, My requirements, Progress |
| Developer | `audience=developer` | Collect, design, inspect delivery progress, talk on Agent Channel, bind environment | Collect, Design, Progress, Channel, Environment |
| Admin | `audience=admin` | Users, membership, environment readiness, plugin config, audit | Users, Projects, Environment, Access, Audit |

Customer-safe progress remains submitted / waiting on customer / in analysis / in development / delivered. Developer Progress may show runs and evidence as two views of one job, not two top-level products. Admin does not edit requirement text as its primary job.

Layout rule for every shell: one job in the rail, one primary canvas, one inspector that only shows fields for that job. Create actions belong to the job that owns the record.

## What Not To Do

- Do not restyle the seven-module rail and call the refactor done.
- Do not keep all forms in one HTML file and hide them.
- Do not put Agent Channel or environment setup on the customer shell.
- Do not put Business CRUD coverage on a daily developer page.
- Do not grow `page.ts` further. New shells are new modules.

## Refactor Slices

Track these slices as WorkItems. Each slice names `REQ-*` ids and an exit check. Do not start slice 2 until slice 1 can route an audience without the old rail.

### Slice 0 — Split the page module

Files: `src/host/web/page.ts` into shell markup, CSS, and view scripts. No user-visible change required.

Exit: `page.ts` is a composer; CSS and workspace scripts load as separate modules. Unit tests still render a board page.

### Slice 1 — Login and audience routing

Requirements: `REQ-WEB-007`, `REQ-AUTH-001`.

- Persist `audience` on the session principal: `customer`, `developer`, `admin`.
- After login, open only that shell. Other shells return authorization errors.
- Unauthenticated users see login only, not a greyed cockpit.

Exit: three users, three landing pages; URL guess of another shell is denied.

### Slice 2 — Customer shell

Requirements: `REQ-WEB-007`, `REQ-MKT-001`, `REQ-INTAKE-001`, `REQ-HARNESS-008`.

- Create and open only that customer's projects.
- MKT dialog is the primary canvas.
- My requirements lists original requirements with source quotes.
- Progress uses customer-safe labels from evidence, not edited summaries.

Exit: a customer can submit talk, see their words, and see progress without Backlog, Team, Runs, Evidence, or Admin.

### Slice 3 — Developer shell restack

Requirements: `REQ-WEB-007`, `REQ-REQ-001`, `REQ-HARNESS-001`, `REQ-COLLAB-001`, `REQ-COLLAB-004`.

Replace the seven-module rail with five jobs:

| Job | Shows | Does not show |
| --- | --- | --- |
| Collect | MKT sessions and original requirements (developer view) | Customer-only copy; admin CRUD |
| Design | Analysis, design, acceptance, decomposition | Gate matrices as the home page |
| Progress | Runs, blockers, evidence as views of delivery | Team WIP as a peer product |
| Channel | Agent Channel (`REQ-COLLAB-004`) | Customer MKT history |
| Environment | Profile, readiness, blockers, repo binding | Plugin auth token admin |

Inspector tabs follow the active job. Team assignment can live on Design or Progress as a panel, not a top-level product.

Exit: a developer can collect, open design, see progress, and open Channel without an Intake/Backlog/Plans/Team/Runs/Evidence/Admin strip.

### Slice 4 — Admin shell

Requirements: `REQ-WEB-007`, `REQ-AUTH-001`, `REQ-AUDIT-001`.

- Users and audience assignment.
- Project membership.
- Environment readiness across projects.
- Plugin and access settings.
- Audit trail.

Exit: login, project create-for-customer, and CRUD coverage are not on the developer Collect or Design pages.

### Slice 5 — Remove the fused cockpit

- Delete unused rail, health dumps, and always-on composers from customer and admin shells.
- Keep `REQ-WEB-006` workspace rules inside each shell: one primary canvas, one inspector.
- Update [main-board-design](main-board-design.md) so its view catalog is the developer shell, not the only UI.

Exit: `git grep` for `module-rail` in customer/admin markup is empty; developer markup has no Admin/CRUD as a peer job.

## Tracking

| Slice | Status | Owner | REQ ids | Proof |
| --- | --- | --- | --- | --- |
| 0 Split page module | planned | Web | `REQ-WEB-001` | Page still renders; file is no longer one 12k-line string as the only UI source |
| 1 Audience routing | planned | Web/Auth | `REQ-WEB-007`, `REQ-AUTH-001` | Three landings; denied cross-shell routes |
| 2 Customer shell | planned | Web/MKT | `REQ-WEB-007`, `REQ-MKT-001`, `REQ-INTAKE-001` | Customer path without developer nav |
| 3 Developer restack | planned | Web | `REQ-WEB-007`, `REQ-REQ-001`, `REQ-COLLAB-004`, `REQ-HARNESS-001` | Five jobs; Channel and Environment present |
| 4 Admin shell | planned | Web | `REQ-WEB-007`, `REQ-AUDIT-001` | Admin-only settings and audit |
| 5 Remove fused cockpit | planned | Web | `REQ-WEB-006`, `REQ-WEB-007` | Old seven-module rail gone from product shells |

Implementation order in the backlog already puts audience shells in step 2. These slices are that step. Do not implement new Backlog/Plans/Team chrome on the fused page.

## Dev Note

None.
