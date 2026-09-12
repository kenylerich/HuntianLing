# AGENTS.md

HuntianLing is a Cordis plugin loaded by DeepSeek Harness (dsh). This file is the working agreement for code, docs, and reviews in this repository.

This repository is an early HuntianLing implementation. The plugin package, local Board Service, Milestone model, Requirement Service, Web Service, vendored Cordis build path, and focused tests exist; requirement intake, workflow orchestration, advanced UI views, and rollup reporting are still planned. Sections marked **TODO** describe rules that will apply once those pieces exist; everything else is in force today.

## Status

- Repository name: `HuntianLing`
- Remote: `https://github.com/kenylerich/HuntianLing.git`
- Default branch: `master`
- Package scope: `@kenylerich/dsh-huntianling`
- Loader target: host composition loaded by `dsh` through `cordis.yml`

## What this plugin will provide

HuntianLing is a dsh plugin whose interface is a standard development board for requirement collection, requirement design, development progress, evaluation, and acceptance. After Web login, customer, developer, and admin shells project the same records. MKT collects original requirements under a role contract that a human or Agent may execute. Behind the developer board the plugin prepares a reusable standard vibe-coding environment in the current dsh setup, including executable Planner, Generator, and Evaluator Agents and built-in engineering methods. Skills declare capability boundary and depth; the harness does not assume a strong model. It owns an internal WorkItem tree as the source of truth, supports Epic → Feature → Requirement/Story → Task decomposition, groups work through project Milestones, records requirement analysis and design directly on board cards, tracks acceptance coverage and delivery evidence, and projects the same records into portfolio, milestone, requirement, delivery, tree, coverage, roadmap, and browser-accessible views. GitHub Issues and Projects are optional synchronization targets; they do not own the requirements lifecycle.

## Repository layout

Current:

```
src/                plugin source (Host and/or Client faces)
  host/               Host-half Cordis plugin(s)
  client/             Client-half Cordis plugin(s), if any
cordis.yml           plugin composition and config (loaded by dsh)
package.json         npm manifest; entry points; scripts
tsconfig*.json       strict-mode TypeScript projects, face-specific where required
test/                unit and snapshot tests
fixtures/            recorded-session fixtures (keyless replay)
docs/                documentation map, requirements, reviews, and architecture notes
README.md            plugin user-facing docs
CHANGELOG.md         release notes
```

`.agents/` remains a harness reference asset. `.github/` is active for this repository's CI and optional GitHub Issue/Project synchronization policy; keep those workflows aligned with HuntianLing's independent requirements model.

## Requirement implementation

Before implementing product behavior, API behavior, board behavior, workflow behavior, Agent/Skill behavior, SCM/CI behavior, authentication, governance, or storage changes, read `docs/requirements/backlog.md` and identify the relevant `REQ-*` ids. Read `docs/requirements/harness-engineering.md` for product direction and the self-development method. Use the backlog as the product requirements source; do not rely on GitHub Issues, Project boards, chat history, or memory as the source of truth.

If the scope touches workflow templates, scheduling, state transitions, handoffs, Agent/Skill binding, Team Chat collaboration, approvals, reviews, Story delivery runs, workflow visualization, Workflow Test Lab, SCM/CI evidence, or governance gates, also read `docs/architecture/workflow-orchestration-engine.md` before editing code or tests.

When implementation splits, changes, completes, or discovers a requirement, update the English and Chinese backlog pair in the same change, re-record it with `pnpm run doc-sync:write`, and keep `pnpm run doc-sync` green. The final handoff or PR summary must name the implemented or affected `REQ-*` ids and the checks that prove them.

## Developing HuntianLing with its own method

The product baseline is both faces together: the standard development board, and the invisible standard environment with MKT collection, Planner, Generator, Evaluator, executable methods, and Skill boundary/depth. Until that runtime exists, develop this repository with the depth 0–1 pack in `.agents/skills/huntianling-self-harness/` (`huntianling-mkt`, `huntianling-planner`, `huntianling-environment`, `huntianling-generator`, `huntianling-evaluator`). Validate slice artifacts with `pnpm run self-harness:validate -- <file>`. Do not claim HuntianLing-runtime Agents. A manually prepared Story demonstration does not replace fresh-project onboarding acceptance. Use `REQ-WEB-007`, `REQ-MKT-001`, `REQ-SKILL-005`, `REQ-SKILL-006`, `REQ-HARNESS-001`, and `REQ-HARNESS-005`–`008` to evaluate those capabilities. Do not reduce MKT or the three coding Agents to role labels, substitute Generator self-checks for Evaluator execution, or complete a Skill without sensors.

