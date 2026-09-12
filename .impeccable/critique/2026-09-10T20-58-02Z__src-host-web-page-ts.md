---
target: src/host/web/page.ts
total_score: 20
max_score: 40
na_heuristics:
p0_count: 1
p1_count: 4
assessment: dual-agent
target_identity: "file:/Users/kenyle/workspace/agent/deepseek-harness-plugin/src-host-web-page-ts"
timestamp: 2026-09-10T20-58-02Z
slug: src-host-web-page-ts
---
Method: dual-agent (A: 01a08d13-42e5-7be2-88cd-ca8ecd2c5980 · B: 01a08d13-4389-71b1-82b5-1b49a8057a05)

Target: src/host/web/page.ts
Date: 2026-09-10
Score: 20/40

Conclusion:
The product information architecture is directionally right, but the current interface is not yet commercial-grade. The biggest problem is not a missing feature list; it is that each workspace still exposes too much shared implementation inventory. Intake, Backlog, Plans, Team, Runs, Evidence, and Admin need distinct primary work surfaces. The current implementation repeatedly falls back to generic WorkItem cards, KPI tiles, badges, and side panels, which makes different business areas feel visually and operationally similar.

Evidence:
- Mechanical detector result for src/host/web/page.ts: no static issues found.
- Real browser preview was tested at desktop and mobile widths against a populated project.
- Backlog has roughly 76 visible controls on desktop and 74 on mobile, with mobile content height around 8541px.
- Plans mobile board content starts around y=1708, after context/sidebar material.
- Workflow/Runs desktop internal content overflows roughly 1909/985 and mobile content height is around 10979px.
- Evidence desktop internal content overflows roughly 1273/985.
- Admin CRUD mobile content height is around 16670px; Audit around 12000px.

Priority findings:
- P0: Mobile and narrow layouts put shell/context/sidebar content before the actual workbench. The user must scroll through navigation, project context, and tree/settings panels before reaching the real task surface.
- P1: Workspace identity collapses because Plans, Team, Runs, and Evidence repeatedly present generic WorkItem cards instead of workspace-specific artifacts.
- P1: Backlog is overloaded. Saved views, columns, filters, risk filters, bulk edit, hierarchy, cards, insights, and detail affordances appear together instead of being progressively disclosed.
- P1: Runs and Evidence can hide critical state because content overflows inside the viewport and status/gate content is not organized around actionable decisions.
- P1: Admin mixes project/access settings, CRUD workbenches, and audit history in a single heavy management surface.
- P2: Product terminology is inconsistent across Chinese/English labels, and the static browser title weakens commercial polish.

Workspace recommendations:
- Intake should center on request sessions, source documents, chat intake, and candidate requirement review. Candidate editing should move to a focused inspector instead of repeating inside every card.
- Backlog should center on one professional workbench: hierarchy/table, filter toolbar, bulk action bar, and side inspector. Tree, coverage, and roadmap should be separate work modes, not stacked context before the workbench.
- Plans should behave like a milestone planning tool: roadmap timeline, scope by milestone, delivery slices, dependency/capacity hints, and release confidence. Generic work cards should be secondary.
- Team should behave like a capacity and collaboration console: role board, WIP, ownership, rebalance actions, coverage gaps, and handoffs. Assigned WorkItem cards should not dominate the page.
- Runs should behave like a run-control console: story queue, active runs, handoffs, blockers, approvals, evidence gates, and CI/PR state. Diagnostic status lanes should not compete with the primary run queue.
- Evidence should behave like an evidence and gate remediation workbench: required checks, missing evidence, owner/action/date, and unblock requests. "No config" must not look equivalent to passed evidence.
- Admin should be split into subview-specific pages for access, CRUD, audit, workflow templates, auth/OAuth, data retention, and system policy. Shared project/access forms should not lead every Admin view.

Next implementation slice:
Start with IA shell and workspace separation. Make each area render one primary surface, move contextual material into inspectors/drawers, fix mobile ordering, and remove repeated generic cards from non-Backlog pages. Then harden Runs/Evidence overflow and Admin subview separation.
