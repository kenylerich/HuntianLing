---
doc_status: active
doc_version: 2026-09-12.19
created: 2026-09-10
last_reviewed: 2026-09-12
review_after: 2026-10-12
---

# HuntianLing Requirements Backlog

English | [中文](backlog.zh.md)

Document lifecycle:

| Status | Version | Created | Last reviewed | Review after |
| --- | --- | --- | --- | --- |
| `active` | `2026-09-12.19` | 2026-09-10 | 2026-09-12 | 2026-10-12 |

## Summary

HuntianLing is a dsh plugin whose interface is a standard development board and whose backend prepares a standard vibe-coding environment. After login, customer, developer, and admin shells share WorkItem records. MKT collects original requirements; Planner, Generator, and Evaluator run behind the developer board. Skills declare capability boundary and depth so weak models still complete bounded slices with sensors. [Harness Engineering Product Direction](harness-engineering.md) explains the source articles, alignment assessment, and self-development method.

This document collects the product requirements discussed for HuntianLing. It is the planning source for future WorkItems; implementation may split any item into Epics, Features, Requirements/Stories, Tasks, Bugs, Research, and Milestones on the internal board.

## Table of Contents

- [Product Principles](#product-principles)
- [Harness Delivery Foundations](#harness-delivery-foundations)
- [Current Baseline](#current-baseline)
- [Requirement and Board Management](#requirement-and-board-management)
- [Storage and Persistence](#storage-and-persistence)
- [Authentication and Access](#authentication-and-access)
- [Intake and Requirement Analysis](#intake-and-requirement-analysis)
- [MKT Collection](#mkt-collection)
- [Requirement Design and Prioritization](#requirement-design-and-prioritization)
- [Agile AI Team](#agile-ai-team)
- [Team Membership and Concurrent Work](#team-membership-and-concurrent-work)
- [Team Workflow Orchestration](#team-workflow-orchestration)
- [Team Collaboration](#team-collaboration)
- [Skills and Coverage](#skills-and-coverage)
- [Harness Tools](#harness-tools)
- [SCM, Git, and CI/CD](#scm-git-and-cicd)
- [External Issue Tracker Integration](#external-issue-tracker-integration)
- [Governance, Compliance, Security, Reliability, and Trust](#governance-compliance-security-reliability-and-trust)
- [Web and API Expansion](#web-and-api-expansion)
- [Audit and Compliance](#audit-and-compliance)
- [Implementation Order](#implementation-order)
  - [Phase A — already shipped](#phase-a--already-shipped-keep-do-not-redo)
  - [Phase B — first product milestone](#phase-b--first-product-milestone-do-in-this-order)
  - [Phase C — after the first loop works](#phase-c--after-the-first-loop-works)
  - [After Phase C — residuals of shipped slices](#after-phase-c--residuals-of-shipped-slices)
  - [Phase D — later, only with a measured need](#phase-d--later-only-with-a-measured-need)
  - [D16–D21 — defect correction acceptance](#d16d21--defect-correction-acceptance)

## Product Principles

- Success means accepted customer behavior with maintainable code and recoverable execution, measured against time, cost, and human intervention.
- The plugin presents a standard development board for requirement collection, requirement design, and development progress. Behind that board, a dsh plugin prepares a standard vibe-coding environment and runs Planner, Generator, Evaluator plus built-in engineering methods. Users start work without assembling that environment themselves.
- One Web login serves three audiences: customer, developer, and admin. They share WorkItem records and use different shells (`REQ-WEB-007`).
- MKT is the requirement-collection role. A human or an Agent may execute it under the same contract, Skills, tools, and sensors (`REQ-MKT-001`).
- The harness does not assume a strong model. Skill boundary, depth, and sensors determine whether a task may complete (`REQ-SKILL-005`, `REQ-SKILL-006`).
- MKT, Planner, Generator, Evaluator, and developers talk on the developer-shell Agent Channel using a typed message schema. That channel is not the customer MKT dialog (`REQ-COLLAB-004`).
- HuntianLing owns the requirements lifecycle internally and must run without GitHub.
- GitHub, Gitea, GitLab, and other SCM/CI systems own their code and check facts; they do not own HuntianLing requirement hierarchy or delivery decisions.
- Requirements, milestones, intake records, agents, skills, checks, tool runs, and delivery evidence must be project-scoped.
- AI output must be traceable to user input, source documents, tool calls, and verification evidence.
- The system cannot claim universal software-domain coverage. It must detect the current project's needed skills, report coverage gaps, and make missing skills explicit backlog items.

## Harness Delivery Foundations

These planned requirements complete the executable delivery loop described in [Harness Engineering Product Direction](harness-engineering.md). They extend the existing task runtime, workflow, tools, SCM/CI, and gate requirements; they do not create a second model runtime. Implement the first bounded slice of each before claiming end-to-end agent delivery.

### REQ-HARNESS-001: Reproducible Project Environment

Status: planned.

The system must prepare and verify the environment an agent needs to implement a Project's requirements.

Acceptance criteria:

- The plugin ships a versioned standard composition of environment setup, three Agent definitions, method/Skill baseline, tool bindings, checks, and board integration. Users connect a repository and supply project-specific access without manually rebuilding that composition.
- Setup inventories the existing host, reuses compatible installed capabilities, prepares declared missing dependencies, and reports a ready or blocked environment. Re-running setup preserves existing work and project guidance and does not silently replace incompatible tools.
- A supported profile can initialize a second project without maintainer-specific setup knowledge. Record profile version and explicit overrides, preparation time, required manual steps, and the result of a baseline verification.
- A versioned Project profile identifies repository and baseline, runtime and dependency setup, build/test/start commands, browser or other verification tools, relevant Skills, and allowed capabilities.
- Preparation runs through dsh execution adapters in an isolated workspace and records the resolved profile, workspace identity, setup output, and baseline check results.
- Missing dependencies, tools, Skills, permissions, or credentials produce an actionable blocker before dependent implementation starts; secrets remain outside persisted task context and evidence.
- A replacement environment can be prepared from the profile and retained artifacts; uncommitted work is preserved or its loss is explicitly reported before resuming.
- Tests demonstrate successful preparation, a failed prerequisite, and replacement of an environment. The first slice supports one repository and one configured toolchain; remote environment fleets are deferred.

Implementation state:

- `huntianling.environment` ships profile `huntianling.node-pnpm` 1.0.0. Prepare reports ready or blocked, can initialize a second workspace, preserves existing files, records credential names without secrets, and treats probe lint/hygiene as blocked.
- `POST /api/v1/environment/replace` prepares a replacement fleet slot from the same profile. Uncommitted work is copied by default; discarding it without `acceptUncommittedLoss` blocks. `GET /api/v1/environment/fleets` lists local and remote slots.

Related requirements: `REQ-AGENT-002`, `REQ-AGENT-004`, `REQ-TOOL-001`, `REQ-SKILL-003`, `REQ-SCM-001`.

### REQ-HARNESS-002: Durable Long-Task Continuity

Status: partial.

A Story delivery run must survive context compaction, agent interruption, and execution-environment failure without losing accepted scope or repeating an uncertain external action blindly.

Acceptance criteria:

- A durable checkpoint records requirement/design revisions, acceptance scope, completed and pending steps, owner, blockers, decisions, repository revision and retained patch/artifacts, evidence references, budget usage, and next action.
- Session/event references and delivery state remain retrievable outside the active model context and disposable execution environment. dsh owns session storage; HuntianLing owns its delivery records and links.
- Resume reconciles current repository, tool, review, and evidence state against the checkpoint. Duplicate or stale events cannot advance delivery; uncertain side effects are inspected or escalated before retry.
- Cancellation and configured time, token/cost, retry, and no-progress limits pause or terminate work with a visible reason and recoverable handoff; no unbounded retry loop is allowed.
- Tests interrupt a run after persisted progress, replace its execution environment, and resume it without losing accepted decisions or duplicating a completed action.

Related requirements: `REQ-FLOW-015`, `REQ-FLOW-020`, `REQ-FLOW-021`, `REQ-AGENT-005`, `REQ-TEAM-004`.

Implementation state:

- `huntianling.delivery` persists Story delivery checkpoints under `.huntianling/story-delivery.json`, outside the in-memory agent runtime and disposable web process.
- Interrupt after a persisted Planner step, then resume on a new runtime or a replaced execution workspace, continues with Generator and does not re-run Planner. Duplicate and stale events are recorded as rejected and do not change run state.
- Cancel requires a reason and leaves a recoverable next action. Retry and step budgets block unbounded repair loops. Changing analysis, design, or acceptance after a checkpoint blocks resume.

### REQ-HARNESS-003: Evidence-Based Evaluation and Repair

Status: partial.

Delivery must be evaluated against agreed customer behavior, with a bounded repair loop for failed criteria.

Acceptance criteria:

- Before coding, store a reviewed delivery contract with requirement/design revision, included criteria, repository baseline, expected artifacts, verification method, authority, and budget; scope changes require a recorded decision and revalidation.
- Each criterion has a reproducible check or an explicit human evaluation method. Checks exercise behavior at the relevant layer, including live user workflows where applicable; build success or filled fields alone cannot prove acceptance.
- The standard coding workflow invokes the built-in Evaluator independently of the Generator. Evaluation depth follows Project policy; deterministic checks and human review supplement its findings and cannot silently replace the required Agent execution.
- Evidence identifies its producer, criterion, code/artifact revision, design revision, check or rubric version, result, and retained output. Missing, stale, contradictory, or failed required evidence blocks completion; manually entered summaries cannot masquerade as executed checks.
- Failed evaluation returns actionable defects to implementation within configured limits. Product ambiguity returns to clarification; exhausted budgets or repeated lack of progress produce a human decision or visible blocked result.
- Tests demonstrate a detected defect, repair and recheck, stale evidence after a revision change, rejected self-approval, and a blocked completion with missing evidence.

Related requirements: `REQ-REQ-001`, `REQ-FLOW-002`, `REQ-FLOW-019`, `REQ-FLOW-020`, `REQ-CI-001`, `REQ-TRUST-001`.

Implementation state:

- Evaluator runs persist one executed check per acceptance criterion on the owning WorkItem. Generator self-check is stored as `self_check` and cannot mark customer progress delivered.
- Evidence records producer and design revision. Changing analysis, design, or acceptance blocks previously passing executed checks as stale.
- Customer-visible delivered requires a passing executed evaluator, CI, or local Git check on the current revision. Notes, unexecuted links, and missing evidence do not. Project Definition of Done cannot turn that executed-evidence gate off.

### REQ-HARNESS-004: Harness Evaluation and Continuous Improvement

Status: partial.

The team must measure whether a method, Skill, prompt, environment, or gate improves delivery before treating it as a required harness mechanism.

Acceptance criteria:

- Maintain representative requirement-design and coding scenarios with fixed inputs, baseline revisions, acceptance criteria, declared model/configuration, and budgets; include failed and cancelled runs.
- Record accepted-scope completion, escaped defects, repair rounds, human intervention time, recovery success, elapsed time, and token/tool cost with artifact references. Unknown measurements remain unknown.
- Calibrate evaluator rubrics against human-reviewed passing and failing examples; track missed defects and false rejections rather than accepting the evaluator's score as ground truth.
- Compare the baseline with one changed mechanism at a time, including one Skill depth level, repeat model-dependent trials, and distinguish orchestration replay from fresh model execution. Set promotion thresholds before interpreting the comparison.
- A Skill depth level becomes a required harness mechanism only after that comparison for the declared model and task.
- Link recurring failures to a proposed Skill, instruction, check, depth change, context, or environment change and a regression case. Retain useful changes and remove ineffective or obsolete mechanisms after review.

Related requirements: `REQ-FLOW-007`, `REQ-SKILL-002`, `REQ-SKILL-006`, `REQ-TRUST-001`, `REQ-AUDIT-001`.

Implementation state:

- `huntianling.harness` compares MKT Skill depth, including 2–4, on fixed pass, fail, and cancelled cases. Token cost stays unknown unless a live-model trial reports usage. Orchestration replay is stored separately from a fresh or live-model trial.
- Promotion thresholds are resolved before the comparison. A depth is marked required only after a comparison that meets that threshold; a miss cannot be promoted. Promoting depth 2–4 calibrates that depth for product writes.
- Live-model repeated trials run when a model endpoint is configured, fail loud when it is missing, and never persist tokens.

### REQ-HARNESS-005: HuntianLing Self-Development Demonstration

Status: partial; the documented manual method can be used before runtime automation exists.

HuntianLing must use and demonstrate the same requirement-to-code method for its own development.

Acceptance criteria:

- Each development slice references backlog `REQ-*` ids, records customer outcome, analysis/design, acceptance scope, owner, relevant Milestone, and applicable gates before implementation.
- Link the real change set, check output, reviewer decision, remaining blockers, and acceptance result. Label steps as manual, external-agent, or HuntianLing-runtime execution; unavailable gates are not reported as passing.
- Use board execution records when supported and linked repository review records for missing capabilities. Keep the bilingual backlog as specification owner; do not create conflicting specification copies in GitHub or the board.
- First demonstrate onboarding a fresh project through the shipped standard profile and built-in methods, then use the same composition for HuntianLing development. Identify any maintainer-only setup or manually substituted Agent step as an acceptance gap.
- Demonstrate one real repository Story through environment preparation, dsh agent implementation, failed evaluation, repair, interruption/resume, and acceptance of the resulting revision. The run must update board progress from evidence rather than only editing summary fields.
- Retain the demonstration's artifacts and measured results, identify manual gaps, and convert them into follow-up requirements. A documentation update alone does not complete this requirement.

Related requirements: `REQ-HARNESS-001`, `REQ-HARNESS-002`, `REQ-HARNESS-003`, `REQ-HARNESS-004`, `REQ-FLOW-020`.

Implementation state:

- `huntianling.harness` records a demonstration that prepares a fresh workspace with the shipped Node/pnpm profile, then runs one Story through failed evaluation, repair, interrupt, resume, and Evaluator evidence. Customer-visible delivered updates from that evidence.
- Demonstration steps are labeled `manual`, `external-agent`, or `huntianling-runtime`. Coverage scan and live-model trial steps are recorded. Lint and hygiene stay blocked. An unbound live model is a labeled gap, not a passing gate.
- Maintainer-only OAuth setup remains listed as a follow-up gap, not a passing gate. Hosted SCM/CI adapters already exist as optional call-time integrations.

### REQ-HARNESS-006: Built-In Three-Agent Development System

Status: planned.

The plugin must implement Planner, Generator, and Evaluator as three executable Agents in the standard development environment.

Acceptance criteria:

- Plugin composition provides versioned definitions for all three Agents, including task inputs, instructions, Skills, allowed tools, model binding, output validation, and persisted run identity. Model selection is configurable; three different models are not required.
- Planner turns user dialogue and source material into reviewable analysis, design, acceptance criteria, and delivery decomposition. Output stays at product intent, scenarios, assumptions, open questions, and testable acceptance; it does not freeze repository-specific implementation details. The user confirms scope before implementation.
- Generator implements confirmed work in the prepared environment, produces a runnable result and self-check evidence, and accepts structured repair tasks from Evaluator.
- Evaluator independently exercises the candidate result against the agreed criteria and records evidence and a pass or revision-required result. It cannot be replaced by Generator self-approval in the standard coding workflow.
- Generator and Evaluator agree on verifiable delivery before coding. Typed persisted handoffs route design, implementation, evaluation, repair, clarification, and completion without requiring users to relay messages.
- Each Agent reads task-relevant shared artifacts through its own task context. State, permissions, cancellation, budgets, and recovery remain enforced across handoffs.
- The board displays Planner-produced requirements/design, Generator progress/results, and Evaluator findings/acceptance from real runs. Tests verify all three invocations, rejected invalid outputs, repair routing, and interrupted handoff recovery; a real integration run exercises the configured model and tools.

Implementation state:

- `huntianling.agents` ships versioned Planner, Generator, and Evaluator task definitions. Deterministic executors validate outputs, route typed handoffs including repair, refuse Generator self-acceptance, and resume interrupted runs. Live model execution remains planned.

Related requirements: `REQ-AGENT-001`, `REQ-AGENT-002`, `REQ-FLOW-014`, `REQ-FLOW-020`, `REQ-HARNESS-001`, `REQ-HARNESS-003`.

### REQ-HARNESS-007: Executable Engineering Method Baseline

Status: planned.

The standard environment must ship a usable engineering method baseline that guides the three Agents and governs their outputs.

Acceptance criteria:

- The built-in baseline includes requirement analysis, acceptance examples, design decisions, incremental implementation, code review, behavior verification, and retrospective improvement; first use does not require customers to author their own Skills or workflow.
- Each method declares when it applies, which Agent executes it, required inputs, versioned instructions/Skills, output fields or artifacts, checks, and the route for missing information or rejected output.
- Planner applies design methods to customer inputs; Generator applies repository and implementation practices; Evaluator applies behavior checks and review rubrics. Outputs populate the same requirement/design/evidence records used by the board.
- A Project selects supported method packs and overrides declared options against a recorded baseline version. Missing required method implementations or Skills block dependent work visibly; method names alone do not count as available capabilities.
- A method or baseline update preserves active-run version references and reports changed requirements before adoption. Project-specific design and existing repository guidance remain preserved.
- Tests prove that a method changes the produced artifact and gate decision, that missing required information triggers the declared correction path, and that the default baseline operates on a newly connected project.

Implementation state:

- The default method baseline includes User Story only. Enabling that method adds a `userStory` artifact to Planner output; missing the method Skill blocks the Planner task.

Related requirements: `REQ-METHOD-001`, `REQ-METHOD-002`, `REQ-SKILL-001`, `REQ-SKILL-002`, `REQ-FLOW-001`, `REQ-HARNESS-004`, `REQ-HARNESS-006`.

### REQ-HARNESS-008: Bounded-Slice Commercial Quality

Status: partial.

Commercial-quality vibe coding is proven on one confirmed original-requirement slice, not on generating a whole product in one model call. Weak models use Skill depth and sensors rather than assumed model strength.

Acceptance criteria:

- A slice starts from a confirmed MKT original requirement with raw source quotes and passing collection sensors.
- The slice is complete only when agreed design exists if Planner ran, Generator produced a candidate in the prepared environment, Evaluator recorded criterion-level evidence, and customer-visible progress updated from that evidence.
- Generator self-check cannot mark the slice complete. Manually edited progress cannot mark the customer view delivered.
- Repeated Skill sensor failure lowers depth or stops the task; it does not retry the same prompt without bound.
- Tests show a slice that passes sensors and evaluation, a slice blocked by missing Skill coverage, and a slice that downgrades depth after repeated validation failure.

Related requirements: `REQ-MKT-001`, `REQ-SKILL-005`, `REQ-SKILL-006`, `REQ-HARNESS-003`, `REQ-HARNESS-004`, `REQ-HARNESS-006`.

Implementation state:

- A slice records Evaluator criterion-level evidence on the owning WorkItem. Customer-visible delivered updates from that executed evidence, not from Generator self-check or edited notes.
- Tests cover a slice blocked by missing coding or MKT Skill coverage and a slice that lowers depth after repeated validation failure.

## Current Baseline

| ID | Requirement | Status |
| --- | --- | --- |
| REQ-BOARD-001 | Internal WorkItem tree with Epic -> Feature -> Requirement/Story -> Task plus Bug and Research | Implemented in local SQLite store |
| REQ-BOARD-002 | Multi-project board management | Implemented in local SQLite store and Web API |
| REQ-BOARD-005 | Business CRUD and lifecycle coverage matrix | Implemented as a project-scoped v1 API and Admin workbench view |
| REQ-MILESTONE-001 | Project Milestones with WorkItem assignment and progress summaries | Implemented in local SQLite store, Web API, and the Plans roadmap workbench |
| REQ-MILESTONE-002 | Cross-Milestone requirement delivery | Implemented for explicit JSON delivery slices, v1 Web APIs, the Delivery Slice workbench, and parent-plan audit on child Milestone moves |
| REQ-WEB-001 | Browser board UI available through a dsh display surface and URL | Implemented with local HTTP service |
| REQ-WEB-002 | Authenticated Web UI | Implemented for configurable sessions, API tokens, project-scoped API filtering, admin user-directory create, and login-audit listing |
| REQ-WEB-006 | Workspace information architecture for the browser UI | Implemented for top-level navigation, area-scoped sidebars/details, clean workspace layout, saved Backlog views, column controls, bulk edits, Ready/Done signals, Story delivery queue controls, Backlog, Plans, Runs, Evidence, and Admin workbenches |
| REQ-FLOW-022 | Agile lifecycle swimlane coverage for Runs | Implemented in the workflow board API and Runs workspace |
| REQ-INTAKE-001 | Chat-based requirement intake | Implemented sessions, messages, approval, clarifying questions, and structured follow-up answers |
| REQ-INTAKE-002 | Attachment intake | Implemented PDF, Word, image extraction, and configured hosted OCR for images and textless PDFs |
| REQ-INTAKE-003 | AI requirement candidate generation | Implemented deterministic extraction and a configured live-model extractor for `mode: llm`; approval still required |
| REQ-AUTH-001 | Web login and session authentication | Implemented for configured PBKDF2 users, SQLite user directory, session cookies, API tokens, logout, and login audit |
| REQ-AUDIT-001 | Audit log | Implemented foundation for Board Store write events, project or WorkItem v1 API reads, login auth events, and Admin browser visualization |
| REQ-TRACE-001 | Acceptance criteria coverage from parent items to child items | Implemented for WorkItem descendants |
| REQ-DATA-001 | Database service | SQLite implemented for local deployments; PostgreSQL remains planned |
| REQ-DATA-002 | Local file storage | Implemented for workspace filesystem uploads with database metadata |
| REQ-AUTH-002 | Password credential security | Argon2id preferred with bcrypt/PBKDF2 fallbacks, rotation, and disable |
| REQ-COLLAB-003 | Conversation-driven agent task management | First-slice and split/merge task types, transfer fields, runtime refusal, pending-approval gate, and developer-visible open tasks |
| REQ-AGENT-005 | Agent state recognition | Implemented for workflow run snapshots, step recognition, start and agent-run refusal, Team Chat on blocked actions, and Test Lab simulation of stale, conflict, missing-approval, and missing-evidence cases |
| REQ-FLOW-006 | Visual workflow designer | Implemented canvas read/edit, validation, publish, and archive on a dedicated developer lab page |
| REQ-FLOW-016 | Static workflow visualization | Implemented stage/role swimlanes, dependency graph, outline, layer toggles, badges, version diff, and Markdown/DSL/SVG export |
| REQ-FLOW-018 | Workflow test replay visualization | Implemented replay over the designer map with frame scrubbing and exportable publication evidence |
| REQ-FLOW-007 | Workflow Test Lab | Implemented dry-run of happy-path, missing-approval, resource-conflict, stale-state, missing-evidence, and custom-node fixtures; timeout and retry remain planned |
| REQ-FLOW-008 | Workflow pack conformance | Implemented pack import, versioned conformance reports, and project enable gated on a passing report |
| REQ-FLOW-009 | Custom workflow event catalog | Implemented namespaced custom events, schema rejection, and a block on redefining system events |
| REQ-FLOW-010 | Custom plan and node types | Implemented built-in node catalog, post-conformance custom nodes, and Test Lab fixture simulation |
| REQ-FLOW-011 | Workflow extension points | Implemented declared extension points with ordered enablement and explicit conflict errors |
| REQ-FLOW-001 | Project workflow templates | Implemented built-in user-story, Scrum, Kanban, hotfix, and research templates with project selection; Scrumban, compliance-heavy, and per-item overrides remain planned |
| REQ-METHOD-001 | Requirement design method packs | Implemented User Story baseline plus selectable Use Case, BDD, Example Mapping, Event Storming, DDD, API Design, ADR, and Threat Modeling packs |
| REQ-METHOD-002 | Prioritization method packs | Implemented MoSCoW, RICE, WSJF, Kano, risk-first, dependency-first, and milestone-first ranking with explainable scores and auditable overrides |
| REQ-AGENT-001 | Agile team agent registry | Implemented specialist agent definitions for UX, QA, security, and similar roles with project enablement, in-boundary customization, WorkItem attachment, and audit |
| REQ-SKILL-004 | Technology skill packs | Implemented installable versioned frontend, backend, database, and related packs with scan recommendations, WorkItem requirements, and task-scoped loading |
| REQ-AUTH-003 | Regional login strategy | Implemented cn/global/auto modes, domain-based routing, manual region switch, and login-event region recording |
| REQ-AUTH-004 | OAuth login providers | Implemented Google OIDC, GitHub OAuth, and WeChat QR start/callback/unlink with PKCE/state and identities stored outside board records |

## Requirement and Board Management

### REQ-REQ-001: Board-Based Requirement Authoring

Users must be able to write requirement analysis and requirement design directly on board items.

Acceptance criteria:

- WorkItem details store business background, problem statement, analysis notes, design notes, constraints, risks, assumptions, open questions, and acceptance criteria.
- Board detail views let users edit those fields without leaving the board workflow.
- Requirement analysis and design updates are auditable.
- Requirement detail data is available through internal services and HTTP APIs.

Suggested APIs:

```text
GET   /api/requirements/:id
PATCH /api/requirements/:id
POST  /api/requirements/:id/decompose
GET   /api/requirements/:id/coverage
```

### REQ-BOARD-003: Versioned Board and Requirement APIs

The product must expose stable APIs for external callers and dsh integrations.

Acceptance criteria:

- Provides versioned HTTP APIs for projects, milestones, WorkItems, requirement details, board views, tree views, coverage, intake, agents, skills, tools, SCM, CI, checks, and audit logs.
- Keeps internal services as the first integration point for dsh plugins.
- Documents request and response fields for every public endpoint.
- Provides authentication and authorization behavior for every write endpoint.
- Preserves compatibility through versioned routes or explicit migration notes.

Implementation state:

- Versioned main board endpoints currently expose Project listing and creation, Project main board aggregation, built-in main board views, business CRUD coverage reads, card summaries, Project Milestone board reads, Project Team board reads, Project Workflow board reads, Project Evidence board reads, Project delivery evidence rollups, Project team member reads and writes, Project capacity reads, WorkItem assignment writes, WorkItem workflow summary reads and writes, WorkItem delivery evidence reads and writes, WorkItem Code View reads, WorkItem compliance/security/reliability/trust reads, Project tree reads with hierarchy warnings, Project coverage reads with duplicate coverage warnings, WorkItem board detail reads and updates with source input, decomposition reason, and intake-origin source references, WorkItem Milestone plan reads, WorkItem delivery slice writes, Milestone delivery slice reads, Milestone Code View reads, Project unlinked-code reads, WorkItem traceability reads with intake-origin source indexes, Project intake session APIs, and Project or WorkItem audit event reads.
- When Web auth is enabled, versioned board APIs require a session cookie, an issued API token, or the compatible static Bearer token, and Project-scoped users only see or open allowed Projects.
- Versioned catalog groups are `GET /api/v1/agents`, `GET /api/v1/skills`, `GET /api/v1/tools`, `GET /api/v1/scm/catalog`, and `GET /api/v1/ci/catalog`. Broader check-specific write coverage remains planned.

Suggested APIs:

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id/main-board
GET    /api/v1/projects/:id/main-board/views
GET    /api/v1/projects/:id/main-board/cards
GET    /api/v1/projects/:id/main-board/milestones
GET    /api/v1/projects/:id/main-board/tree
GET    /api/v1/projects/:id/main-board/coverage
GET    /api/v1/projects/:id/main-board/team
GET    /api/v1/projects/:id/main-board/workflow
GET    /api/v1/projects/:id/main-board/evidence
GET    /api/v1/projects/:id/delivery-evidence
GET    /api/v1/projects/:id/unlinked-code
GET    /api/v1/projects/:id/business-crud
GET    /api/v1/projects/:id/audit-events
GET    /api/v1/projects/:id/intake/sessions
POST   /api/v1/projects/:id/intake/sessions
GET    /api/v1/intake/sessions/:id
PATCH  /api/v1/intake/sessions/:id
POST   /api/v1/intake/sessions/:id/messages
POST   /api/v1/intake/sessions/:id/source-documents
POST   /api/v1/intake/sessions/:id/analyze
GET    /api/v1/intake/sessions/:id/candidates
POST   /api/v1/intake/sessions/:id/approve
PATCH  /api/v1/intake/candidates/:id
GET    /api/v1/work-items/:id/board-detail
PATCH  /api/v1/work-items/:id/board-detail
GET    /api/v1/work-items/:id/traceability
GET    /api/v1/work-items/:id/workflow
PATCH  /api/v1/work-items/:id/workflow
GET    /api/v1/work-items/:id/delivery-evidence
PATCH  /api/v1/work-items/:id/delivery-evidence
GET    /api/v1/work-items/:id/code-view
GET    /api/v1/work-items/:id/audit-events
GET    /api/v1/work-items/:id/compliance
GET    /api/v1/work-items/:id/security
GET    /api/v1/work-items/:id/reliability
GET    /api/v1/work-items/:id/trust
GET    /api/v1/work-items/:id/milestone-plan
POST   /api/v1/work-items/:id/milestone-slices
PATCH  /api/v1/work-items/:id/milestone-slices/:sliceId
GET    /api/v1/milestones/:id/requirement-slices
GET    /api/v1/milestones/:id/code-view
GET    /api/v1/projects/:id/board
GET    /api/v1/projects/:id/tree
GET    /api/v1/projects/:id/milestones
POST   /api/v1/projects/:id/milestones
GET    /api/v1/work-items/:id
PATCH  /api/v1/work-items/:id
POST   /api/v1/work-items/:id/children
POST   /api/v1/work-items/:id/status
GET    /api/v1/work-items/:id/evidence
```

### REQ-BOARD-004: Requirement Decomposition Traceability

Requirement decomposition must remain visible from the original idea to delivered tasks.

Acceptance criteria:

- Every generated or manually split child keeps a link to its parent, source input, and decomposition reason.
- Parent progress rolls up from child status, acceptance coverage, blockers, and delivery evidence.
- Users can see how many child items were created from a requirement and which acceptance criteria each child covers.
- The system flags parent requirements with uncovered acceptance criteria.
- The board can show hierarchy, status flow, milestone flow, and coverage views from the same underlying records.

Implementation state:

- The v1 Project main board response includes a Tree board read model with nested cards, root count, total count, maximum depth, and tree warnings.
- The v1 Project main board response includes a Coverage board read model that maps each parent acceptance criterion to covering child WorkItems, evidence counts, and uncovered warnings.
- WorkItems approved from intake candidates expose their originating intake session, candidate, source messages, source documents, chunks, confidence, and preserved quotes in board-detail responses; traceability responses return intake-origin indexes for tree items.
- WorkItems persist source input and decomposition reason fields through the Board Service, Requirement Management Service, v1 HTTP APIs, JSON schema migration, browser create form, and WorkItem detail editor. Intake approval fills those fields from candidate source references and candidate ancestry.
- Coverage board rows, parent summaries, and project coverage summaries flag duplicate acceptance coverage when more than one descendant covers the same acceptance criterion.
- Tree and card read models flag missing parents, root-level children that normally require a parent, invalid parent types, and cycles as specific hierarchy warnings.
- The browser Backlog workbench can filter hierarchy and coverage warnings, and the WorkItem detail editor can update parent, priority, and Milestone assignments from the board workflow.
- The browser Backlog workbench groups WorkItems into portfolio, product, execution, and discovery levels, and list rows show planning, definition readiness, traceability, and next-action signals from the same card read model.
- The browser Backlog workbench includes portfolio, Milestone, and risk planning panels so decomposition gaps, unplanned work, and Ready blockers can be reviewed without leaving the requirements workspace.

### REQ-BOARD-005: Business CRUD and Lifecycle Coverage

Every business object must declare its Create, Read, Update, lifecycle, and delete or archive policy so product gaps are visible before a workflow depends on them.

Acceptance criteria:

- The system exposes a project-scoped matrix for all business domains: Project, WorkItem, requirement hierarchy, Milestone, delivery slice, intake session, intake message, source document, intake candidate, team member, workflow summary, delivery evidence, governance/risk, audit event, auth session, API token, OAuth identity, SCM/CI/code view, Agent/Skill/Tool, Team Chat, collaboration tasks, and workflow templates.
- The matrix distinguishes implemented, partially implemented, planned, forbidden, and not-applicable operations.
- Delete is not treated as a mandatory physical delete. Regulated or traceable records use explicit lifecycle actions such as reject, stop, cancel, void, revoke, retire, redact, archive, restore, waive, sign, or supersede.
- Each row names existing APIs, missing APIs, the business owner, the record being governed, and the recommended next implementation slice.
- Admin users can review CRUD coverage in the browser without inspecting code or issue trackers.

Implementation state:

- `/api/v1/projects/:id/business-crud` returns a project-scoped CRUD coverage matrix with entity rows, operation status, endpoint references, delete policy, gaps, and recommended next slices.
- The Admin workspace includes a Business CRUD view with summary metrics, per-entity operation chips, lifecycle policy text, and a gap list.
- The current matrix shows Project update/archive, versioned WorkItem create/status/archive, Agent/Skill/Tool catalogs, SCM/CI catalogs, and Team Chat decisions/approvals/split/merge as usable. Source document retention, OAuth binding, and remaining later catalog types remain planned.

Suggested APIs:

```text
GET /api/v1/projects/:id/business-crud
PATCH /api/v1/projects/:id
POST /api/v1/projects/:id/archive
POST /api/v1/projects/:id/restore
POST /api/v1/work-items
POST /api/v1/work-items/:id/status
POST /api/v1/work-items/:id/archive
POST /api/v1/work-items/:id/restore
POST /api/v1/work-items/:id/milestone-slices/:sliceId/void
POST /api/v1/intake/sessions/:id/archive
POST /api/v1/intake/messages/:id/redact
POST /api/v1/intake/source-documents/:id/reparse
POST /api/v1/intake/source-documents/:id/redact
GET /api/v1/agents
GET /api/v1/skills
GET /api/v1/tools
GET /api/v1/team/conversations
GET /api/v1/workflow-templates
```

### REQ-MILESTONE-002: Cross-Milestone Requirement Delivery

Large requirements must support delivery across multiple Milestones without losing parent-child traceability.

Acceptance criteria:

- A parent Epic, Feature, Requirement, or Story can span multiple Milestones through its descendants or explicit delivery slices.
- Each delivery slice identifies the Milestone, scope, acceptance criteria, expected evidence, target status, and owner for that slice.
- Parent progress rolls up by Milestone and across all Milestones.
- The board shows which parts of the parent requirement are delivered, in progress, blocked, or not yet planned for each Milestone.
- A parent requirement cannot be marked delivered until all required cross-Milestone slices meet the Definition of Done.
- Moving a child item between Milestones updates the parent cross-Milestone plan and audit log.

Implementation state:

- The JSON Board Store persists `MilestoneDeliverySlice` records under the same Project as the parent WorkItem.
- The v1 API can create and update delivery slices, read a parent WorkItem Milestone plan, read one Milestone's requirement slices, and read Project Milestone board lanes with WorkItem cards and slice cards.
- The browser Plans workspace renders a Milestone roadmap workbench with KPI summaries, a Milestone timeline, a scope matrix, delivery slice queue, planning blocker queue, and a folded lane reference.
- The Delivery Slice view renders a dedicated cross-Milestone slice workbench with parent requirement grouping, slice status, Milestone coverage, acceptance scope, evidence counts, blockers, and parent navigation.
- A parent WorkItem with open delivery slices cannot transition to `delivered`.
- Moving a child WorkItem between Milestones writes `parent_plan.updated` on the parent with the child id and old/new Milestone in the audit reason.

Suggested APIs:

```text
GET  /api/v1/work-items/:id/milestone-plan
POST /api/v1/work-items/:id/milestone-slices
PATCH /api/v1/work-items/:id/milestone-slices/:sliceId
GET  /api/v1/milestones/:id/requirement-slices
```

## Storage and Persistence

### REQ-DATA-001: Database Service

HuntianLing must support a real database layer for production data while keeping lightweight local deployment possible.

Acceptance criteria:

- Supports SQLite for local/single-user/private deployments.
- Supports PostgreSQL for team and external-user deployments.
- Exposes one internal `huntianling.database` service so upper layers do not depend on a concrete driver.
- Provides schema migrations and version tracking.
- Migrates the current JSON board data into database tables.
- Stores large file content outside the database and stores metadata, hashes, extracted text status, and references in the database.

Primary entities:

- `users`
- `auth_sessions`
- `projects`
- `project_memberships`
- `compliance_obligations`
- `compliance_control_packs`
- `compliance_controls`
- `compliance_mappings`
- `control_evidence`
- `risk_register_entries`
- `reliability_slos`
- `incident_records`
- `ai_risk_assessments`
- `ai_evaluation_runs`
- `trust_attestations`
- `team_conversations`
- `team_messages`
- `team_message_links`
- `team_members`
- `team_member_roles`
- `team_member_availability`
- `team_capacity_allocations`
- `team_wip_policies`
- `team_work_assignments`
- `team_resource_leases`
- `workflow_templates`
- `workflow_stages`
- `workflow_transitions`
- `workflow_runs`
- `workflow_run_steps`
- `workflow_plan_schedules`
- `workflow_step_queue_items`
- `workflow_scheduler_decisions`
- `workflow_state_snapshots`
- `workflow_state_transition_rules`
- `workflow_state_transitions`
- `workflow_handoff_requests`
- `workflow_handoff_acceptances`
- `workflow_role_event_policies`
- `workflow_event_role_bindings`
- `workflow_review_requests`
- `workflow_review_decisions`
- `workflow_approval_decisions`
- `story_priority_queues`
- `story_priority_queue_items`
- `story_delivery_runs`
- `story_delivery_checkpoints`
- `workflow_visual_views`
- `workflow_visual_exports`
- `workflow_runtime_trace_events`
- `workflow_runtime_timelines`
- `workflow_test_replay_frames`
- `workflow_gate_results`
- `workflow_automation_rules`
- `workflow_handoffs`
- `workflow_canvas_versions`
- `workflow_test_cases`
- `workflow_test_runs`
- `workflow_test_assertions`
- `workflow_simulation_fixtures`
- `workflow_publication_reviews`
- `workflow_conformance_results`
- `workflow_event_types`
- `workflow_plan_node_types`
- `workflow_extension_points`
- `workflow_extension_packages`
- `workflow_builtin_capabilities`
- `workflow_template_selections`
- `workflow_template_replacements`
- `workflow_agent_bindings`
- `workflow_skill_bindings`
- `harness_workflow_actions`
- `approval_requests`
- `agent_collaboration_tasks`
- `agent_collaboration_task_events`
- `agent_collaboration_task_dependencies`
- `human_agent_participants`
- `milestones`
- `work_item_milestone_slices`
- `work_items`
- `work_item_links`
- `acceptance_criteria`
- `work_item_acceptance_coverage`
- `scm_repositories`
- `scm_branches`
- `scm_changesets`
- `scm_pull_requests`
- `code_view_snapshots`
- `agent_capability_profiles`
- `agent_state_recognition_results`
- `audit_events`

Implementation state:

- `huntianling.database` is the internal persistence service. Local deployments use SQLite through `node:sqlite`; PostgreSQL remains planned and fails loud if selected.
- Schema migrations are recorded in `schema_migrations` with a monotonic version.
- Opening a workspace imports `.huntianling/board.json` into SQLite tables when the database has no board document yet. Later reads and writes use SQLite as the source of truth.
- Current board collections persist as tables for projects, work items, milestones, team members, delivery slices, workflow summaries, delivery evidence, intake records, audit events, acceptance criteria, coverage, and links.
- Large upload bytes are stored outside the database. File metadata, hashes, extracted-text status, and storage-path references are stored in `stored_files`.

### REQ-DATA-002: Local File Storage

HuntianLing must use local filesystem storage as the baseline file backend.

Acceptance criteria:

- Stores uploads under a configurable workspace storage root.
- Stores original filename, MIME type, size, sha256, uploader, project, and storage path in the database.
- Rejects files that exceed configured size or type limits.
- Keeps the storage interface replaceable for future S3-compatible storage without requiring MinIO in the baseline.

Implementation state:

- Uploads are stored under a configurable workspace storage root (default `.huntianling/files`).
- The database records original filename, MIME type, size, sha256, uploader, project, storage path, extracted-text status, and extracted-text path.
- Uploads that exceed configured `maxUploadBytes` or `allowedMimeTypes` are rejected.
- `FileStorageBackend` is the replaceable local filesystem interface; S3-compatible storage and MinIO are not required in the baseline.
- `POST/GET /api/v1/projects/:id/files` and `GET /api/v1/files/:id` plus `/content` expose the same records.

## Authentication and Access

### REQ-AUTH-001: Web Login and Session Authentication

The Web UI and HTTP APIs must support authenticated access.

Acceptance criteria:

- Supports login, logout, current-session lookup, and session expiration.
- Each session principal includes audience `customer`, `developer`, or `admin` (`REQ-WEB-007`).
- Supports project-level authorization.
- Records login events and security-relevant audit events.
- Supports API tokens for external callers.
- Requires authentication for browser writes when Web access is public.

Suggested APIs:

```text
POST /api/auth/password/login
POST /api/auth/logout
GET  /api/auth/session
POST /api/auth/api-tokens
GET  /api/auth/api-tokens
DELETE /api/auth/api-tokens/:id
```

Implementation state:

- The Web Service can enable process-local auth through `web.auth.enabled`.
- Password login verifies configured PBKDF2-SHA256 password hashes and issues `HttpOnly` session cookies with expiration.
- `/api/auth/session`, `/api/auth/password/login`, `/api/auth/logout`, `/api/auth/api-tokens`, and `/api/auth/providers` are implemented.
- API tokens are generated once, stored as hashes, listed without raw secrets, and accepted as Bearer tokens for external callers.
- Project authorization filters Project lists and rejects denied Project, WorkItem, and Milestone routes.
- `POST /api/v1/admin/users` persists a user directory in SQLite `auth_users` beside configured Web users. Login, failed login, logout, and API-token creation write `auth_events`. OAuth login flows and fine-grained role permissions remain planned.

### REQ-AUTH-002: Password Credential Security

Password credentials must use safe password hashing.

Acceptance criteria:

- Supports Argon2id as the preferred algorithm.
- Allows bcrypt or PBKDF2 as configured fallback algorithms.
- Stores only salted password hashes and algorithm parameters.
- Provides password rotation and credential disable flows.
- Never logs passwords, OAuth secrets, API tokens, or raw session secrets.

Implementation state:

- New password hashes prefer Argon2id through `node:crypto.argon2Sync`, with configurable bcrypt and PBKDF2-SHA256 fallbacks. Stored records keep salt and algorithm parameters only.
- `POST /api/auth/password/rotate` replaces the stored hash. `POST /api/v1/admin/users/:username/credential` enables or disables a credential; a disabled credential cannot log in.
- Credential records persist in SQLite `credentials` when `huntianling.database` is present. API responses omit password hashes. Existing PBKDF2 hashes continue to verify.
- OAuth secrets remain out of logs; login and rotation error messages do not include the submitted password.

### REQ-AUTH-003: Regional Login Strategy

The login page must distinguish China and global access modes without relying only on IP detection.

Acceptance criteria:

- Supports configurable region modes: `cn`, `global`, and `auto`.
- Supports different provider lists per region.
- Allows domain-based routing such as `board.example.cn` and `board.example.com`.
- Lets users manually switch login region when routing is ambiguous.
- Records the region used for login events.

Implementation state:

- The Web auth API and login panel support `cn`, `global`, and `auto` region selection.
- Region-specific provider lists can be configured for China and global access modes.
- Domain-based routing infers `cn` and `global` from configured hosts and common domain suffixes.
- Password and OAuth login audit events record the selected region and persist it through SQLite when `huntianling.database` is present. The fused `/board` cockpit is unchanged.

### REQ-AUTH-004: OAuth Login Providers

HuntianLing must support third-party login with Google, GitHub, and WeChat.

Acceptance criteria:

- Supports OAuth/OIDC authorization code flow for Google.
- Supports GitHub OAuth App web flow.
- Supports WeChat website QR login through WeChat Open Platform when configured.
- Stores provider identities separately from users so one user can bind multiple providers.
- Uses state validation and PKCE where supported.
- Stores provider subject ids, optional WeChat unionid, email/profile metadata, and binding status.

Suggested APIs:

```text
GET /api/auth/providers?region=cn|global
GET /api/auth/oauth/:provider/start
GET /api/auth/oauth/:provider/callback
POST /api/auth/oauth/:provider/unlink
```

Implementation state:

- Provider discovery is implemented for regional login lists, with Google, GitHub, and WeChat as the default provider ids.
- OAuth/OIDC start redirects to the configured provider, records state, and uses PKCE where the provider supports it.
- OAuth/OIDC callback validates state, calls the configured exchange adapter, binds provider identities separately from users, and can create a developer user from the provider email when no mapped user exists.
- `POST /api/auth/oauth/:provider/unlink` removes the current user's binding and records an auth audit event.
- Provider identities and transient OAuth states persist in SQLite when `huntianling.database` is present. Client secrets stay in config/env and are omitted from APIs and board snapshots. The dedicated login page lists enabled providers.
- Provider secrets stay in auth configuration or call-time exchange dependencies; public API responses and board records do not expose them.

## Intake and Requirement Analysis

### REQ-INTAKE-001: Chat-Based Requirement Intake

HuntianLing must let users submit ideas through a chat-style intake session. Product language for this flow is MKT (`REQ-MKT-001`). Intake sessions are the MKT collection record.

Acceptance criteria:

- Supports project-scoped intake sessions.
- Supports text messages, clarifying questions, and structured follow-up answers.
- Keeps raw user input separate from confirmed requirements.
- Records submitter, timestamps, source channel, and analysis status.
- Allows the user to approve generated candidate requirements before they become WorkItems.

Suggested APIs:

```text
GET    /api/v1/projects/:id/intake/sessions
POST   /api/v1/projects/:id/intake/sessions
GET    /api/v1/intake/sessions/:id
PATCH  /api/v1/intake/sessions/:id
POST   /api/v1/intake/sessions/:id/messages
POST   /api/v1/intake/sessions/:id/source-documents
POST   /api/v1/intake/sessions/:id/analyze
GET    /api/v1/intake/sessions/:id/candidates
POST   /api/v1/intake/sessions/:id/approve
```

Implementation state:

- The Board Service persists project-scoped intake sessions, messages, source document links, candidate ids, submitter, timestamps, source channel, status, and analysis status.
- The v1 Web API supports creating and reading intake sessions, appending messages, running analysis, listing candidates, editing candidate title, body, analysis, design, acceptance, open questions, status, and Milestone, and approving selected draft candidates into formal WorkItems while remaining draft candidates stay open for review.
- Missing MKT fields produce `clarifying-question` messages. `POST /api/v1/intake/sessions/:id/follow-ups` records a structured answer. The original-requirement draft stays untracked until the customer confirms. Technical-design answers are rejected. Live-model default extractors remain planned.

### REQ-INTAKE-002: Attachment Intake

Users must be able to upload requirement material as images and documents.

Supported inputs:

- Image files
- Word documents
- PDF files
- Markdown files
- Plain text files

Acceptance criteria:

- Stores each upload as a source document.
- Extracts text where possible.
- Supports OCR or image understanding for images.
- Stores parse status, parse errors, and extracted chunks.
- Links each generated candidate requirement back to source document chunks or image references.

Implementation state:

- The Board Service persists source documents with kind, name, MIME type, size, parse status, parse error, extracted text, and extracted chunks.
- The browser intake workspace accepts image, Word, PDF, Markdown, and plain-text files. Markdown and plain-text files are read as extracted text in the browser.
- Candidate review shows source references with message or source document labels, chunk positions when available, confidence, and the preserved quote.
- PDF and Word bytes are extracted into parse status, errors, and chunks. Images extract when understanding or hosted OCR is configured; otherwise they stay pending with a parse error. Textless PDFs fall back to hosted OCR. SVG text is extracted without OCR. Generic files remain unsupported. Tokens are supplied at call time or from the environment and are never persisted.

### REQ-INTAKE-003: AI Requirement Candidate Generation

AI analysis must turn raw ideas and source documents into candidate requirements, not directly into committed WorkItems.

Acceptance criteria:

- Extracts business goals, actors, scenarios, constraints, risks, assumptions, open questions, and acceptance criteria.
- Generates candidate Epic, Feature, Requirement/Story, Task, Bug, and Research nodes.
- Preserves source references for every candidate node where possible.
- Flags confidence and open questions.
- Requires human approval before writing WorkItems.

Implementation state:

- Deterministic analysis extracts goals, actors, scenarios, constraints, risks, assumptions, open questions, and acceptance from labeled source text, and adds a Bug candidate when the material mentions a defect.
- `POST /api/v1/intake/sessions/:id/analyze` with `mode: llm` uses a configured live-model extractor from intake config or environment, or an injected extractor in tests, and fails loud when none is configured. LLM results can include Bug nodes. Human approval is still required before WorkItems are written.
- A hosted model fleet is not a product.

## MKT Collection

### REQ-MKT-001: MKT Collection Role

Status: planned.

MKT is the requirement-collection role. A human or an Agent may execute it. Replacement is equivalent only when inputs, Skills, tools, outputs, and sensors stay the same.

Acceptance criteria:

- Inputs are customer dialog and attachments. Raw customer language is persisted separately from confirmed original requirements.
- Outputs are original-requirement records on the board with source quotes plus goal, actor, scenario, constraint, non-goal, and open-question fields when present.
- MKT does not freeze technical design, split implementation Tasks, change code, or declare acceptance. Those belong to Planner, Generator, and Evaluator.
- The customer sees their own words immediately. A record becomes a tracked original requirement only after the configured confirm path: customer confirm, developer promote, or both.
- Missing required fields return questions to the customer MKT dialog. Product ambiguity stays with MKT.
- Each run records the executor as manual, external-agent, or HuntianLing-runtime MKT, and records Skill ids, Skill versions, and depth level.
- Tests prove a human MKT run and an Agent MKT run write the same record kinds when they use the same Skills, tools, and sensors.

Implementation state:

- Missing goal, actors, scenarios, or confirm returns clarifying questions to the customer MKT dialog. Structured follow-ups fill the original-requirement draft. Confirm tracks it with source quotes; until then it stays untracked. Agent Channel `customer.question_needed` appears in that dialog. Customers do not need the developer shell to answer.

Related requirements: `REQ-INTAKE-001`, `REQ-INTAKE-002`, `REQ-INTAKE-003`, `REQ-MKT-002`, `REQ-SKILL-005`, `REQ-SKILL-006`, `REQ-WEB-007`.

### REQ-MKT-002: MKT Skill Pack

Status: planned.

The first MKT Skill pack supplies the collection role's required capabilities. It is not a Product Owner, Business Analyst, or marketing catalog.

Acceptance criteria:

- The pack includes Skills for interview and clarification, distinguishing a wish from a trackable requirement, extracting original-requirement fields, preserving quotes, confirming before tracking, and returning product questions to the customer dialog.
- Each Skill in the pack declares a capability boundary and a depth profile (`REQ-SKILL-005`, `REQ-SKILL-006`).
- The pack ships with output schema, validators, and passing and failing examples. Writes of original requirements go through tools.
- Unmeasured or weak models default to depth 1 (schema fill, tool validation, human confirm). Depth 0 remains available when no model runs.
- Missing pack Skills create a visible gap and block MKT from claiming collection is complete.
- Tests run the pack at depth 0 and depth 1, reject a write that lacks a source quote, and reject a write that includes technical design fields.

Implementation state:

- The host Skill service ships the MKT collection pack, a versioned registry, and an `original-requirement.write` tool. Depth 0 and 1 are calibrated; missing pack Skills block collection complete.

Related requirements: `REQ-MKT-001`, `REQ-SKILL-001`, `REQ-SKILL-002`, `REQ-SKILL-005`, `REQ-SKILL-006`, `REQ-TOOL-001`.

## Requirement Design and Prioritization

### REQ-METHOD-001: Requirement Design Method Packs

Method packs must be executable in the standard three-Agent environment under `REQ-HARNESS-007`, with built-in defaults available on first use. The first product milestone ships that baseline. Additional packs remain later project options.

HuntianLing must support multiple requirement design methodologies.

Required method packs:

- User Story
- Use Case
- BDD / Gherkin
- Example Mapping
- Event Storming
- Domain-Driven Design
- API Design
- ADR
- Threat Modeling

Acceptance criteria:

- Project configuration selects enabled method packs.
- A WorkItem can record which method pack produced or refined it.
- Agent tasks can require method-specific skills and output schemas.
- Missing method skills are reported as skill gaps.

Implementation state:

- The method catalog lists User Story plus Use Case, BDD, Example Mapping, Event Storming, DDD, API Design, ADR, and Threat Modeling. A new project enables User Story only; extra packs stay disabled until selected.
- Enabling a pack lets a planner run produce that method's output fields. A WorkItem records the method pack that produced it. Missing or disabled method skills are skill gaps and block the planner run. Customers cannot enable method packs. The fused `/board` cockpit is unchanged.

### REQ-METHOD-002: Prioritization Method Packs

HuntianLing must support several prioritization approaches.

Required method packs:

- MoSCoW
- RICE
- WSJF
- Kano
- Risk-first
- Dependency-first
- Milestone-first

Acceptance criteria:

- Project configuration selects the prioritization method.
- WorkItems store the inputs needed by the selected method.
- Ranking output is explainable and traceable to inputs.
- Ranked Story output feeds the Story priority queue used by workflow scheduling.
- Users can override ranking with an audit reason.

Implementation state:

- The browser Backlog workbench exposes WorkItem priority, sorts the Backlog by rank, priority, status, Milestone, or type, and displays the Story priority queue produced by the Board Service.
- The browser Backlog workbench can filter by business Backlog level and lifecycle status, so the Story priority queue can be reviewed with its surrounding portfolio, product, execution, and risk context.
- Users can save project-scoped Backlog views with filters and visible columns, then batch update selected visible WorkItems by priority, Milestone, or lifecycle status through the existing WorkItem APIs.
- The Backlog decision panel explains the current deterministic Story queue order as Priority, due date, and WorkItem order, and shows visible skip reasons from the Board Service queue.
- Project configuration selects MoSCoW, RICE, WSJF, Kano, risk-first, dependency-first, or milestone-first. WorkItems store ranking inputs. The Story priority queue uses that ranking with explanations and auditable overrides. Customers cannot select a pack. The fused `/board` cockpit is unchanged.

## Agile AI Team

### REQ-AGENT-001: Agile Team Agent Registry

HuntianLing must define a complete agile AI team model.

Required built-in executable coding Agents are Planner, Generator, and Evaluator (`REQ-HARNESS-006`). MKT is the built-in collection role (`REQ-MKT-001`); listing it does not by itself implement an Agent. A later MKT Agent is equivalent only when it uses the MKT Skills, tools, and sensors. The following professional roles provide responsibility and Skill profiles for those Agents or later specialist extensions; listing a role does not implement an Agent.

Professional role profiles:

- MKT
- Product Owner
- Business Analyst
- UX Designer
- Architect / Tech Lead
- Frontend Developer
- Backend Developer
- QA Engineer
- DevOps / Release Engineer
- Security Reviewer
- Scrum Master
- Technical Writer

Acceptance criteria:

- Stores role, responsibilities, allowed task types, allowed tools, required skills, and output expectations.
- Agents are project-scoped and can be enabled, disabled, or customized per project.
- Agent runs attach outputs and feedback to WorkItems.
- Agent actions are auditable.

Implementation state:

- The agent catalog keeps Planner, Generator, and Evaluator as the coding baseline and adds specialist definitions for Product Owner, Business Analyst, UX Designer, Architect, Frontend Developer, Backend Developer, QA Engineer, DevOps, Security Reviewer, Scrum Master, and Technical Writer. Each definition stores role, responsibilities, allowed task types, allowed tools, required skills, and output expectations.
- A new project enables only the three coding Agents. Specialists can be enabled, disabled, or customized per project inside the built-in tool and skill boundary. A specialist run attaches output to the WorkItem and writes an audit event. Customers cannot enable specialist agents. Technology skill packs and the fused `/board` cockpit are unchanged.

### REQ-AGENT-002: Agent Task Runtime

Agent work must run through explicit task specifications.

Acceptance criteria:

- Defines task type, required role, required skills, required tools, input schema, output schema, checks, depth level, and feedback channels.
- Loads only skills and tools required by the task and allowed by each Skill's capability boundary.
- Selects Skill depth from calibration for the current model and task, or from project policy; unmeasured models use the declared default (MKT defaults to depth 1).
- Blocks tasks when required input, permissions, or skills are missing, or when output violates the Skill schema.
- On repeated sensor failure, lowers depth or stops; does not retry the same prompt without bound.
- Stores task run status, result, tool evidence, Skill version, depth level, errors, and next-step recommendations.

Implementation state:

- Agent runs store task type, skills, tools, depth, and feedback. Depth is selected from calibrated Skill depths or the declared default. Repeated invalid output lowers depth or stops.

### REQ-AGENT-003: Agile Feedback Surface

The board must show AI team feedback in context.

Acceptance criteria:

- WorkItem detail shows agent feedback, open questions, decisions, blockers, missing evidence, and suggested next actions.
- Feedback links to the producing agent run and skill version.
- Users can accept, reject, or request revision for AI feedback.
- Rejected feedback remains auditable but does not update the WorkItem.

Implementation state:

- Evaluating a WorkItem captures Agent feedback on the owning record, including open questions, decisions, blockers, missing evidence, next actions, producing run id, and skill versions.
- Developers can accept, reject, or request revision from WorkItem detail and the progress inspector. Accept may patch analysis, design, and acceptance. Reject writes `agent_feedback.rejected` and does not update the WorkItem. Customers cannot dispatch work or decide feedback.

### REQ-AGENT-004: Agent Capability Boundaries

Each agent role must have explicit capability limits before it can work on a project.

Acceptance criteria:

- Stores each role's allowed WorkItem types, project scopes, repository scopes, file scopes, tools, write permissions, approval requirements, and forbidden actions.
- Separates read-only analysis, editable draft output, code modification, Git commit, branch push, CI trigger, review approval, and merge permissions.
- Blocks an agent action when the role, task spec, project policy, or human approval does not allow it.
- Requires human approval for high-risk actions such as pushing branches, opening pull requests, changing protected files, triggering production deployments, or merging.
- Records every blocked action, approval request, approval result, and policy reason in the audit log.
- Shows capability boundaries in the WorkItem, Agent, and Team Chat views before a task starts.

Implementation state:

- `huntianling.authority` stores per-role allowed WorkItem types, tools, write permissions, approval-required actions, and forbidden actions. Read, draft, code change, commit, push, pull request, local CI, production CI, review approval, and merge are separate permissions.
- Planner cannot push or open a pull request. Generator push, pull request, protected-file write, and merge require a human approval granted by a different actor. Evaluator may run local CI; production CI requires approval.
- Denied actions and approval request/result records are written to the project audit log. The developer progress inspector shows capability boundaries before a task starts. Hosted GitHub, Gitea, and GitLab pull-request write adapters use the same C1 approval gate as local Git.

### REQ-AGENT-005: Agent State Recognition

Agents must recognize the current workflow and delivery state before they act.

Acceptance criteria:

- Builds a state snapshot from WorkItem status, workflow run status, workflow step status, collaboration task status, Team Chat context, Milestone, approvals, gates, resource leases, branch state, CI state, evidence state, and open blockers.
- Requires each executable agent step to identify allowed actions, blocked actions, required inputs, missing approvals, missing skills, unavailable tools, held resources, and next safe action.
- Prevents an agent from executing when the state snapshot is stale, incomplete, contradictory, or outside the agent's capability boundary.
- Lets agents ask for missing information or request human approval instead of guessing the next state transition.
- Records state recognition results on the workflow step and emits a visible Agent Team Chat event when the state blocks or changes the planned action.
- Lets the Workflow Test Lab simulate stale state, conflicting state, missing approval, missing evidence, and resource conflict cases.

Suggested APIs:

```text
GET  /api/v1/workflow-runs/:id/state
POST /api/v1/workflow-runs/:id/steps/:stepId/recognize-state
GET  /api/v1/agent-runs/:id/state-recognition
```

Implementation state:

- `GET /api/v1/workflow-runs/:id/state` returns WorkItem status, workflow run and step status, collaboration task status, Team Chat message count, Milestone, pending approvals, resource leases, branch owners, CI status, evidence readiness, and open blockers.
- `POST /api/v1/workflow-runs/:id/steps/:stepId/recognize-state` records allowed and blocked actions, required inputs, missing approvals, missing skills, unavailable tools, held resources, and the next safe action on the step. Start refuses a stale, incomplete, contradictory, or out-of-boundary recognition. A missing approval names `request-approval`; an exclusive foreign lease posts a Team Chat event.
- `GET /api/v1/agent-runs/:id/state-recognition` returns the recognition stored on the Agent run. `startRun` refuses a blocked recognition.
- Workflow Test Lab dry-runs stale, conflicting, missing-approval, missing-evidence, and resource-conflict cases as publication evidence.

## Team Membership and Concurrent Work

HuntianLing must manage project teams as a mix of humans and agents. Agent definitions describe roles and capabilities; team membership describes who is available in a project, what capacity they have, and which concurrent work they may take.

### REQ-TEAM-001: Project Team Member Management

Each Project must have an explicit team roster.

Acceptance criteria:

- Stores team members as humans, agents, service accounts, or external reviewers.
- Stores member display name, member type, status, roles, permissions, capability profile, skill profile, region, timezone, and project membership.
- Supports project-specific role assignment so the same human or agent can hold different roles in different Projects.
- Allows members to be active, inactive, suspended, unavailable, or observer-only.
- Shows current assignee, reviewers, approvers, watchers, and collaboration participants on WorkItems and Milestones.
- Records membership changes in the audit log.

Suggested APIs:

```text
GET  /api/v1/projects/:id/team/members
POST /api/v1/projects/:id/team/members
PATCH /api/v1/team/members/:id
POST /api/v1/team/members/:id/roles
DELETE /api/v1/team/members/:id/roles/:roleId
```

Current implementation baseline:

- The Board Store persists Project team members with member type, status, role ids, permissions, capability profile, skill profile, region, timezone, capacity units, and concurrent WorkItem limit.
- The Web API implements `GET /api/v1/projects/:id/team/members`, `POST /api/v1/projects/:id/team/members`, and `PATCH /api/v1/team/members/:id`.
- The browser sidebar can create team members and shows Project roster status, roles, assigned work, blocked work, WIP, and member warnings.
- Project-scoped `claimedRole` board views seed one lane for every Project role plus an unclaimed lane, expose role display names, and support filtering cards by claimed role id.
- `POST /api/v1/team/members/:id/roles` and `DELETE /api/v1/team/members/:id/roles/:roleId` add and remove project roles with audit events. WorkItems store reviewers, approvers, and watchers from the project roster. Membership create, role, and participant changes are audited.

### REQ-TEAM-002: Capacity, Availability, and WIP Limits

The system must know how much concurrent work each team member can safely handle.

Acceptance criteria:

- Stores member availability, working region, timezone, planned absence, capacity units, and concurrent task limit.
- Supports role-level and member-level WIP limits for WorkItems, collaboration tasks, code changes, reviews, and CI-sensitive tasks.
- Supports different capacity policies for humans and agents.
- Includes model, tool, repository, CI, and environment limits when calculating agent capacity.
- Blocks new assignment when the member, role, project, repository, or shared resource exceeds its WIP limit.
- Shows available capacity, assigned work, blocked work, and overload warnings on the team view.

Suggested APIs:

```text
GET  /api/v1/projects/:id/team/capacity
PATCH /api/v1/team/members/:id/availability
PATCH /api/v1/projects/:id/team/wip-policies
```

Current implementation baseline:

- Member availability is represented by team member status; capacity units, region, timezone, and member-level concurrent WorkItem limits are persisted.
- `GET /api/v1/projects/:id/team/capacity` returns active members, assigned WorkItems, unassigned WorkItems, blocked assigned WorkItems, unavailable members, overloaded members, and warnings.
- `PATCH /api/v1/team/members/:id/availability` updates the same member status, capacity, region, timezone, and profile fields as the general member update endpoint.
- Manual assignment blocks inactive, unavailable, suspended, or observer-only members, rejects wrong project membership, rejects roles the member does not hold, and blocks assignment once the member-level WIP limit is reached.
- `PATCH /api/v1/projects/:id/team/wip-policies` stores role, repository, CI, environment, member-type, and collaboration-task limits. Assignment is blocked when a matching policy is at its limit. Humans and agents can use different member-type limits. Team capacity warnings include those policy codes. Model/tool-aware capacity accounting remains planned.

### REQ-TEAM-003: Concurrent Work Dispatch

Concurrent work must be assigned through a dispatch policy rather than ad hoc agent starts.

Acceptance criteria:

- Dispatch considers priority, Milestone, dependencies, blocked status, required role, required skills, required tools, capacity, WIP limits, branch ownership, and approval requirements.
- Supports manual assignment, automatic recommendation, and policy-approved automatic dispatch.
- Prevents two members from unknowingly working on the same exclusive task.
- Allows pair work or review work when the task policy permits multiple participants.
- Rebalances assignments when work is blocked, declined, cancelled, or transferred.
- Writes assignment, claim, release, transfer, and reassignment events to Team Chat and the audit log.

Suggested APIs:

```text
POST /api/v1/work-items/:id/assignments
POST /api/v1/work-items/:id/claim
POST /api/v1/work-items/:id/release
POST /api/v1/team/dispatch/recommend
POST /api/v1/team/dispatch/run
```

Current implementation baseline:

- `POST /api/v1/work-items/:id/assignments` performs manual assignment through the Board Service and enforces Project membership, role, active status, and member WIP rules.
- Main board cards and the Team board show assigned owners by display name when the assignee is a Project team member.
- `huntianling.dispatch` ranks eligible members by available WIP slots, role, skills, and blocked status. `POST /api/v1/team/dispatch/recommend` and `POST /api/v1/team/dispatch/run` assign exclusive work to one member and write an audit event plus an Agent Channel note.
- `POST /api/v1/work-items/:id/claim` and `POST /api/v1/work-items/:id/release` take or drop the exclusive WorkItem lease. A second member cannot claim while that lease is held. Shared read leases allow pair or review participants.
- `POST /api/v1/projects/:id/dispatch/rebalance` releases leases and assignees when work is blocked or cancelled.
- Dispatch recommendation scores branch ownership and pending approvers. `POST /api/v1/work-items/:id/transfer` moves exclusive work and writes `work_item.transferred` instead of a new assignment event. Token-cost capacity accounting remains planned.

### REQ-TEAM-004: Resource Leases and Conflict Control

Concurrent agent work must avoid conflicting edits, duplicate reviews, and shared-resource contention.

Acceptance criteria:

- Supports leases for WorkItems, collaboration tasks, repositories, branches, files, environments, CI runners, and external tools.
- Uses short-lived leases with renewal, expiration, owner, reason, and linked task.
- Blocks or warns when another member tries to edit the same exclusive resource.
- Allows shared read leases for analysis and exclusive write leases for code, configuration, migration, and release actions.
- Detects branch conflicts, file overlap, migration conflicts, CI runner contention, and environment contention before starting work.
- Shows active leases and conflicts in WorkItem, Team Chat, Code View, and team capacity views.

Suggested APIs:

```text
POST /api/v1/resource-leases
GET  /api/v1/resource-leases?projectId=:projectId
POST /api/v1/resource-leases/:id/renew
POST /api/v1/resource-leases/:id/release
GET  /api/v1/projects/:id/conflicts
```

Current implementation baseline:

- Team capacity views and WorkItem cards already surface assignment-related conflicts: unassigned open work, unknown assignees, unavailable assignees, unavailable members with open work, blocked assigned work, and member WIP overload.
- `huntianling.dispatch` persists short-lived leases for WorkItems, collaboration tasks, repositories, branches, files, environments, CI runners, and tools, with owner, reason, linked task, renewal, expiration, shared read, and exclusive write.
- Exclusive write blocks conflicting editors. `GET /api/v1/projects/:id/conflicts` lists exclusive contention, file-path overlap, and migration conflicts. WorkItem Code View includes active lease badges. The developer progress inspector still shows active leases.

## Team Workflow Orchestration

HuntianLing should orchestrate team work through project workflow templates. The workflow engine should decide what must happen next, which roles are needed, which work can run in parallel, which gates must pass, and when a human must approve a transition.

The detailed workflow engine design is organized in [../architecture/workflow-orchestration-engine.md](../architecture/workflow-orchestration-engine.md) so the team can discuss terminology, runtime behavior, visualization, testing, extension points, and implementation phases from one document.

The first product milestone uses a versioned built-in coding workflow that runs Planner, Generator, and Evaluator. The longer template below is a later project option. Visual designers, extension catalogs, and third-party packs are not part of the first milestone.

Recommended default workflow:

```text
Intake
  -> Analysis
  -> Design
  -> Breakdown
  -> Planning
  -> Dispatch
  -> Implementation
  -> Code Review
  -> QA Verification
  -> Security / Reliability / Trust Gates
  -> Release
  -> Retrospective
```

### REQ-FLOW-001: Project Workflow Templates

Projects must be able to choose or customize a team workflow.

Acceptance criteria:

- Supports templates for Scrum, Kanban, Scrumban, compliance-heavy delivery, hotfix delivery, and research-only work.
- Stores stages, allowed transitions, required roles, required skills, required tools, inputs, outputs, checks, approvals, and evidence for each workflow template.
- Lets a Project choose one default workflow and override it by WorkItem type, Milestone, risk level, or delivery slice.
- Keeps workflow template versions so historical WorkItems remain explainable.
- Prevents deleting or changing a workflow version that active WorkItems still use.

Suggested APIs:

```text
GET  /api/v1/workflow-templates
POST /api/v1/projects/:id/workflow
GET  /api/v1/projects/:id/workflow
PATCH /api/v1/projects/:id/workflow
```

Implementation state:

- Built-in published templates include `huntianling.user-story`, `huntianling.scrum`, `huntianling.kanban`, `huntianling.hotfix`, and `huntianling.research`. Each stores stages, roles, skills, tools, checks, approvals, and evidence. Built-in versions cannot be edited in place.
- A project selects one default template through `GET/PATCH /api/v1/projects/:id/workflow` and `GET /api/v1/workflow-templates`. New plans use the selected template. An open run keeps its original template id and version.
- Scrumban and compliance-heavy templates, and override by WorkItem type, Milestone, risk level, or delivery slice, remain planned.

### REQ-FLOW-002: Stage Gates and State Machine

Workflow stages must enforce entry rules, exit rules, and valid transitions.

Acceptance criteria:

- Defines stage states, allowed transitions, required fields, required evidence, required reviews, and required approvals.
- Supports Definition of Ready and Definition of Done per Project, Milestone, WorkItem type, and risk level.
- Blocks invalid transitions and explains the missing fields, tasks, checks, approvals, or evidence.
- Supports manual override only with permission, reason, scope, and audit record.
- Updates board columns, WorkItem status, milestone rollups, Team Chat events, and audit logs after each accepted transition.

Suggested APIs:

```text
POST /api/v1/work-items/:id/workflow/transition
GET  /api/v1/work-items/:id/workflow/gates
POST /api/v1/work-items/:id/workflow/override
```

Implementation state:

- `huntianling.workflow` inspects stage gates for required fields, evidence, reviews, and approvals and blocks invalid transitions with those missing items.
- Override requires actor, reason, and scope, writes `work_item.transition_overridden` audit records, and still rejects forbidden lifecycle moves such as delivered back to inbox.
- Definition of Ready uses the project delivery policy for ready/in_progress. Visual designer editing of gates remains planned.

### REQ-FLOW-003: Agent Orchestration Plan

The workflow engine must translate a WorkItem into an executable human-agent plan.

Acceptance criteria:

- Builds a plan with steps, dependencies, required roles, required skills, required tools, input data, expected outputs, checks, timeouts, retries, and handoffs.
- Marks steps as sequential, parallel, exclusive, review-only, approval-required, or manual-only.
- Uses team capacity, WIP limits, resource leases, branch ownership, and skill coverage before starting steps.
- Creates collaboration tasks and Team Chat messages for planned agent work.
- Pauses the plan when an agent raises a blocker, missing information, failed check, permission gap, or required human decision.
- Stores every workflow run, step result, retry, handoff, and failure reason.

Suggested APIs:

```text
POST /api/v1/work-items/:id/workflow/plan
POST /api/v1/workflow-runs/:id/start
GET  /api/v1/workflow-runs/:id
POST /api/v1/workflow-runs/:id/pause
POST /api/v1/workflow-runs/:id/resume
```

Implementation state:

- Planning a WorkItem from the selected template creates a stored run with sequential, review-only, approval-required, and manual steps, including roles, skills, tools, checks, dependencies, and handoffs.
- Starting a run creates an Agent Channel collaboration task for agent steps and does not start blocked or unapproved steps.
- Starting a step is blocked when the assignee is over WIP, an exclusive lease is held by another owner, or a linked branch is owned by another member.

### REQ-FLOW-004: Human Approval and Escalation

Workflow orchestration must include humans when decisions exceed the agent's authority.

Acceptance criteria:

- Creates approval requests for requirement acceptance, scope changes, risk acceptance, code push, pull request creation, merge, release, production deployment, compliance exceptions, and security exceptions when policy requires them.
- Each approval request declares requester role, required approver roles, allowed decision roles, quorum, sequence, delegation rules, escalation rules, and conflict-of-interest rules.
- Emits role-scoped approval events for request, assignment, approval, rejection, revision request, delegation, expiration, cancellation, and escalation.
- Shows approval requests in WorkItem detail, Team Chat, milestone view, and project workflow view.
- Lets authorized humans approve, reject, request revision, delegate, or expire an approval request.
- Blocks dependent workflow steps until required approvals are resolved.
- Records approver, approver role, decision, reason, timestamp, scope, resulting transition, emitted events, and impacted gates in the audit log.

Suggested APIs:

```text
POST /api/v1/approval-requests
GET  /api/v1/approval-requests?projectId=:projectId
POST /api/v1/approval-requests/:id/approve
POST /api/v1/approval-requests/:id/reject
POST /api/v1/approval-requests/:id/request-revision
POST /api/v1/approval-requests/:id/delegate
```

Implementation state:

- Approval requests store requester role, required approver roles, allowed decision roles, and quorum. Approve, reject, request-revision, and delegate write role-scoped events and audit-visible channel notes.
- Dependent approval-required steps stay queued or waiting until a required approval is resolved.
- Push/PR/merge still use C1 authority grants in addition to workflow approval requests.

### REQ-FLOW-005: Workflow Visibility and Control

Users must be able to see and control active workflows without reading raw logs.

Acceptance criteria:

- Shows active workflow stage, current agent or human owner, running steps, blocked steps, waiting approvals, failed checks, next recommended action, and expected downstream impact.
- Shows parallel branches of work and their dependencies.
- Links workflow steps to Team Chat messages, WorkItems, branches, code changes, CI runs, security checks, reliability checks, trust evidence, and audit records.
- Allows authorized users to pause, resume, cancel, reassign, retry, or rerun workflow steps.
- Provides project-level views for active workflows, blocked workflows, overdue approvals, overloaded roles, and release readiness.

Suggested APIs:

```text
GET  /api/v1/projects/:id/workflow-runs
GET  /api/v1/work-items/:id/workflow
POST /api/v1/workflow-runs/:id/steps/:stepId/retry
POST /api/v1/workflow-runs/:id/cancel
```

Current implementation baseline:

- The Board Store persists per-WorkItem workflow board summaries with run status, active owner, next action, downstream impact, scheduler reason, running steps, blocked steps, waiting approvals, waiting reviews, failed checks, controls, and workflow links.
- The Web API implements `GET /api/v1/projects/:id/main-board/workflow`, `GET /api/v1/projects/:id/workflow-runs`, `GET /api/v1/work-items/:id/workflow`, `PATCH /api/v1/work-items/:id/workflow`, `GET /api/v1/work-items/:id/workflow-board-summary`, and `PATCH /api/v1/work-items/:id/workflow-board-summary`.
- The browser board includes a Workflow board view and an editable Workflow summary section in the WorkItem detail inspector.
- `huntianling.workflow` stores executable runs. Pause, resume, cancel, retry, and reassign are implemented on those runs. Project and WorkItem workflow reads include the live run, next action, blocked/waiting steps, scheduler reasons, and timeline.
- `GET /api/v1/projects/:id/workflow-rollups` returns overloaded roles (active steps versus member capacity) and release-readiness reasons for blocked runs, pending approvals, pending reviews, pending handoffs, missing evidence, and open stories.

### REQ-FLOW-006: Visual Workflow Designer

The orchestration engine must provide a visual editor for workflow templates. Users should be able to design engine workflows without editing raw JSON or code.

Acceptance criteria:

- Provides a canvas for stages, agent steps, human steps, gates, approvals, handoffs, parallel branches, retries, timers, resource leases, and failure paths.
- Lets users edit required roles, required skills, allowed tools, input fields, output fields, checks, evidence requirements, WIP rules, and approval rules for each node.
- Shows invalid or incomplete nodes before the workflow can be saved.
- Saves every canvas as a versioned workflow template that can also be exported as machine-readable workflow DSL.
- Supports draft, review, published, deprecated, and archived template states.
- Prevents publishing when the template fails schema validation, dependency validation, permission validation, or required test cases.
- Shows how each visual node maps to runtime stages, run steps, Team Chat events, board status, and evidence records.

Suggested APIs:

```text
GET  /api/v1/workflow-templates/:id/canvas
PUT  /api/v1/workflow-templates/:id/canvas
POST /api/v1/workflow-templates/:id/validate
POST /api/v1/workflow-templates/:id/publish
POST /api/v1/workflow-templates/:id/archive
```

Implementation state:

- `GET/PUT /api/v1/workflow-templates/:id/canvas` reads and saves a versioned canvas of stages, agent/human steps, gates, and approvals. Each node maps to runtime stage, run step, board status, Team Chat event, and evidence. Built-in templates cannot be edited in place.
- Invalid or incomplete nodes are returned on save. `POST .../validate` and `POST .../publish` block schema, dependency, capability, and tool errors. Draft, review, published, deprecated, and archived states exist; archive is refused while an active run still uses the template.
- Authors edit and dry-run on `/developer/workflow-lab`. The fused `/board` cockpit is unchanged.

### REQ-FLOW-007: Workflow Test Lab

Workflow authors must be able to test a workflow template before it is used by real Project work.

Acceptance criteria:

- Supports dry-run execution with sample WorkItems, Milestones, team members, agent profiles, skills, tools, repositories, CI results, approvals, and evidence fixtures.
- Supports scenario tests for happy path, missing input, blocked task, declined handoff, failed gate, failed CI, missing skill, missing approval, timeout, retry, cancellation, resource conflict, and cross-Milestone delivery.
- Lets test cases assert expected final status, emitted events, created collaboration tasks, Team Chat messages, gate results, evidence records, blocked reasons, and audit events.
- Provides visual replay of each test run so authors can inspect step order, parallel execution, waiting points, retries, and failure paths.
- Stores test runs and reports as evidence for workflow template publication.
- Requires a configured minimum test suite before a workflow template can be published.
- Allows third-party workflow packs to include conformance tests with the workflow template.

Suggested APIs:

```text
POST /api/v1/workflow-templates/:id/test-cases
GET  /api/v1/workflow-templates/:id/test-cases
POST /api/v1/workflow-templates/:id/test-runs
GET  /api/v1/workflow-test-runs/:id
GET  /api/v1/workflow-test-runs/:id/report
```

Implementation state:

- Test Lab dry-runs happy-path, missing-approval, resource-conflict, stale-state, and missing-evidence, stores replay frames and a report as publication evidence, and blocks publish until a passing happy-path run exists.
- Custom-node fixtures are simulated in Test Lab. Timeout and retry suites remain planned.

### REQ-FLOW-008: Workflow Pack Conformance

Third-party workflow packs must pass contract and behavior checks before they can be enabled for a Project.

Acceptance criteria:

- Validates workflow templates against the public workflow schema, node catalog, event catalog, gate catalog, permission model, and API version.
- Requires each workflow pack to declare supported WorkItem types, required agents, required skills, required tools, required evidence, approval points, and unsupported scenarios.
- Runs the Workflow Test Lab conformance suite before a pack can be published or installed.
- Produces a conformance report with passed checks, failed checks, warnings, unsupported features, and required fixes.
- Blocks installation when a workflow pack uses unknown node types, undeclared tools, missing skills, unsafe permissions, or untested high-risk paths.
- Keeps conformance reports versioned so teams can see which workflow pack version was used by historical workflow runs.

Suggested APIs:

```text
POST /api/v1/workflow-packs/import
POST /api/v1/workflow-packs/:id/conformance
GET  /api/v1/workflow-packs/:id/conformance/:runId
POST /api/v1/projects/:id/workflow-packs/:id/enable
```

Implementation state:

- `POST /api/v1/workflow-packs/import` stores a namespaced pack with declared WorkItem types, agents, skills, tools, evidence, approvals, templates, events, nodes, and extensions.
- `POST /api/v1/workflow-packs/:id/conformance` writes a versioned report. Enable is blocked on unknown nodes, undeclared tools, missing skills, unsafe permissions, or a failed Test Lab happy-path. `POST /api/v1/projects/:id/workflow-packs/:id/enable` requires a passing report.

### REQ-FLOW-009: Custom Workflow Event Catalog

Workflow authors and third-party workflow packs must be able to define custom workflow events through a controlled catalog.

Acceptance criteria:

- Separates system event types from custom event types.
- Requires custom event names to use a namespace owned by the workflow pack or Project.
- Stores event name, version, JSON schema, producer roles, target roles, required decision roles, allowed consumers, visibility, retention policy, redaction policy, and audit behavior.
- Supports event visibility levels for runtime-only events, Team Chat events, board-visible events, and audit events.
- Rejects events that do not match their declared schema.
- Prevents custom events from redefining system event names or changing system event semantics.
- Allows workflow tests to assert emitted custom events.
- Keeps event versions available so historical workflow runs can be replayed and explained.

Suggested APIs:

```text
GET  /api/v1/workflow-event-types
POST /api/v1/workflow-event-types
GET  /api/v1/workflow-event-types/:id
POST /api/v1/workflow-events
GET  /api/v1/workflow-runs/:id/events
```

Implementation state:

- `GET /api/v1/workflow-event-types` lists system and custom events. Custom ids must use a pack or project namespace and cannot redefine system events.
- `POST /api/v1/workflow-events` rejects payloads that miss declared required fields and stores the event version for later replay.

### REQ-FLOW-010: Custom Plan and Node Types

The workflow plan must support custom node types without requiring changes to the core engine for every new workflow style.

Acceptance criteria:

- Provides built-in node types for stages, agent steps, human steps, gates, approvals, handoffs, parallel branches, timers, retries, resource leases, and failure handlers.
- Lets workflow packs register custom plan node types with a namespace, input schema, output schema, UI form schema, required capabilities, required permissions, supported events, and test fixtures.
- Shows custom node types in the Visual Workflow Designer only after the workflow pack passes conformance checks.
- Lets the Workflow Test Lab simulate custom nodes through declared fixtures or a registered test adapter.
- Blocks custom nodes that request undeclared tools, unsafe permissions, unknown events, or unsupported runtime capabilities.
- Prevents custom nodes from bypassing stage gates, approvals, resource leases, audit logging, or evidence requirements.
- Keeps custom node versions linked to workflow runs and conformance reports.

Suggested APIs:

```text
GET  /api/v1/workflow-node-types
POST /api/v1/workflow-node-types
GET  /api/v1/workflow-node-types/:id
POST /api/v1/workflow-templates/:id/nodes
POST /api/v1/workflow-templates/:id/nodes/:nodeId/validate
```

Implementation state:

- Built-in node types cover stages, agent/human steps, gates, approvals, handoffs, parallel branches, timers, retries, resource leases, and failure handlers.
- Pack custom nodes appear in `GET /api/v1/workflow-node-types` only after conformance passes. Test Lab simulates them from declared fixtures. Unsafe bypass permissions are rejected.

### REQ-FLOW-011: Workflow Extension Points

Workflow behavior must be extensible through declared extension points, not through hidden runtime hooks.

Acceptance criteria:

- Defines extension points for template validation, plan generation, dispatch recommendation, step start, step completion, gate evaluation, evidence ingestion, approval request creation, event emission, failure handling, and report generation.
- Requires each extension to declare scope, input schema, output schema, side effects, required permissions, timeout, retry policy, idempotency behavior, and test cases.
- Lets Projects enable or disable extension packages per workflow template.
- Runs extensions in a controlled order with deterministic results or explicit conflict errors.
- Blocks publishing when enabled extensions conflict, lack tests, require missing tools, or request permissions outside the Project policy.
- Records extension execution in workflow run history and audit events.
- Supports process customization by adding stages, transitions, gates, events, plan nodes, and approval rules through the same validated extension model.

Suggested APIs:

```text
GET  /api/v1/workflow-extension-points
POST /api/v1/workflow-extension-packages/import
GET  /api/v1/workflow-extension-packages/:id
POST /api/v1/projects/:id/workflow-extension-packages/:id/enable
POST /api/v1/workflow-templates/:id/extensions/validate
```

Implementation state:

- `GET /api/v1/workflow-extension-points` lists the declared points. Packs register extension packages with order, schemas, permissions, and test cases.
- Enabling two extensions at the same point and order fails with an explicit conflict. Pack enable writes `workflow_pack.enabled` audit events.

### REQ-FLOW-012: Harness Workflow Management

Workflow authors must be able to manage workflow templates through Harness-facing UI and APIs.

Acceptance criteria:

- Supports creating, editing, saving, cloning, selecting, replacing, publishing, deprecating, archiving, importing, and exporting workflow templates through Harness.
- Lets a Project select a default workflow template and override it by WorkItem type, Milestone, risk level, or delivery slice.
- Shows template version, owner, publication state, test status, conformance status, active Project usage, and active workflow runs before replacement.
- Requires replacement preview that shows changed stages, nodes, events, gates, approvals, Agent bindings, Skill bindings, and possible impact on active WorkItems.
- Supports safe replacement modes: future WorkItems only, selected WorkItems, selected Milestones, or explicit migration of active workflow runs.
- Supports rollback to a previously published workflow template version.
- Records template selection, replacement, migration, and rollback events in the audit log.

Suggested APIs:

```text
GET  /api/v1/harness/workflows
POST /api/v1/harness/workflows
POST /api/v1/harness/workflows/:id/clone
POST /api/v1/projects/:id/workflow-template/select
POST /api/v1/projects/:id/workflow-template/replace
POST /api/v1/projects/:id/workflow-template/rollback
```

Implementation state:

- `GET/POST /api/v1/harness/workflows` lists and clones templates. A Project can select a default template. Built-in templates cannot be mutated in place; customization requires clone or import.
- `POST /api/v1/projects/:id/workflow-template/replace` returns a preview of changed stages, steps, gates, approvals, and bindings. Mode `future` leaves active runs on the previous template; `migrate-active` remaps open runs; `selected` migrates listed WorkItems. `POST /api/v1/projects/:id/workflow-template/rollback` restores the previous template. Import and export are `POST /api/v1/harness/workflows/import` and `GET /api/v1/harness/workflows/:id/export`. Selection, replacement, and rollback write audit events.

### REQ-FLOW-013: Built-In Orchestration Capability Library

The system must ship common workflow capabilities by default so teams can build useful workflows before adding custom extensions.

Acceptance criteria:

- Provides built-in capabilities for intake, requirement analysis, requirement design, decomposition, prioritization, planning, dispatch, implementation, code review, QA verification, security review, reliability review, trust review, approval, release, retrospective, Team Chat, Git, CI, evidence, and audit actions.
- Ships built-in events, plan node types, gate types, approval types, Team Chat message types, and evidence types for those capabilities.
- Provides default workflow templates that use the built-in capabilities.
- Keeps built-in capabilities versioned and visible in the Visual Workflow Designer.
- Allows teams to select, copy, extend, or disable built-in workflow capabilities according to Project policy.
- Prevents destructive edits to built-in capability definitions; teams must clone or extend them for customization.
- Requires built-in capabilities to include schemas, UI forms, test fixtures, documentation, and conformance results.

Suggested APIs:

```text
GET  /api/v1/workflow-capabilities/builtin
GET  /api/v1/workflow-capabilities/:id
POST /api/v1/projects/:id/workflow-capabilities/:id/enable
POST /api/v1/projects/:id/workflow-capabilities/:id/disable
```

Implementation state:

- Built-in capabilities for intake, analysis, design, decomposition, implementation, review, evaluation, approval, git, CI, evidence, and audit ship versioned on `GET /api/v1/workflow-capabilities/builtin`.
- Projects can enable or disable a capability. Built-in definitions cannot be edited in place.
- `GET /api/v1/workflow-capabilities/:id` returns packed documentation, a happy-path fixture, and a conformance schema result. Visual designer visibility remains planned.

### REQ-FLOW-014: Agent and Skill Binding

Workflow nodes must bind to agent roles, concrete team members, required skills, and allowed tools before they can run.

Acceptance criteria:

- Each executable workflow node declares required role, optional preferred agent, agent selection policy, required skills, optional skill packs, allowed tools, inputs, outputs, checks, and approval requirements.
- The workflow planner resolves the node to an eligible team member by checking project membership, role, capability profile, skill profile, availability, WIP limits, resource leases, and permissions.
- The Agent Runtime loads only the skills required by the selected node and records skill id, skill version, input data, output data, and validation results.
- The node cannot start when no eligible agent or human member exists, required skills are missing or unvalidated, required tools are unavailable, or approval is unresolved.
- Agent Team Chat receives a visible event that explains which agent was selected, which skills were loaded, and why the step can run or cannot run.
- Skill outputs must map back to WorkItem fields, Team Chat messages, evidence records, gate results, or follow-up collaboration tasks.
- Workflow Test Lab can simulate agent and skill binding decisions with fixtures.

Suggested APIs:

```text
GET  /api/v1/workflow-templates/:id/agent-bindings
PUT  /api/v1/workflow-templates/:id/agent-bindings
GET  /api/v1/workflow-templates/:id/skill-bindings
PUT  /api/v1/workflow-templates/:id/skill-bindings
POST /api/v1/workflow-runs/:id/steps/:stepId/resolve-agent
POST /api/v1/workflow-runs/:id/steps/:stepId/start-agent
```

### REQ-FLOW-015: Plan Scheduling

The workflow engine must schedule executable plan steps instead of starting every generated step immediately.

Acceptance criteria:

- Maintains a schedule for workflow plan steps with dependencies, priority, due date, Milestone, required role, required skills, allowed tools, estimated duration, retry policy, timeout, and resource requirements.
- Queues ready steps only when dependencies, stage gates, approvals, skill coverage, team capacity, WIP limits, resource leases, and repository state allow the step to start.
- Supports sequential, parallel, exclusive, delayed, recurring, retry, manual-only, approval-gated, and event-triggered steps.
- Recomputes scheduling decisions when WorkItem state, Team Chat tasks, approvals, blockers, resource leases, CI results, branch state, or agent availability changes.
- Records why each step is scheduled, delayed, blocked, retried, cancelled, or reassigned.
- Prevents starvation by exposing aging, priority override, deadline risk, and blocked-duration signals.
- Lets authorized users pause, resume, reorder, reprioritize, reassign, or cancel scheduled plan steps.
- Provides deterministic scheduling simulation in the Workflow Test Lab.

Suggested APIs:

```text
GET  /api/v1/workflow-runs/:id/schedule
POST /api/v1/workflow-runs/:id/schedule/recompute
POST /api/v1/workflow-runs/:id/schedule/pause
POST /api/v1/workflow-runs/:id/schedule/resume
POST /api/v1/workflow-runs/:id/steps/:stepId/reprioritize
POST /api/v1/workflow-runs/:id/steps/:stepId/reassign
```

Implementation state:

- The scheduler queues steps only after dependencies complete, records why a step is scheduled, delayed, blocked, or waiting for approval, and recomputes after approvals or capability changes.
- Pause, resume, reassign, retry, and cancel of scheduled steps are implemented. Recurring steps reschedule after completion; event-triggered steps stay queued until `POST /api/v1/workflow-runs/:id/events`. Workflow Test Lab simulation remains planned.

### REQ-FLOW-016: Static Workflow Visualization

Workflow authors and Project readers must be able to understand a workflow template without running it.

Acceptance criteria:

- Shows a static workflow map with stages, steps, gates, approvals, handoffs, parallel branches, retry paths, timers, resource leases, failure handlers, events, and evidence outputs.
- Supports stage swimlane, role swimlane, dependency graph, and compact outline presentations from the same workflow template.
- Provides layer toggles for lifecycle stages, Agent and Skill binding, tools, events, gates, approvals, evidence, data inputs, source documents, compliance controls, and risk signals.
- Shows validation badges on nodes and edges for missing fields, invalid schemas, missing skills, unsafe permissions, unresolved approvals, untested paths, and conformance failures.
- Opens a node inspector with description, required role, selected or eligible agents, required skills, allowed tools, inputs, outputs, checks, evidence requirements, state transitions, and failure behavior.
- Lets users compare two template versions and see added, removed, changed, and risky nodes or transitions.
- Exports a static snapshot for review as image, Markdown summary, and workflow DSL without losing node ids and version references.

Suggested APIs:

```text
GET  /api/v1/workflow-templates/:id/visualization
GET  /api/v1/workflow-templates/:id/visualization/layers
POST /api/v1/workflow-templates/:id/visualization/export
GET  /api/v1/workflow-templates/:id/versions/:versionId/diff
```

Implementation state:

- `GET /api/v1/workflow-templates/:id/visualization` returns stage swimlane, role swimlane, dependency graph, and outline from the same template, plus layer toggles, validation badges, and a node inspector.
- `GET .../visualization/layers`, `POST .../visualization/export`, and `GET .../versions/:versionId/diff` export Markdown/DSL/SVG snapshots and compare added, removed, changed, and risky steps. Authors inspect the map on `/developer/workflow-lab` without editing JSON. The fused `/board` cockpit is unchanged.

### REQ-FLOW-017: Runtime Scheduling Visualization

Users must be able to see how the scheduler moves a real workflow run through the plan.

Acceptance criteria:

- Shows a live workflow run view with active node states: `pending`, `ready`, `queued`, `scheduled`, `running`, `waiting_for_input`, `waiting_for_approval`, `blocked`, `retrying`, `completed`, `failed`, `skipped`, and `cancelled`.
- Provides a scheduler timeline that shows when each step became ready, queued, assigned, started, paused, retried, reassigned, completed, or blocked.
- Shows parallel execution with role swimlanes, agent swimlanes, resource lease lanes, and dependency edges.
- Displays the scheduler reason for each decision, including dependency state, gate result, approval state, team capacity, WIP limit, resource lease, repository state, CI state, missing skill, missing tool, or permission limit.
- Shows selected agent, eligible alternatives, loaded skills, allowed tools, input data, output data, evidence records, Team Chat events, branch, pull request, and CI run for each step.
- Lets authorized users pause, resume, retry, reassign, reprioritize, cancel, or rerun a step from the visual run view.
- Keeps an event stream synchronized with the canvas and timeline so users can inspect raw scheduling events without reading server logs.
- Supports time scrubbing and replay for completed runs.

Suggested APIs:

```text
GET  /api/v1/workflow-runs/:id/timeline
GET  /api/v1/workflow-runs/:id/scheduler-decisions
GET  /api/v1/workflow-runs/:id/steps/:stepId/trace
POST /api/v1/workflow-runs/:id/replay
GET  /api/v1/workflow-runs/:id/replay/:replayId
```

Current implementation baseline:

- The browser Runs workspace renders a Story delivery runway with candidate ranking, readiness checks, implementation execution, role handoff, verification gates, and completion stages from the Project workflow board payload.
- The Runs workspace shows the priority Story queue, role handoff and approval/review waits, workflow blockers, failed checks, and status lanes without requiring users to inspect server logs.
- `GET /api/v1/workflow-runs/:id/timeline` and `GET /api/v1/workflow-runs/:id/scheduler-decisions` return stored run events and scheduler reasons. Developer progress shows the live workflow run.
- Canvas replay, time scrubbing, and swimlane maps remain planned.

### REQ-FLOW-018: Workflow Test Replay Visualization

Workflow Test Lab must show why a workflow test passed or failed through replayable visual evidence.

Acceptance criteria:

- Shows the test scenario, fixture data, expected assertions, actual events, final states, and failed assertions in one test report view.
- Replays test execution over the same workflow map used by the designer, with a time scrubber for state transitions, scheduling decisions, retries, waits, blockers, and failures.
- Highlights differences between expected and actual node order, emitted events, created collaboration tasks, Team Chat messages, gate results, evidence records, approvals, and audit events.
- Supports side-by-side comparison of dry-run, real run, and replay data when the same template version and scenario are available.
- Exports the replay report as publication evidence for the workflow template and as debugging evidence for third-party workflow packs.
- Stores replay frames and trace events with workflow template version, workflow pack version, fixture version, scheduler version, and conformance run id.

Suggested APIs:

```text
GET  /api/v1/workflow-test-runs/:id/timeline
GET  /api/v1/workflow-test-runs/:id/replay
GET  /api/v1/workflow-test-runs/:id/assertions
POST /api/v1/workflow-test-runs/:id/export-report
```

Implementation state:

- `GET /api/v1/workflow-test-runs/:id/replay` overlays Test Lab frames on the designer dependency graph, with timeline, assertions, and highlights. Frames store template, pack, fixture, scheduler, and conformance versions.
- `POST /api/v1/workflow-test-runs/:id/export-report` writes Markdown publication evidence. Side-by-side dry-run versus live-run comparison remains planned.

### REQ-FLOW-019: Role-Scoped Approval and Review Events

Approvals and reviews must be modeled as workflow events associated with roles, not only as fields on WorkItems or workflow steps.

Acceptance criteria:

- Workflow templates can declare which roles may request, perform, approve, reject, request revision, delegate, expire, cancel, and escalate an approval or review.
- Approval and review events store event type, actor, actor role, target role, requester role, reviewer role, approver role, scope, WorkItem, Milestone, workflow run, step, branch, pull request, CI run, evidence, reason, timestamp, and correlation id.
- Supports approval event types such as `approval.requested`, `approval.assigned`, `approval.approved`, `approval.rejected`, `approval.revision_requested`, `approval.delegated`, `approval.expired`, `approval.cancelled`, and `approval.escalated`.
- Supports review event types such as `review.requested`, `review.assigned`, `review.started`, `review.commented`, `review.approved`, `review.changes_requested`, `review.rejected`, `review.completed`, and `review.cancelled`.
- Stage gates and scheduler decisions can wait for required role-scoped events, required quorum, ordered approvals, separation of duties, or delegated reviewer completion.
- Agent Team Chat displays approval and review events as visible conversation entries, including the responsible roles and unresolved next actions.
- Workflow Test Lab can simulate approval and review event sequences, missing role authorization, wrong-role approval, expired approvals, delegated reviews, and conflicting decisions.
- Audit records preserve the full event chain so a user can see who requested, who reviewed, who approved, which role they held, and which gate or transition changed.

Suggested APIs:

```text
GET  /api/v1/workflow-role-event-policies
POST /api/v1/workflow-role-event-policies
GET  /api/v1/workflow-runs/:id/role-events
POST /api/v1/workflow-runs/:id/role-events
POST /api/v1/review-requests
GET  /api/v1/review-requests?projectId=:projectId
POST /api/v1/review-requests/:id/complete
```

Implementation state:

- Approval events `approval.requested`, `assigned`, `approved`, `rejected`, `revision_requested`, and `delegated` are stored with actor role, target role, WorkItem, run, step, reason, and correlation id, and are posted to the Agent Channel.
- Stage gates and the scheduler wait on required approval events. `POST /api/v1/review-requests`, `GET /api/v1/review-requests?projectId=:projectId`, and `POST /api/v1/review-requests/:id/complete` store `review.requested`, `review.assigned`, and `review.completed` role-scoped events. Workflow Test Lab simulation remains planned.

### REQ-FLOW-020: Priority-Ordered Story E2E Delivery

The workflow engine must support selecting Stories by priority and driving one Story through an end-to-end team delivery run.

Acceptance criteria:

- Maintains a Project or Milestone Story priority queue generated from the selected prioritization method, dependencies, risk, deadline, delivery slice, blocked state, and human overrides.
- Starts a Story delivery run only when the Story passes Definition of Ready and required analysis, design, acceptance criteria, dependency, approval, Skill, tool, team-capacity, and resource checks.
- Links each Story delivery run to the Story, parent Feature or Epic, Milestone or delivery slice, workflow template version, priority rank, selected team members, Agent runs, collaboration tasks, branches, pull requests, CI runs, reviews, approvals, and evidence.
- Uses Story-level WIP limits and resource leases so the team can focus on a controlled number of active Stories while still allowing safe parallel work inside a Story.
- Generates child Tasks, Agent collaboration tasks, review requests, approval requests, branch work, CI checks, and evidence requirements from the Story workflow template.
- Schedules internal Story steps by dependency and role so analysis, design, implementation, review, QA, security, reliability, trust, and release work happen in the required order or approved parallel branches.
- Allows the scheduler to skip a higher-ranked Story only when it is blocked, not ready, missing required roles, missing Skills, missing tools, waiting for approval, or blocked by resources; the skip reason must be visible and auditable.
- Requires Story completion to prove acceptance coverage, child WorkItem completion, review decisions, approval events, code evidence, CI evidence, configured security/reliability/trust gates, and Definition of Done.
- Shows Story delivery progress in board, workflow visualization, Agent Team Chat, Code View, Milestone rollups, runtime scheduler timeline, and test replay.
- Lets authorized users pause, resume, cancel, reprioritize, split, or move a Story delivery run with reason and audit records.
- Workflow Test Lab can simulate priority queues, blocked top-priority Stories, WIP limits, missing Skills, branch conflicts, failed CI, wrong-role approval, and successful end-to-end Story delivery.

Suggested APIs:

```text
GET  /api/v1/projects/:id/story-queue
POST /api/v1/projects/:id/story-queue/recompute
POST /api/v1/projects/:id/story-queue/reorder
POST /api/v1/work-items/:id/story-delivery/start
GET  /api/v1/work-items/:id/story-delivery
GET  /api/v1/story-delivery-runs/:id
POST /api/v1/story-delivery-runs/:id/pause
POST /api/v1/story-delivery-runs/:id/resume
POST /api/v1/story-delivery-runs/:id/cancel
GET  /api/v1/story-delivery-runs/:id/evidence
```

Current implementation baseline:

- `GET /api/v1/projects/:id/story-queue` returns a deterministic Project or Milestone Story queue sorted by priority, due date, and WorkItem order.
- `POST /api/v1/projects/:id/story-queue` recomputes and returns the same queue without creating a separate workflow run.
- Queue items explain skipped Stories with machine-readable reasons such as missing analysis, missing design, missing acceptance criteria, missing Milestone, missing assignee, unavailable assignee, WIP overload, waiting approvals, waiting reviews, blocked workflow steps, and failed checks.
- Developer assignment, developer role claims, and `in_progress` WorkItem transitions require Ready work plus Definition-of-Ready fields for requirement-bearing items.
- The Workflow board shows agile lifecycle swimlanes, ready, skipped, active, blocked, approval, review, and failed-check counts, plus a Runs workbench that separates the Story queue, delivery runway, role handoff waits, workflow blockers, and status lanes.
- The requirements Backlog shows Story Ready and delivery evidence signals beside the priority queue, and can queue a Ready Story by updating its workflow summary to `queued` with a scheduler reason. This records scheduling intent and does not create the future Story delivery run entity yet.
- `huntianling.delivery` starts one Story delivery run after Definition of Ready, drives Planner then Generator then Evaluator, and exposes start, get, advance, pause, resume, cancel, and evidence APIs. The developer progress inspector can start, pause, resume, or cancel the run.
- Automatic child task generation, collaboration task creation, resource leases, branch/PR/CI execution, Definition of Done enforcement, and Workflow Test Lab simulation remain planned.

### REQ-FLOW-021: Event-Driven State Transitions and Handoffs

Workflow tasks must combine immutable events with durable current state so the system can run a delivery pipeline from start to finish.

Acceptance criteria:

- WorkItems, workflow runs, run steps, Story delivery runs, collaboration tasks, approval requests, and review requests each store a current state and owner.
- Workflow events are immutable facts with actor, actor role, target object, reason, timestamp, correlation id, and optional evidence references.
- Events do not replace current state. Current state does not replace the event log.
- A State Transition Engine validates each event against current state, role policy, gate rules, approvals, reviews, evidence, Skills, tools, resource leases, and idempotency keys before changing state.
- Role handoff starts with a handoff or review event and completes only when the target object changes state and owner in the same accepted transition.
- Rejected, duplicate, stale, out-of-order, or wrong-role events must not change state; the system must record the rejection reason.
- Scheduler decisions use current state for execution control and use events to explain why the state changed.
- Board, workflow visualization, Agent Team Chat, Code View, audit log, and test replay must show both current state and the event history behind it.
- Workflow Test Lab can assert event sequences, state transitions, rejected transitions, duplicate events, stale events, and successful role handoffs.

Suggested APIs:

```text
GET  /api/v1/workflow-state-transition-rules
POST /api/v1/workflow-runs/:id/events
GET  /api/v1/workflow-runs/:id/events
GET  /api/v1/workflow-runs/:id/state-transitions
POST /api/v1/workflow-runs/:id/handoffs
POST /api/v1/workflow-handoffs/:id/accept
POST /api/v1/workflow-handoffs/:id/reject
```

Current implementation baseline:

- WorkItem workflow summaries persist current run state, active owner or role, scheduler reason, running steps, blocked steps, waiting approvals, waiting reviews, failed checks, controls, and links.
- The browser Runs workspace renders role handoff and approval/review waits beside blocker reasons so users can see which role owns the next transition and why the current state has not advanced.
- Role-scoped events are stored as immutable facts beside current run state. `POST /api/v1/workflow-runs/:id/handoffs` with accept/reject changes owner only on an accepted transition; rejected, duplicate, or wrong-role events write a rejection record and leave state unchanged. `GET /api/v1/workflow-runs/:id/state-transitions` lists those rejections. Event-history playback remains planned.

### REQ-FLOW-022: Agile Lifecycle Swimlane Coverage

The Runs workspace must show the agile development lifecycle as first-class swimlanes, separate from low-level workflow run status.

Acceptance criteria:

- Covers the agile lifecycle lanes for requirement intake, requirement analysis, solution design, breakdown review, milestone planning, Ready dispatch, implementation, code review, QA verification, security/reliability/trust gates, delivery complete, and exception closed.
- Maps every WorkItem status to exactly one agile lifecycle lane or reports it as an unmapped lifecycle coverage gap.
- Keeps workflow run status lanes available as a secondary diagnostic view, not as the primary business lifecycle view.
- Shows lane owner role, mapped WorkItem statuses, required evidence areas, blocked card count, ready card count, and missing evidence count for each lifecycle lane.
- Highlights lifecycle lanes and cards that are blocked by waiting approvals, waiting reviews, failed checks, blocked workflow steps, or required delivery evidence gaps.
- Lets users open a WorkItem from the lifecycle lane without leaving the Runs workspace.

Suggested APIs:

```text
GET /api/v1/projects/:id/main-board/workflow
```

Current implementation baseline:

- `GET /api/v1/projects/:id/main-board/workflow` returns `lifecycleLanes` and `lifecycleCoverage` beside the existing run-status lanes.
- The lifecycle coverage maps all current WorkItem statuses: `inbox`, `analyzing`, `designing`, `triaged`, `planned`, `ready`, `in_progress`, `in_review`, `verifying`, `gates_passing`, `delivered`, `rejected`, and `stopped`.
- The browser Runs workspace renders agile lifecycle swimlanes as the primary panel and keeps run-status lanes as a collapsible diagnostic section.

## Team Collaboration

### REQ-COLLAB-001: Agent Team Chat Window

HuntianLing must provide a dedicated Agent Channel in the developer shell. This window is separate from the customer's MKT dialog and from the user's normal LLM task chat. It shows how MKT, Planner, Generator, Evaluator, and developers collaborate.

Acceptance criteria:

- Each conversation belongs to one Project and is reachable only from the developer shell (`REQ-WEB-007`). Customer and admin shells do not host this channel.
- MKT, Planner, Generator, Evaluator, and human developers may participate. An Agent participates only under its role contract and Skill boundary.
- Messages use the envelope and `type` catalog in `REQ-COLLAB-004`.
- Messages can include optional context tags for Milestone, WorkItem, branch, pull request, CI run, or source document. These tags support navigation, filtering, and traceability; they do not turn the chat window into the board, Code View, SCM tool, CI tool, customer MKT dialog, or normal LLM task window.
- Allows humans and agents to join the same conversation.
- Ordinary `note.chat` messages, mentions, role-targeted messages, and threaded replies are visible and do not change WorkItem state by themselves.
- Links messages to related WorkItems, acceptance criteria, Milestones, code changes, CI evidence, and audit events only as references unless the type's write path updates the owning record.
- Distinguishes human messages, agent messages, tool-generated evidence, system events, and typed collaboration messages.
- Preserves conversation history as project data and applies project-level developer access control.

Suggested APIs:

```text
POST /api/v1/team/conversations
GET  /api/v1/team/conversations?projectId=:projectId
GET  /api/v1/team/conversations/:id
POST /api/v1/team/conversations/:id/messages
POST /api/v1/team/conversations/:id/participants
POST /api/v1/team/conversations/:id/decisions
POST /api/v1/team/conversations/:id/approvals
```

Implementation state:

- Developer-only Agent Channel conversations and messages are stored by `huntianling.collab`. `POST /api/v1/team/conversations/:id/decisions` and `/approvals` record conversation decisions and approvals. Customers receive 403.

### REQ-COLLAB-002: Agent Collaboration Protocol

Agent-to-agent collaboration must be visible in the Agent Team Chat instead of existing only in temporary model context.

Acceptance criteria:

- Agents use structured chat messages to request information, delegate work, report findings, raise blockers, ask for review, and hand off tasks.
- Each agent message can show producing role, collaboration task, skill versions, referenced WorkItems, tool evidence, confidence, open questions, and next action.
- Agent handoff messages define expected receiver role, required inputs, expected output, deadline or Milestone, and validation checks.
- Human participants can interrupt, answer, approve, reject, or redirect an agent collaboration flow.
- Board and WorkItem views show unresolved team-chat questions and decisions.
- Agent runtime reads the relevant Agent Team Chat messages selected by task policy before starting a collaboration task and writes its conclusions back to that conversation.

Implementation state:

- Board-detail and developer-board progress list unresolved team-chat questions and recorded decisions for the WorkItem.
- Agent runtime reads task-policy selected channel messages before starting a collaboration task and writes `progress.update` or `report.findings` back to that conversation. A pending approval blocks start.

### REQ-COLLAB-003: Conversation-Driven Agent Task Management

Agent Team Chat messages must be able to create, assign, transfer, and update collaboration tasks between agents. A collaboration task is an internal agent-team work record; creating it does not create a new dsh LLM chat task by itself.

Acceptance criteria:

- A structured chat message can create an agent collaboration task inside the current Project and attach optional context tags for Milestone, WorkItem, branch, pull request, CI run, or source document.
- Collaboration tasks store requester, assignee role, assignee agent or human, objective, inputs, expected output, required skills, allowed tools, due Milestone or date, status, priority, blockers, and acceptance checks.
- Supported task states include `proposed`, `accepted`, `in_progress`, `waiting_for_input`, `blocked`, `ready_for_review`, `completed`, `rejected`, and `cancelled`.
- Agents can accept, decline, ask questions, request missing information, transfer, split, merge, or complete a collaboration task through typed chat messages.
- Humans can create tasks, join tasks, answer questions, approve transfers, override assignments, request revisions, or cancel tasks from the same conversation.
- Each task update writes a visible conversation event and an auditable state transition.
- A task transfer message names the sending role, receiving role, reason, transferred context, expected next action, required evidence, and unresolved questions.
- WorkItem and board views show open collaboration tasks, pending handoffs, missing answers, and completed task results.
- Agent runtime uses the task record as the runnable input and refuses to start when the chat-created task lacks required fields, skills, tools, or approvals.

Task message types are listed in `REQ-COLLAB-004`. First-slice task types are `task.propose`, `task.accept`, `task.decline`, `task.question`, `task.answer`, `task.transfer`, `task.block`, `task.unblock`, `task.complete`, and `task.cancel`.

Suggested APIs:

```text
POST  /api/v1/team/conversations/:id/tasks
GET   /api/v1/team/conversations/:id/tasks
GET   /api/v1/agent-collaboration-tasks/:id
PATCH /api/v1/agent-collaboration-tasks/:id
POST  /api/v1/agent-collaboration-tasks/:id/messages
POST  /api/v1/agent-collaboration-tasks/:id/transfer
POST  /api/v1/agent-collaboration-tasks/:id/complete
```

Implementation state:

- First-slice task types create and update collaboration tasks with requester, assignee, objective, inputs, skills, tools, checks, due milestone or date, priority, blockers, and context tags.
- Accept, decline, question, answer, transfer, block, unblock, complete, and cancel write an auditable conversation event. Transfer payloads require sending role, receiving role, reason, transferred context, expected next action, required evidence, and unresolved questions.
- Agent runtime refuses to start from a collaboration task that is missing required skills, tools, checks, expected output, or a required approval, or that is already completed, rejected, or cancelled.
- Developer board progress and WorkItem board-detail responses list open collaboration tasks, unresolved questions, and recorded decisions. Customers receive 403 on task, decision, and approval writes.
- `task.split` creates child collaboration tasks from a parent. `task.merge` keeps one remaining task and cancels the others.

### REQ-COLLAB-004: Agent Channel Message Schema

Status: planned.

Agent Channel messages use one envelope and a typed payload. Implementation switches on the `type` discriminant. First-slice types are a closed union ending in `assertNever`. Later catalog types are merge-extensible and must fall through a documented default that rejects unknown types at write time.

Envelope fields:

- `id`, `conversationId`, `projectId`, `schemaVersion`
- `type`
- `createdAt`
- `from`: `kind` (`human` | `agent` | `system`), `role`, `memberId` or `agentRunId`, Skill ids and depth when the sender is an Agent
- `to`: `kind` (`channel` | `role` | `member`), optional `role`, optional `memberId`
- `threadId`, `inReplyTo`
- `refs`: WorkItem, Milestone, collaboration task, workflow run, Skill, evidence, customer MKT session
- `visibility`: `developer` for this channel; customer-visible facts go through MKT or the customer progress projection

A typed message that assigns work, reports a result, hands off, blocks, or decides must update the owning collaboration-task, WorkItem, evidence, or MKT record in the same accepted write. `note.chat` never does that. Hidden model context is not a substitute for a channel message.

First-slice types:

| Family | Types | Purpose |
| --- | --- | --- |
| Note | `note.chat` | Human or Agent talk. No state change. |
| Task | `task.propose`, `task.accept`, `task.decline`, `task.question`, `task.answer`, `task.transfer`, `task.block`, `task.unblock`, `task.complete`, `task.cancel` | Assignment, tracking of collaboration-task lifecycle (`REQ-COLLAB-003`). |
| Progress | `progress.update` | Current step, next action, budget or blocker summary. Does not mark customer delivery. |
| Report | `report.findings` | Evaluator or review findings with criterion ids and evidence refs. Generator self-check must set `kind: self_check`. |
| Handoff | `handoff.request`, `handoff.accept`, `handoff.decline` | Role-to-role transfer with `handoffKind`, required inputs, expected output, checks. |
| Question | `question.ask`, `question.answer` | Missing information inside the developer channel. |
| Blocker | `blocker.raise`, `blocker.resolve` | Work cannot proceed; resolve names the evidence or decision. |
| Human | `human.redirect`, `human.stop` | Interrupt, redirect, or stop an Agent flow. |
| Customer bridge | `customer.question_needed` | Product question must go to the customer MKT dialog; the customer does not join this channel. |

`handoffKind` values for the first slice: `collect_complete` (MKT → Planner), `design_ready` (Planner → confirmed scope), `implement` (→ Generator), `evaluate` (→ Evaluator), `repair` (Evaluator → Generator), `clarify` (→ MKT or Planner), `complete`.

Later catalog types, not first milestone: `task.split`, `task.merge`, `task.review_request`, `task.revision_request`, `review.request`, `review.comment`, `approval.request`, `approval.granted`, `approval.rejected`, `decision.record`, `skill.gap`, `environment.blocked`, `run.started`, `run.paused`, `run.resumed`, `run.failed`, `checkpoint.saved`, `customer.decision_received`.

Acceptance criteria:

- Writes reject unknown first-slice `type` values and payloads that fail the type's JSON schema.
- Handoff and task-assignment payloads include receiver role, required Skills, allowed tools, output schema or expected artifact, and sensors. Runtime refuses to start when those fields are missing (`REQ-AGENT-002`, `REQ-SKILL-005`).
- `report.findings` cannot complete a customer-visible delivered state; `REQ-HARNESS-008` still requires Evaluator evidence on the owning record.
- `customer.question_needed` creates or updates the customer MKT dialog and does not expose Agent Channel history to the customer.
- Tests cover a MKT → Planner → Generator → Evaluator handoff sequence, a rejected unknown type, a `note.chat` that does not change WorkItem state, and a human stop that cancels the active collaboration task.

Implementation state:

- `huntianling.collab` stores developer-only Agent Channel conversations, first-slice typed messages, later catalog types `task.split`/`task.merge`/`decision.record`/`approval.request`/`approval.granted`/`approval.rejected`, collaboration tasks, and immutable events. `/developer/channel` is the developer shell surface; remaining later catalog types are still rejected at write time; customers receive a 403.

Related requirements: `REQ-COLLAB-001`, `REQ-COLLAB-002`, `REQ-COLLAB-003`, `REQ-WEB-007`, `REQ-MKT-001`, `REQ-HARNESS-006`, `REQ-FLOW-021`.

## Skills and Coverage

### REQ-SKILL-001: Skill Registry

HuntianLing must track available skills and skill versions.

Acceptance criteria:

- Stores skill id, name, version, description, supported roles, supported task types, required tools, validation status, capability boundary, and depth profile.
- Knows whether a skill was created through `skill-creator`.
- Supports project-specific skill enablement.
- Keeps skill version history so old agent runs remain explainable.
- A Skill that lacks boundary or depth metadata cannot be enabled for Agent execution.

Implementation state:

- `huntianling.skills` stores Skill id, version, boundary, depth profile, validation status, and history. Project enablement can disable a required MKT Skill and produce a coverage gap. Validated skill-creator drafts can be enabled per project, keep version history, and reload from `.huntianling/skills.json`.

### REQ-SKILL-002: Agile Skill Creation

The product must include a workflow for creating agile development skills.

Acceptance criteria:

- Uses `skill-creator` to create or update skills.
- Creates skills for requirement intake, analysis, story splitting, acceptance criteria, prioritization, sprint planning, UX review, architecture, implementation planning, code review, test design, QA verification, security review, release, documentation, and retrospective analysis.
- Validates every created skill with the skill validator.
- Records validation results in `agent_skill_validations`.

Implementation state:

- `skill-creator` drafts Skills from the agile template catalog (requirement intake, analysis, story splitting, acceptance criteria, prioritization, sprint planning, UX review, architecture, implementation planning, code review, test design, QA verification, security review, release, documentation, and retrospective analysis).
- Drafts stay `unvalidated` and are not registered for agent execution. The skill validator writes `agent_skill_validations`. Invalid or unvalidated drafts cannot be enabled. A validated draft enabled for a project can be loaded on an Agent run; other projects and other drafts stay gated. Built-in MKT and coding Skills remain enabled unless a project disables them.

### REQ-SKILL-003: Skill Coverage Matrix

HuntianLing must not assume it can cover every software domain. It must calculate skill coverage for each project.

Acceptance criteria:

- Scans project language, framework, package manager, build commands, test commands, CI config, deployment files, and documentation.
- Produces a matrix of required skills versus available skills.
- Classifies gaps as missing, unvalidated, outdated, or blocked by missing tools.
- Creates Skill Gap WorkItems for missing or insufficient skills.
- Prevents an agent from claiming a task is supported when required skills are missing.

Implementation state:

- Environment prepare scans language, package manager, build, test, CI, and documentation, computes required-vs-available MKT and coding Skill coverage, classifies gaps as missing, unvalidated, outdated, disabled, or blocked-by-tool, creates Skill Gap WorkItems when a project id is supplied, and blocks implementation start when coverage is incomplete.
- `GET /api/v1/projects/:id/skill-coverage` returns that matrix, including recommended and installed technology skill packs.

### REQ-SKILL-004: Technology Skill Packs

HuntianLing must support technology-specific skill packs.

Initial categories:

- Frontend web
- Backend service
- API integration
- Database
- Mobile
- Desktop
- Data / ML
- Infrastructure
- Security
- QA automation
- Documentation

Acceptance criteria:

- Skill packs are installable and versioned.
- Project scan recommends skill packs.
- WorkItems can declare required skill packs.
- Agent runtime loads only the relevant skill packs for the selected task.

Implementation state:

- The catalog ships versioned frontend-web, backend-service, API integration, database, mobile, desktop, data/ML, infrastructure, security, QA automation, and documentation packs. They are installable per project and are not part of the coding environment baseline.
- Project scan recommends packs from workspace dependencies and files. WorkItems declare required pack ids. The agent runtime loads only installed pack skills that match the selected task. A missing required pack blocks the run. Customers cannot install packs. The fused `/board` cockpit is unchanged.

### REQ-SKILL-005: Skill Capability Boundary

Status: planned.

A Skill must declare what it covers and what it refuses. This is competence, not Git or approval authority (`REQ-AGENT-004`).

Acceptance criteria:

- Each Skill declares covered roles, task types, artifacts, required tools, output schema, and explicit `does_not_cover` items.
- The task runtime loads only Skills whose boundary matches the task. Fields outside the output schema are rejected.
- Missing required Skills produce a Skill Gap WorkItem and block the task from claiming support (`REQ-SKILL-003`).
- MKT Skills refuse technical design, code changes, and acceptance decisions. Coding-agent Skills refuse to treat unconfirmed chat as accepted scope.
- Tests reject an out-of-boundary write and block a task when the required Skill is absent.

Related requirements: `REQ-SKILL-001`, `REQ-SKILL-003`, `REQ-SKILL-006`, `REQ-AGENT-002`, `REQ-MKT-002`.

Implementation state:

- Built-in MKT and coding Skills declare roles, task types, artifacts, required tools, output schema, and `does_not_cover`. The agent runtime loads only Skills whose boundary matches the task. Coverage gaps block claiming support.

### REQ-SKILL-006: Skill Capability Depth

Status: planned.

Skill depth is the scaffolding used for the current model. It is not a longer prompt. The harness does not assume a strong model.

Acceptance criteria:

- Each Skill declares depth levels 0–4: checklist (human), form fill, question loop, method constraint, and calibrated quality. Each step names model, tool, or human as the actor.
- A Skill ships guide text, schema, depth profile, deterministic validators, and passing and failing examples. Original-requirement and code writes go through tools.
- Runtime selects the lowest depth that passed calibration for this model and task (`REQ-HARNESS-004`), or the project policy. Unmeasured or weak models use the Skill's default; MKT defaults to depth 1, with depth 0 available.
- Repeated validator failure lowers depth or stops the task. Unbounded retry of the same prompt is forbidden.
- The producing run stores Skill version and depth level on the WorkItem or MKT record.
- Tests execute depth 0 and depth 1, force a downgrade after repeated invalid output, and refuse to complete when sensors fail.

Related requirements: `REQ-SKILL-001`, `REQ-SKILL-005`, `REQ-HARNESS-004`, `REQ-HARNESS-008`, `REQ-AGENT-002`, `REQ-MKT-002`.

Implementation state:

- Skills declare depth 0–4 with named actors. Depth 2 asks missing fields, depth 3 requires actors and scenarios, and depth 4 requires confirm without open questions. Uncalibrated depth 2–4 product writes are rejected until a harness comparison is promoted. Repeated invalid output lowers depth or stops.

## Harness Tools

### REQ-TOOL-001: Harness Tool Registry

HuntianLing must model the tools that agents can use inside dsh.

Acceptance criteria:

- Stores tool id, capability, permission level, risk level, and supported task types.
- Maps tools to agent roles and task specs.
- Denies tool usage that is not allowed for the current role/task.
- Records tool calls as evidence when they affect delivery conclusions.

Implementation state:

- A built-in tool registry allowlists original-requirement write, typecheck, test, doc-sync, git, CI, `browser.navigate`, `image.analyze`, `document.parse`, `database.migrate`, and `web-api.call` by role and task type, denies disallowed use, and records calls during environment prepare.
- Invoking a remaining-category tool writes `ToolCallEvidence`. When the call affects delivery, a `tool` producer check is stored on the WorkItem evidence summary. Hosted browser fleets fail loud. Web-api transport is call-time only and does not persist secrets.

Tool categories:

- Filesystem and code editing
- Terminal commands
- Browser automation
- Git and repository inspection
- Document parsing
- Image analysis
- Test execution
- CI/CD integration
- Database migration
- Web API calls

### REQ-TOOL-002: Tool Feedback and Required Information

Agent tasks must receive the information needed to work correctly.

Acceptance criteria:

- Injects WorkItem context, parent/child tree, milestone, acceptance criteria, project tech profile, relevant source documents, prior agent feedback, tool permissions, and checks.
- Requires agents to return structured feedback, assumptions, open questions, evidence references, and next actions.
- Shows missing required information before a task starts.

Implementation state:

- `inspectTask` injects WorkItem context, parent/child tree, milestone, acceptance, tech profile, intake source documents, prior agent feedback, tool permissions, and executed checks, and lists missing required information before start.
- `startRun` with a WorkItem is blocked while required information is missing. Completed Planner, Generator, and Evaluator runs include structured feedback, assumptions, open questions, evidence references, and next actions. Customers cannot inspect agent task context.

## SCM, Git, and CI/CD

### REQ-SCM-001: Source Control Service

HuntianLing must support code changes linked to WorkItems.

Acceptance criteria:

- Discovers repository metadata and current branch.
- Creates branches linked to WorkItems.
- Associates commits, diffs, tags, and pull/merge requests with WorkItems.
- Supports GitHub, Gitea, GitLab, and local Git where configured.
- Does not require GitHub for core operation.

Suggested service:

```text
huntianling.scm
```

Implementation state:

- `huntianling.scm` inspects local Git branch, HEAD, remotes, and dirty state through an injected runner and does not require GitHub.
- Linking HEAD writes a commit code link and an executed `scm` check onto the WorkItem delivery evidence summary.
- Local repository registration, WorkItem branches, changesets, and pull-request records are implemented. Hosted GitHub, Gitea, and GitLab write adapters push, open pull requests, and merge through the same records. Tokens are supplied at call time or from the environment and are never persisted.

### REQ-SCM-002: Branch Management

Development branches must be managed as project data linked to requirements and delivery evidence.

Acceptance criteria:

- Registers one or more repositories for a project.
- Stores branch name, base branch, target branch, linked WorkItems, linked Milestone, owner, creator, status, protection policy, and last synchronization result.
- Supports branch creation for WorkItems, Milestones, fixes, experiments, and release stabilization.
- Applies configurable branch naming rules and protected-branch rules.
- Detects stale branches, merge conflicts, diverged bases, unpushed commits, and branches without linked WorkItems.
- Supports stacked or dependent branches when a requirement is split across multiple delivery slices.
- Keeps branch operations adapter-based so local Git, GitHub, Gitea, and GitLab can use the same internal model.

Suggested APIs:

```text
GET  /api/v1/projects/:id/repositories
POST /api/v1/projects/:id/repositories
GET  /api/v1/work-items/:id/branches
POST /api/v1/work-items/:id/branches
POST /api/v1/branches/:id/sync
POST /api/v1/branches/:id/rebase-check
```

Implementation state:

- `huntianling.scm` registers local Git repositories on a project and creates managed branches linked to WorkItems. Branch names use a configurable `{workItemId}` template; protected names such as `main` are rejected.
- Sync and rebase-check record unpushed, diverged, conflict, and unlinked signals. Stacked branches can name a parent branch as the base. Hosted GitHub, Gitea, and GitLab repositories register on the same branch records as local Git. Unknown providers and missing hosted remote metadata fail loud.

### REQ-SCM-003: Code Submission Workflow

Code submission must connect commits, reviews, checks, and merge decisions back to the requirement.

Acceptance criteria:

- Links commits, diffs, tags, pull requests, merge requests, reviews, and merge results to WorkItems and Milestones.
- Supports commit preparation with configurable message templates that include WorkItem identifiers.
- Separates patch generation, commit creation, branch push, pull request creation, review request, and merge as distinct auditable actions.
- Requires configured approvals before an agent can push, open a pull request, or merge.
- Records author, committer, actor, tool run, branch, repository, changed files, and related acceptance criteria.
- Blocks delivered status when required code submission evidence is missing.

Suggested APIs:

```text
POST /api/v1/work-items/:id/changesets
GET  /api/v1/work-items/:id/changesets
POST /api/v1/changesets/:id/commit
POST /api/v1/branches/:id/push
POST /api/v1/branches/:id/pull-request
POST /api/v1/pull-requests/:id/merge
```

Implementation state:

- Changesets separate patch generation from commit. Commit messages use a configurable template that includes the WorkItem id. Push, pull-request creation, and merge remain distinct actions and still require C1 human approval.
- Commit, changed-file, diff, and pull-request records attach to the WorkItem delivery evidence summary. Hosted push, pull-request creation, and merge are distinct actions against GitHub, Gitea, and GitLab and still require C1 human approval. Hosted review adapters remain planned.

### REQ-CODE-001: Requirement Code View

Each requirement must have a Code View that shows the code and delivery evidence related to that requirement.

Acceptance criteria:

- Shows linked repositories, branches, commits, diffs, changed files, pull requests, reviews, CI runs, coverage, security findings, and deployment evidence.
- Groups code changes by WorkItem, Milestone, delivery slice, acceptance criterion, and agent or human contributor.
- Lets users inspect changed files and diffs without leaving the requirement detail flow.
- Shows which acceptance criteria have code, tests, reviews, and CI evidence.
- Flags code changes that are not linked to a WorkItem or acceptance criterion.
- Provides read-only views to external users unless project policy grants write actions.

Suggested APIs:

```text
GET /api/v1/work-items/:id/code-view
GET /api/v1/milestones/:id/code-view
GET /api/v1/projects/:id/unlinked-code
```

Implementation state:

- The JSON Board Store now persists `DeliveryEvidenceSummary` records for WorkItems, including code links, pull requests, review links, CI runs, deployment links, evidence links, checks, compliance obligations, risk acceptances, provenance links, notes, and timestamps.
- The v1 Web API exposes WorkItem Code View reads, Milestone Code View reads, Project unlinked-code reads, and WorkItem delivery evidence reads and writes. Milestone Code View includes WorkItems assigned directly to the Milestone and parent WorkItems that participate through explicit delivery slices.
- The browser main board includes an Evidence board view and card badges for PR, review, CI, missing required checks, and governance blockers.
- `huntianling.scm` inspects local Git and links HEAD as executed code evidence. Code View now also shows managed repositories, branches, changeset diffs, changed files, and pull requests, including hosted provider and pull-request URL. Unlinked branches appear in project unlinked-code. Hosted CI adapters remain planned.

### REQ-CI-001: CI/CD Service

HuntianLing must read and use CI/CD results as verification evidence.

Acceptance criteria:

- Discovers CI provider and workflow config.
- Triggers pipelines when authorized.
- Waits for run completion.
- Reads logs, job status, artifacts, JUnit reports, coverage reports, SARIF reports, and Playwright reports where available.
- Links CI runs and reports to WorkItems and milestones.
- Supports GitHub Actions, Gitea Actions, GitLab CI, Jenkins, and local command runners through adapters.

Suggested service:

```text
huntianling.ci
```

Implementation state:

- CI runs can be recorded as delivery evidence links and as required or optional CI checks on a WorkItem.
- Project and Milestone delivery evidence rollups count WorkItems with CI evidence and expose pending, missing, failing, or blocked required CI checks.
- `huntianling.ci` runs local typecheck and test commands through an injected runner and records ci-run links plus executed `ci` checks on the WorkItem.
- Hosted GitHub Actions, Gitea Actions, and GitLab CI adapters discover workflows, trigger authorized pipelines, wait for completion, and attach JUnit, coverage, SARIF, and Playwright artifacts as executed CI evidence. Tokens are supplied at call time or from the environment and are never persisted. Jenkins adapters remain planned.

### REQ-EVIDENCE-001: Evidence-Based Delivery Gates

WorkItems must not be marked delivered only because an agent says work is complete.

Acceptance criteria:

- Delivery requires acceptance coverage, linked code change when code is involved, test results, review status, and configured security checks.
- Missing evidence blocks `delivered` transition and explains the missing pieces.
- Check results attach to WorkItems and roll up to Milestones.
- Supports Definition of Ready and Definition of Done checks per project.
- External Issue cards cannot be closed as Done until the projected WorkItem has a delivery gate certificate that names WorkItem, acceptance, code, review, CI, evidence, and gate results.

Suggested service:

```text
huntianling.checks
```

Implementation state:

- WorkItem delivery evidence summaries store required checks across acceptance, code, review, CI, evidence, governance, security, reliability, and trust areas.
- Project delivery evidence rollups expose ready WorkItems, blocked WorkItems, missing required checks, pending required checks, failed required checks, open risk acceptances, active obligations, and unapproved obligations.
- A WorkItem with configured blocking delivery evidence, unapproved compliance obligations, or open risk acceptances cannot transition to `delivered`.
- Browser WorkItem detail shows a pre-delivery gate panel that separates acceptance, child completion, Milestone slices, workflow handoffs, code, review, CI, required checks, governance, and dependency readiness. The `delivered` action is disabled when the preflight has blockers, while the server transition remains the final enforcement point.
- The Evidence workspace renders a project-level gate summary, evidence gap matrix, blocker queue, governance risk queue, and status lanes from the same Evidence board payload so teams can see delivery gaps before opening individual WorkItems.
- The GitHub Issue projection requires a `huntianling-delivery-gate` certificate before a card can reach Done. Illegal completed closes are reopened and returned to the previous open lane, or to In review when the previous lane is missing or terminal.
- A scheduled and manually dispatched recovery sweep scans completed closed GitHub Issue projections and reopens any card that lacks the certificate, while leaving gated Done cards closed.
- Customer-visible delivered requires a passing executed evaluator, CI, or local Git check. Generator self-check, notes, and stale evidence after a design revision cannot complete delivery.
- `GET/PATCH /api/v1/projects/:id/delivery-policy` configures Definition of Ready and Definition of Done checks. Missing executed evidence still blocks `delivered`. `GET /api/v1/work-items/:id/delivery-gates` names the missing pieces.

## External Issue Tracker Integration

### REQ-ISSUE-001: Optional Issue Tracker Synchronization

External issue trackers may mirror or import work, but they must not replace HuntianLing's internal WorkItem model.

Acceptance criteria:

- Supports adapters for GitHub Issues, Gitea Issues, and GitLab Issues where configured.
- Maps external issues to internal WorkItems through stored external references.
- Preserves internal parent-child hierarchy, milestones, acceptance coverage, agent feedback, and evidence even when an external tracker lacks those concepts.
- Supports import, export, and sync conflict reporting.
- Clearly marks externally synchronized fields and internally owned fields.
- Allows projects to run with no issue tracker integration.
- Completed closes from an external tracker are recovery events unless the linked internal delivery evidence and gate result have been published into the external card projection.

Suggested service:

```text
huntianling.issueSync
```

Implementation state:

- Repository workflows project GitHub Issues into the configured user Project. Issue open and reopen events update the projected Status lane; explicit `workflow_event` dispatches move cards through Backlog, Ready, In progress, In review, and gated completion. Pull request events initialize Start Date for referenced Issues but do not own Status lane changes.
- The GitHub lifecycle policy blocks `completed` workflow dispatches that lack a delivery gate certificate, and completed native Issue close events without that certificate reopen the Issue and restore the Project card to its previous open lane or In review.
- The manual `recover_closed` workflow event reopens an already closed illegal Issue card and returns it to In review so unfinished tasks, evidence, and gate checks remain visible.
- The `recover_illegal_closed` workflow event and scheduled lifecycle sweep batch-recover illegal completed closes so unfinished tasks cannot disappear from the board.
- Full internal issue-sync adapters, stored external references, import/export flows, and conflict reporting remain planned.

## Governance, Compliance, Security, Reliability, and Trust

HuntianLing must turn governance requirements into project policies, controls, checks, evidence, and auditable decisions. The system does not make legal determinations; it records the applicable obligations selected by the project owner, compliance owner, or legal reviewer and enforces the configured delivery rules.

Reference framework packs should be configurable. Initial packs should include NIST CSF 2.0 for cybersecurity governance, OWASP ASVS for application security verification, NIST AI RMF for AI risk management, and ISO/IEC 42001 for AI management systems.

### REQ-GOV-001: Compliance Obligation Registry

Projects must track applicable legal, regulatory, contractual, and certification obligations.

Acceptance criteria:

- Stores obligation id, title, jurisdiction, source, applicability reason, owner, reviewer, effective date, review date, status, and linked controls.
- Supports project selection for regional laws, industry rules, internal policies, customer contracts, and certification programs.
- Links obligations to WorkItems, acceptance criteria, data categories, user roles, source documents, controls, risks, checks, and evidence.
- Requires reviewer approval before an obligation can become enforcement policy.
- Flags WorkItems that affect regulated data, authentication, authorization, audit, retention, AI output, payment, security, privacy, or availability.

Suggested APIs:

```text
GET  /api/v1/projects/:id/compliance/obligations
POST /api/v1/projects/:id/compliance/obligations
POST /api/v1/compliance/obligations/:id/approve
GET  /api/v1/work-items/:id/compliance
```

Implementation state:

- WorkItem delivery evidence summaries can store compliance obligation summaries with jurisdiction, source, owner, reviewer, effective date, review date, status, control ids, and evidence links.
- WorkItem compliance reads expose obligations, governance checks, security checks, reliability checks, trust checks, risk acceptances, and current governance blockers.
- Unapproved obligations block a configured WorkItem delivery transition to `delivered`.
- Project-level obligation registries, approval workflows, framework pack selection, and obligation lifecycle APIs remain planned.

### REQ-GOV-002: Certification Control Packs

Certification requirements must be represented as versioned control packs with mappings to WorkItems and evidence.

Acceptance criteria:

- Stores control pack id, framework name, version, control id, control text summary, applicability, owner, required evidence, and check rules.
- Supports custom control packs for internal security baselines and customer audit requirements.
- Maps controls to WorkItems, checks, code evidence, CI reports, manual approvals, and audit events.
- Shows certification readiness by Project, Milestone, and WorkItem.
- Keeps old control pack versions available so historical evidence remains explainable.

Suggested service:

```text
huntianling.governance
```

### REQ-SEC-001: Security Requirement Gates

Security requirements must be first-class delivery gates.

Acceptance criteria:

- Classifies WorkItems by security impact, data sensitivity, permission impact, exposed API surface, dependency risk, and deployment risk.
- Requires threat modeling for configured high-risk WorkItems.
- Maps security controls to acceptance criteria and Definition of Done checks.
- Ingests security evidence from tests, code review, dependency scans, secret scans, static analysis, dynamic tests, and manual reviews.
- Blocks delivery when required security controls or evidence are missing.
- Records residual risk acceptance with approver, reason, scope, expiration, and compensating controls.

Suggested APIs:

```text
GET  /api/v1/work-items/:id/security
POST /api/v1/work-items/:id/security/threat-model
POST /api/v1/work-items/:id/security/risk-acceptance
```

Implementation state:

- WorkItem security reads expose security checks and security risk acceptances from the delivery evidence summary.
- Required security checks with `missing`, `failing`, or `blocked` status appear as board blockers and prevent configured delivery completion.
- Threat model records, scan ingestion, security classification, compensating controls, and dedicated risk-acceptance write APIs remain planned.

### REQ-REL-001: Reliability and Resilience Gates

Reliability must be captured as measurable requirements and checked before delivery.

Acceptance criteria:

- Stores service-level objectives, availability targets, latency targets, error budgets, capacity assumptions, backup requirements, restore objectives, and dependency assumptions.
- Links reliability requirements to WorkItems, Milestones, CI evidence, load tests, operational checks, and incident records.
- Requires observability plans for configured production-facing WorkItems.
- Tracks reliability risks, mitigations, and residual risk approvals.
- Blocks delivery when required reliability tests, rollback plans, backup checks, or monitoring evidence are missing.
- Rolls reliability readiness up to Milestones and release views.

Suggested APIs:

```text
GET  /api/v1/projects/:id/reliability
POST /api/v1/work-items/:id/reliability
POST /api/v1/work-items/:id/reliability/evidence
```

Implementation state:

- WorkItem reliability reads expose reliability checks and reliability risk acceptances from the delivery evidence summary.
- Required reliability checks roll up to Project, Milestone, WorkItem, and Evidence board views.
- SLO records, load-test ingestion, observability plans, rollback evidence, backup checks, incident links, and dedicated reliability write APIs remain planned.

### REQ-TRUST-001: AI Trustworthiness and Provenance

AI-generated analysis, requirements, code, tests, and conclusions must remain explainable and reviewable.

Acceptance criteria:

- Records source inputs, prompt templates, model identity, skill versions, tool calls, retrieved context, generated output, human edits, approvals, and verification evidence.
- Requires confidence, assumptions, limitations, and open questions for AI-generated requirement analysis and design.
- Supports AI risk assessment for features that use AI or materially rely on AI output.
- Links AI outputs to WorkItems, source documents, Team Chat messages, agent runs, checks, and audit events.
- Blocks automated delivery claims when provenance or verification evidence is missing.
- Supports human review and correction of AI-generated requirements before they become committed WorkItems.

Suggested APIs:

```text
GET  /api/v1/work-items/:id/trust
GET  /api/v1/agent-runs/:id/provenance
POST /api/v1/work-items/:id/ai-risk-assessment
```

Implementation state:

- WorkItem trust reads expose trust checks, trust risk acceptances, evidence links, and provenance links from the delivery evidence summary.
- Required trust checks and open risk acceptances roll up to cards, Evidence board lanes, Project evidence rollups, and delivery transition blockers.
- Agent-run provenance records, prompt/model/tool-call capture, AI risk assessment writes, confidence/assumption capture, and human correction workflows remain planned.

### REQ-TRUST-002: Evidence Reports and Attestations

The system must produce evidence reports that humans can use for audit, certification, and release decisions.

Acceptance criteria:

- Generates Project, Milestone, WorkItem, release, and certification evidence reports.
- Reports include applicable obligations, mapped controls, completed checks, missing checks, risk acceptances, approvals, source code links, CI evidence, security evidence, reliability evidence, AI provenance, and audit events.
- Marks reports as draft until a human owner signs or approves them.
- Supports immutable report snapshots with timestamp, actor, source data version, and export hash.
- Supports export as JSON and Markdown; PDF export can be added through a document rendering adapter.

Suggested APIs:

```text
POST /api/v1/projects/:id/evidence-reports
GET  /api/v1/evidence-reports/:id
POST /api/v1/evidence-reports/:id/approve
GET  /api/v1/evidence-reports/:id/export
```

## Web and API Expansion

### REQ-WEB-007: Three-Audience Web Shells

Status: planned.

The Web service presents one login and three audience shells that project the same WorkItem records.

Acceptance criteria:

- After login, the UI is the shell for the principal's audience `customer`, `developer`, or `admin`. Other shells return authorization errors.
- Customer shell: create and open only that customer's projects; MKT dialog; list original requirements they submitted; show customer-safe progress labels submitted, waiting on customer, in analysis, in development, and delivered.
- Customer shell hides environment setup, Agent internals, gates, developer board controls, and other customers' projects.
- Developer shell: the standard development board for collection, design, and progress; the Agent Channel (`REQ-COLLAB-001`); and the ability to bind a repository and environment profile to a customer project.
- Admin shell: users, project membership, environment readiness, and plugin configuration. It is not the primary editor of customer requirement text.
- Customer-safe progress is a projection of evidence-backed state. Manually edited summaries cannot show delivered to the customer.
- Product questions, missing decisions, and acceptance prompts return to the customer MKT dialog.
- Tests cover one user per audience, denied cross-audience routes, and a customer progress change driven by delivery evidence.

Related requirements: `REQ-AUTH-001`, `REQ-WEB-002`, `REQ-WEB-003`, `REQ-MKT-001`, `REQ-HARNESS-008`.

### REQ-WEB-002: Authenticated Web UI

The browser UI must be upgraded from token-protected writes to full user login.

Acceptance criteria:

- Login page supports regional provider sets.
- All Web API calls return clear authentication and authorization errors.
- WorkItem, Milestone, Intake, Team Chat, Agent, Skill, SCM, Code View, CI, Governance, Security, Reliability, Trust, and Check pages respect project permissions.

Implementation state:

- The browser surface has a login panel with region selection, password login, provider discovery display, logout, and external API token entry.
- With Web auth enabled, non-auth API calls return `authentication required` when no valid session, API token, or compatible static token is present.
- Project-scoped users see only allowed Projects and receive `project access denied` for denied Project, WorkItem, and Milestone routes.
- Admin user-directory create and login-audit listing reuse the same auth context. OAuth provider pages remain planned.

### REQ-WEB-006: Workspace Information Architecture

The browser UI must separate major workflows into clear Project workspaces instead of placing every control on one mixed page.

Acceptance criteria:

- A Project has top-level workspaces for intake, requirements, planning, team, workflow, evidence and governance, and settings.
- The view selector shows only board views that belong to the active workspace.
- Sidebar forms and lists are scoped to the active workspace.
- WorkItem detail panels show only the sections needed for the active workspace.
- Unauthenticated users land in the settings and access workspace when Web auth is enabled.
- Each workspace has one primary job, one primary work surface, and a secondary inspection area; product UI must not merge unrelated planning, execution, evidence, and administration controls into one page.
- Backlog pages use list, hierarchy, ranking, rollup, and scoped display controls; planning pages use timeline or Milestone-oriented views; team pages use capacity and ownership views; workflow pages use run state and handoff views; evidence pages use gate matrices.
- Repeated summary metrics, generic cards, and creation controls must be removed from pages where they are not the user's primary task.

Implementation state:

- The developer shell at `/developer` uses five jobs: Collect, Design, Progress, Channel, and Environment. The fused seven-module cockpit remains at `/board` until it is removed. Design fields stay editable through WorkItem APIs.
- Workspace navigation uses product-planning labels for Intake, Backlog, Plans, Team, Runs, Evidence, and Admin, with each workspace showing its owning role, primary record, expected output, and delivery stage.
- The active workspace controls which sidebar panels, board views, and WorkItem detail sections are visible.
- Desktop view switching uses workspace-scoped tabs, while the mobile view keeps the same scoped view selector.
- Workspace health metrics are scoped to the active business workflow: intake sessions, backlog traceability, Milestone slices, WIP, workflow runs, evidence gates, or admin state.
- The workspace shell uses compact segmented view tabs, page-scoped KPI summaries, and a conditional inspector panel so navigation, primary work, and detail inspection stay visually separate without reserving space for empty detail content.
- The sidebar no longer shows the requirements tree in planning, workflow, and evidence workspaces; those pages keep their side context focused on their own setup, scope, or inspector model.
- The requirements workspace includes a Backlog workbench with search, type filters, warning filters, Milestone filters, priority/status/Milestone/type sorting, clickable risk buckets, and a Story priority queue strip.
- The requirements workspace renders a professional Backlog workbench with business-level filters, a primary Backlog list, and a lifecycle flow summary instead of exposing the status board as the only primary organization.
- The Backlog workbench includes project-scoped browser saved views and column visibility controls for planning, definition readiness, traceability, and next-action signals.
- The primary Backlog list supports visible-item selection and bulk priority, Milestone, and status updates while preserving server-side transition gates.
- The requirements workspace puts view controls and filters above the work list, keeps the Backlog list as the primary surface, and moves portfolio, Milestone, risk, Ready/Done, queue, and lifecycle-flow panels into a secondary insight drawer instead of showing every support panel by default.
- The WorkItem composer is collapsed by default and scoped to the requirements workspace, so review and delivery workspaces are not dominated by creation controls.
- The Plans workspace renders a Milestone roadmap workbench for timeline planning and a Delivery Slice workbench for cross-Milestone parent requirement delivery instead of falling back to generic status cards.
- The Admin workspace includes a Business CRUD coverage view so project owners can see which business objects have create, read, update, lifecycle, and delete or archive policies before a workflow depends on them.
- The Admin workspace separates access settings from an Audit Trail view with project-level filters, event timeline, and action/object/actor summaries.
- The URL stores `areaId`, `projectId`, `viewId`, and the selected `intakeSessionId` when applicable, so direct links reopen the same workspace context.

### REQ-WEB-003: Intake Chat UI

The browser UI must include a project-scoped requirement intake chat.

Acceptance criteria:

- Users can enter text ideas.
- Users can upload supported files.
- Users can review extracted content, AI analysis, candidate requirements, and source references.
- Users can approve selected candidate nodes into the WorkItem tree and assign them to a Milestone.

Implementation state:

- The browser surface includes an intake workspace with project-scoped session creation, session selection, chat-style message entry, file upload, source document review, candidate review, source reference review, candidate field editing, candidate selection, candidate rejection/restore, Milestone assignment, analysis, and approval into formal WorkItems.
- The UI reads Markdown and plain-text files in the browser and stores image, PDF, Word, and generic file records with pending parser status.
- Candidate approval sends the selected candidate ids to the v1 API. Child candidates keep parent traceability because the approval path includes required ancestors or uses already approved parent candidates.
- WorkItems generated from approved candidates show an intake-origin panel in requirement detail, including the source session, candidate, message/file references, chunks, confidence, and quote text.
- The customer shell lists open clarifying questions and accepts structured follow-up answers in the MKT dialog, including confirm-to-track. Open questions mark progress as waiting on the customer.

### REQ-WEB-004: Agent and Evidence Panels

The browser UI must show AI team and delivery evidence.

Acceptance criteria:

- WorkItem detail has tabs or panels for Details, Tree, Acceptance, Milestone, Agent Feedback, Source Evidence, Code, CI, and Audit.
- Team Chat view shows project, Milestone, WorkItem, branch, pull request, and CI conversations.
- Milestone view shows readiness, delivery evidence, blockers, and risk summaries.
- Project view shows skill coverage and missing skills.

Implementation state:

- WorkItem requirement detail now includes Source Evidence for WorkItems generated from approved intake candidates, using the same intake-origin source references returned by the v1 board-detail API.
- WorkItem requirement detail also shows editable source input and decomposition reason fields for manually split WorkItems.
- WorkItem detail panels include a scoped Audit tab that reads the WorkItem audit timeline from the v1 API.
- WorkItem detail panels include a delivery gate panel and status action summary so agent, evidence, workflow, governance, and dependency blockers are visible before a user marks a WorkItem delivered.
- The Evidence workspace separates gate matrix, blocker queue, governance queue, and status lanes so delivery evidence remains a project-level operating surface, not only a WorkItem detail tab.
- The developer progress inspector shows Agent, Code, CI, and Evidence panels from local Git, local checks, and Evaluator records on the WorkItem.

### REQ-WEB-005: Governance and Trust Dashboard

The browser UI must show compliance, security, reliability, and trust readiness in the same delivery workflow.

Acceptance criteria:

- Project view shows applicable obligations, control coverage, risk register, open exceptions, security readiness, reliability readiness, AI trust assessments, and evidence report status.
- WorkItem detail shows required controls, mapped checks, missing evidence, residual risks, approval requirements, and trust provenance.
- Milestone view rolls up compliance, security, reliability, and trust readiness for the planned delivery scope.
- Users can request review, approve obligations, accept residual risk, and sign evidence reports when their role allows it.

Implementation state:

- WorkItem detail shows governance blocker counts in the delivery gate, Evidence, and Governance panels, including unapproved obligations and open risk acceptances that block delivery.
- The Evidence workspace includes a governance risk queue that surfaces WorkItems with unapproved obligations, open risk acceptances, and governance blockers next to the delivery blocker queue.
- Project-level governance dashboards, review requests, approval actions, residual-risk acceptance actions, and signed evidence reports remain planned.

## Audit and Compliance

### REQ-AUDIT-001: Audit Log

Important changes must be auditable.

Acceptance criteria:

- Records actor, action, target, project, timestamp, request source, and changed fields.
- Covers auth events, WorkItem changes, milestone changes, intake approvals, team messages, decisions, approvals, agent runs, skill changes, tool calls, governance policy changes, compliance approvals, risk acceptances, security checks, reliability checks, trust assessments, SCM actions, code submissions, CI actions, and gate decisions.
- Supports filtering by project, actor, target, and date range.

Suggested APIs:

```text
GET /api/v1/projects/:id/audit-events
GET /api/v1/work-items/:id/audit-events
```

Implementation state:

- The JSON Board Store persists `AuditEvent` records with actor, action, target, Project, timestamp, request source, changed fields, reason, and correlation id.
- Board Store write paths record audit events for Projects, Milestones, WorkItems, team members, workflow summaries, delivery evidence, intake sessions, intake messages, intake source documents, intake candidates, intake approvals, and Milestone delivery slices.
- The v1 Web API exposes Project-scoped audit reads with actor, action, target, date range, and limit filters, plus WorkItem-scoped audit reads.
- The browser Admin workspace includes an Audit Trail view with actor, action, target type, target id, date range, and limit filters, plus a project event timeline and action, object, and actor summaries.
- WorkItem detail panels show scoped audit timelines using the WorkItem audit API.
- Login, failed login, logout, and API-token creation persist as `auth_events` and are listed at `GET /api/v1/admin/auth-events`. Governance policy audit writes and report signing audit records remain planned.
- The admin shell at `/admin` lists users, creates directory users, assigns audience, grants project membership with an audit event, shows login audit, access settings and last environment prepare, and reads project audit events. Developers receive 403.

## Implementation Order

Preserve implemented baseline records and the scoped results of B/C and D slices. Slice implementation does not establish acceptance of the complete harness product. The [2026-09-12 runtime alignment review](reviews/2026-09-12-runtime-alignment.md) records a false-completion reproduction from its inspected working-tree snapshot; it is not a fresh audit of D6 or later code. UI restack follows [the web shell refactor](../architecture/web-shell-refactor.md). Skill gaps for doing this work ourselves are in [Harness Engineering Product Direction](harness-engineering.md#self-harness-skill-gap).

The user reports that Grok has reached D6 and requests defect corrections after the existing D sequence. Keep D1–D15 and their current progress; append D16–D21 below. Do not interrupt or reset existing slices based on this review. These corrections repair existing requirements and remain required for complete harness product acceptance. Grok should recheck each finding against the latest source before implementation, attach evidence when it is already fixed, and use the repository self-harness workflow with independent evaluation for unresolved findings.

### Phase A — already shipped (keep, do not redo)

`REQ-BOARD-001`, `REQ-BOARD-002`, `REQ-BOARD-003` (partial), `REQ-BOARD-004` (partial), `REQ-BOARD-005`, `REQ-REQ-001` (fields), `REQ-MILESTONE-001`, `REQ-MILESTONE-002`, `REQ-WEB-001`, `REQ-WEB-002` (partial), `REQ-WEB-003` (foundation), `REQ-WEB-004` (partial), `REQ-WEB-006` (one fused cockpit), `REQ-AUTH-001` (persistent directory), `REQ-INTAKE-001` (foundation), `REQ-INTAKE-002` (text/Markdown), `REQ-INTAKE-003` (deterministic), `REQ-TEAM-001` (partial), `REQ-TEAM-002` (partial), `REQ-FLOW-005` (summaries), `REQ-FLOW-022`, `REQ-TRACE-001`, `REQ-AUDIT-001` (foundation).

### Phase B — first product milestone (do in this order)

| Order | Slice | REQ ids |
| ---: | --- | --- |
| B1 | Split `page.ts`; login lands on audience; deny other shells | `REQ-WEB-007`, `REQ-AUTH-001`, `REQ-WEB-001` |
| B2 | Customer shell: own projects, MKT dialog, original requirements, customer-safe progress | `REQ-WEB-007`, `REQ-MKT-001`, `REQ-INTAKE-001`, `REQ-WEB-003` |
| B3 | MKT Skill pack at depth 0–1 with boundary, schema, validators, examples | `REQ-MKT-002`, `REQ-SKILL-001`, `REQ-SKILL-005`, `REQ-SKILL-006` |
| B4 | One versioned environment profile for this repo and a second project; ready or blocked | `REQ-HARNESS-001`, `REQ-TOOL-001`, `REQ-SKILL-003` |
| B5 | Planner, Generator, Evaluator as three task definitions; default method baseline | `REQ-HARNESS-006`, `REQ-HARNESS-007`, `REQ-AGENT-002`, `REQ-FLOW-014`, `REQ-METHOD-001` (User Story only) |
| B6 | Developer Agent Channel first-slice types; typed handoffs | `REQ-COLLAB-001`, `REQ-COLLAB-002`, `REQ-COLLAB-004`, `REQ-FLOW-021` |
| B7 | Developer shell restack: Collect, Design, Progress, Channel, Environment | `REQ-WEB-007`, `REQ-REQ-001`, `REQ-WEB-006` |
| B8 | Admin shell: users, membership, environment readiness, access, audit | `REQ-WEB-007`, `REQ-AUDIT-001` |
| B9 | Local Git + local checks + Evaluator evidence on the owning record; customer progress from evidence | `REQ-SCM-001`, `REQ-CI-001`, `REQ-HARNESS-003`, `REQ-HARNESS-008`, `REQ-EVIDENCE-001`, `REQ-WEB-004` |
| B10 | Durable checkpoint, interrupt, resume; one Story delivery run | `REQ-HARNESS-002`, `REQ-FLOW-020` |
| B11 | Measure one Skill depth change; HuntianLing self-development demonstration | `REQ-HARNESS-004`, `REQ-HARNESS-005` |

### Phase C — after the first loop works

| Order | Slice | REQ ids |
| ---: | --- | --- |
| C1 | Authority boundaries before push/PR/CI | `REQ-AGENT-004` |
| C2 | Branch, PR, Code View | `REQ-SCM-002`, `REQ-SCM-003`, `REQ-CODE-001` |
| C3 | SQLite database behind the current JSON store | `REQ-DATA-001` (SQLite), `REQ-DATA-002` |
| C4 | Password hashing upgrade; remaining collaboration-task types | `REQ-AUTH-002`, `REQ-COLLAB-003` |
| C5 | Stage gates, approvals, workflow visibility, built-in workflow management | `REQ-FLOW-002`, `REQ-FLOW-003`, `REQ-FLOW-004`, `REQ-FLOW-005`, `REQ-FLOW-012`, `REQ-FLOW-013`, `REQ-FLOW-015`, `REQ-FLOW-017`, `REQ-FLOW-019` |
| C6 | Dispatch, leases, Agent feedback on the board | `REQ-TEAM-003`, `REQ-TEAM-004`, `REQ-AGENT-003` |
| C7 | Tool missing-input feedback; Skill draft via skill-creator, still gated | `REQ-TOOL-002`, `REQ-SKILL-002` |
| C8 | Intake attachments beyond Markdown/plain text; LLM candidate extraction | `REQ-INTAKE-002`, `REQ-INTAKE-003` |

### After Phase C — residuals of shipped slices

Phase C ends at C8. There is no C9. CR rows finish leftovers inside slices that already shipped. Do them only with a measured need, and do them before Phase D chrome. Outcome is the customer-visible result; Depends on is the earliest predecessor; Out of scope stays in a later row.

| Order | Slice | Outcome | Depends on | Out of scope | REQ ids |
| ---: | --- | --- | --- | --- | --- |
| CR1 | Clarifying MKT follow-up | Customer answers missing fields in the MKT dialog without entering the developer shell | C8 | Live-model default extractor | `REQ-INTAKE-001` remaining, `REQ-WEB-003` remaining, `REQ-MKT-001` remaining |
| CR2 | Hosted SCM write adapters | A project can push, open PR, and merge on GitHub, Gitea, or GitLab through the same WorkItem records | C2 | Hosted CI | `REQ-SCM-001` remaining, `REQ-SCM-002` remaining, `REQ-SCM-003` remaining, `REQ-CODE-001` remaining, `REQ-AGENT-004` remaining |
| CR3 | Hosted CI adapters | Authorized pipeline trigger and JUnit/coverage/SARIF/Playwright artifacts attach as executed CI evidence | CR2 or local CI from B9 | GitHub Issue sync | `REQ-CI-001` remaining |
| CR4 | Hosted OCR and default live-model intake extractor | Image/PDF/Word extract without a test stub, and `mode: llm` has a configured extractor | C8 | Hosted model fleet as a product | `REQ-INTAKE-002` remaining, `REQ-INTAKE-003` remaining |
| CR5 | Team roster leftovers | Projects add/remove roles, reviewers, approvers, watchers, and apply role/repo/CI/environment WIP policies | C6 | Dispatch scoring leftovers | `REQ-TEAM-001` remaining, `REQ-TEAM-002` remaining |
| CR6 | Dispatch leftovers | Recommend considers branch ownership and approvals; transfer is a distinct event; Code View shows lease badges; migration conflicts are listed | C6, CR5 | Token-cost capacity accounting | `REQ-TEAM-003` remaining, `REQ-TEAM-004` remaining, `REQ-FLOW-003` remaining |
| CR7 | Workflow leftovers | Template replace/rollback, capability docs/fixtures, recurring/event-triggered steps, review-request APIs, handoff accept/reject, overloaded-role and release-readiness rollups | C5 | Visual designer and Test Lab | `REQ-FLOW-002` remaining, `REQ-FLOW-004` remaining, `REQ-FLOW-005` remaining, `REQ-FLOW-012` remaining, `REQ-FLOW-013` remaining, `REQ-FLOW-014` remaining, `REQ-FLOW-015` remaining, `REQ-FLOW-017` remaining, `REQ-FLOW-019` remaining, `REQ-FLOW-020` remaining, `REQ-FLOW-021` remaining |
| CR8 | Skill and harness leftovers | Coverage scan beyond MKT, Skill depth 2–4, live-model repeated trials, labeled self-dev runtime steps | C7, B11 | Technology skill packs | `REQ-SKILL-003` remaining, `REQ-SKILL-005` remaining, `REQ-SKILL-006` remaining, `REQ-AGENT-002` remaining, `REQ-HARNESS-004` remaining, `REQ-HARNESS-005` remaining, `REQ-HARNESS-006` remaining, `REQ-HARNESS-007` remaining, `REQ-HARNESS-008` remaining |
| CR9 | Board, API, Web, and audit leftovers | Versioned agent/skill/tool/SCM/CI API groups, remaining board CRUD, extra authenticated pages, persistent user directory, login audit, parent-plan updates | C3 | OAuth providers | `REQ-BOARD-003` remaining, `REQ-BOARD-004` remaining, `REQ-BOARD-005` remaining, `REQ-REQ-001` remaining, `REQ-WEB-002` remaining, `REQ-WEB-004` remaining, `REQ-WEB-006` remaining, `REQ-WEB-007` remaining, `REQ-AUDIT-001` remaining, `REQ-MILESTONE-002` remaining, `REQ-AUTH-001` remaining |
| CR10 | Agent Channel leftovers | Conversation decisions/approvals APIs, unresolved questions on the board, later catalog types `task.split`/`task.merge`, runtime reads selected channel messages before a task | B6, C4 | Specialist agent roster | `REQ-COLLAB-001` remaining, `REQ-COLLAB-002` remaining, `REQ-COLLAB-003` remaining, `REQ-COLLAB-004` remaining |
| CR11 | Remaining tool categories | Registry covers browser, image analysis, document parsing, database migration, and web-api tools with allow/deny and delivery evidence | C7 | Hosted browser fleets | `REQ-TOOL-001` remaining |
| CR12 | Project Definition of Ready and Done | Project policy configures Ready/Done checks; missing evidence still blocks `delivered` | C5, B9 | Governance certification packs | `REQ-EVIDENCE-001` remaining, `REQ-HARNESS-003` remaining |
| CR13 | Remote environment fleets | A replacement remote environment can be prepared from the profile without losing uncommitted work | B4 | PostgreSQL | `REQ-HARNESS-001` remaining, `REQ-HARNESS-002` remaining |
| CR14 | Enable gated skill-creator drafts | A validated skill-creator draft can be enabled for Agent execution without auto-enabling unvalidated drafts | C7 | Technology skill packs | `REQ-SKILL-001` remaining, `REQ-SKILL-002` remaining |

### Phase D — later, only with a measured need

Keep the existing D1–D15 sequence and current work. Their matching residuals must be completed or explicitly deferred. D16–D21 follow as required defect corrections with the acceptance below. Catalog and visualization results do not establish the real three-Agent product baseline.

| Order | Slice | Outcome | Depends on | Out of scope | REQ ids |
| ---: | --- | --- | --- | --- | --- |
| D1 | Agent state recognition | A step inspects repo, CI, leases, and evidence before it runs and records the recognized state | CR6, CR7, CR12 | Visual designer | `REQ-AGENT-005` |
| D2 | Extra workflow templates | A project can select Scrum, Kanban, hotfix, or research templates besides the built-in user-story template | C5 | Third-party packs | `REQ-FLOW-001` |
| D3 | Visual workflow designer and Test Lab | Authors edit and dry-run a template on a canvas before publishing | D2, CR7 | Third-party pack conformance | `REQ-FLOW-006`, `REQ-FLOW-007` |
| D4 | Workflow packs, custom events, nodes, extensions | Third-party packs pass conformance; custom events and node types stay catalogued | D3 | Issue tracker sync | `REQ-FLOW-008`, `REQ-FLOW-009`, `REQ-FLOW-010`, `REQ-FLOW-011` |
| D5 | Static and replay visualization | Authors inspect a template map and replay a test run without editing JSON | D3 | Governance dashboard | `REQ-FLOW-016`, `REQ-FLOW-018` |
| D6 | Remaining design method packs | Use Case, BDD, Example Mapping, Event Storming, DDD, API Design, ADR, and Threat Modeling are selectable method packs | CR8 | Prioritization packs | `REQ-METHOD-001` remaining |
| D7 | Prioritization method packs | MoSCoW, RICE, WSJF, Kano, risk-first, dependency-first, and milestone-first ranking is explainable and overridable with audit | D6 | Specialist agents | `REQ-METHOD-002` |
| D8 | Specialist agent roster | UX, QA, security, and similar roles exist as explicit agent definitions with boundaries | D1, CR14 | Technology skill packs | `REQ-AGENT-001` |
| D9 | Technology skill packs | Frontend, backend, database, and related packs install as versioned coverage | CR8, CR14 | OAuth | `REQ-SKILL-004` |
| D10 | Regional login and OAuth | Login routes by region and binds OAuth/OIDC accounts without storing secrets in board records | CR9 | PostgreSQL | `REQ-AUTH-003`, `REQ-AUTH-004` |
| D11 | PostgreSQL driver | `huntianling.database` can use PostgreSQL; SQLite remains the local default | C3 | Governance packs | `REQ-DATA-001` PostgreSQL |
| D12 | Compliance obligation registry | Projects select framework packs and track obligation lifecycle | CR12 | Security scan ingestion | `REQ-GOV-001`, `REQ-GOV-002` |
| D13 | Security, reliability, and AI-trust gates | Threat models, SLOs, provenance, and attestations block delivery when configured | D12, D1 | Issue sync | `REQ-SEC-001`, `REQ-REL-001`, `REQ-TRUST-001`, `REQ-TRUST-002` |
| D14 | Governance and trust dashboard | One authenticated dashboard shows obligations, residual risk, and signed evidence | D13 | GitHub Issue ownership | `REQ-WEB-005` |
| D15 | Optional GitHub Issue/Project sync | External cards mirror WorkItems with provenance and conflict handling; they do not own the lifecycle | CR2, CR12 | Replacing the internal board | `REQ-ISSUE-001` |
| D16 | Truthful execution and delivery gates | Simulated or unexecuted results cannot complete delivery or show customer delivery | B9, CR12 | Real Agent execution | `REQ-HARNESS-003`, `REQ-HARNESS-006`, `REQ-HARNESS-008`, `REQ-WEB-007` |
| D17 | Real standard environment preparation | Actual preparation and required checks establish readiness for this repository and a second project | D16, B4 | Remote fleet expansion | `REQ-HARNESS-001`, `REQ-HARNESS-005`, `REQ-TOOL-001` |
| D18 | Executable three-Agent delivery and repair | dsh tasks create working code and independently evaluate and repair a real failure | D17, B5 | Specialist role expansion | `REQ-HARNESS-006`, `REQ-HARNESS-008`, `REQ-AGENT-002` |
| D19 | Methods and Skill sensors in execution | Selected methods and depth steps constrain real tasks and detect invalid results | D18, D6, CR8 | Additional method catalogs | `REQ-HARNESS-007`, `REQ-SKILL-005`, `REQ-SKILL-006`, `REQ-METHOD-001` |
| D20 | Real run recovery and revision-bound evidence | Resume reconciles sessions and side effects; changed code invalidates affected evidence | D18, B10 | Distributed scheduler expansion | `REQ-HARNESS-002`, `REQ-HARNESS-003`, `REQ-FLOW-020` |
| D21 | Fresh-project and self-development acceptance | Independent evidence proves intake, design, environment, coding, repair, and customer delivery | D16–D20, B2, B11 | More board views | `REQ-HARNESS-005`, `REQ-HARNESS-008`, `REQ-MKT-001`, `REQ-WEB-007` |

### D16–D21 — defect correction acceptance

All six slices are planned; a review finding is not an implementation or acceptance record. Their placement after D15 is the requested delivery order; the table's dependencies name technical prerequisites. Grok is the intended implementer. Before each slice, read the linked review, inspect current source and prior repair evidence, and record whether the finding remains reproducible. Independently verified fixes may satisfy a slice without duplicate implementation. Each completion record must link its REQ ids, reviewed design, actual change set, executed checks, reviewer decision, and remaining blockers. Missing live execution remains blocked, even when deterministic tests pass.

#### D16 — truthful gates

- Recheck the [isolated reproduction](reviews/2026-09-12-runtime-repro.mjs), then cover the production start/evaluate/transition APIs and customer progress. An empty application with failing checks, an unconfigured executor, and a simulated evaluator must each fail to produce accepted delivery.
- Separate demonstration, self-check, manual, and executed evidence at the producing service. Caller declarations such as `independent: true`, `environmentReady: true`, or a producer label must not establish executed success. Existing affected evidence must be invalidated or excluded until revalidated.
- Preserve legitimate external CI and evaluator evidence when it has verifiable provenance and satisfies project policy. Add negative regression tests and a positive verified-evidence case; do not merely hide the delivered label in the UI.

#### D17 — real environment preparation

- Resolve the actual dsh host execution interfaces and wire configurable preparation/check commands through production plugin composition. Prepare both this repository and a second fresh project from one versioned profile without test-only runners.
- Derive readiness from project-scoped command results and required capability probes. Missing commands, failed checks, and absent executors remain visible blockers; `canStartImplementation` cannot replace results with synthetic passes.
- Record the profile version, workspace, commands, exit results, and artifacts. Prove that a failed required check blocks Generator and a repaired environment becomes ready. Keep unavailable lint/hygiene gates accurately labeled.

#### D18 — real Agent tasks and repair

- Bind Planner, Generator, and Evaluator to actual dsh task/session/tool execution with separate contexts and durable references. Preserve authorized original requirements and design decisions; a synthesized confirmation flag is not approval. Missing host primitives become explicit dependencies, not a replacement model runtime.
- Generator must create actual code and execute self-checks. Evaluator must independently inspect the candidate revision and acceptance behavior, retain criterion-level evidence, and return concrete findings that the next Generator attempt consumes.
- Demonstrate one real failure, bounded repair, and independent re-evaluation. Assert file existence and behavior as well as run state. Retain model/tool/session references; deterministic functions remain test or demonstration support.

#### D19 — executable methods and Skill sensors

- Resolve the default or selected method and bind its version, Skill instructions, and chosen depth steps to actual tasks. Reuse the D6 method packs and existing Skill records; catalog selection alone does not satisfy execution.
- Run valid and invalid examples against the declared output validation and behavior sensors. Missing requirement information, invalid output, and failed quality checks must trigger recorded clarification, repair, depth adjustment, or blocking as appropriate.
- Show an actual task taking the intended method steps and a sensor rejecting an invalid result. Record method/Skill versions and evidence; metadata, `valid`, and `{ok: true}` examples cannot certify capability by themselves.

#### D20 — recovery and evidence revisions

- Checkpoints must identify the repository/worktree and candidate revision, actual task/session references, completed actions, pending effects, and budget usage needed for recovery.
- Interrupt a real task, restart execution, and reconcile current code and pending effects before resuming. Prove completed actions are not duplicated and unresolved effects block or request a decision.
- Change candidate code without changing requirement text and prove affected evidence becomes stale and blocks delivery until revalidated. Preserve requirement/design revision checks alongside code and execution provenance.

#### D21 — fresh-project and self-development acceptance

- Through the production plugin and audience interfaces, start with a fresh project and original customer input. Show MKT collection and clarification, reviewed requirement analysis/design, actual environment preparation, three-Agent coding, and working customer behavior.
- Include a real failed acceptance criterion, evidence-driven repair, independent evaluation, and customer-safe progress that stays open until actual acceptance. A prepared Story, `demoRunner`, or forced evaluator result cannot substitute for this scenario.
- Execute a bounded HuntianLing development slice using the same method and retain independent evidence. Link second-project preparation from D17 and real recovery from D20. Reconcile requirement statuses and product completion claims only against these artifacts, with manual/external-Agent/runtime labels and unresolved blockers retained.