For each implementation slice, record the affected `REQ-*` ids, intended customer behavior, reviewed analysis/design, acceptance criteria, applicable checks, and execution owner. Link the actual change set, verification artifacts, reviewer decision, and unresolved blockers before recording completion. Use the board where supported and a linked repository review record for missing capabilities; keep requirement specifications in the bilingual backlog. Mark manual, external-agent, and HuntianLing-runtime steps explicitly. Unavailable gates and manually edited workflow summaries are not proof of automated delivery. The first runtime demonstration and its acceptance criteria are owned by `REQ-HARNESS-005`.

## Plugin conventions (in force today)

These rules apply to any Cordis plugin code, tests, or docs added to this repository.

- A plugin's contribution goes through `ctx.effect()` / `ctx.on()`; a registry's `register()` returns the disposer.
- **Inject declarations are for hard dependencies only.** Declare `inject: ['serviceName']` on the returned plugin object when the Service is required and the plugin must wait until Cordis reactivates it. For optional Services, read `ctx.get('serviceName')` and handle `undefined`.
- **Typed events use declaration merging** and merge-extensible maps. Event JSDoc needs `@mode` and payload `@param`; scoped keys absent from payloads need `@dshScopeScan unsupported`. Public service methods document parameters and non-void returns.
- **Waterfall listeners MUST call `next()`** to delegate; returning without it short-circuits the chain.
- **Switch on discriminant tags.** Closed unions end in `assertNever`; merge-extensible unions fall through a documented default.
- **A capability seam comprises Service Definition / Service Provider / Consumer roles.** It is complete, never one role; split only when roles evolve independently.
- **Explicit > implicit at package boundaries**: defaulting is an explicit `resolve(request): Spec` step in the owning implementation, never a hidden `?? default` inside `run()`.
- **No hardcoded tunables in plugins**: deployment-varying choices are validated `Config` fields changeable from `cordis.yml`; a `DEFAULT_*` constant or test hook is not configurability. Protocol constants, external specs, and security invariants stay fixed.
- **Misconfiguration fails loud** at load when self-contained, otherwise at the earliest resolvable point; never silently skip a missing referent.
- **Opaque cross-boundary ids are branded** (`Branded<B>` from `dsh-brand`), never bare `string`.
- **ESM everywhere** (`"type": "module"`). Use package names across packages and `.ts` in local relative imports. No CJS-only exports.
- **An empty `catch` names what it swallows** and why nothing else can reach it; keep the `try` to one statement.

## TypeScript

- `strict: true` with `noImplicitAny`. Every remaining `any` explains why narrowing is infeasible.
- **Source plane vs artifact plane, never mixed.** Static gates and tests resolve workspace imports through tsconfig `paths` to `src` and pass on a clean tree; gates consuming built `lib/` declare that dependency.
- **Keep compiler faces explicit.** A package with both Host and Client programs exposes face-specific leaf configs and a solution-only root; repo-wide programs seed a face config, never the root solution.

## Tests

- **Tests describe behavior, not correctness.** Change obsolete behavior with its tests; explain why in the PR.
- Plan unit, e2e, and snapshot coverage for capability seams, lifecycle paths, and transcript output. TODO: add fixture harness support once the plugin is implemented.
- Fixtures replay on macOS/Linux; fix fixtures, not normalizers.

## Documentation and prose

