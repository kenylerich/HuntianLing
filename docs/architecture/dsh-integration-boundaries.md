---
doc_status: active
doc_version: 2026-09-17.1
created: 2026-09-17
last_reviewed: 2026-09-17
review_after: 2026-10-17
---

# DSH Integration and Ownership Boundaries

English | [中文](dsh-integration-boundaries.zh.md)

## Decision

HuntianLing is distributed for the first supported host as a private, fixed-version tarball bundle. DSH owns package composition and generic host capabilities. HuntianLing owns product records, policies, and delivery decisions. Integration crosses those boundaries through explicit adapters and references; neither side copies the other's authoritative state.

This boundary applies when the bundle runs in DSH `0.1.3-alpha.1`. Reconsider it when DSH exposes a stable native seam that can replace a HuntianLing subsystem while retaining its acceptance criteria, migration path, and rollback evidence.

## Distribution Policy

- Package version `0.1.0-alpha.1` is the first fixed internal bundle version.
- `private: true` and `UNLICENSED` are deliberate: the artifact may be installed on authorized local hosts but may not be published to a public registry or redistributed as open-source software.
- The release artifact is produced with `pnpm pack`, retains prebuilt `lib`, rewrites `workspace:^` Cordis to the resolved package version, and is identified by its SHA256 digest.
- Compatibility is limited to macOS arm64, Node 24.20.0, pnpm 11.21.0, and DSH `0.1.3-alpha.1` until another matrix is qualified.
- Installation must use a fixed tarball path or digest. A source link and a mutable Git branch are development inputs, not release artifacts.
- Upgrade and downgrade preserve the profile user patch and HuntianLing workspace. Uninstall removes bundle composition and package dependency but does not delete product data.

The rejected alternatives are a public npm release without a licensing decision, a mutable Git install that builds during installation, and copying a second Cordis runtime into the bundle.

## State and Lifecycle Ownership

| Capability | State owner | Lifecycle owner | Integration rule |
| --- | --- | --- | --- |
| Profile, bundle order, patch layers | DSH | DSH | HuntianLing contributes one bundle row and never edits generated config. |
| Model endpoint, account, provider credential | DSH/operator | DSH | HuntianLing stores only a binding reference; secrets remain outside product records and evidence. |
| Model session and generic tool execution | DSH | DSH | Future live Agents call an adapter and retain the DSH session/tool receipt identifier. |
| Project, WorkItem, requirements, acceptance | HuntianLing | HuntianLing | DSH sessions receive scoped snapshots; they do not become the record of truth. |
| Planner, Generator, Evaluator definitions | HuntianLing | HuntianLing | DSH executes a bound task, while HuntianLing validates outputs and controls handoffs. |
| Workflow, scheduling, leases, budgets | HuntianLing | HuntianLing | Generic DSH cancellation is an execution signal; product transition and recovery remain HuntianLing decisions. |
| Authorization and delivery policy | HuntianLing | HuntianLing | DSH host authentication may establish identity; HuntianLing evaluates project role and action policy. |
| Execution receipt | Producing DSH host | DSH for production; HuntianLing for verification/index | Persist immutable producer and revision references; editable summaries cannot mint acceptance. |
| Product database and artifacts | HuntianLing | HuntianLing | Use an explicit durable workspace; package uninstall never deletes it. |
| DSH Web UI | DSH | DSH | HuntianLing currently uses a separate loopback surface. Navigation embedding waits for a documented UI extension seam. |
| HuntianLing Web/API | HuntianLing | HuntianLing | It binds a distinct port, enforces its own write boundary, and disposes with the bundle fiber. |

## Adapter Contract

Every DSH adapter must receive a project-scoped request, declare the required capability and budget, return a typed receipt with host/session identity, and expose cancellation and terminal status. It must fail closed when the host capability, credential binding, or receipt verification is missing. An adapter may cache presentation data but cannot mirror DSH secrets or claim that a submitted task was executed.

## Migration Rule

Migrate one seam only after a compatibility test proves equivalent positive and negative behavior, state migration is reversible, and exactly one owner remains after cutover. Loading the bundle or displaying the same information in two interfaces is not migration evidence. Until those conditions hold, the ownership table above is the operative boundary.

## Open Work

- A real DeepSeek provider and live three-Agent run still require the separately approved provider credential and bounded evaluation plan.
- DSH native UI navigation, identity federation, and task/session adapters need stable host APIs before migration.
- Public or customer distribution needs a licensing decision and a wider compatibility matrix.
