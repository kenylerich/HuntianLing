---
doc_status: active
doc_version: 2026-09-12.1
created: 2026-09-12
last_reviewed: 2026-09-12
review_after: 2026-10-12
---

# Project lane operations

English | [中文](README.zh.md)

## Summary

The repository lifecycle workflow projects Issue events into Project #2. Explicit workflow events control development lanes; PR activity only initializes Start date. This implements the repository projection subset of `REQ-ISSUE-001` and the required completion-record checks of `REQ-EVIDENCE-001`.

## Deployment and operation

Merge the workflow and policy changes into `master` before using the new inputs. The lifecycle job checks out the default branch: opening a PR or changing local files does not deploy the policy. Local Agent slice records do not automatically dispatch GitHub events; that producer belongs to the product's Issue synchronization adapter.

In Actions, select **Issue lifecycle**, then **Run workflow** on `master`. Set `issue_number` and the applicable `workflow_event`. A successful run must be checked against the resulting Issue state and Project Status; validation failures retain the lane and produce an Issue audit comment.

| Event | Required current lane | Result |
| --- | --- | --- |
| `intake` | Inbox or missing Status | Inbox |
| `triaged` | Inbox | Backlog |
| `ready` | Backlog | Ready |
| `work_started` | Ready | In progress |
| `review_requested` | In progress | In review |
| `changes_requested` | In review | In progress |
| `completed` | In review | Done and completed close, subject to the completion record |
| `no_action` | Any open lane | No action and not-planned close |

A repeated event for its target lane is permitted if Issue validation passes. Native open/reopen events place the card in Inbox. Native not-planned closes place it in No action. Other Issue edits validate metadata and initialize a missing Status; they do not infer development progress. Resolving PR references require the Issue to have entered In progress or In review through the workflow.

## Completion records and recovery

A completed close requires a `<!-- huntianling-delivery-gate -->` block in the Issue body. Place it inside the collapsed details section to retain the visible-body limit. It names WorkItem, Acceptance, Code, Review, CI, Evidence, and Gates. Values cannot be missing or placeholders. Gates must be exactly a supported success token such as `passed`, `approved`, or `已通过`; `not passed` is rejected.

This parser validates a declared record, not the existence, authenticity, or revision of its referenced evidence. Operators must retain real linked acceptance, code, review, and check evidence. The parser does not replace independent evaluation or certify HuntianLing runtime delivery.

An uncertified completed close is reopened and its Project card returns to the previous open lane, or In review if that lane is missing or terminal. `recover_closed` checks one Issue; `recover_illegal_closed` and the scheduled sweep check completed closed Issues. Recovery re-reads the current Issue: open or not-planned Issues are preserved, while a certified completed Issue with a stale lane is projected to Done. Existing correctly projected certified Done cards remain unchanged.

The workflow requires the configured GitHub App credentials or `HUNTIANLING_PROJECT_TOKEN` for the user-owned Project. Missing credentials fail at **Resolve board token**. Project fields and repository setup are documented in [AGENTS.md](../../AGENTS.md#issue-assets).

## Verification

Run the candidate policy's focused tests:

```sh
node --test .github/issue-management/policy.test.mjs
```

CI runs this suite in addition to the package tests. It mocks GitHub requests and verifies outgoing state writes, transition rejection, recovery, and token separation. Actual GitHub dispatch and Project write acceptance must be verified after deployment; local tests do not prove that deployment has happened.
