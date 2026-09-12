---
doc_status: active
doc_version: 2026-09-12.2
created: 2026-09-10
last_reviewed: 2026-09-12
review_after: 2026-12-10
---

# HuntianLing Documentation

English | [中文](README.zh.md)

## Summary

This directory stores HuntianLing product, review, and architecture documents. Use this map before adding or reading documentation so requirements, design decisions, and review records do not become a flat collection of unrelated files.

## Directory Map

| Path | Owner | Contents |
| --- | --- | --- |
| `requirements/` | Product and analysis owners | Product backlog, requirement source, requirement splits, acceptance criteria, and review outputs. |
| `requirements/reviews/` | Review owner | Dated requirement review packages, dispositions, decisions, and follow-up rules. |
| `architecture/` | Architecture owner | System design, workflow runtime, API design, data model, extension model, and integration design. |
| `archive/` | Review owner | Historical documents that no longer guide current implementation but remain useful for traceability. |

## Current Documents

| Document | Status | Version | Review after | Purpose |
| --- | --- | --- | --- | --- |
| [requirements/harness-engineering.md](requirements/harness-engineering.md) | `active` | `2026-09-11.8` | 2026-10-11 | Product direction, source articles, alignment assessment, and self-development method. |
| [requirements/backlog.md](requirements/backlog.md) | `active` | `2026-09-12.14` | 2026-10-12 | Product requirement source for implementation. |
| [requirements/reviews/2026-09-12-runtime-alignment.md](requirements/reviews/2026-09-12-runtime-alignment.md) | `active` | `2026-09-12.2` | 2026-09-26 | Dated runtime findings, false-completion reproduction, and D16–D21 handoff. |
| [requirements/reviews/2026-09-10.md](requirements/reviews/2026-09-10.md) | `active` | `2026-09-11.2` | 2026-09-24 | Dated review package; current delivery order is owned by the backlog. |
| [architecture/main-board-design.md](architecture/main-board-design.md) | `active` | `2026-09-11.6` | 2026-10-10 | Main board information architecture, views, card model, APIs, and implementation slices. |
| [architecture/web-shell-refactor.md](architecture/web-shell-refactor.md) | `active` | `2026-09-11.6` | 2026-10-11 | Browser UI diagnosis and audience-shell refactor slices. |
| [architecture/workflow-orchestration-engine.md](architecture/workflow-orchestration-engine.md) | `active` | `2026-09-11.6` | 2026-10-10 | Workflow orchestration design, terminology, runtime model, visualization, testing, and extension model. |
| [archive/README.md](archive/README.md) | `active` | `2026-09-10.1` | 2026-12-10 | Archive policy and index. |

## Placement Rules

- Put requirement source material, `REQ-*` definitions, decomposition decisions, and acceptance criteria in `requirements/`.
- Put dated review packages and review outcomes in `requirements/reviews/`.
- Put cross-cutting implementation design in `architecture/`.
- Put superseded or expired historical records in `archive/` after recording the active replacement or review decision.
- Keep package-specific implementation details beside the owning source package when that package exists.
- Do not add new human-facing Markdown directly under `docs/` unless it is a directory map or navigation page; `pnpm run doc-sync` rejects root-level flat documents.
- Every user-facing Markdown document must keep its `.zh.md` counterpart and `.i18n.yaml` sidecar current.

## Lifecycle Rules

- `doc_status` must be `active`, `draft`, `superseded`, or `archived`.
- `doc_version` must use `YYYY-MM-DD.N` and should increment when a review changes the document's meaning.
- The `.i18n.yaml` sidecar stores the content hashes that identify the exact English and Chinese text versions.
- `created`, `last_reviewed`, and `review_after` must use `YYYY-MM-DD`.
- `review_after` marks the next required review date. When it passes, update the document after review or archive it.
- `archive_after` marks time-bound documents that should stop guiding implementation after a date.
- Archived documents must live under `docs/archive/`, except for the archive index itself.

## Implementation Rule

Before implementing a requirement, read [requirements/backlog.md](requirements/backlog.md) and identify the affected `REQ-*` ids. For workflow-related implementation, also read [architecture/workflow-orchestration-engine.md](architecture/workflow-orchestration-engine.md).
