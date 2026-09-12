---
doc_status: active
doc_version: 2026-09-11.6
created: 2026-09-10
last_reviewed: 2026-09-11
review_after: 2026-10-10
---

# Main Board Design

English | [中文](main-board-design.zh.md)

Document lifecycle:

| Status | Version | Created | Last reviewed | Review after |
| --- | --- | --- | --- | --- |
| `active` | `2026-09-11.6` | 2026-09-10 | 2026-09-11 | 2026-10-10 |

## Summary

This document defines the main HuntianLing board surface. The board is the operating cockpit for requirements, Milestones, delivery progress, team assignment, workflow state, code evidence, and governance readiness. It is not a thin issue list and it is not a replacement for the workflow designer, Code View, governance dashboard, or Agent Team Chat.

The main board design can start now. The current backlog already contains the required product direction: internal WorkItem hierarchy, multi-project boards, requirement analysis and design fields, decomposition traceability, cross-Milestone delivery slices, team capacity, Agent collaboration, workflow visibility, code evidence, governance gates, authenticated Web access, and audit records.

## Table of Contents

- [Affected Requirements](#affected-requirements)
- [Design Position](#design-position)
- [Reader Model](#reader-model)
- [Core Principles](#core-principles)
- [Information Architecture](#information-architecture)
- [Primary Views](#primary-views)
- [Card Design](#card-design)
- [Detail Inspector](#detail-inspector)
- [Status Model](#status-model)
- [Traceability Model](#traceability-model)
- [Milestone Model](#milestone-model)
- [Team and Agent Integration](#team-and-agent-integration)
- [Workflow Integration](#workflow-integration)
- [Code and Evidence Integration](#code-and-evidence-integration)
- [Governance Integration](#governance-integration)
- [Data Read Model](#data-read-model)
- [API Requirements](#api-requirements)
- [Interaction Flows](#interaction-flows)
- [Implementation Slices](#implementation-slices)
- [Validation Checks](#validation-checks)
- [Open Decisions](#open-decisions)

## Affected Requirements

The first main board implementation should use these backlog entries as product inputs:

| Area | Requirement ids |
| --- | --- |
| Requirement authoring and decomposition | `REQ-REQ-001`, `REQ-BOARD-003`, `REQ-BOARD-004`, `REQ-TRACE-001` |
| Multi-project and Milestone planning | `REQ-BOARD-001`, `REQ-BOARD-002`, `REQ-MILESTONE-001`, `REQ-MILESTONE-002` |
| Web and authenticated access | `REQ-WEB-001`, `REQ-WEB-002`, `REQ-WEB-004`, `REQ-WEB-005` |
| Team, Agent, and collaboration | `REQ-TEAM-001`, `REQ-TEAM-002`, `REQ-TEAM-003`, `REQ-TEAM-004`, `REQ-COLLAB-001`, `REQ-COLLAB-002`, `REQ-COLLAB-003` |
| Workflow orchestration | `REQ-FLOW-005`, `REQ-FLOW-016`, `REQ-FLOW-017`, `REQ-FLOW-020` |
| SCM, CI, and evidence | `REQ-CODE-001`, `REQ-CI-001`, `REQ-EVIDENCE-001` |
| Governance and audit | `REQ-GOV-001`, `REQ-GOV-002`, `REQ-SEC-001`, `REQ-REL-001`, `REQ-TRUST-001`, `REQ-TRUST-002`, `REQ-AUDIT-001` |

## Design Position

The first product UI is three audience shells. Track that change in [the web shell refactor plan](web-shell-refactor.md). This document owns the developer-shell board views. The seven-module cockpit in `src/host/web/page.ts` is not the target product UI.

The standard development board is the developer-shell interface of the prepared dsh environment and three-Agent system. Intake and design show Planner outputs; development views show Generator work and runnable results; evaluation and acceptance show Evaluator findings. Users can supply information, revise designs, control execution, and accept work from these views. Environment provisioning and method execution happen behind the interface, with readiness and failures visible when they affect work.

The board serves [the harness delivery loop](../requirements/harness-engineering.md). Keep requirement analysis and design central, distinguish planned work, agent activity, and verified acceptance, and connect visible completion to current evidence. The first delivery slice uses the existing board to expose a real run; the full view catalog is not a prerequisite for agent execution.

In the developer shell, the main board is the daily entry point. It must let a product owner, engineer, reviewer, compliance owner, or Agent operator answer these questions without searching logs:

- Which requirement are we working on?
- Where is it in the lifecycle?
- How was it split?
- Which acceptance criteria are covered or uncovered?
- Which Milestone or delivery slice owns each part?
- Who or which Agent owns the next action?
- Which workflow step, approval, review, branch, pull request, CI run, or evidence record blocks delivery?
- Can the parent requirement be considered complete?

The board reads from HuntianLing's internal WorkItem model. External trackers may synchronize or mirror data, but the board does not depend on GitHub Issues or GitHub Projects.

## Reader Model

Web login selects one of three audiences (`REQ-WEB-007`). Internal roles below live inside the developer shell.

| Audience | Primary need |
| --- | --- |
| Customer | Create their project, talk to MKT, see original requirements they submitted, and inspect customer-safe progress. |
| Developer | Operate the standard development board: collection, design, progress, environment binding, and delivery evidence. |
| Admin | Manage users, project membership, environment readiness, and plugin configuration. |

Developer-shell roles (not login audiences):

| Role | Primary need |
| --- | --- |
| Product owner | Write requirements, review decomposition, prioritize Stories, and approve readiness. |
| Project manager | Track Milestones, blockers, ownership, WIP, delivery risk, and cross-Milestone progress. |
| Engineer | Select ready work, inspect context, create branches, and attach delivery evidence. |
| Reviewer or approver | Find pending reviews, approvals, missing evidence, and decision context. |
| Compliance, security, reliability, or trust owner | See required controls, missing evidence, residual risks, and release readiness. |
| Agent operator | Understand Agent assignment, capability limits, Skill gaps, workflow state, and Team Chat activity. |

## Core Principles

- The WorkItem tree is the source of truth for requirement hierarchy: Epic -> Feature -> Requirement or Story -> Task, plus Bug and Research.
- A Milestone is a delivery lens, not a parent in the requirement tree.
- A large requirement can span multiple Milestones through child items or explicit delivery slices.
- The board must show traceability before it shows progress. A fast-moving card is not enough if parent coverage is unclear.
- Parent completion is derived from child status, acceptance coverage, blockers, required reviews, approvals, and evidence gates.
- Requirement analysis and design are first-class card detail fields, not attachments hidden away from the delivery flow.
- Workflow events explain what happened; accepted state transitions explain the durable current status, owner, and next action.
- Agent Team Chat is a visible project collaboration window. It does not replace the board and it does not reuse the user's normal LLM task chat.
- Code, CI, security, reliability, and trust evidence attach to WorkItems and acceptance criteria before they roll up to a Milestone.
- Board actions must respect project authentication, authorization, regional login policy, role rules, WIP limits, and resource leases.

## Information Architecture

The main board should use an operational layout:

| Region | Responsibility |
| --- | --- |
| Project rail | Project switcher, project health, Milestone filter, saved views, team capacity, and governance readiness markers. |
| Command bar | View selector, search, filters, create actions, sort, density, refresh, and permission-aware write actions. |
| Board canvas | The selected view: columns, lanes, cards, rollups, tree groups, coverage rows, or delivery slices. |
| Detail inspector | Editable WorkItem detail, analysis, design, children, acceptance, Milestones, workflow, Team Chat references, code, evidence, governance, and audit. |
| Activity panel | Optional bottom or side panel for workflow timeline, Agent Team Chat references, evidence stream, and recent audit events. |

The layout should stay dense and work-focused. It should favor stable columns, readable tables, inline rollups, keyboard navigation, and predictable inspectors over large promotional sections or decorative page bands.

## Primary Views

The main board must support several projections of the same internal records.

| View | Purpose | Primary grouping |
| --- | --- | --- |
| Portfolio board | Track Epic and Feature progress across a Project. | Objective, Epic, Feature, or Milestone |
| Requirement board | Move Requirement and Story items through analysis, design, ready, and planning states. | Status and priority |
| Delivery board | Track Task, Bug, and Research execution through implementation, review, verification, gates, and delivery. | Status and owner |
| Tree board | Show parent-child decomposition inline so users can see how many children exist and how each child contributes. | Epic or Feature |
| Coverage board | Map parent acceptance criteria to children, evidence, and uncovered gaps. | Acceptance criterion |
| Milestone board | Track release, phase, MVP, or checkpoint delivery scope and blockers. | Milestone and delivery slice |
| Roadmap view | Show cross-Milestone delivery of large requirements over time. | Milestone timeline |
| Team board | Show assignments, WIP limits, capacity, role coverage, overload, and resource conflicts. | Member, role, or work type |
| Workflow board | Show active workflow stage, step state, owner, blockers, approvals, and next action. | Workflow run or stage |
| Code View entry | Open requirement-linked branches, commits, diffs, reviews, CI, and unlinked code warnings. | WorkItem, Milestone, or acceptance criterion |
| Governance view entry | Open obligation coverage, control mapping, risk acceptance, trust provenance, and evidence reports. | Project, Milestone, or WorkItem |

The first UI does not need to render every view as a finished page. It does need a stable view model so each later view can read the same WorkItems, Milestones, workflow summaries, evidence summaries, and governance summaries.

## Card Design

A board card should carry the minimum fields that let users scan status and traceability:

| Field | Purpose |
| --- | --- |
| WorkItem id and type | Identifies the item and hierarchy level. |
| Title | Names the requirement or delivery work. |
| Parent breadcrumb | Shows Epic, Feature, Requirement, Story, or delivery slice lineage. |
| Status | Shows the durable WorkItem state. |
| Priority and rank | Supports priority-ordered Story delivery. |
| Owner and role | Shows human or Agent responsibility. |
| Milestone or slice | Shows delivery target and cross-Milestone placement. |
| Child count | Shows decomposition size and unfinished child count. |
| Acceptance coverage | Shows covered and uncovered parent criteria. |
| Workflow stage | Shows active workflow phase and next action. |
| Blockers | Shows dependencies, missing fields, failed gates, resource conflicts, or waiting approvals. |
| Evidence badges | Shows code, review, CI, security, reliability, trust, and approval evidence. |
| Due date and aging | Shows delivery pressure and stale work. |

Cards should support a compact density for delivery teams and a detailed density for review sessions. Badges must be stable in size and consistent across board views.

## Detail Inspector

Selecting a card opens the detail inspector. The inspector is where requirement management happens without leaving the board.

| Tab | Contents |
| --- | --- |
| Summary | Title, type, status, priority, owner, Milestone, body, schedule, estimate, source, and tags. |
| Analysis | Business background, problem statement, analysis notes, constraints, risks, assumptions, and open questions. |
| Design | Proposed solution, UX/API/data considerations, non-goals, dependency decisions, and design review state. |
| Acceptance | Acceptance criteria, child coverage, uncovered criteria, duplicate coverage, and Definition of Ready or Done checks. |
| Children | Parent-child tree, decomposition reason, generated children, manual children, orphans, and split actions. |
| Milestones | Delivery slices, target Milestones, slice scope, slice owner, slice evidence, and cross-Milestone rollup. |
| Workflow | Current run, active stage, running or blocked steps, waiting approvals, failed checks, scheduler reason, and controls. |
| Team Chat | Related Agent Team Chat messages, open questions, decisions, handoffs, review requests, and collaboration tasks. |
| Code | Branches, commits, diffs, pull requests, reviews, CI runs, coverage, and unlinked code warnings. |
| Evidence | Source documents, tests, CI artifacts, approvals, security, reliability, trust, and delivery evidence. |
| Governance | Obligations, controls, risk acceptances, certification readiness, and required signoff. |
| Audit | Actor, action, target, timestamp, changed fields, source, and correlation ids. |

The Team Chat tab shows references and unresolved actions. Opening the full Agent Team Chat should keep the user in the project collaboration window, not start or merge into a normal LLM task chat.

## Status Model

The board should begin with the existing WorkItem states and add view-specific grouping as needed:

| State | Meaning |
| --- | --- |
| `inbox` | New or imported work that has not been triaged. |
| `analyzing` | Requirement analysis is active. |
| `designing` | Design is active or waiting for design review. |
| `triaged` | The item is understood enough for prioritization. |
| `planned` | The item is selected for a Milestone, release, or delivery slice. |
| `ready` | Definition of Ready passes and delivery can start. |
| `in_progress` | Delivery work is active. |
| `in_review` | Human or Agent review is active. |
| `verifying` | Test, CI, QA, security, reliability, or trust verification is active. |
| `gates_passing` | Required evidence gates are being evaluated. |
| `delivered` | Definition of Done and required evidence gates pass. |
| `rejected` | The item is rejected as product scope. |
| `stopped` | The item is intentionally stopped or cancelled. |

Events and states have different jobs. Events record facts such as review requested, approval granted, CI failed, handoff proposed, or evidence attached. State transitions update the durable current state after policy, role, gate, and concurrency checks accept the event or command. A role handoff is complete only when the handoff event is accepted and the WorkItem, workflow step, collaboration task, or review request changes owner and state.

## Traceability Model

The board must make requirement splitting visible:

- Each child stores parent id, source input, decomposition reason, creator, timestamp, and covered acceptance ids.
- Parent cards show child count, unfinished child count, uncovered acceptance count, and blocker count.
- Tree board shows decomposition depth from Epic to Task.
- Coverage board shows every acceptance criterion and the child items or evidence that cover it.
- Orphan children, children assigned to another Project, duplicate coverage, and uncovered criteria are visible warnings.
- Parent delivery status cannot be set to delivered while required children, required slices, or required acceptance criteria are incomplete.

## Milestone Model

Milestones are delivery targets. They should be visible from every major board view because planning and progress both depend on them.

Required board behavior:

- Project rail lists active Milestones with delivery health and dates.
- Cards show current Milestone or delivery slice.
- Milestone board shows scope, completed work, open work, blocked work, risk, and evidence readiness.
- Roadmap view shows large parent requirements across multiple Milestones.
- Detail inspector shows each delivery slice with scope, criteria, owner, target state, and evidence.
- Moving a child item between Milestones updates parent rollups and audit records.

## Team and Agent Integration

The board must show humans and Agents as project team members with explicit roles and capacity.

Required surfaces:

- Team board shows active members, roles, availability, WIP limits, assigned work, blocked work, and overload warnings.
- Cards show owner, claimed role, reviewer, approver, and Agent or human indicator.
- Assignment controls call dispatch recommendations before starting concurrent work.
- Resource conflicts appear on cards, detail inspector, Team Chat references, Code View, and team capacity views.
- Skill gaps appear as blockers and as actions to create or validate Skills before an Agent can run.

Agent capability boundaries must be visible where they affect actions. A user should see why an Agent can analyze a requirement but cannot push a branch, approve a review, merge a pull request, or accept a residual risk.

## Workflow Integration

The main board consumes workflow state and gives users control points. The workflow designer, runtime timeline, and test replay remain separate detailed surfaces.

Board-level workflow fields:

- current workflow template and version;
- active workflow run;
- current stage and active step;
- selected owner and eligible alternatives;
- loaded Skills and missing Skills;
- running, queued, blocked, failed, skipped, or completed steps;
- waiting approvals and reviews;
- scheduler reason and next action;
- allowed controls such as pause, resume, retry, reassign, reprioritize, cancel, or rerun.

The board should link to the static workflow map for template review, the runtime scheduler timeline for live execution, and the test replay view for workflow validation evidence.

## Code and Evidence Integration

The board should show code and evidence status without becoming a full code review tool.

Required indicators:

- linked repositories and branch state;
- active branch, pull request, reviewer, merge state, and conflict state;
- changed files and acceptance criteria linked to code;
- CI status, coverage, artifacts, JUnit, SARIF, and browser-test reports when available;
- missing tests, missing reviews, failed CI, unlinked code, stale branch, or merge conflict warnings;
- delivery evidence completeness for Definition of Ready and Definition of Done.

The Code View owns full diff inspection. The board owns summary, readiness, blocker, and rollup presentation.

Current implementation baseline:

- `DeliveryEvidenceSummary` stores WorkItem code links, pull requests, review links, CI runs, deployment links, evidence links, checks, compliance obligations, risk acceptances, provenance links, notes, and timestamps in the JSON Board Store.
- The Evidence board groups WorkItems into blocked, missing, pending, and ready evidence lanes. Cards expose PR, review, CI, missing required checks, and governance blockers.
- WorkItem and Milestone Code View APIs read the same evidence summaries. Milestone Code View includes direct Milestone WorkItems and parent WorkItems included through explicit delivery slices.
- Real SCM/CI adapters, inline diff rendering, unlinked external code discovery, and provider write actions remain separate adapter work.

## Governance Integration

Governance readiness must appear in the same delivery workflow because security, reliability, compliance, and trust can block delivery.

Required indicators:

- applicable obligations and control packs;
- WorkItems that affect regulated data, authentication, authorization, audit, retention, AI output, payment, security, privacy, or availability;
- missing controls, missing evidence, residual risk approvals, and expired approvals;
- security readiness, reliability readiness, AI trust provenance, and evidence report status;
- project, Milestone, and WorkItem readiness rollups.

High-risk actions should show the required approving role and the current approval state before the user or Agent attempts the action.

## Data Read Model

The first board implementation should introduce a read model that keeps UI requests predictable.

| Read model | Fields |
| --- | --- |
| `main_board_views` | Project id, view id, filters, sort, grouping, density, visible fields, and user defaults. |
| `main_board_cards` | WorkItem fields, parent breadcrumb, child rollup, acceptance rollup, Milestone slice rollup, owner, workflow summary, evidence summary, governance summary, and warnings. |
| `work_item_board_details` | Editable requirement detail fields plus inspector tab summaries. |
| `work_item_traceability` | Parent tree, children, covered criteria, uncovered criteria, duplicate coverage, source references, and decomposition reasons. |
| `milestone_delivery_rollups` | Milestone scope, delivery slices, progress, blockers, risks, evidence, and readiness. |
| `team_capacity_rollups` | Member capacity, assigned work, WIP status, role gaps, Skill gaps, and resource conflicts. |
| `workflow_board_summaries` | Run state, step states, active owner, next action, scheduler reason, waiting approvals, and controls. |
| `evidence_board_summaries` | Code links, pull requests, review links, CI runs, deployment links, evidence links, checks, compliance obligations, risk acceptances, provenance links, missing evidence, and report state. |

The read model can be backed by SQLite for local deployment and PostgreSQL for team deployment. The board should not require GitHub, GitHub Projects, or an external issue tracker to load.

## API Requirements

The main board should use versioned APIs. These endpoints are the first candidate API group:

```text
GET    /api/v1/projects/:projectId/main-board
GET    /api/v1/projects/:projectId/main-board/views
POST   /api/v1/projects/:projectId/main-board/views
PATCH  /api/v1/projects/:projectId/main-board/views/:viewId
GET    /api/v1/projects/:projectId/main-board/cards
GET    /api/v1/projects/:projectId/main-board/team
GET    /api/v1/projects/:projectId/main-board/workflow
GET    /api/v1/projects/:projectId/main-board/evidence
GET    /api/v1/projects/:projectId/delivery-evidence
GET    /api/v1/projects/:projectId/unlinked-code
GET    /api/v1/projects/:projectId/workflow-runs
GET    /api/v1/projects/:projectId/story-queue
POST   /api/v1/projects/:projectId/story-queue
GET    /api/v1/projects/:projectId/team/members
POST   /api/v1/projects/:projectId/team/members
PATCH  /api/v1/team/members/:memberId
PATCH  /api/v1/team/members/:memberId/availability
GET    /api/v1/projects/:projectId/team/capacity
GET    /api/v1/work-items/:workItemId/board-detail
PATCH  /api/v1/work-items/:workItemId/board-detail
POST   /api/v1/work-items/:workItemId/assignments
GET    /api/v1/work-items/:workItemId/traceability
GET    /api/v1/work-items/:workItemId/milestone-plan
GET    /api/v1/work-items/:workItemId/workflow-board-summary
PATCH  /api/v1/work-items/:workItemId/workflow-board-summary
GET    /api/v1/work-items/:workItemId/workflow
PATCH  /api/v1/work-items/:workItemId/workflow
GET    /api/v1/work-items/:workItemId/delivery-evidence
PATCH  /api/v1/work-items/:workItemId/delivery-evidence
GET    /api/v1/work-items/:workItemId/evidence
PATCH  /api/v1/work-items/:workItemId/evidence
GET    /api/v1/work-items/:workItemId/code-view
GET    /api/v1/work-items/:workItemId/compliance
GET    /api/v1/work-items/:workItemId/security
GET    /api/v1/work-items/:workItemId/reliability
GET    /api/v1/work-items/:workItemId/trust
GET    /api/v1/milestones/:milestoneId/code-view
GET    /api/v1/projects/:projectId/board-health
```

Write endpoints must enforce authentication, project authorization, role rules, transition gates, WIP limits, resource leases, and audit logging.

## Interaction Flows

The board should support these daily flows:

1. A user opens a Project, selects a Milestone, and sees the current requirement and delivery health.
2. A product owner creates or edits a Requirement card with analysis, design, assumptions, risks, and acceptance criteria.
3. The user decomposes a parent item into child WorkItems and maps each child to acceptance criteria.
4. The board flags uncovered acceptance criteria, orphan children, duplicate coverage, and missing design fields.
5. A planner creates delivery slices for a large requirement across multiple Milestones.
6. The scheduler selects the highest-priority ready Story and starts or recommends an end-to-end delivery run.
7. The team or Agent claims work through dispatch controls that check capacity and resource leases.
8. Agents and humans discuss blockers, handoffs, and review requests in Agent Team Chat, with references visible in the detail inspector.
9. Engineers attach branches, pull requests, CI runs, reviews, and test evidence to the related WorkItem and acceptance criteria.
10. Governance, security, reliability, and trust gates block delivery until required controls, evidence, and approvals exist.
11. A parent item becomes deliverable only when required children, slices, acceptance coverage, reviews, approvals, and evidence gates pass.

## Implementation Slices

The recommended first build sequence:

| Slice | Scope | Requirements |
| --- | --- | --- |
| 1 | Project selector, main board shell, WorkItem cards, status columns, and detail inspector. | `REQ-BOARD-001`, `REQ-BOARD-002`, `REQ-REQ-001`, `REQ-WEB-001` |
| 2 | Tree board and coverage board with parent rollups and warnings. | `REQ-BOARD-004`, `REQ-TRACE-001` |
| 3 | Milestone board and cross-Milestone delivery slices. | `REQ-MILESTONE-001`, `REQ-MILESTONE-002` |
| 4 | Versioned main board APIs and authenticated Web access. | `REQ-BOARD-003`, `REQ-WEB-002`, `REQ-AUTH-001` |
| 5 | Team capacity, assignment, WIP warnings, and resource conflicts. | `REQ-TEAM-001`, `REQ-TEAM-002`, `REQ-TEAM-003`, `REQ-TEAM-004` |
| 6 | Workflow summaries, next actions, approvals, reviews, and scheduler links. | `REQ-FLOW-005`, `REQ-FLOW-020` |
| 7 | Code, CI, evidence, governance, reliability, security, and trust rollups. | `REQ-CODE-001`, `REQ-CI-001`, `REQ-EVIDENCE-001`, `REQ-GOV-001`, `REQ-SEC-001`, `REQ-REL-001`, `REQ-TRUST-001` |

This sequence lets the team implement the board before the full workflow designer and runtime visualization are complete, while preserving the fields those later surfaces require.

## Validation Checks

A main board implementation is acceptable only when these checks pass:

- A user can open the board for one Project without GitHub configuration.
- A user can switch Projects and cannot mix a WorkItem with a Milestone from another Project.
- A parent WorkItem shows every child and the number of unfinished children.
- A parent WorkItem shows uncovered acceptance criteria and blocks delivered status when required coverage is missing.
- A large requirement can show delivery across more than one Milestone.
- Requirement analysis and design fields can be edited from the board detail inspector.
- Board cards show owner, role, status, priority, Milestone, blockers, and evidence summary.
- A workflow-controlled item shows active stage, next action, waiting approval, failed check, or blocked reason.
- Agent Team Chat references are visible without merging into the normal LLM task chat.
- Code evidence and CI evidence link to WorkItems and acceptance criteria.
- Governance, security, reliability, and trust blockers are visible before delivery.
- Every write action records an audit event and enforces authentication and authorization.

## Open Decisions

- Which board view should be the default for a new Project: Requirement board, Tree board, or Milestone board?
- Which status columns should appear by default for requirement work and delivery work?
- Should view customization be project-wide, user-specific, or both?
- Which card fields are mandatory in compact density?
- Which transitions are drag-and-drop commands, and which require an inspector form because they need a reason, evidence, or approval?
- How much mobile support is required for external viewers in the first implementation slice?
- Which graph or canvas library should the workflow visualization use after the main board shell is stable?
