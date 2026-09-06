# HuntianLing

A Cordis plugin for [DeepSeek Harness](https://github.com/kenylerich/deepseek-harness) that adds an agile project-management capability to the harness session.

> Status: skeleton. The plugin package, types, and Service Definitions are stubbed. No business logic is implemented yet; this repository exists to fix the bundle shape and AGENTS.md contract before any code lands.

## Capability seams (planned)

- **Requirement intake** — structured submission entry backed by an agile methodology template.
- **Workflow orchestration** — drives the collected → triaged → planned → in_progress → verifying → gates_passing → delivered state machine.
- **Board** — GitHub Projects-style view: projects → milestones → role-owned lanes → cards. Cards can be linked to a Requirement.

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
package.json         npm manifest (@kenylerich/dsh-huntianling)
tsconfig*.json       strict-mode TypeScript project refs
cordis.yml           dsh host composition
src/
  index.ts           package entry; re-exports the root plugin
  host/
    plugin.ts        root Plugin; wires agile + board sub-plugins
    agile/
      plugin.ts      agile Service Definition (skeleton)
      types.ts       Requirement / WorkflowState contracts
      intake.ts      intake form schema (stub)
      workflow.ts    state-machine driver (stub)
    board/
      plugin.ts      board Service Definition (skeleton)
      types.ts       Project / Milestone / Lane / Card contracts
      store.ts       persistence layer (stub)
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