- `README.md` and every user-facing `docs/**/*.md` source must ship as a bilingual pair: `foo.md`, `foo.zh.md`, and `foo.i18n.yaml`. Put the language switcher in the first 16 lines of each file, update both languages in the same change, run `pnpm run doc-sync:write` to re-record the pair, and keep `pnpm run doc-sync` green. The local gate enforces pair presence, switchers, sidecar freshness, and blocks re-recording when only one language changed.
- Every user-facing Markdown source and counterpart must start with lifecycle frontmatter containing `doc_status`, `doc_version`, `created`, `last_reviewed`, and `review_after`. Use `doc_version: YYYY-MM-DD.N`, use ISO dates for lifecycle fields, and use `archive_after` for time-bound review packages, decision notes, and temporary design material. `pnpm run doc-sync` rejects overdue active documents and archived documents that are not under `docs/archive/`.
- Comments and docs state complete contracts and context, not reasoning transcripts. Use direct, concrete terms.
- Before writing `contract`, `boundary`, or `shape`, ask whether a more exact term names the subject: write `response fields`, `JSON validation`, or `ESM exports` instead of `response shape`, `validation boundary`, or `module shape`. Keep `contract` for preconditions, postconditions, invariants, compatibility promises, and other obligations that callers, callees, implementers, providers, producers, or consumers rely on.
- Keep a literal process, wire, security, transaction, or lifecycle boundary. Do not narrate control flow or tests, preserve review history, or restate code.
- **Keep comments local.** Do not restate code, explain distant behavior unless locally required, or expand unrelated comments.
- **Prefer symmetry for parallel values**; unexplained asymmetry usually signals a missed extraction.
- **Client UI copy is locale-owned.** Route product text through typed dictionaries and `t` or localized primitive props.
- Files end with exactly one trailing newline; `git diff --cached --check` (pre-commit) gates it.

## Quality gates

This repository adopts the dsh quality-gate discipline. The exact command surface is TODO until `package.json` exists; once present, every change must pass the relevant gate before push.

| Surface | dsh command (TODO) | When to run |
| --- | --- | --- |
| Type safety | `pnpm run typecheck` | every commit |
| Lint | `pnpm run lint` | every commit |
| Duplication | `pnpm run duplication` | before push |
| Hygiene (publint + workspace + package + dep + NodeNext) | `pnpm run hygiene` | before push |
| Build | `pnpm run build` | before push |
| Unit tests | `pnpm run test` | before push |
| Coverage gate (per-file 100% on `src/`) | `pnpm run test:coverage` | CI gate; never bypass |
| Real-API e2e | `pnpm run test:e2e` | when a provider or live API is touched; self-skip without key |
| Docs sync | `pnpm run doc-sync` | when docs change |
| Host sandbox failures | retry with the narrowest host escalation | on `gh` / network / IPC / watcher / `sandbox-exec` denials; require sandbox evidence, never bypass test failures or the product sandbox |

Match evidence to the surface: focused behavior tests, model/user-output snapshots, `doc-sync` for docs, built smokes for published paths, and real-API e2e for providers. Never default to the full suite for commit or push. CI owns exhaustive coverage and the platform matrix; rehearse all locally only by explicit request, for CI diagnosis, or for an irreducibly repository-wide change.

## Defensive patterns

