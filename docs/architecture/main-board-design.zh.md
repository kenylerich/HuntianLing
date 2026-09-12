---
doc_status: active
doc_version: 2026-09-11.6
created: 2026-09-10
last_reviewed: 2026-09-11
review_after: 2026-10-10
---

# 主看板设计

[English](main-board-design.md) | 中文

文档生命周期：

| 状态 | 版本 | 创建日期 | 最后复审 | 下次复审 |
| --- | --- | --- | --- | --- |
| `active` | `2026-09-11.6` | 2026-09-10 | 2026-09-11 | 2026-10-10 |

## 摘要

本文定义 HuntianLing 的主看板界面。看板是需求、Milestone、交付进度、团队分配、工作流状态、代码证据和治理准备度的运营驾驶舱。它不是简单 issue 列表，也不替代工作流设计器、Code View、治理仪表盘或 Agent Team Chat。

主看板设计现在可以开展。当前 backlog 已经具备产品方向：内部 WorkItem 层级、多项目看板、需求分析和设计字段、拆分可追踪、跨 Milestone 交付切片、团队容量、Agent 协作、工作流可视化、代码证据、治理门禁、认证 Web 访问和审计记录。

## 目录

- [影响的需求](#影响的需求)
- [设计定位](#设计定位)
- [用户模型](#用户模型)
- [核心原则](#核心原则)
- [信息架构](#信息架构)
- [主要视图](#主要视图)
- [卡片设计](#卡片设计)
- [详情检查器](#详情检查器)
- [状态模型](#状态模型)
- [可追踪模型](#可追踪模型)
- [Milestone 模型](#milestone-模型)
- [团队和 Agent 集成](#团队和-agent-集成)
- [工作流集成](#工作流集成)
- [代码和证据集成](#代码和证据集成)
- [治理集成](#治理集成)
- [数据读取模型](#数据读取模型)
- [API 要求](#api-要求)
- [交互流程](#交互流程)
- [实现切片](#实现切片)
- [验证检查](#验证检查)
- [待决问题](#待决问题)

## 影响的需求

第一版主看板实现应使用这些 backlog 条目作为产品输入：

| 范围 | 需求 ids |
| --- | --- |
| 需求编写和拆分 | `REQ-REQ-001`, `REQ-BOARD-003`, `REQ-BOARD-004`, `REQ-TRACE-001` |
| 多项目和 Milestone 规划 | `REQ-BOARD-001`, `REQ-BOARD-002`, `REQ-MILESTONE-001`, `REQ-MILESTONE-002` |
| Web 和认证访问 | `REQ-WEB-001`, `REQ-WEB-002`, `REQ-WEB-004`, `REQ-WEB-005` |
| 团队、Agent 和协作 | `REQ-TEAM-001`, `REQ-TEAM-002`, `REQ-TEAM-003`, `REQ-TEAM-004`, `REQ-COLLAB-001`, `REQ-COLLAB-002`, `REQ-COLLAB-003` |
| 工作流编排 | `REQ-FLOW-005`, `REQ-FLOW-016`, `REQ-FLOW-017`, `REQ-FLOW-020` |
| SCM、CI 和证据 | `REQ-CODE-001`, `REQ-CI-001`, `REQ-EVIDENCE-001` |
| 治理和审计 | `REQ-GOV-001`, `REQ-GOV-002`, `REQ-SEC-001`, `REQ-REL-001`, `REQ-TRUST-001`, `REQ-TRUST-002`, `REQ-AUDIT-001` |

## 设计定位

首个产品 UI 是三套人群界面。跟踪见 [Web 界面重构计划](web-shell-refactor.zh.md)。本文档负责开发界面中的看板视图。`src/host/web/page.ts` 里的七模块驾驶舱不是目标产品 UI。

标准开发看板是准备好的 dsh 环境和三 Agent 系统的开发界面。录入和设计展示 Planner 产物，开发视图展示 Generator 工作和可运行结果，评价和验收展示 Evaluator 的发现。用户可以在这些视图补充信息、修改设计、控制执行和验收工作。环境准备与方法执行在界面背后完成，影响工作时显示就绪情况和失败。

看板服务于 [Harness 交付闭环](../requirements/harness-engineering.zh.md)。以需求分析和设计为核心，区分计划工作、Agent 活动和经验证的验收，并将可见完成状态连接到当前证据。首个交付切片使用现有看板展示真实运行，完整视图目录不是 Agent 执行的前提。

在开发界面中，主看板是日常入口。产品负责人、工程师、评审者、合规负责人或 Agent operator 不需要搜索日志，就应能回答这些问题：

- 当前正在处理哪个需求？
- 它处于哪个生命周期阶段？
- 它被如何拆分？
- 哪些验收标准已覆盖，哪些未覆盖？
- 哪个 Milestone 或交付切片负责每一部分？
- 谁或哪个 Agent 负责下一步？
- 哪个工作流步骤、审批、评审、分支、PR、CI run 或证据记录阻塞交付？
- 父需求是否可以被认为已完成？

看板读取 HuntianLing 内部 WorkItem 模型。外部跟踪器可以同步或镜像数据，但看板不依赖 GitHub Issues 或 GitHub Projects。

## 用户模型

Web 登录选择三种人群之一（`REQ-WEB-007`）。下列内部角色位于开发界面之内。

| 人群 | 主要需求 |
| --- | --- |
| 客户 | 创建自己的项目，与 MKT 对话，查看自己提交的原始需求，并查看客户侧进度。 |
| 开发 | 操作标准开发看板：收集、设计、进度、环境绑定和交付证据。 |
| 管理员 | 管理用户、项目归属、环境是否就绪和插件配置。 |

开发界面内的角色（不是登录人群）：

| 角色 | 主要需求 |
| --- | --- |
| 产品负责人 | 编写需求、评审拆分、排序 Story，并批准 ready。 |
| 项目经理 | 跟踪 Milestone、阻塞、负责人、WIP、交付风险和跨 Milestone 进度。 |
| 工程师 | 选择 ready 工作、查看上下文、创建分支，并附加交付证据。 |
| 评审者或审批者 | 找到待处理评审、审批、缺失证据和决策上下文。 |
| 合规、安全、可靠性或可信负责人 | 查看必需控制、缺失证据、残余风险和发布准备度。 |
| Agent operator | 理解 Agent 分配、能力边界、Skill 缺口、工作流状态和 Team Chat 活动。 |

## 核心原则

- WorkItem 树是需求层级事实源：Epic -> Feature -> Requirement 或 Story -> Task，同时支持 Bug 和 Research。
- Milestone 是交付视角，不是需求树父节点。
- 大需求可以通过子项或显式交付切片跨多个 Milestone 交付。
- 看板必须先显示可追踪性，再显示进度。如果父级覆盖关系不清晰，卡片移动再快也不够。
- 父项完成状态由子项状态、验收覆盖、阻塞、必需评审、审批和证据门禁推导。
- 需求分析和设计是一等卡片详情字段，不是隐藏在交付流程之外的附件。
- 工作流事件说明发生了什么；已接受的状态流转说明持久的当前状态、负责人和下一步。
- Agent Team Chat 是可见的项目协作窗口。它不替代看板，也不复用用户普通 LLM 任务聊天。
- 代码、CI、安全、可靠性和可信证据先关联到 WorkItem 和验收标准，再汇总到 Milestone。
- 看板动作必须遵守项目认证、授权、区域登录策略、角色规则、WIP 限制和资源租约。

## 信息架构

主看板应采用运营型布局：

| 区域 | 职责 |
| --- | --- |
| Project rail | 项目切换、项目健康、Milestone 过滤、已保存视图、团队容量和治理准备度标记。 |
| Command bar | 视图选择、搜索、过滤、创建动作、排序、密度、刷新和按权限显示的写动作。 |
| Board canvas | 当前选中视图：列、泳道、卡片、汇总、树分组、覆盖行或交付切片。 |
| Detail inspector | 可编辑 WorkItem 详情、分析、设计、子项、验收、Milestone、工作流、Team Chat 引用、代码、证据、治理和审计。 |
| Activity panel | 可选底部或侧边面板，用于工作流时间线、Agent Team Chat 引用、证据流和最近审计事件。 |

布局应保持紧凑并面向工作。它应优先使用稳定列、可读表格、内联汇总、键盘导航和可预测详情检查器，而不是大块宣传区域或装饰性页面分区。

## 主要视图

主看板必须支持同一批内部记录的多个投影。

| 视图 | 用途 | 主要分组 |
| --- | --- | --- |
| Portfolio board | 跟踪 Project 内 Epic 和 Feature 进度。 | Objective、Epic、Feature 或 Milestone |
| Requirement board | 让 Requirement 和 Story 在 analysis、design、ready、planning 状态中流转。 | Status 和 priority |
| Delivery board | 跟踪 Task、Bug 和 Research 的实现、评审、验证、门禁和交付。 | Status 和 owner |
| Tree board | 内联展示父子拆分，让用户看到子项数量和每个子项贡献。 | Epic 或 Feature |
| Coverage board | 把父级验收标准映射到子项、证据和未覆盖缺口。 | Acceptance criterion |
| Milestone board | 跟踪版本、阶段、MVP 或检查点的交付范围和阻塞。 | Milestone 和 delivery slice |
| Roadmap view | 按时间展示大需求跨多个 Milestone 的交付。 | Milestone timeline |
| Team board | 展示分配、WIP 限制、容量、角色覆盖、过载和资源冲突。 | Member、role 或 work type |
| Workflow board | 展示活动工作流阶段、步骤状态、负责人、阻塞、审批和下一步。 | Workflow run 或 stage |
| Code View entry | 打开需求关联的分支、提交、diff、评审、CI 和未关联代码告警。 | WorkItem、Milestone 或 acceptance criterion |
| Governance view entry | 打开义务覆盖、控制映射、风险接受、可信溯源和证据报告。 | Project、Milestone 或 WorkItem |

第一版 UI 不需要把每个视图都做成完整页面，但需要稳定的 view model，让后续视图读取同一批 WorkItem、Milestone、工作流摘要、证据摘要和治理摘要。

## 卡片设计

看板卡片应携带最小但足够扫描状态和可追踪性的字段：

| 字段 | 用途 |
| --- | --- |
| WorkItem id and type | 识别条目和层级。 |
| Title | 命名需求或交付工作。 |
| Parent breadcrumb | 展示 Epic、Feature、Requirement、Story 或交付切片来源。 |
| Status | 展示持久 WorkItem 状态。 |
| Priority and rank | 支持按优先级排序的 Story 交付。 |
| Owner and role | 展示人或 Agent 责任。 |
| Milestone or slice | 展示交付目标和跨 Milestone 位置。 |
| Child count | 展示拆分规模和未完成子项数量。 |
| Acceptance coverage | 展示父级验收标准的已覆盖和未覆盖情况。 |
| Workflow stage | 展示活动工作流阶段和下一步。 |
| Blockers | 展示依赖、缺失字段、失败门禁、资源冲突或等待审批。 |
| Evidence badges | 展示代码、评审、CI、安全、可靠性、可信和审批证据。 |
| Due date and aging | 展示交付压力和停滞工作。 |

卡片应支持交付团队使用的 compact density 和评审会议使用的 detailed density。徽章尺寸必须稳定，并在不同看板视图中保持一致。

## 详情检查器

选择卡片后打开详情检查器。需求管理应在这个检查器中完成，不需要离开看板。

| 标签页 | 内容 |
| --- | --- |
| Summary | 标题、类型、状态、优先级、负责人、Milestone、正文、排期、估算、来源和标签。 |
| Analysis | 业务背景、问题陈述、分析说明、约束、风险、假设和开放问题。 |
| Design | 方案、UX/API/data 考量、非目标、依赖决策和设计评审状态。 |
| Acceptance | 验收标准、子项覆盖、未覆盖标准、重复覆盖和 Definition of Ready 或 Done 检查。 |
| Children | 父子树、拆分原因、生成子项、手工子项、孤儿项和拆分动作。 |
| Milestones | 交付切片、目标 Milestone、切片范围、切片负责人、切片证据和跨 Milestone 汇总。 |
| Workflow | 当前运行、活动阶段、运行或阻塞步骤、等待审批、失败检查、调度原因和控制动作。 |
| Team Chat | 关联的 Agent Team Chat 消息、开放问题、决策、交接、评审请求和协作任务。 |
| Code | 分支、提交、diff、PR、评审、CI run、覆盖率和未关联代码告警。 |
| Evidence | 源文档、测试、CI artifacts、审批、安全、可靠性、可信和交付证据。 |
| Governance | 义务、控制、风险接受、认证准备度和必需签核。 |
| Audit | Actor、action、target、timestamp、changed fields、source 和 correlation ids。 |

Team Chat 标签页显示引用和未解决动作。打开完整 Agent Team Chat 时，应进入项目协作窗口，而不是启动或合并到普通 LLM 任务聊天。

## 状态模型

看板应先使用现有 WorkItem 状态，并按视图需要增加分组：

| 状态 | 含义 |
| --- | --- |
| `inbox` | 新建或导入但尚未 triage 的工作。 |
| `analyzing` | 需求分析进行中。 |
| `designing` | 设计进行中或等待设计评审。 |
| `triaged` | 条目已足够清晰，可以排序。 |
| `planned` | 条目已进入 Milestone、发布或交付切片。 |
| `ready` | Definition of Ready 通过，可以开始交付。 |
| `in_progress` | 交付工作进行中。 |
| `in_review` | 人或 Agent 评审进行中。 |
| `verifying` | 测试、CI、QA、安全、可靠性或可信验证进行中。 |
| `gates_passing` | 正在评估必需证据门禁。 |
| `delivered` | Definition of Done 和必需证据门禁通过。 |
| `rejected` | 条目作为产品范围被拒绝。 |
| `stopped` | 条目被有意停止或取消。 |

事件和状态承担不同职责。事件记录事实，例如请求评审、授予审批、CI 失败、提出交接或附加证据。状态流转在策略、角色、门禁和并发检查接受事件或命令后，更新持久当前状态。一次角色交接只有在交接事件被接受，并且 WorkItem、工作流步骤、协作任务或评审请求更新负责人和状态后才完成。

## 可追踪模型

看板必须让需求拆分可见：

- 每个子项保存 parent id、source input、decomposition reason、creator、timestamp 和 covered acceptance ids。
- 父卡片显示子项数量、未完成子项数量、未覆盖验收标准数量和阻塞数量。
- Tree board 显示从 Epic 到 Task 的拆分深度。
- Coverage board 显示每条验收标准以及覆盖它的子项或证据。
- 孤儿子项、分配到其他 Project 的子项、重复覆盖和未覆盖标准都应显示为告警。
- 当必需子项、必需切片或必需验收标准未完成时，父项不能进入 delivered。

## Milestone 模型

Milestone 是交付目标。它们应在每个主要看板视图中可见，因为规划和进度都依赖它们。

必需看板行为：

- Project rail 列出活动 Milestone，并显示交付健康和日期。
- 卡片显示当前 Milestone 或交付切片。
- Milestone board 显示范围、已完成工作、未完成工作、阻塞、风险和证据准备度。
- Roadmap view 显示大父需求跨多个 Milestone 的交付。
- 详情检查器显示每个交付切片的范围、标准、负责人、目标状态和证据。
- 移动子项到其他 Milestone 时，更新父级汇总和审计记录。

## 团队和 Agent 集成

看板必须把人和 Agent 显示为拥有明确角色和容量的项目成员。

必需界面：

- Team board 显示活动成员、角色、可用性、WIP 限制、已分配工作、阻塞工作和过载告警。
- 卡片显示负责人、claimed role、reviewer、approver 以及 Agent 或 human 标记。
- 分配控制在启动并发工作前调用调度推荐。
- 资源冲突显示在卡片、详情检查器、Team Chat 引用、Code View 和团队容量视图中。
- Skill 缺口显示为阻塞，并转化为创建或验证 Skill 后 Agent 才能运行的动作。

Agent 能力边界必须在影响动作的位置可见。用户应能看到为什么某个 Agent 可以分析需求，但不能 push 分支、批准评审、合并 PR 或接受残余风险。

## 工作流集成

主看板消费工作流状态并提供控制点。工作流设计器、运行时时间线和测试回放仍然是独立的详细界面。

看板级工作流字段：

- 当前工作流模板和版本；
- 活动 workflow run；
- 当前阶段和活动步骤；
- 已选负责人和可选替代人；
- 已加载 Skills 和缺失 Skills；
- 运行、排队、阻塞、失败、跳过或完成的步骤；
- 等待中的审批和评审；
- 调度原因和下一步；
- 允许的控制动作，例如 pause、resume、retry、reassign、reprioritize、cancel 或 rerun。

看板应链接到用于模板评审的静态流程图、用于真实执行的运行时调度时间线，以及用于工作流验证证据的测试回放视图。

## 代码和证据集成

看板应展示代码和证据状态，但不变成完整代码评审工具。

必需指标：

- 已关联仓库和分支状态；
- 活动分支、PR、reviewer、merge 状态和冲突状态；
- 变更文件和与代码关联的验收标准；
- 可用 CI 状态、覆盖率、artifacts、JUnit、SARIF 和 browser-test reports；
- 缺失测试、缺失评审、CI 失败、未关联代码、过期分支或合并冲突告警；
- Definition of Ready 和 Definition of Done 的交付证据完整性。

Code View 负责完整 diff 检查。看板负责摘要、ready 判断、阻塞和汇总展示。

当前实现基线：

- `DeliveryEvidenceSummary` 在 JSON Board Store 中保存 WorkItem code links、pull requests、review links、CI runs、deployment links、evidence links、checks、compliance obligations、risk acceptances、provenance links、notes 和 timestamps。
- Evidence board 把 WorkItems 分组到 blocked、missing、pending 和 ready evidence 泳道。卡片显示 PR、review、CI、missing required checks 和 governance blockers。
- WorkItem 和 Milestone Code View APIs 读取同一批 evidence summaries。Milestone Code View 包含直接分配到 Milestone 的 WorkItems，也包含通过显式 delivery slices 纳入的父 WorkItems。
- 真实 SCM/CI adapters、inline diff rendering、unlinked external code discovery 和 provider write actions 属于后续独立 adapter 工作。

## 治理集成

治理准备度必须出现在同一个交付工作流中，因为安全、可靠性、合规和可信都可能阻塞交付。

必需指标：

- 适用义务和 control packs；
- 影响 regulated data、authentication、authorization、audit、retention、AI output、payment、security、privacy 或 availability 的 WorkItems；
- 缺失控制、缺失证据、残余风险审批和过期审批；
- 安全准备度、可靠性准备度、AI trust provenance 和 evidence report 状态；
- Project、Milestone 和 WorkItem 准备度汇总。

高风险动作应在用户或 Agent 尝试前显示必需审批角色和当前审批状态。

## 数据读取模型

第一版看板实现应引入读取模型，使 UI 请求保持可预测。

| 读取模型 | 字段 |
| --- | --- |
| `main_board_views` | Project id、view id、filters、sort、grouping、density、visible fields 和 user defaults。 |
| `main_board_cards` | WorkItem 字段、parent breadcrumb、child rollup、acceptance rollup、Milestone slice rollup、owner、workflow summary、evidence summary、governance summary 和 warnings。 |
| `work_item_board_details` | 可编辑需求详情字段以及 inspector tab summaries。 |
| `work_item_traceability` | Parent tree、children、covered criteria、uncovered criteria、duplicate coverage、source references 和 decomposition reasons。 |
| `milestone_delivery_rollups` | Milestone scope、delivery slices、progress、blockers、risks、evidence 和 readiness。 |
| `team_capacity_rollups` | Member capacity、assigned work、WIP status、role gaps、Skill gaps 和 resource conflicts。 |
| `workflow_board_summaries` | Run state、step states、active owner、next action、scheduler reason、waiting approvals 和 controls。 |
| `evidence_board_summaries` | Code links、pull requests、review links、CI runs、deployment links、evidence links、checks、compliance obligations、risk acceptances、provenance links、missing evidence 和 report state。 |

读取模型可以由 SQLite 支撑本地部署，由 PostgreSQL 支撑团队部署。看板加载不应要求 GitHub、GitHub Projects 或外部 issue tracker。

## API 要求

主看板应使用版本化 API。下面是第一组候选 API：

```text
GET    /api/v1/projects/:projectId/main-board
GET    /api/v1/projects/:projectId/main-board/views
POST   /api/v1/projects/:projectId/main-board/views
PATCH  /api/v1/projects/:projectId/main-board/views/:viewId
GET    /api/v1/projects/:projectId/main-board/cards
GET    /api/v1/projects/:projectId/main-board/team
GET    /api/v1/projects/:projectId/main-board/workflow
GET    /api/v1/projects/:projectId/main-board/evidence
GET    /api/v1/projects/:projectId/delivery-evidence
GET    /api/v1/projects/:projectId/unlinked-code
GET    /api/v1/projects/:projectId/workflow-runs
GET    /api/v1/projects/:projectId/story-queue
POST   /api/v1/projects/:projectId/story-queue
GET    /api/v1/projects/:projectId/team/members
POST   /api/v1/projects/:projectId/team/members
PATCH  /api/v1/team/members/:memberId
PATCH  /api/v1/team/members/:memberId/availability
GET    /api/v1/projects/:projectId/team/capacity
GET    /api/v1/work-items/:workItemId/board-detail
PATCH  /api/v1/work-items/:workItemId/board-detail
POST   /api/v1/work-items/:workItemId/assignments
GET    /api/v1/work-items/:workItemId/traceability
GET    /api/v1/work-items/:workItemId/milestone-plan
GET    /api/v1/work-items/:workItemId/workflow-board-summary
PATCH  /api/v1/work-items/:workItemId/workflow-board-summary
GET    /api/v1/work-items/:workItemId/workflow
PATCH  /api/v1/work-items/:workItemId/workflow
GET    /api/v1/work-items/:workItemId/delivery-evidence
PATCH  /api/v1/work-items/:workItemId/delivery-evidence
GET    /api/v1/work-items/:workItemId/evidence
PATCH  /api/v1/work-items/:workItemId/evidence
GET    /api/v1/work-items/:workItemId/code-view
GET    /api/v1/work-items/:workItemId/compliance
GET    /api/v1/work-items/:workItemId/security
GET    /api/v1/work-items/:workItemId/reliability
GET    /api/v1/work-items/:workItemId/trust
GET    /api/v1/milestones/:milestoneId/code-view
GET    /api/v1/projects/:projectId/board-health
```

写接口必须执行认证、项目授权、角色规则、流转门禁、WIP 限制、资源租约和审计记录。

## 交互流程

看板应支持这些日常流程：

1. 用户打开 Project，选择 Milestone，并看到当前需求和交付健康。
2. 产品负责人创建或编辑 Requirement 卡片，填写分析、设计、假设、风险和验收标准。
3. 用户把父项拆分为子 WorkItems，并把每个子项映射到验收标准。
4. 看板标记未覆盖验收标准、孤儿子项、重复覆盖和缺失设计字段。
5. 计划人员为大需求创建跨多个 Milestone 的交付切片。
6. 调度器选择最高优先级 ready Story，并启动或推荐端到端交付运行。
7. 团队或 Agent 通过调度控制认领工作，系统检查容量和资源租约。
8. Agent 和人类在 Agent Team Chat 中讨论阻塞、交接和评审请求，并在详情检查器中显示引用。
9. 工程师把分支、PR、CI run、评审和测试证据关联到对应 WorkItem 和验收标准。
10. 治理、安全、可靠性和可信门禁在必需控制、证据和审批存在前阻塞交付。
11. 只有必需子项、切片、验收覆盖、评审、审批和证据门禁都通过后，父项才可交付。

## 实现切片

推荐第一轮构建顺序：

| 切片 | 范围 | 需求 |
| --- | --- | --- |
| 1 | 项目选择器、主看板 shell、WorkItem 卡片、状态列和详情检查器。 | `REQ-BOARD-001`, `REQ-BOARD-002`, `REQ-REQ-001`, `REQ-WEB-001` |
| 2 | Tree board 和 Coverage board，包含父级汇总和告警。 | `REQ-BOARD-004`, `REQ-TRACE-001` |
| 3 | Milestone board 和跨 Milestone 交付切片。 | `REQ-MILESTONE-001`, `REQ-MILESTONE-002` |
| 4 | 版本化主看板 API 和认证 Web 访问。 | `REQ-BOARD-003`, `REQ-WEB-002`, `REQ-AUTH-001` |
| 5 | 团队容量、分配、WIP 告警和资源冲突。 | `REQ-TEAM-001`, `REQ-TEAM-002`, `REQ-TEAM-003`, `REQ-TEAM-004` |
| 6 | 工作流摘要、下一步、审批、评审和调度器链接。 | `REQ-FLOW-005`, `REQ-FLOW-020` |
| 7 | 代码、CI、证据、治理、可靠性、安全和可信汇总。 | `REQ-CODE-001`, `REQ-CI-001`, `REQ-EVIDENCE-001`, `REQ-GOV-001`, `REQ-SEC-001`, `REQ-REL-001`, `REQ-TRUST-001` |

这个顺序让团队在完整工作流设计器和运行时可视化完成前先实现看板，同时保留后续界面需要的字段。

## 验证检查

主看板实现只有通过这些检查才可接受：

- 用户可以在没有 GitHub 配置的情况下打开一个 Project 的看板。
- 用户可以切换 Project，且不能把 WorkItem 和另一个 Project 的 Milestone 混用。
- 父 WorkItem 显示全部子项和未完成子项数量。
- 父 WorkItem 显示未覆盖验收标准，并在必需覆盖缺失时阻止 delivered 状态。
- 大需求可以显示跨多个 Milestone 的交付情况。
- 需求分析和设计字段可以从看板详情检查器编辑。
- 看板卡片显示负责人、角色、状态、优先级、Milestone、阻塞和证据摘要。
- 受工作流控制的条目显示活动阶段、下一步、等待审批、失败检查或阻塞原因。
- Agent Team Chat 引用可见，但不会并入普通 LLM 任务聊天。
- 代码证据和 CI 证据关联到 WorkItem 和验收标准。
- 治理、安全、可靠性和可信阻塞在交付前可见。
- 每个写动作记录审计事件，并执行认证和授权。

## 待决问题

- 新 Project 默认打开哪个看板视图：Requirement board、Tree board 还是 Milestone board？
- 需求工作和交付工作默认显示哪些状态列？
- 视图定制应是 project-wide、user-specific，还是二者都支持？
- compact density 下哪些卡片字段必须保留？
- 哪些状态流转可以通过拖拽完成，哪些必须打开详情表单填写原因、证据或审批？
- 第一版对外部查看者需要多少移动端支持？
- 主看板 shell 稳定后，工作流可视化应使用哪个 graph 或 canvas library？
