---
doc_status: active
doc_version: 2026-09-17.1
created: 2026-09-17
last_reviewed: 2026-09-17
review_after: 2026-10-01
archive_after: 2026-12-17
---

# DSH Bundle Integration Record

English | [中文](2026-09-17-dsh-bundle-integration.zh.md)

## Decision

The HuntianLing package is a qualified private tarball dsh bundle for dsh `0.1.3-alpha.1`. It declares `cordis.patch.yml` through `package.json#dsh.bundle.patch`; installation adds one stable `huntianling` Cordis row that imports `@kenylerich/dsh-huntianling/host`. The bundle default is inert. A profile must replace the complete row with explicit workspace, SQLite, authentication, host, and port settings before the HuntianLing HTTP surface starts.

This completes the bounded internal bundle integration slice of `REQ-HARNESS-001` and supplies real-host evidence for `REQ-HARNESS-005`. It does not complete either requirement: live model tasks, the three-Agent self-development run, public/customer publication, and customer delivery acceptance remain open.

## Trigger, Implementation, and Rationale

- Trigger: use this integration when HuntianLing must run inside an installed dsh host rather than as a standalone Node process.
- Implementation: dsh reads the package manifest, applies `cordis.patch.yml`, imports the root plugin, and starts the children in dependency order. A dedicated qualification profile supplies runtime-only paths and secrets. `cordis.yml` remains a legacy direct-Cordis fixture.
- Rationale: the bundle contract keeps dsh in control of profile composition and lifecycle. The inert default prevents a package install from binding a second listener, choosing a workspace, or weakening authentication without an operator decision. The rejected alternative was to treat the legacy full `cordis.yml` as a dsh bundle manifest; dsh does not use it for bundle discovery.

## Change Set

| Area | Result |
| --- | --- |
| Bundle contract | `package.json` exports and packages `cordis.patch.yml`; the manifest declares it as the dsh bundle patch. |
| Composition | One stable row imports the public `./host` export; it contains no path, token, password, or enabled listener. |
| Lifecycle | The root plugin advertises the workspace provider and awaits child fibers in provider-before-consumer order. Children can read the activating parent provider. |
| Verification | The plugin smoke test uses the Cordis runtime from the installed dsh host when available and verifies the production SQLite child reaches ready state. |
| Operator path | README documents add, dump, boot, and the separate roles of the bundle patch and legacy fixture. |

## Real DSH Evidence

Qualification used source revision `15efd66ec08726252640b6d1ceb955ed9db9997d` plus this change set, Node `24.20.0`, pnpm `11.21.0`, and dsh `0.1.3-alpha.1`. The isolated profile was `huntianling-qualification`; the existing `web` profile was not used as the test database or workspace. Its pre-test manifest and user patch hashes remained `b07f71cba5c341f6bd6ebf1316573588817e3a15629a86f11d34d4a01a82c94b` and `7bf2f2c53a74f37e452302901f19fa9d9c1e31ab75006b83e3bff3fc53defb14`.

| Check | Observed result |
| --- | --- |
| Install and readback | Local package link became one dsh bundle and one Cordis row. Repeated config dump did not duplicate the row. |
| Real boot | dsh loaded the package through its normal profile lifecycle; the root and production children reached ready state. |
| HTTP boundary | `GET /api/status` and `GET /api/projects` returned 200. An unauthenticated write returned 403; an authenticated invalid write reached validation and returned 400. |
| Persistence | An authenticated project create returned 201. After graceful stop and restart, the project remained in SQLite. |
| Remove and reinstall | Removing the plugin removed its dependency, bundle entry, and generated row. Reinstall restored one entry and the service booted again. |
| Hot reload | Changing the qualification profile listener from port 3877 to 3878 moved the service and released the old port. |
| Secret handling | The packaged row contains no secret. The write token was provided by process environment and was not stored in the bundle, profile patch, or this record. |
| Normal Web profile | Immutable artifact `ca349f014507b9ca8ce4e10e3f303ce1e1073e3a5320b1d0054da9491acbb195`, built from commit `09cb93c`, was installed after exact rollback copies. Bundle order is base, web-app, HuntianLing, with one HuntianLing row. |
| Shared-profile coexistence | A temporary boot placed DSH Web on 3081 and HuntianLing on 3878 without interrupting the running desktop profile. DSH Web required authentication; HuntianLing reads returned 200, an unauthenticated write returned 403, and an authenticated invalid write reached validation and returned 400. |
| Portable artifact | Version `0.1.0-alpha.1` packed with prebuilt output and resolved Cordis dependency. Artifact SHA256 is `928d7562d68fb8dda99a4841361fb1df57793137220e95870887e4593792d7d9`. |
| Clean DSH Home | A new disposable home installed the prior artifact, upgraded to `0.1.0-alpha.1`, retained one bundle row, downgraded to `0.0.0`, removed the bundle, preserved an external data sentinel, reinstalled the alpha artifact, and cold-booted until SQLite was ready without the source checkout. |

The qualification profile patch hash after the port change was `2ff37e72570c625339055451fe0d5ac3022464ec1591c6faf84b43e203b3ee5d`. The profile and its disposable workspace are qualification artifacts, not product defaults.

## Repository Verification

| Command | Result |
| --- | --- |
| `pnpm run typecheck` | Passed |
| `pnpm run build` | Passed |
| Bundle and host contract tests | 9 passed, 0 failed |
| `pnpm run test` | 509 tests: 508 passed, 1 conditionally skipped, 0 failed |
| `pnpm run test:e2e` | Passed against an installed dsh Cordis runtime and real SQLite child |
| `pnpm run lint` | Passed |
| `pnpm run hygiene` | Passed |
| `pnpm run duplication` | Failed: 95 clones, 1.93%, against the existing zero threshold |

The full test suite binds loopback listeners. A sandbox run returned `EPERM`; the authorized host retry passed. This is an execution-environment restriction, not a product pass from the failed sandbox attempt.

The duplication result is a repository-wide open quality gate and is not reported as passing. Consolidating the bundle workspace-provider lookup reduced the observed baseline from 99 clones / 2.01% to 95 / 1.93%; resolving the remaining baseline belongs to the existing quality-gate repair scope.

## Remaining Boundaries

- The long-lived Web profile uses the immutable local artifact and a durable isolated workspace. Its write token remains an environment-only runtime value; without it, the surface is read-only.
- Validate future dsh versions again because the qualified host is an alpha release and its bundle schema is not claimed compatible beyond `0.1.3-alpha.1`.
- Public or customer distribution still requires a licensing decision and a wider compatibility matrix; the qualified artifact remains private and `UNLICENSED`.
- Native integration ownership is defined in [DSH integration and ownership boundaries](../../architecture/dsh-integration-boundaries.md). Actual model-session, identity, or UI seam migrations require stable DSH APIs and separate compatibility evidence.
- Complete the live-model Planner, Generator, and Evaluator self-development scenario before closing `REQ-HARNESS-005`.

Acceptance result: **DBI-0 through DBI-6 are complete for the private internal bundle boundary; live-model execution, public/customer distribution, and future native seam migrations remain separate work.**