Read [dsh defensive patterns](https://github.com/kenylerich/deepseek-harness/blob/main/docs/defensive-patterns.md) before lifecycle, concurrency, subprocess, or teardown work. The patterns and their rationale are owned by the dsh repository and tracked there; this repo only consumes them.

## Git history and PRs

- **Choose PR history deliberately.** Split independent changes and fix the introducing PR before propagation. Standalone/stack branches may merge-forward or rebase. Rewrites use `--force-with-lease`, abort on remote movement, never raw `--force`; preserve an in-progress merge-forward checkpoint before taking a newer base.
- TODO: label policy — once the repository gains its own PR/Issue workflow, adopt `kind/*` and `area/*` labels per the dsh taxonomy.

## Secrets

- Never commit credentials. Real-API tests and demos read `DEEPSEEK_API_KEY` and optional `DEEPSEEK_BASE_URL` from the root `.env` when needed.
- `cordis.yml` allows `!!js` (never `!js`) under plugin `config` and entry `disabled`; other metadata stays literal, so conditional composition also uses overlays.

## What stays in dsh (do not duplicate here)

The dsh repository owns the following. Do not restate them in this `AGENTS.md`; link instead.

- Cordis vendoring manifest and sync procedure — `deepseek-harness/vendor/README.md`.
- `dsh` CLI source-launch contract (tsx ESM-only hook) — `deepseek-harness/.agents/notes/implemented/architecture/2026-07-29-dsh-source-launch-tsx-esm.md`.
- Session log version mechanism — `deepseek-harness/.agents/notes/implemented/architecture/2026-08-10-session-log-version-mechanism.md`.
- Released Session JSONL adjacent migration — `deepseek-harness/.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md`.
- Cordis waterfall semantics — `deepseek-harness/docs/cordis-primer.md#cordis-waterfall-semantics`.
- Capability seam glossary — `deepseek-harness/docs/glossary.md#capability-seam`.
- Defensive patterns — `deepseek-harness/docs/defensive-patterns.md`.

## Editing these instructions

This file is the real source for repository guidance. Keep each rule self-contained while linking high-level docs. Condense when clarity survives.

## GitHub workflow probe history

The HuntianLing `.github/workflows/` originally shipped as a verbatim copy of the host dsh repo's workflow set. Three probe commits (`git log --grep="Probe"`) and one right-sizing commit reduced the set to two workflows that fit the plugin:

- `ci.yml` — pull-request gate: `pnpm install` + `typecheck` + `build` + `test`.
- `e2e.yml` — push-to-master + manual dispatch: real-API smoke test against `DEEPSEEK_API_KEY`.

The probe series also established that the package scripts (`test`, `test:e2e`, `lint`, `hygiene`) and the HuntianLing workflow tree must be filled in before those workflows report green. Each script currently exits 1 with a `HUNTIANLING_PROBE:` prefix; replace each one with a real runner as the corresponding capability lands.

## Issue assets

`ISSUE_TEMPLATE/` ships five templates (`bug`, `feature`, `idea`, `research`, `task`) plus `config.yml` with `blank_issues_enabled: false`. The templates are generic Chinese Markdown with a 50-unit body limit and a collapsed `<details>` block — they match the rules `policy.validateBody` checks for and pass when run locally against each file. The picker therefore surfaces them at the New Issue page.

`issue-management/` is live. `config.json` points at user `kenylerich`, repository `HuntianLing`, and user Project #2 titled `HuntianLing project`. `policy.mjs` reads the Project through `repository.owner` so the same query works for a User-owned board. `issue-lifecycle.yml` is the write path: Issue open/reopen events place cards in Inbox, explicit workflow events move cards through Backlog, Ready, In progress, In review, and gated completion, and PR-open events initialize Start Date only. Native Issue close events with `not_planned` move cards to No action. Native completed close events must include a `huntianling-delivery-gate` certificate; otherwise the workflow reopens the Issue and restores the Project card to the previous open lane, or to In review when the previous lane is missing or terminal. Use the manual `recover_closed` workflow event to reopen one already closed illegal card, or `recover_illegal_closed` plus the scheduled lifecycle sweep to recover all illegal completed closes. See [.github/issue-management/README.md](.github/issue-management/README.md) for deployment, transition inputs, and recovery. `issue-policy.yml` is the PR check.

Those workflows cannot use `github.token` to mutate a user-owned Project V2. They mint a GitHub App token when `HUNTIANLING_ISSUE_APP_CLIENT_ID` is set; otherwise they use repository secret `HUNTIANLING_PROJECT_TOKEN`. Without one of those two credentials, lifecycle fails at "Resolve board token" with a pointer back here. A fine-grained PAT is not sufficient: GitHub does not grant user-Project write to that token type.

Operator setup, once:

1. Create a classic PAT at https://github.com/settings/tokens/new with scopes `repo` and `project` (that `project` checkbox is read/write).
2. Store it as repository secret `HUNTIANLING_PROJECT_TOKEN`.
3. Provision the board fields: `GH_TOKEN=<classic-pat> node scripts/setup-project-board.mjs`. The script creates Status / Priority / Start Date when missing and links the repository to Project #2.
4. Open a templated Issue. `issue-lifecycle.yml` should add it to the board at Inbox.
5. Backfill an existing Issue from Actions by running `Issue lifecycle` manually with `issue_number` and the target `workflow_event`.

A GitHub App (`HUNTIANLING_ISSUE_APP_CLIENT_ID` + `HUNTIANLING_ISSUE_APP_PRIVATE_KEY`) is the longer-lived alternative to the classic PAT; the workflows accept either.

`dependabot.yml` no longer declares a `uv` ecosystem. The original entry pointed at `/python/sdk`, a directory that does not exist in this repo, so the daily cron kept opening PRs that could not merge. HuntianLing's only registries are `npm` (root) and `github-actions`.
