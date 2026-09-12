---
doc_status: active
doc_version: 2026-09-12.2
created: 2026-09-10
last_reviewed: 2026-09-12
review_after: 2026-12-10
---

# HuntianLing 文档

[English](README.md) | 中文

## 摘要

这个目录保存 HuntianLing 的产品、评审和架构文档。新增或阅读文档前先使用这张地图，避免需求、设计决策和评审记录继续变成无分类的平铺文件。

## 目录地图

| 路径 | Owner | 内容 |
| --- | --- | --- |
| `requirements/` | Product and analysis owners | 产品 backlog、需求事实源、需求拆分、验收标准和评审输出。 |
| `requirements/reviews/` | Review owner | 按日期保存的需求评审包、dispositions、decisions 和 follow-up rules。 |
| `architecture/` | Architecture owner | 系统设计、workflow runtime、API design、data model、extension model 和 integration design。 |
| `archive/` | Review owner | 不再指导当前实现、但为追踪保留的历史文档。 |

## 当前文档

| 文档 | 状态 | 版本 | 下次复审 | 用途 |
| --- | --- | --- | --- | --- |
| [requirements/harness-engineering.zh.md](requirements/harness-engineering.zh.md) | `active` | `2026-09-11.8` | 2026-10-11 | 产品定位、背景原文、方向审视和自身开发方法。 |
| [requirements/backlog.zh.md](requirements/backlog.zh.md) | `active` | `2026-09-12.14` | 2026-10-12 | 实现时使用的产品需求事实源。 |
| [requirements/reviews/2026-09-12-runtime-alignment.zh.md](requirements/reviews/2026-09-12-runtime-alignment.zh.md) | `active` | `2026-09-12.2` | 2026-09-26 | 按日期保存的运行能力问题、虚假完成复现及 D16–D21 交接。 |
| [requirements/reviews/2026-09-10.zh.md](requirements/reviews/2026-09-10.zh.md) | `active` | `2026-09-11.2` | 2026-09-24 | 按日期保存的评审包；当前交付顺序由 backlog 负责。 |
| [architecture/main-board-design.zh.md](architecture/main-board-design.zh.md) | `active` | `2026-09-11.6` | 2026-10-10 | 主看板信息架构、视图、卡片模型、API 和实现切片。 |
| [architecture/web-shell-refactor.zh.md](architecture/web-shell-refactor.zh.md) | `active` | `2026-09-11.6` | 2026-10-11 | 浏览器 UI 诊断和人群界面重构切片。 |
| [architecture/workflow-orchestration-engine.zh.md](architecture/workflow-orchestration-engine.zh.md) | `active` | `2026-09-11.6` | 2026-10-10 | 工作流编排设计、术语、运行模型、可视化、测试和扩展模型。 |
| [archive/README.zh.md](archive/README.zh.md) | `active` | `2026-09-10.1` | 2026-12-10 | 归档策略和索引。 |

## 放置规则

- 需求事实源、`REQ-*` 定义、拆分决策和验收标准放到 `requirements/`。
- 按日期生成的评审包和评审结果放到 `requirements/reviews/`。
- 跨模块实现设计放到 `architecture/`。
- 记录 active replacement 或 review decision 后，把 superseded 或 expired historical records 放到 `archive/`。
- package-specific implementation details 应在对应 package 存在后放到 owning source package 旁边。
- 除目录地图或导航页外，不要把新的 human-facing Markdown 直接放到 `docs/` 根目录；`pnpm run doc-sync` 会拒绝根目录平铺文档。
- 每个用户可见 Markdown 文档都必须保持 `.zh.md` counterpart 和 `.i18n.yaml` sidecar 最新。

## 生命周期规则

- `doc_status` 必须是 `active`、`draft`、`superseded` 或 `archived`。
- `doc_version` 必须使用 `YYYY-MM-DD.N`，当复审改变文档含义时应递增。
- `.i18n.yaml` sidecar 保存内容 hash，用来识别中英文文本的精确版本。
- `created`、`last_reviewed` 和 `review_after` 必须使用 `YYYY-MM-DD`。
- `review_after` 表示下一次必需复审日期。过期后要么复审并更新文档，要么归档。
- `archive_after` 标记有时效的文档，表示该日期后不应继续指导实现。
- 除归档索引自身外，归档文档必须放在 `docs/archive/` 下。

## 实现规则

实现需求前，先读 [requirements/backlog.zh.md](requirements/backlog.zh.md) 并识别受影响的 `REQ-*` ids。工作流相关实现还要读 [architecture/workflow-orchestration-engine.zh.md](architecture/workflow-orchestration-engine.zh.md)。
