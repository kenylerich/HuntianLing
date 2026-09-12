---
doc_status: active
doc_version: 2026-09-10.1
created: 2026-09-10
last_reviewed: 2026-09-10
review_after: 2026-12-10
---

# HuntianLing 文档归档

[English](README.md) | 中文

## 摘要

这个目录保存已经不再作为当前事实使用、但仍需为追踪保留的文档。只有在 active replacement、review decision 或 superseding requirement 已记录后，才把文档归档到这里。

## 归档规则

- 已归档文档是历史记录，不做日常清理式编辑。
- 当 `archive_after` 过期、文档被 superseded，或 review owner 决定它不再指导实现时，把文档移动到这里。
- 保持原始文档 pair 和 `.i18n.yaml` sidecar 一起移动。
- 该索引以外的归档文档必须设置 `doc_status: archived`。
- 如果存在 active replacement 或 review decision，从归档文档链接过去。
