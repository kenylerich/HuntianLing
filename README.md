---
doc_status: active
doc_version: 2026-09-11.5
created: 2026-09-10
last_reviewed: 2026-09-11
review_after: 2026-12-10
---

# HuntianLing

English | [中文](README.zh.md)

A Cordis plugin for [DeepSeek Harness](https://github.com/kenylerich/deepseek-harness). The plugin interface is a standard development board for requirement collection, requirement design, and development progress. Behind that board the plugin prepares a standard vibe-coding environment in the current dsh setup, with executable Planner, Generator, and Evaluator Agents and built-in engineering methods, so users connect a project and start work without assembling that environment themselves.

Start with [Harness Engineering Product Direction](docs/requirements/harness-engineering.md) for the background articles, scope assessment, requirement-to-code loop, and how this repository applies the same method to its own development.

> Product baseline status: standard environment provisioning, the three built-in Agents, and executable method composition are planned; the available implementation is the board and supporting services.

> First product milestone: both faces together — customer/developer/admin shells, MKT collection with Skill boundary and depth, the standard development board that shows collection, design, and progress, and the invisible standard vibe-coding environment with Planner, Generator, Evaluator, and methods. Later capability seams stay planned and must not displace that baseline.

> Status: internal board model in place. The host bundle loads, the local Board Service persists Projects, Milestones, WorkItems, Project team members, workflow board summaries, and delivery evidence summaries; computes Story priority queues and delivery evidence rollups; the Requirement Service manages decomposition and coverage; and the Web Service exposes the same data through a dsh browser surface plus JSON APIs with optional session authentication and API tokens. Full workflow orchestration, dispatch automation, resource leases, and real SCM/CI adapters are still planned.

## Capability seams (planned)

- **Requirement intake** — creates internal WorkItems from structured requirement submissions; GitHub Issues are optional projections, not the source of truth.
- **Milestone management** — groups project work into releases, phases, MVPs, or delivery checkpoints with progress summaries on the board.
- **Work-item hierarchy** — tracks Epic → Feature → Requirement/Story → Task, plus Bug and Research items, with parent-child links stored inside HuntianLing.
- **Board** — the primary operation surface for requirement analysis, design notes, acceptance criteria, dependencies, blockers, ownership, and delivery progress.
- **Web surface** — serves a browser-accessible board UI and JSON API so dsh can display the plugin and external users can open the configured URL with optional login, session cookies, regional provider lists, and API tokens.
- **Team management** — manages human and agent team members, roles, availability, capacity, WIP limits, manual assignment, role-board lanes, and team-board warnings; automated dispatch and resource leases remain planned.
- **Team collaboration** — shows a dedicated Agent Team Chat where humans can observe and join agent-to-agent collaboration without mixing it with the normal LLM task chat.
- **Code view** — shows the branches, commits, diffs, reviews, checks, and deployment evidence related to a requirement.
- **Governance gates** — maps legal, certification, security, reliability, and AI trust controls to requirements, checks, evidence, approvals, and release decisions.
- **Workflow orchestration** — uses configurable templates, stage gates, orchestration plans, priority-ordered Story delivery runs, role-scoped approval and review events, and accepted state transitions to coordinate human-agent delivery work.
- **Workflow builder** — provides Harness-managed workflow templates, built-in orchestration capabilities, visual editing, static workflow maps, runtime scheduler timelines, custom events, custom plan nodes, Agent/Skill binding, plan scheduling, state recognition, dry-run testing, replay, and conformance checks before a workflow template is published.
- **Traceability** — rolls progress up from child work items and checks whether child items cover the parent requirement's acceptance criteria.

## Requirement management model

HuntianLing manages requirements as internal WorkItems scoped by Project and optionally assigned to a Milestone. A card is a WorkItem; its detail panel stores the requirement analysis, design notes, acceptance criteria, covered criteria, dependency links, blockers, evidence, priority, estimate, owner, milestone, and schedule fields. The same data can be projected into several views without changing the underlying record.

The full collected product backlog is tracked in [docs/requirements/backlog.md](docs/requirements/backlog.md). The main board design is organized in [docs/architecture/main-board-design.md](docs/architecture/main-board-design.md) so the team can align the board information architecture, views, card model, APIs, and implementation slices. The workflow orchestration engine is organized in [docs/architecture/workflow-orchestration-engine.md](docs/architecture/workflow-orchestration-engine.md) so the team can align goals, terms, runtime behavior, visualization, testing, and implementation phases. The current formal review package is in [docs/requirements/reviews/2026-09-10.md](docs/requirements/reviews/2026-09-10.md). The documentation map is in [docs/README.md](docs/README.md). Those documents record both implemented baseline requirements and the missing requirements that still need to become WorkItems.

The product hierarchy follows the familiar Azure Boards pattern:

```text
Epic
  Feature
    Requirement / Story
      Task
      Bug
```

Boards are the main entry point, but not the data model itself:

- **Portfolio board** — Epic and Feature progress, grouped by objective or release.
- **Milestone board** — release or phase progress, including total items, delivery slices, open items, blockers, and completion percentage.
- **Requirement board** — Requirement/Story cards moving through analysis, design, and ready states.
- **Delivery board** — Task, Bug, and Research work moving through implementation, review, verification, and delivery.
- **Tree board** — swimlanes grouped by Epic or Feature, with child cards visible inline.
- **Role board** — swimlanes grouped by claimed Project role, including empty role lanes and unclaimed work.
- **Coverage board** — acceptance criteria mapped to child work items and evidence.
- **Code view** — branches, commits, diffs, reviews, CI, and deployment evidence linked to the requirement.
- **Governance dashboard** — compliance obligations, security controls, reliability targets, AI trust assessments, risk acceptances, and evidence reports.

Parent status is derived from child status and acceptance coverage. A parent item should not be considered delivered while it still has uncovered acceptance criteria, unfinished required children, or unresolved blockers.

Milestones are project-level delivery targets, not parents in the requirement tree. Assigning an Epic to a Milestone lets child Feature, Requirement/Story, Task, Bug, and Research items inherit that Milestone unless a caller explicitly changes it. A WorkItem cannot be assigned to a Milestone from another Project.

Large parent requirements can span multiple Milestones through child WorkItems or planned delivery slices. Each slice keeps its own scope, acceptance criteria, evidence, owner, and Milestone while the parent rolls up progress across the whole delivery plan.

Planned collaboration work adds a dedicated Agent Team Chat window. It is an ordinary conversation timeline for seeing how agents discuss requirements, blockers, handoffs, review requests, and verification conclusions; it is separate from the user's normal LLM task chat. Messages can carry optional context tags for a WorkItem, Milestone, branch, pull request, CI run, or source document so readers understand what the conversation is about. Structured chat messages can create, assign, transfer, split, review, and complete internal agent collaboration tasks. Agent capability boundaries define which roles may read, edit, commit, push, open pull requests, trigger CI, approve, or merge, and high-risk actions can require human approval.

Concurrent team work is managed through project rosters, member availability, WIP limits, dispatch policies, and resource leases. This lets several humans and agents work in parallel while preventing duplicate ownership, conflicting code edits, overloaded reviewers, and shared CI or environment contention.

Workflow orchestration coordinates the team without replacing the board. A Project can choose a workflow template, apply stage gates, generate an agent orchestration plan, schedule parallel or sequential steps, pause for human approval, and show active workflow state in board, Team Chat, and milestone views. Prioritized Story delivery runs let the scheduler select the highest-ranked ready Story and control its end-to-end path from readiness through implementation, review, CI, evidence, gates, and delivery. Events record what happened and who did it; accepted state transitions record the current owner and progress. A role handoff is complete only when the engine accepts the event and updates the target state and owner. Approval and review work is represented as role-scoped events, so the system can show who requested a decision, which role must review or approve it, which role made the decision, and which gate changed. Harness manages workflow save, clone, selection, replacement, rollback, import, and export. Built-in workflow capabilities cover common agile delivery actions, and executable nodes bind to Agent roles, concrete team members, required Skills, and allowed tools before the Agent Runtime can start them. The scheduler starts a plan step only when dependencies, gates, approvals, capacity, resource leases, and repository state allow it. The selected agent must recognize the current workflow state before acting and stop when the state is stale, incomplete, contradictory, or outside its capability boundary. Workflow authors can use a visual designer and test lab to build, validate, dry-run, replay, and publish workflow templates before real Project work uses them. The workflow UI should provide three linked views: a static workflow map for template structure, a runtime scheduling timeline for live execution, and a replay view for test assertions and expected-versus-actual results. Workflow packs can extend events, plan node types, stages, transitions, gates, and approval rules through declared schemas, permissions, tests, and conformance checks.

Governance work maps applicable laws, certification controls, security requirements, reliability targets, and AI trust requirements to the same WorkItems and Milestones. The system tracks evidence and approvals, but project owners and legal reviewers decide which obligations apply.

## Service APIs

HuntianLing exposes three host-side Cordis services:

- `huntianling.requirements` — requirement-management API. It creates and splits Epic, Feature, Requirement/Story, Task, Bug, and Research items; updates analysis/design text; maintains acceptance criteria; links child items to covered criteria; and reads requirement trees and coverage summaries.
- `huntianling.board` — board-management API. It owns projects, milestones, team members, capacity summaries, WorkItem assignment, workflow board summaries, delivery evidence summaries, delivery evidence rollups, milestone delivery slices, WorkItem CRUD, status transitions, role claims, board views, milestone views, tree queries, coverage queries, and transition gates.
- `huntianling.web` — browser/API API. It starts and stops the local HTTP server, returns the dsh display surface, produces board URLs for project-filtered views, and can require authenticated sessions or API tokens.

Typical requirement-management calls:

```ts
const requirements = ctx.get('huntianling.requirements');

const epic = requirements.createEpic({ projectId, title, body });
const feature = requirements.createFeature({ epicId: epic.id, title, body });
const story = requirements.createStory({
  featureId: feature.id,
  title,
  body,
  analysis,
  design,
  acceptanceCriteria,
});
const task = requirements.createTask({
  parentId: story.id,
  title,
  body,
  coversAcceptanceIds: ['story-ac-1'],
});

requirements.updateRequirement(story.id, { analysis, design });
requirements.getRequirementTree(epic.id);
requirements.getAcceptanceCoverage(epic.id);
```

Typical board-management calls:

```ts
const board = ctx.get('huntianling.board');

const project = board.createProject({ name, description });
const milestone = board.createMilestone({ projectId: project.id, title: 'MVP', goal });
const item = board.createWorkItem({ projectId: project.id, type: 'task', title, body });
const member = board.createTeamMember({
  projectId: project.id,
  displayName: 'Dev Agent',
  memberType: 'agent',
  roleIds: ['developer'],
  concurrentWorkLimit: 1,
});

board.updateWorkItem(item.id, { assignee, priority: 'p1', milestoneId: milestone.id });
board.assignWorkItem(item.id, { memberId: member.id, roleId: 'developer', actorId });
board.transitionWorkItem(item.id, 'in_progress');
board.claimWorkItem(item.id, { roleId: 'developer', actorId });
board.getBoardView({ projectId: project.id, groupBy: 'milestone' });
board.getMilestoneSummary(milestone.id);
board.getTeamCapacity(project.id);
board.updateDeliveryEvidenceSummary(item.id, {
  codeLinks,
  pullRequests,
  ciRuns,
  checks,
  obligations,
  riskAcceptances,
});
board.getProjectDeliveryEvidenceRollup(project.id);
```

Typical web-surface calls:

```ts
const web = ctx.get('huntianling.web');

await web.start();
web.getSurface();
web.boardUrl({ projectId: project.id, groupBy: 'status' });
```

## Browser and HTTP API

The Web Service starts by default on `127.0.0.1` with an ephemeral port. dsh can display it by reading `ctx.get('huntianling.web').getSurface()`. Operators can expose it to other users by configuring the listener and public URL:

```ts
ctx.plugin(huntianling, {
  web: {
    host: '0.0.0.0',
    port: 8787,
    publicUrl: 'https://huntianling.example.com',
    writeToken: process.env.HUNTIANLING_WEB_WRITE_TOKEN,
    auth: {
      enabled: true,
      regionMode: 'auto',
      users: [{
        username: 'alice',
        displayName: 'Alice PO',
        passwordHash: process.env.HUNTIANLING_ALICE_PASSWORD_HASH,
        roles: ['product-owner'],
        projectIds: [],
        region: 'global',
      }],
    },
  },
});
```

Equivalent environment variables:

- `HUNTIANLING_WEB_ENABLED`
- `HUNTIANLING_WEB_AUTO_START`
- `HUNTIANLING_WEB_HOST`
- `HUNTIANLING_WEB_PORT`
- `HUNTIANLING_PUBLIC_URL`
- `HUNTIANLING_WEB_WRITE_TOKEN`
- `HUNTIANLING_WEB_ALLOW_UNAUTHENTICATED_WRITES`
- `HUNTIANLING_WEB_AUTH_ENABLED`
- `HUNTIANLING_WEB_AUTH_SESSION_TTL_MS`
- `HUNTIANLING_WEB_AUTH_API_TOKEN_TTL_MS`
- `HUNTIANLING_WEB_AUTH_REGION_MODE`
- `HUNTIANLING_WEB_AUTH_USERS_JSON`

Writes are allowed without a token only for the default local listener. When `host` is public or `publicUrl` is set, POST/PATCH requests require `Authorization: Bearer <token>` or `x-huntianling-token: <token>`, unless `allowUnauthenticatedWrites` is explicitly enabled.

When `web.auth.enabled` is true, every non-auth API request must authenticate with a session cookie, an issued API token, or the compatible static Bearer token. Password login verifies configured PBKDF2-SHA256 password hashes and never returns raw session or API token secrets after creation. Project-scoped users only see the Projects listed in their configured `projectIds`; users with no `projectIds` entry can see all Projects. OAuth flows, persistent credential storage, Argon2id/bcrypt support, rotation, and full audit events remain planned.

HTTP endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` or `/board` | Browser board UI |
| `GET` | `/api/status` | Web status and dsh display surface |
| `GET` | `/api/auth/session` | Read current authentication state, session, and regional provider set |
| `GET` | `/api/auth/providers` | Read configured login providers for `cn`, `global`, or `auto` |
| `POST` | `/api/auth/password/login` | Create a session cookie from a configured password credential |
| `POST` | `/api/auth/logout` | Clear the current session cookie |
| `GET/POST` | `/api/auth/api-tokens` | List or create API tokens for the current session user |
| `DELETE` | `/api/auth/api-tokens/:id` | Delete one API token owned by the current session user |
| `GET/POST` | `/api/projects` | List or create projects |
| `GET/POST` | `/api/milestones` | List or create project milestones |
| `GET/PATCH` | `/api/milestones/:id` | Read or update a milestone |
| `GET` | `/api/milestones/:id/summary` | Read milestone delivery progress |
| `GET` | `/api/milestone-board` | Read milestone lanes and work items |
| `GET/POST` | `/api/work-items` | List or create WorkItems |
| `GET/PATCH` | `/api/work-items/:id` | Read or update a WorkItem |
| `POST` | `/api/work-items/:id/transition` | Move a WorkItem status |
| `GET` | `/api/work-items/:id/tree` | Read a WorkItem subtree |
| `GET` | `/api/work-items/:id/coverage` | Read acceptance coverage |
| `GET` | `/api/board` | Read projected board columns |
| `GET` | `/api/requirements` | List Epic/Feature/Requirement/Story items |
| `POST` | `/api/requirements/epics` | Create an Epic |
| `POST` | `/api/requirements/features` | Create a Feature |
| `POST` | `/api/requirements/requirements` | Create a Requirement |
| `POST` | `/api/requirements/stories` | Create a Story |
| `POST` | `/api/requirements/tasks` | Create a Task |
| `POST` | `/api/requirements/bugs` | Create a Bug |
| `POST` | `/api/requirements/research` | Create a Research item |
| `POST` | `/api/requirements/:id/split` | Split one requirement into child items |
| `PATCH` | `/api/requirements/:id` | Update analysis/design/acceptance fields |
| `GET` | `/api/requirements/:id/tree` | Read a requirement subtree |
| `GET` | `/api/requirements/:id/coverage` | Read requirement acceptance coverage |

Versioned main board endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/v1/projects` | List or create projects |
| `GET` | `/api/v1/projects/:projectId/main-board` | Read the Project main board, view definitions, card summaries, columns, Milestone board, Team board, Role board, Workflow board, Evidence board, Story queue, Tree board, Coverage board, Milestones, team members, and board health |
| `GET` | `/api/v1/projects/:projectId/main-board/views` | Read built-in main board views |
| `GET` | `/api/v1/projects/:projectId/main-board/cards` | Read main board card summaries for one view |
| `GET` | `/api/v1/projects/:projectId/main-board/milestones` | Read Milestone board lanes with WorkItem cards, delivery slices, and lane rollups |
| `GET` | `/api/v1/projects/:projectId/main-board/team` | Read Team board lanes with capacity, WIP, assigned cards, unassigned cards, and team warnings |
| `GET` | `/api/v1/projects/:projectId/main-board/workflow` | Read Workflow board lanes, workflow summaries, Story queue, approvals, reviews, failed checks, and scheduler reasons |
| `GET` | `/api/v1/projects/:projectId/main-board/evidence` | Read Evidence board lanes and Project rollups for code, PRs, reviews, CI, checks, obligations, risk acceptances, security, reliability, and trust |
| `GET` | `/api/v1/projects/:projectId/delivery-evidence` | Read Project delivery evidence summaries and rollup counts |
| `GET` | `/api/v1/projects/:projectId/unlinked-code` | Read unlinked external code discovered by configured SCM adapters |
| `GET` | `/api/v1/projects/:projectId/workflow-runs` | Read project workflow board summaries as the current run list |
| `GET/POST` | `/api/v1/projects/:projectId/story-queue` | Read or recompute the priority-ordered Story queue with visible skipped reasons |
| `GET` | `/api/v1/projects/:projectId/main-board/tree` | Read the Project requirement tree as nested board cards with depth and tree warnings |
| `GET` | `/api/v1/projects/:projectId/main-board/coverage` | Read Project acceptance criteria mapped to child WorkItems, evidence counts, and uncovered warnings |
| `GET/POST` | `/api/v1/projects/:projectId/team/members` | List or create Project team members |
| `PATCH` | `/api/v1/team/members/:memberId` | Update a team member's display name, role ids, status, capacity, region, timezone, permissions, or skill profile |
| `PATCH` | `/api/v1/team/members/:memberId/availability` | Update member availability and capacity fields |
| `GET` | `/api/v1/projects/:projectId/team/capacity` | Read Project team capacity, assigned work, unassigned work, overloads, and warnings |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/board-detail` | Read or update WorkItem detail fields used by the board inspector |
| `POST` | `/api/v1/work-items/:workItemId/assignments` | Assign a WorkItem to an active Project team member while enforcing member role and WIP checks |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/workflow` | Read or update the WorkItem workflow board summary |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/workflow-board-summary` | Alias for WorkItem workflow board summary reads and updates |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/delivery-evidence` | Read or update WorkItem code, PR, review, CI, check, obligation, risk, and provenance evidence |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/evidence` | Alias for WorkItem delivery evidence reads and updates |
| `GET` | `/api/v1/work-items/:workItemId/code-view` | Read code, PR, review, CI, deployment, check, and unlinked-code context for a WorkItem |
| `GET` | `/api/v1/work-items/:workItemId/compliance` | Read WorkItem obligations, governance checks, risk acceptances, and blockers |
| `GET` | `/api/v1/work-items/:workItemId/security` | Read WorkItem security checks and security risk acceptances |
| `GET` | `/api/v1/work-items/:workItemId/reliability` | Read WorkItem reliability checks and reliability risk acceptances |
| `GET` | `/api/v1/work-items/:workItemId/trust` | Read WorkItem trust checks, trust risk acceptances, and provenance links |
| `GET` | `/api/v1/work-items/:workItemId/traceability` | Read WorkItem hierarchy, descendants, coverage, and warnings |
| `GET` | `/api/v1/work-items/:workItemId/milestone-plan` | Read a parent WorkItem delivery plan across Milestones |
| `POST` | `/api/v1/work-items/:workItemId/milestone-slices` | Create a delivery slice for one parent WorkItem |
| `PATCH` | `/api/v1/work-items/:workItemId/milestone-slices/:sliceId` | Update a delivery slice status, owner, Milestone, scope, evidence expectation, or target status |
| `GET` | `/api/v1/milestones/:milestoneId/requirement-slices` | Read delivery slices assigned to one Milestone |
| `GET` | `/api/v1/milestones/:milestoneId/code-view` | Read Milestone code evidence from directly assigned WorkItems and explicit delivery slices |

## Loader

HuntianLing is loaded by dsh as a host bundle:

```sh
dsh --profile huntianling
```

The `cordis.yml` at the package root is the loader entry; it imports `@kenylerich/dsh-huntianling/host`, whose default export is the root `Plugin` (see `src/host/plugin.ts`).

## Repository layout

```
AGENTS.md            working agreement (see file)
README.md            this file
docs/                documentation map, requirements, reviews, and architecture notes
package.json         npm manifest (@kenylerich/dsh-huntianling)
tsconfig*.json       strict-mode TypeScript project refs
cordis.yml           dsh host composition
src/
  index.ts           package entry; re-exports the root plugin
  host/
    plugin.ts        root Plugin; wires board + agile + web sub-plugins
    agile/
      plugin.ts      agile Service Definition (skeleton)
      types.ts       Requirement / WorkflowState contracts
      intake.ts      intake form schema (stub)
      workflow.ts    state-machine driver (stub)
    board/
      plugin.ts      board Service Definition
      types.ts       Project / Milestone / Lane / WorkItem contracts
      work-item.ts   hierarchy and transition rules
      store.ts       persistence layer
    web/
      plugin.ts      web Service Definition
      server.ts      browser and JSON HTTP API
      page.ts        browser board UI
      types.ts       web config and display surface contracts
```

`.agents/` and `.github/` are kept as read-only reference assets copied from the dsh repository. They are not active in this repository and will be replaced when this repo graduates to running its own quality gates.

## Development

```sh
pnpm install
pnpm run typecheck
pnpm run build
```

`pnpm run typecheck` is the local gate for the source plane. The full gate list (lint, duplication, hygiene, coverage, e2e, doc-sync) is in [AGENTS.md](AGENTS.md#quality-gates) and is TODO until the harness-side scripts are ported.

## License

UNLICENSED — private prototype.
