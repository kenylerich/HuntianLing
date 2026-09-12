---
doc_status: active
doc_version: 2026-09-12.19
created: 2026-09-10
last_reviewed: 2026-09-12
review_after: 2026-10-12
---

# HuntianLing 需求 Backlog

[English](backlog.md) | 中文

文档生命周期：

| 状态 | 版本 | 创建日期 | 最近复审 | 下次复审 |
| --- | --- | --- | --- | --- |
| `active` | `2026-09-12.19` | 2026-09-10 | 2026-09-12 | 2026-10-12 |

## 摘要

HuntianLing 是 dsh 插件：界面是标准开发看板，后端准备标准 vibe coding 环境。登录后客户、开发和管理员界面共享 WorkItem 记录。MKT 收集原始需求；Planner、Generator 和 Evaluator 在开发看板背后运行。Skill 声明能力边界和深度，使弱模型仍能在传感器约束下完成有边界的切片。[Harness Engineering 产品定位](harness-engineering.zh.md) 说明原文背景、方向审视和自身开发方法。

本文档收集已经讨论过的 HuntianLing 产品需求。它是未来 WorkItems 的规划来源；实现时可以把任何条目拆分为 Epics、Features、Requirements/Stories、Tasks、Bugs、Research 和 Milestones，并在内部看板继续跟踪。

## 目录

- [产品原则](#产品原则)
- [Harness 交付基础](#harness-交付基础)
- [当前基线](#当前基线)
- [需求和看板管理](#需求和看板管理)
- [存储和持久化](#存储和持久化)
- [认证和访问](#认证和访问)
- [录入和需求分析](#录入和需求分析)
- [MKT 收集](#mkt-收集)
- [需求设计和优先级](#需求设计和优先级)
- [敏捷 AI 团队](#敏捷-ai-团队)
- [团队成员和并发工作](#团队成员和并发工作)
- [团队工作流编排](#团队工作流编排)
- [团队协作](#团队协作)
- [Skills 和覆盖度](#skills-和覆盖度)
- [Harness 工具](#harness-工具)
- [SCM、Git 和 CI/CD](#scmgit-和-cicd)
- [外部 Issue Tracker 集成](#外部-issue-tracker-集成)
- [治理、合规、安全、可靠性和可信](#治理合规安全可靠性和可信)
- [Web 和 API 扩展](#web-和-api-扩展)
- [审计和合规](#审计和合规)
- [实现顺序](#实现顺序)
  - [阶段 A — 已交付](#阶段-a--已交付保留不重做)
  - [阶段 B — 首个产品里程碑](#阶段-b--首个产品里程碑按此顺序)
  - [阶段 C — 第一条闭环能跑之后](#阶段-c--第一条闭环能跑之后)
  - [阶段 C 之后 — 已交付切片的残留](#阶段-c-之后--已交付切片的残留)
  - [阶段 D — 后续，仅在有实测需要时](#阶段-d--后续仅在有实测需要时)
  - [D16–D21 — 缺陷修正验收](#d16d21--缺陷修正验收)

## 产品原则

- 成功意味着客户行为通过验收、代码可维护、执行可恢复，并结合时间、成本和人工干预衡量。
- 插件以标准开发看板呈现需求收集、需求设计和开发进度。看板背后由 dsh 插件准备标准 vibe coding 环境，并运行 Planner、Generator、Evaluator 和内置工程方法。用户不必自行拼装即可开始工作。
- 一次 Web 登录服务三种人群：客户、开发和管理员。他们共享 WorkItem 记录，使用不同界面（`REQ-WEB-007`）。
- MKT 是需求收集角色。人或 Agent 都可在同一契约、Skill、工具和传感器下执行（`REQ-MKT-001`）。
- Harness 不假设模型很强。Skill 边界、深度和传感器决定任务能否完成（`REQ-SKILL-005`、`REQ-SKILL-006`）。
- MKT、Planner、Generator、Evaluator 和开发者在开发界面的 Agent 频道用类型化消息交流。该频道不是客户的 MKT 对话框（`REQ-COLLAB-004`）。
- HuntianLing 在内部拥有需求生命周期，并且必须能脱离 GitHub 运行。
- GitHub、Gitea、GitLab 和其他 SCM/CI 系统拥有其代码和检查事实，不拥有 HuntianLing 的需求层级或交付决策。
- 需求、里程碑、录入记录、agents、skills、checks、tool runs 和 delivery evidence 必须按项目归属。
- AI 输出必须能追踪到用户输入、源文档、工具调用和验证证据。
- 系统不能声称覆盖所有软件领域。它必须检测当前项目所需 Skills，报告覆盖缺口，并把缺失 Skills 明确变成 backlog items。

## Harness 交付基础

以下规划需求补全 [Harness Engineering 产品定位](harness-engineering.zh.md) 中的可执行交付闭环。它们扩展现有任务运行时、工作流、工具、SCM/CI 和门禁需求，不另建模型运行时。宣称 Agent 端到端交付之前，必须完成每项的首个明确切片。

### REQ-HARNESS-001: 可复现的项目环境

状态：规划中。

系统必须准备并验证 Agent 实现项目需求所需的环境。

验收标准：

- 插件内置有版本的标准组合，包含环境准备、三个 Agent 定义、方法/Skill 基线、工具绑定、检查和看板集成。用户关联仓库并提供项目访问配置，无需手工重建这套组合。
- 准备过程检查现有宿主，复用兼容的已安装能力，准备声明中缺少的依赖，并报告环境就绪或阻塞。重复准备保留已有工作和项目规范，不默默替换不兼容工具。
- 支持的配置可以用于初始化第二个项目，不依赖维护者私有准备经验。记录配置版本和显式覆盖、准备时间、必需人工步骤及基线验证结果。
- 有版本的 Project 配置明确仓库和基线、运行时与依赖准备、构建/测试/启动命令、浏览器或其他验证工具、相关 Skill 和允许的能力。
- 通过 dsh 执行适配器在隔离工作区完成准备，记录解析后的配置、工作区标识、准备输出和基线检查结果。
- 缺少依赖、工具、Skill、权限或凭据时，在依赖它们的实现开始前给出可操作的阻塞；秘密不得进入持久化任务上下文和证据。
- 可以从配置及保留产物准备替代环境；恢复前必须保留未提交工作，或明确报告其丢失。
- 测试证明准备成功、前提失败和环境替换。首个切片支持一个仓库和一套配置的工具链，远程环境集群推迟。

实现状态：

- `huntianling.environment` 内置配置 `huntianling.node-pnpm` 1.0.0。准备报告就绪或阻塞，可用于第二个工作区，保留已有文件，只记录凭据名称不写秘密，并把 probe 的 lint/hygiene 记为阻塞。
- `POST /api/v1/environment/replace` 用同一份 profile 准备 replacement fleet slot。未提交工作默认复制；不带 `acceptUncommittedLoss` 就丢弃会阻塞。`GET /api/v1/environment/fleets` 列出 local 和 remote slots。

关联需求：`REQ-AGENT-002`、`REQ-AGENT-004`、`REQ-TOOL-001`、`REQ-SKILL-003`、`REQ-SCM-001`。

### REQ-HARNESS-002: 长任务持久连续性

状态：部分实现。

Story 交付运行必须能够承受上下文压缩、Agent 中断和执行环境失败，不丢失已接受范围，也不盲目重复结果不确定的外部操作。

验收标准：

- 持久检查点记录需求与设计版本、验收范围、已完成和待执行步骤、负责人、阻塞、决策、仓库版本与保留的补丁/产物、证据引用、预算使用和下一步。
- 会话/事件引用和交付状态可以在活跃模型上下文及可丢弃执行环境之外检索。dsh 拥有会话存储；HuntianLing 拥有交付记录和关联。
- 恢复时，将当前仓库、工具、评审和证据状态与检查点核对。重复或过期事件不能推进交付；重试前先核实结果不确定的副作用，或升级处理。
- 取消以及配置的时间、token/成本、重试和无进展限制会暂停或终止工作，并留下可见原因和可恢复交接；禁止无界重试循环。
- 测试在持久化进度后中断运行、替换执行环境并恢复，证明不丢失已接受决策，也不重复已完成操作。

关联需求：`REQ-FLOW-015`、`REQ-FLOW-020`、`REQ-FLOW-021`、`REQ-AGENT-005`、`REQ-TEAM-004`。

实现状态：

- `huntianling.delivery` 把 Story 交付检查点持久化到 `.huntianling/story-delivery.json`，不依赖内存中的 agent runtime 或可丢弃的 web 进程。
- 在已持久化的 Planner 步骤后中断，再在新 runtime 或替换后的执行工作区上恢复，会继续 Generator 且不重跑 Planner。重复和过期事件记为拒绝，不改变运行状态。
- 取消必须提供原因，并留下可恢复的下一步。重试和步骤预算会阻止无界修复循环。检查点之后更改分析、设计或验收会阻塞恢复。

### REQ-HARNESS-003: 基于证据的评价与修复

状态：部分实现。

交付必须按照约定的客户行为评价，并对失败标准执行有界的修复闭环。

验收标准：

- 编码前保存经过评审的交付契约，包含需求与设计版本、纳入的标准、仓库基线、预期产物、验证方法、权限和预算；范围变化需要记录决策并重新验证。
- 每条标准都有可复现检查或明确的人工评价方法。检查在相应层验证行为，适用时包含真实用户流程；构建成功或字段填满不能单独证明验收。
- 标准编码流程独立于 Generator 调用内置 Evaluator。评价深度遵循项目策略；确定性检查和人工评审补充其结论，不能默默替代必需的 Agent 执行。
- 证据标明产生者、标准、代码/产物版本、设计版本、检查或评分准则版本、结果和保留输出。缺失、过期、矛盾或失败的必需证据阻止完成；手工摘要不能冒充已执行检查。
- 失败评价在配置限制内向实现阶段返回可操作缺陷。产品歧义返回澄清；预算耗尽或反复无进展时，形成待人工决策或可见阻塞结果。
- 测试证明发现缺陷、修复并重验、版本变化后证据失效、拒绝自我批准，以及证据不足时阻止完成。

关联需求：`REQ-REQ-001`、`REQ-FLOW-002`、`REQ-FLOW-019`、`REQ-FLOW-020`、`REQ-CI-001`、`REQ-TRUST-001`。

实现状态：

- Evaluator 运行会把每条验收标准的已执行检查写到所属 WorkItem。Generator 自检存为 `self_check`，不能把客户进度标为已交付。
- 证据记录产生者和设计版本。更改分析、设计或验收会把先前通过的已执行检查标为过期并阻塞。
- 客户可见的已交付要求当前版本上存在通过的 Evaluator、CI 或本地 Git 已执行检查。备注、未执行链接和缺失证据都不算。项目 Definition of Done 不能关闭这条已执行证据门。

### REQ-HARNESS-004: Harness 评价与持续改进

状态：部分实现。

团队必须衡量方法、Skill、提示词、环境或门禁是否改善交付，再决定是否将其作为必需的 Harness 机制。

验收标准：

- 维护有代表性的需求设计和编码场景，固定输入、基线版本、验收标准、声明的模型/配置和预算；结果包含失败与取消的运行。
- 记录约定范围的验收完成度、漏检缺陷、修复轮次、人工干预时间、恢复成功情况、耗时和 token/工具成本，并关联产物；未知指标保持未知。
- 使用经人工审阅的通过和失败示例校准评价准则；跟踪漏检与误拒，不把评价器分数当成事实。
- 每次只改变一个机制（包括一个 Skill 深度档）与基线比较，重复依赖模型的试验，区分编排回放与重新执行模型。在解释比较结果前设定采用阈值。
- 一个 Skill 深度档只有在该模型与任务的比较之后，才能成为必需的 Harness 机制。
- 将重复失败关联到拟议的 Skill、指令、检查、深度变化、上下文或环境改进及回归案例。评审后保留有效改进，移除无效或过时机制。

关联需求：`REQ-FLOW-007`、`REQ-SKILL-002`、`REQ-SKILL-006`、`REQ-TRUST-001`、`REQ-AUDIT-001`。

实现状态：

- `huntianling.harness` 在固定的通过、失败和取消案例上比较 MKT Skill 深度，包括 2–4。token 成本保持未知，除非 live-model trial 报告 usage。编排回放与 fresh 或 live-model trial 分开存储。
- 采用阈值在比较前解析。只有达到该阈值的比较才能把某一深度标为必需；未达到则不能采用。采用深度 2–4 会校准该深度供产品写入使用。
- 配置了模型 endpoint 时可运行 live-model 重复试验；缺失时失败并大声报错；token 永不落盘。

### REQ-HARNESS-005: HuntianLing 自身开发演示

状态：部分实现；运行时自动化存在前即可采用已记录的人工方法。

HuntianLing 必须在自身开发中使用并演示同一套需求到代码的方法。

验收标准：

- 每个开发切片引用 backlog 中的 `REQ-*` 编号，在实现前记录客户结果、分析与设计、验收范围、负责人、相关 Milestone 和适用门禁。
- 关联真实变更集、检查输出、评审决定、剩余阻塞和验收结果。步骤标为人工、外部 Agent 或 HuntianLing 运行时执行；不可用门禁不得报告为通过。
- 能支持时使用看板执行记录，缺失能力使用关联的仓库评审记录。双语 backlog 保持规格归属，不在 GitHub 或看板中建立相互冲突的规格副本。
- 先演示通过交付的标准配置和内置方法接入全新项目，再用同一组合开展 HuntianLing 开发。维护者专有准备或人工替代 Agent 步骤必须标为验收缺口。
- 演示仓库中一个真实 Story 的环境准备、dsh Agent 实现、失败评价、修复、中断/恢复，以及对最终版本的验收。运行必须依据证据更新看板进度，而非只编辑摘要字段。
- 保留演示产物和实测结果，标明人工缺口并转化为后续需求。单次文档更新不能完成这项需求。

关联需求：`REQ-HARNESS-001`、`REQ-HARNESS-002`、`REQ-HARNESS-003`、`REQ-HARNESS-004`、`REQ-FLOW-020`。

实现状态：

- `huntianling.harness` 会记录一次演示：用已交付的 Node/pnpm profile 准备全新工作区，再把一个 Story 跑过失败评价、修复、中断、恢复和 Evaluator 证据。客户可见的已交付由该证据更新。
- 演示步骤标为 `manual`、`external-agent` 或 `huntianling-runtime`。覆盖扫描和 live-model trial 步骤会被记录。lint 和 hygiene 保持 blocked。未绑定的真实模型是已标注缺口，不是通过的门禁。
- 维护者专有的 OAuth 准备仍列为后续缺口，而不是通过的门禁。托管 SCM/CI 适配器已作为调用时可选集成存在。

### REQ-HARNESS-006: 内置三 Agent 开发系统

状态：规划中。

插件必须将 Planner、Generator 和 Evaluator 实现为标准开发环境中的三个可执行 Agent。

验收标准：

- 插件组合提供三个 Agent 的有版本定义，包含任务输入、指令、Skill、允许的工具、模型绑定、输出验证和持久运行标识。模型选择可配置，不要求三个不同模型。
- Planner 将用户对话和源材料转化为可审阅的分析、设计、验收标准和交付拆分。输出停留在产品意图、场景、假设、未决问题和可测试验收，不冻结仓库特有的实现细节。实现前由用户确认范围。
- Generator 在准备好的环境中实现已确认工作，产生可运行结果和自检证据，并接受 Evaluator 发来的结构化修复任务。
- Evaluator 独立操作候选结果，按照约定标准记录证据及通过或需修改结论。标准编码流程不能用 Generator 自我批准替代它。
- 编码前由 Generator 与 Evaluator 约定可验证交付。有类型的持久交接负责设计、实现、评价、修复、澄清和完成路由，不要求用户转述消息。
- 每个 Agent 通过自身任务上下文读取相关共享产物。交接过程中继续执行状态、权限、取消、预算和恢复规则。
- 看板从真实运行展示 Planner 产生的需求/设计、Generator 的进展/结果和 Evaluator 的发现/验收。测试验证三个调用、拒绝无效输出、修复路由及中断交接恢复；真实集成运行实际使用配置的模型和工具。

实现状态：

- `huntianling.agents` 提供有版本的 Planner、Generator、Evaluator 任务定义。确定性执行器校验输出、路由含 repair 的类型化交接、拒绝 Generator 自我验收，并恢复中断运行。真实模型执行仍在规划中。

关联需求：`REQ-AGENT-001`、`REQ-AGENT-002`、`REQ-FLOW-014`、`REQ-FLOW-020`、`REQ-HARNESS-001`、`REQ-HARNESS-003`。

### REQ-HARNESS-007: 可执行工程方法基线

状态：规划中。

标准环境必须内置可用的工程方法基线，指导三个 Agent 并约束其输出。

验收标准：

- 内置基线包含需求分析、验收示例、设计决策、增量实现、代码评审、行为验证和复盘改进；首次使用不要求客户自行编写 Skill 或工作流。
- 每种方法声明适用条件、执行 Agent、必需输入、有版本的指令/Skill、输出字段或产物、检查，以及信息不足或输出被拒绝时的去向。
- Planner 对客户输入应用设计方法，Generator 应用仓库和实现实践，Evaluator 应用行为检查与评审准则。输出填入看板使用的同一组需求/设计/证据记录。
- Project 选择支持的方法包，并基于记录的基线版本覆盖声明的选项。缺少必需方法实现或 Skill 时明确阻止依赖工作；仅有方法名称不算可用能力。
- 方法或基线更新保留活跃运行的版本引用，采用前报告要求变化。项目特有设计和已有仓库规范继续保留。
- 测试证明方法影响实际产物和门禁决定、缺少必需信息时进入声明的纠正路径，以及默认基线能够在新接入项目上工作。

实现状态：

- 默认方法基线目前只含 User Story。启用该方法会在 Planner 输出中增加 `userStory` 产物；缺少方法 Skill 时 Planner 任务不能启动。

关联需求：`REQ-METHOD-001`、`REQ-METHOD-002`、`REQ-SKILL-001`、`REQ-SKILL-002`、`REQ-FLOW-001`、`REQ-HARNESS-004`、`REQ-HARNESS-006`。

### REQ-HARNESS-008: 切片级商业质量

状态：部分实现。

商业质量的 vibe coding 在一条已确认的原始需求切片上证明，而不是一次模型调用生成整个产品。弱模型使用 Skill 深度和传感器，而不是假定模型很强。

验收标准：

- 切片从已确认的 MKT 原始需求开始，带有原始来源原话，并且收集传感器通过。
- 切片完成仅当：若 Planner 已运行则设计已约定，Generator 在准备好的环境中产生候选，Evaluator 记录逐条标准证据，并且客户可见进度由该证据更新。
- Generator 自检不能把切片标为完成。手工编辑的进度不能在客户视图显示已交付。
- Skill 传感器反复失败则降档或停止任务，不对同一提示词无界重试。
- 测试覆盖传感器与评价通过的切片、因缺少 Skill 覆盖被拦住的切片，以及校验反复失败后降档的切片。

关联需求：`REQ-MKT-001`、`REQ-SKILL-005`、`REQ-SKILL-006`、`REQ-HARNESS-003`、`REQ-HARNESS-004`、`REQ-HARNESS-006`。

实现状态：

- 切片把 Evaluator 的逐条标准证据写到所属 WorkItem。客户可见的已交付由该已执行证据更新，而不是 Generator 自检或手工备注。
- 测试覆盖因缺少 coding 或 MKT Skill 覆盖被拦住的切片，以及校验反复失败后降档的切片。

## 当前基线

| ID | 需求 | 状态 |
| --- | --- | --- |
| REQ-BOARD-001 | Epic -> Feature -> Requirement/Story -> Task 内部 WorkItem 树，同时支持 Bug 和 Research | 已在本地 SQLite store 实现 |
| REQ-BOARD-002 | 多项目看板管理 | 已在本地 SQLite store 和 Web API 实现 |
| REQ-BOARD-005 | 业务 CRUD 和生命周期覆盖矩阵 | 已作为 Project-scoped v1 API 和 Admin workbench view 实现 |
| REQ-MILESTONE-001 | Project Milestones、WorkItem 分配和进度汇总 | 已在本地 SQLite store、Web API 和 Plans roadmap workbench 实现 |
| REQ-MILESTONE-002 | 跨里程碑需求交付 | 已通过显式 JSON delivery slices、v1 Web APIs、Delivery Slice workbench 以及子项 Milestone 移动时的 parent-plan audit 实现 |
| REQ-WEB-001 | 通过 dsh display surface 和 URL 访问浏览器看板 UI | 已通过本地 HTTP service 实现 |
| REQ-WEB-002 | Authenticated Web UI | 已实现可配置 session、API tokens、Project-scoped API filtering、admin 用户目录创建和 login-audit listing |
| REQ-WEB-006 | 浏览器 UI 的工作区信息架构 | 已实现顶层导航、按区域显示的侧栏/详情、干净的工作区布局、保存的 Backlog 视图、列控制、批量编辑、Ready/Done signals、Story delivery queue controls，以及 Backlog、Plans、Runs、Evidence 和 Admin workbenches |
| REQ-FLOW-022 | Runs 的敏捷生命周期泳道覆盖 | 已在 workflow board API 和 Runs workspace 实现 |
| REQ-INTAKE-001 | 基于 Chat 的需求录入 | 已实现 sessions、messages、approval、clarifying questions 和结构化 follow-up |
| REQ-INTAKE-002 | 附件录入 | 已实现 PDF、Word、图片抽取，以及为图片和无文本 PDF 配置的托管 OCR |
| REQ-INTAKE-003 | AI 候选需求生成 | 已实现确定性抽取和 `mode: llm` 的已配置 live-model extractor；写入前仍需 approval |
| REQ-AUTH-001 | Web 登录和 Session 认证 | 已实现配置化 PBKDF2 用户、SQLite 用户目录、session cookies、API tokens、logout 和 login audit |
| REQ-AUDIT-001 | Audit log | 已实现 Board Store write events、Project 或 WorkItem v1 API reads、login auth events 以及 Admin browser visualization 的基础能力 |
| REQ-TRACE-001 | 从父项到子项的验收标准覆盖度 | 已支持 WorkItem 后代汇总 |
| REQ-DATA-001 | Database service | 本地部署已实现 SQLite；PostgreSQL 仍在计划中 |
| REQ-DATA-002 | 本地文件存储 | 已实现 workspace 文件系统上传，并由数据库保存 metadata |
| REQ-AUTH-002 | 密码凭据安全 | Argon2id 为首选，bcrypt/PBKDF2 为 fallback，并支持 rotation 和 disable |
| REQ-COLLAB-003 | 会话驱动的 Agent 任务管理 | 首个切片和 split/merge 任务类型、transfer 字段、runtime 拒绝、pending-approval gate，以及开发者可见的开放任务 |
| REQ-AGENT-005 | Agent 状态识别 | 已实现 workflow run snapshot、步骤识别、start 与 agent-run 拒绝、阻塞时的 Team Chat，以及 Test Lab 对 stale、冲突、缺失审批和缺失证据的模拟 |
| REQ-FLOW-006 | 可视化工作流设计器 | 已在独立开发者实验室页实现画布读写、校验、发布和归档 |
| REQ-FLOW-016 | 静态工作流可视化 | 已实现 stage/role 泳道、依赖图、大纲、图层开关、校验标记、版本 diff，以及 Markdown/DSL/SVG 导出 |
| REQ-FLOW-018 | 工作流测试回放可视化 | 已实现在设计器地图上的回放、帧 scrubbing 和可导出的发布证据 |
| REQ-FLOW-007 | Workflow Test Lab | 已实现 happy-path、missing-approval、resource-conflict、stale-state、missing-evidence 和 custom-node fixture 的 dry-run；timeout 和 retry 仍在计划中 |
| REQ-FLOW-008 | Workflow pack 一致性 | 已实现 pack 导入、版本化 conformance reports，以及通过报告后才能项目启用 |
| REQ-FLOW-009 | 自定义工作流事件目录 | 已实现带命名空间的自定义事件、schema 拒绝，以及禁止重定义 system events |
| REQ-FLOW-010 | 自定义计划和节点类型 | 已实现内置节点目录、一致性通过后的自定义节点，以及 Test Lab fixture 模拟 |
| REQ-FLOW-011 | 工作流扩展点 | 已实现声明的 extension points，带顺序启用和显式冲突错误 |
| REQ-FLOW-001 | 项目工作流模板 | 已实现内置 user-story、Scrum、Kanban、hotfix 和 research 模板及项目选择；Scrumban、compliance-heavy 和按条目覆盖仍在计划中 |
| REQ-METHOD-001 | 需求设计 method packs | 已实现 User Story 基线，以及可选的 Use Case、BDD、Example Mapping、Event Storming、DDD、API Design、ADR 和 Threat Modeling packs |
| REQ-METHOD-002 | 优先级 method packs | 已实现 MoSCoW、RICE、WSJF、Kano、risk-first、dependency-first 和 milestone-first 排序，带可解释分数和可审计覆盖 |
| REQ-AGENT-001 | 敏捷团队 Agent 注册表 | 已实现 UX、QA、security 及同类角色的 specialist agent definitions，支持项目启用、边界内定制、WorkItem 附件和审计 |
| REQ-SKILL-004 | 技术 Skill packs | 已实现可安装、带版本的 frontend、backend、database 及相关 packs，含扫描推荐、WorkItem 声明和按任务加载 |
| REQ-AUTH-003 | 区域化登录策略 | 已实现 cn/global/auto、按域名路由、手动切换区域，以及登录事件记录 region |
| REQ-AUTH-004 | OAuth 登录 Providers | 已实现 Google OIDC、GitHub OAuth 和微信 QR 的 start/callback/unlink，带 PKCE/state，identities 不写入看板记录 |

## 需求和看板管理

### REQ-REQ-001: 基于看板的需求编写

用户必须能直接在看板项上填写需求分析和需求设计。

验收标准：

- WorkItem 详情保存业务背景、问题陈述、分析说明、设计说明、约束、风险、假设、开放问题和验收标准。
- 看板详情视图允许用户在不离开看板流程的情况下编辑这些字段。
- 需求分析和设计更新可审计。
- 需求详情数据可通过内部 services 和 HTTP APIs 获取。

建议 APIs：

```text
GET   /api/requirements/:id
PATCH /api/requirements/:id
POST  /api/requirements/:id/decompose
GET   /api/requirements/:id/coverage
```

### REQ-BOARD-003: 版本化看板和需求 APIs

产品必须向外部调用方和 dsh integrations 暴露稳定 API。

验收标准：

- 提供项目、里程碑、WorkItems、需求详情、看板视图、树视图、覆盖度、录入、agents、skills、tools、SCM、CI、checks 和 audit logs 的版本化 HTTP APIs。
- 内部 services 仍然是 dsh plugins 的第一集成点。
- 每个 public endpoint 都文档化 request 和 response fields。
- 每个写 endpoint 都提供认证和授权行为。

实现状态：

- 版本化主看板 endpoints 当前暴露 Project 列表和创建、Project 主看板聚合、内置主看板视图、business CRUD coverage 读取、卡片摘要、Project Milestone board 读取、Project Team board 读取、Project Workflow board 读取、Project Evidence board 读取、Project delivery evidence rollups、Project team member 读写、Project capacity 读取、WorkItem assignment 写入、WorkItem workflow summary 读写、WorkItem delivery evidence 读写、WorkItem Code View 读取、WorkItem compliance/security/reliability/trust 读取、带 hierarchy warnings 的 Project 树读取、带 duplicate coverage warnings 的 Project 覆盖度读取、带 source input、decomposition reason 和 intake-origin source references 的 WorkItem 看板详情读取和更新、WorkItem Milestone plan 读取、WorkItem delivery slice 写入、Milestone delivery slice 读取、Milestone Code View 读取、Project unlinked-code 读取、带 intake-origin source indexes 的 WorkItem traceability 读取、Project intake session APIs，以及 Project 或 WorkItem audit event reads。
- Web auth 启用时，版本化看板 APIs 要求 session cookie、已签发 API token 或兼容的静态 Bearer token；按 Project 限制的用户只能看到或打开允许的 Projects。
- 版本化目录组为 `GET /api/v1/agents`、`GET /api/v1/skills`、`GET /api/v1/tools`、`GET /api/v1/scm/catalog` 和 `GET /api/v1/ci/catalog`。更完整的 check 写入覆盖仍在计划中。

建议 APIs：

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id/main-board
GET    /api/v1/projects/:id/main-board/views
GET    /api/v1/projects/:id/main-board/cards
GET    /api/v1/projects/:id/main-board/milestones
GET    /api/v1/projects/:id/main-board/tree
GET    /api/v1/projects/:id/main-board/coverage
GET    /api/v1/projects/:id/main-board/team
GET    /api/v1/projects/:id/main-board/workflow
GET    /api/v1/projects/:id/main-board/evidence
GET    /api/v1/projects/:id/delivery-evidence
GET    /api/v1/projects/:id/unlinked-code
GET    /api/v1/projects/:id/business-crud
GET    /api/v1/projects/:id/audit-events
GET    /api/v1/projects/:id/intake/sessions
POST   /api/v1/projects/:id/intake/sessions
GET    /api/v1/intake/sessions/:id
PATCH  /api/v1/intake/sessions/:id
POST   /api/v1/intake/sessions/:id/messages
POST   /api/v1/intake/sessions/:id/source-documents
POST   /api/v1/intake/sessions/:id/analyze
GET    /api/v1/intake/sessions/:id/candidates
POST   /api/v1/intake/sessions/:id/approve
PATCH  /api/v1/intake/candidates/:id
GET    /api/v1/work-items/:id/board-detail
PATCH  /api/v1/work-items/:id/board-detail
GET    /api/v1/work-items/:id/traceability
GET    /api/v1/work-items/:id/workflow
PATCH  /api/v1/work-items/:id/workflow
GET    /api/v1/work-items/:id/delivery-evidence
PATCH  /api/v1/work-items/:id/delivery-evidence
GET    /api/v1/work-items/:id/code-view
GET    /api/v1/work-items/:id/audit-events
GET    /api/v1/work-items/:id/compliance
GET    /api/v1/work-items/:id/security
GET    /api/v1/work-items/:id/reliability
GET    /api/v1/work-items/:id/trust
GET    /api/v1/work-items/:id/milestone-plan
POST   /api/v1/work-items/:id/milestone-slices
PATCH  /api/v1/work-items/:id/milestone-slices/:sliceId
GET    /api/v1/milestones/:id/requirement-slices
GET    /api/v1/milestones/:id/code-view
GET    /api/v1/projects/:id/board
GET    /api/v1/projects/:id/tree
GET    /api/v1/projects/:id/milestones
POST   /api/v1/projects/:id/milestones
GET    /api/v1/work-items/:id
PATCH  /api/v1/work-items/:id
POST   /api/v1/work-items/:id/children
POST   /api/v1/work-items/:id/status
GET    /api/v1/work-items/:id/evidence
```

### REQ-BOARD-004: 需求拆分可追踪

需求拆分必须可追踪，用户必须能看到一个大需求如何拆成子需求、拆了多少，以及是否完整覆盖父需求。

验收标准：

- 保存 Epic -> Feature -> Requirement/Story -> Task 的父子关系。
- 支持 Bug、Research 和讨论型条目作为子 WorkItem。
- 每个子项可以声明覆盖的父级验收标准。
- 父项状态从子项状态、覆盖度、阻塞和必需证据汇总。
- UI 和 API 能显示完整树、未覆盖验收项、重复覆盖和孤立子项。

实现状态：

- v1 Project 主看板响应包含 Tree board 读模型，返回嵌套卡片、根节点数、总数、最大层级和树告警。
- v1 Project 主看板响应包含 Coverage board 读模型，把每个父项验收标准映射到覆盖它的子 WorkItems、证据数量和未覆盖告警。
- 从 intake candidates 批准生成的 WorkItems 会在 board-detail 响应中暴露来源 intake session、candidate、source messages、source documents、chunks、confidence 和 preserved quotes；traceability 响应会返回树节点的 intake-origin indexes。
- WorkItems 会通过 Board Service、Requirement Management Service、v1 HTTP APIs、JSON schema migration、浏览器创建表单和 WorkItem detail editor 持久化 source input 和 decomposition reason 字段。Intake approval 会根据 candidate source references 和 candidate ancestry 填充这些字段。
- Coverage board rows、parent summaries 和 project coverage summaries 会在多个 descendants 覆盖同一 acceptance criterion 时标记 duplicate acceptance coverage。
- Tree 和 card 读模型会把 missing parents、通常需要父项却处在根级的 children、invalid parent types 和 cycles 标记为具体 hierarchy warnings。
- 浏览器 Backlog 工作台可以筛选 hierarchy 和 coverage warnings；WorkItem detail editor 可以在看板流程中更新 parent、priority 和 Milestone assignments。
- 浏览器 Backlog 工作台会把 WorkItems 分为 portfolio、product、execution 和 discovery 层级，列表行会从同一个 card 读模型显示 planning、definition readiness、traceability 和 next-action signals。
- 浏览器 Backlog 工作台包含 portfolio、Milestone 和 risk planning panels，因此拆分缺口、未计划工作和 Ready blockers 可以在需求工作区内完成评审。

### REQ-BOARD-005: 业务 CRUD 和生命周期覆盖

每个业务对象必须声明 Create、Read、Update、生命周期以及删除或归档策略，避免工作流依赖某个对象时才发现产品缺口。

验收标准：

- 系统暴露按项目归属的矩阵，覆盖所有业务域：Project、WorkItem、requirement hierarchy、Milestone、delivery slice、intake session、intake message、source document、intake candidate、team member、workflow summary、delivery evidence、governance/risk、audit event、auth session、API token、OAuth identity、SCM/CI/code view、Agent/Skill/Tool、Team Chat、collaboration tasks 和 workflow templates。
- 矩阵区分 implemented、partially implemented、planned、forbidden 和 not-applicable operations。
- Delete 不被当作必须存在的物理删除。受监管或可追踪 records 使用显式 lifecycle actions，例如 reject、stop、cancel、void、revoke、retire、redact、archive、restore、waive、sign 或 supersede。
- 每一行标明 existing APIs、missing APIs、business owner、受治理 record 和 recommended next implementation slice。
- Admin users 可以在浏览器中评审 CRUD coverage，不需要检查代码或 issue trackers。

实现状态：

- `/api/v1/projects/:id/business-crud` 返回按项目归属的 CRUD coverage matrix，包含 entity rows、operation status、endpoint references、delete policy、gaps 和 recommended next slices。
- Admin workspace 包含 Business CRUD view，显示 summary metrics、per-entity operation chips、lifecycle policy text 和 gap list。
- 当前矩阵显示 Project update/archive、版本化 WorkItem create/status/archive、Agent/Skill/Tool catalogs、SCM/CI catalogs 以及 Team Chat decisions/approvals/split/merge 为可用。Source document retention、OAuth binding 和其余后续目录类型仍在计划中。

建议 APIs：

```text
GET /api/v1/projects/:id/business-crud
PATCH /api/v1/projects/:id
POST /api/v1/projects/:id/archive
POST /api/v1/projects/:id/restore
POST /api/v1/work-items
POST /api/v1/work-items/:id/status
POST /api/v1/work-items/:id/archive
POST /api/v1/work-items/:id/restore
POST /api/v1/work-items/:id/milestone-slices/:sliceId/void
POST /api/v1/intake/sessions/:id/archive
POST /api/v1/intake/messages/:id/redact
POST /api/v1/intake/source-documents/:id/reparse
POST /api/v1/intake/source-documents/:id/redact
GET /api/v1/agents
GET /api/v1/skills
GET /api/v1/tools
GET /api/v1/team/conversations
GET /api/v1/workflow-templates
```

### REQ-MILESTONE-002: 跨里程碑需求交付

一个大型需求必须可以跨多个 Milestone 交付。

验收标准：

- 父需求可以拆分为多个 delivery slices。
- 每个 slice 绑定自己的 Milestone、scope、acceptance criteria、owner、状态和 evidence。
- 父项跨所有 slices 汇总进度和风险。
- 未完成的必需 slice 会阻止父项进入 delivered。
- 看板能按 Milestone、父需求、slice 和状态查看同一批工作。

实现状态：

- JSON Board Store 在父 WorkItem 所属 Project 内持久化 `MilestoneDeliverySlice` 记录。
- v1 API 可以创建和更新 delivery slices，读取父 WorkItem Milestone plan，读取单个 Milestone 的 requirement slices，并读取包含 WorkItem cards 和 slice cards 的 Project Milestone board 泳道。
- 浏览器 Plans 工作区显示 Milestone roadmap workbench，包含 KPI summaries、Milestone timeline、scope matrix、delivery slice queue、planning blocker queue 和折叠的 lane reference。
- Delivery Slice 视图显示专门的 cross-Milestone slice workbench，包含 parent requirement grouping、slice status、Milestone coverage、acceptance scope、evidence counts、blockers 和 parent navigation。
- 存在未完成 delivery slices 的父 WorkItem 不能流转到 `delivered`。
- 子 WorkItem 在 Milestone 之间移动时，会在父项上写入 `parent_plan.updated`，审计 reason 包含 child id 以及旧/新 Milestone。

## 存储和持久化

### REQ-DATA-001: Database Service

HuntianLing 必须支持真实数据库层保存生产数据，同时保留轻量本地部署。

验收标准：

- 本地、单用户、私有部署支持 SQLite。
- 团队和外部用户部署支持 PostgreSQL。
- 暴露统一内部 `huntianling.database` service，上层不依赖具体 driver。
- 提供 schema migrations 和 version tracking。
- 把当前 JSON board data 迁移到数据库表。
- 大文件内容存储在数据库外部；数据库保存 metadata、hashes、extracted text status 和 references。

主要 entities：

- `users`
- `auth_sessions`
- `projects`
- `project_memberships`
- `compliance_obligations`
- `compliance_control_packs`
- `compliance_controls`
- `compliance_mappings`
- `control_evidence`
- `risk_register_entries`
- `reliability_slos`
- `incident_records`
- `ai_risk_assessments`
- `ai_evaluation_runs`
- `trust_attestations`
- `team_conversations`
- `team_messages`
- `team_message_links`
- `team_members`
- `team_member_roles`
- `team_member_availability`
- `team_capacity_allocations`
- `team_wip_policies`
- `team_work_assignments`
- `team_resource_leases`
- `workflow_templates`
- `workflow_stages`
- `workflow_transitions`
- `workflow_runs`
- `workflow_run_steps`
- `workflow_plan_schedules`
- `workflow_step_queue_items`
- `workflow_scheduler_decisions`
- `workflow_state_snapshots`
- `workflow_state_transition_rules`
- `workflow_state_transitions`
- `workflow_handoff_requests`
- `workflow_handoff_acceptances`
- `workflow_role_event_policies`
- `workflow_event_role_bindings`
- `workflow_review_requests`
- `workflow_review_decisions`
- `workflow_approval_decisions`
- `story_priority_queues`
- `story_priority_queue_items`
- `story_delivery_runs`
- `story_delivery_checkpoints`
- `workflow_visual_views`
- `workflow_visual_exports`
- `workflow_runtime_trace_events`
- `workflow_runtime_timelines`
- `workflow_test_replay_frames`
- `workflow_gate_results`
- `workflow_automation_rules`
- `workflow_handoffs`
- `workflow_canvas_versions`
- `workflow_test_cases`
- `workflow_test_runs`
- `workflow_test_assertions`
- `workflow_simulation_fixtures`
- `workflow_publication_reviews`
- `workflow_conformance_results`
- `workflow_event_types`
- `workflow_plan_node_types`
- `workflow_extension_points`
- `workflow_extension_packages`
- `workflow_builtin_capabilities`
- `workflow_template_selections`
- `workflow_template_replacements`
- `workflow_agent_bindings`
- `workflow_skill_bindings`
- `harness_workflow_actions`
- `approval_requests`
- `agent_collaboration_tasks`
- `agent_collaboration_task_events`
- `agent_collaboration_task_dependencies`
- `human_agent_participants`
- `milestones`
- `work_item_milestone_slices`
- `work_items`
- `work_item_links`
- `acceptance_criteria`
- `work_item_acceptance_coverage`
- `scm_repositories`
- `scm_branches`
- `scm_changesets`
- `scm_pull_requests`
- `code_view_snapshots`
- `agent_capability_profiles`
- `agent_state_recognition_results`
- `audit_events`

实现状态：

- `huntianling.database` 是内部持久化 service。本地部署通过 `node:sqlite` 使用 SQLite；PostgreSQL 仍在计划中，选中时会失败退出。
- Schema migrations 记录在 `schema_migrations` 中，版本单调递增。
- 打开 workspace 时，若数据库还没有 board document，会把 `.huntianling/board.json` 导入 SQLite 表。之后的读写以 SQLite 为 source of truth。
- 当前 board collections 持久化为 projects、work items、milestones、team members、delivery slices、workflow summaries、delivery evidence、intake records、audit events、acceptance criteria、coverage 和 links 表。
- 大文件字节存储在数据库外部。文件 metadata、hashes、extracted-text status 和 storage-path references 保存在 `stored_files`。

### REQ-DATA-002: 本地文件存储

HuntianLing 必须把本地文件系统作为基线文件后端。

验收标准：

- 上传文件存储在可配置 workspace storage root 下。
- 数据库保存原始文件名、MIME type、size、sha256、uploader、project 和 storage path。
- 拒绝超过配置 size 或 type limits 的文件。
- 存储接口可替换，以便未来接 S3-compatible storage，但 baseline 不要求 MinIO。

实现状态：

- 上传文件存储在可配置 workspace storage root 下（默认 `.huntianling/files`）。
- 数据库记录原始文件名、MIME type、size、sha256、uploader、project、storage path、extracted-text status 和 extracted-text path。
- 超过配置 `maxUploadBytes` 或 `allowedMimeTypes` 的上传会被拒绝。
- `FileStorageBackend` 是可替换的本地文件系统接口；baseline 不要求 S3-compatible storage 或 MinIO。
- `POST/GET /api/v1/projects/:id/files` 以及 `GET /api/v1/files/:id` 和 `/content` 暴露同一批记录。

## 认证和访问

### REQ-AUTH-001: Web 登录和 Session 认证

Web UI 和 HTTP APIs 必须支持认证访问。

验收标准：

- 支持 login、logout、current-session lookup 和 session expiration。
- 每个 session principal 包含人群 `customer`、`developer` 或 `admin`（`REQ-WEB-007`）。
- 支持 project-level authorization。
- 记录 login events 和安全相关 audit events。
- 支持外部调用方使用 API tokens。
- 当 Web 访问公开时，browser writes 必须认证。

建议 APIs：

```text
POST /api/auth/password/login
POST /api/auth/logout
GET  /api/auth/session
POST /api/auth/api-tokens
GET  /api/auth/api-tokens
DELETE /api/auth/api-tokens/:id
```

实现状态：

- Web Service 可以通过 `web.auth.enabled` 启用 process-local auth。
- 密码登录会校验配置的 PBKDF2-SHA256 password hashes，并签发带过期时间的 `HttpOnly` session cookies。
- `/api/auth/session`、`/api/auth/password/login`、`/api/auth/logout`、`/api/auth/api-tokens` 和 `/api/auth/providers` 已实现。
- API tokens 只生成一次，以 hash 保存，列表不返回 raw secrets，并可作为 Bearer tokens 供外部调用方使用。
- Project authorization 会过滤 Project 列表，并拒绝无权访问的 Project、WorkItem 和 Milestone routes。
- `POST /api/v1/admin/users` 把用户目录持久化到 SQLite `auth_users`，并与配置化 Web 用户并存。Login、failed login、logout 和 API-token 创建写入 `auth_events`。OAuth login flows 和细粒度角色权限仍在计划中。

### REQ-AUTH-002: 密码凭据安全

密码凭据必须使用安全哈希。

验收标准：

- Argon2id 是首选算法。
- 可配置 bcrypt 或 PBKDF2 作为 fallback algorithms。
- 只存储 salted password hashes 和 algorithm parameters。
- 提供 password rotation 和 credential disable flows。
- 不记录 passwords、OAuth secrets、API tokens 或 raw session secrets。

实现状态：

- 新密码哈希优先使用 `node:crypto.argon2Sync` 的 Argon2id，并支持可配置的 bcrypt 和 PBKDF2-SHA256 fallback。存储记录只保留 salt 和 algorithm parameters。
- `POST /api/auth/password/rotate` 会替换已存储 hash。`POST /api/v1/admin/users/:username/credential` 启用或停用凭据；停用后无法登录。
- 存在 `huntianling.database` 时，凭据记录持久化到 SQLite `credentials`。API 响应不返回 password hashes。已有 PBKDF2 hashes 仍可校验。
- OAuth secrets 不写入日志；login 和 rotation 的错误信息不包含提交的密码。

### REQ-AUTH-003: 区域化登录策略

登录页必须区分国内和国际访问模式，不能只依赖 IP 检测。

验收标准：

- 支持 `cn`、`global` 和 `auto` region modes。
- 每个 region 可配置不同 provider list。
- 支持 `board.example.cn` 和 `board.example.com` 这类 domain-based routing。
- 路由不明确时允许用户手动切换登录区域。
- 登录事件记录使用的 region。

实现状态：

- Web auth API 和登录面板支持 `cn`、`global` 和 `auto` region selection。
- China 和 global access modes 可以配置不同 region-specific provider lists。
- Domain-based routing 会通过配置的 hosts 和常见域名后缀推断 `cn` 与 `global`。
- Password 和 OAuth login audit events 会记录所选 region；存在 `huntianling.database` 时通过 SQLite 持久化。fused `/board` cockpit 未改。

### REQ-AUTH-004: OAuth 登录 Providers

HuntianLing 必须支持 Google、GitHub 和微信三方登录。

验收标准：

- Google 支持 OAuth/OIDC authorization code flow。
- GitHub 支持 OAuth App web flow。
- 微信在配置后支持 WeChat Open Platform 网站二维码登录。
- provider identities 与 users 分开存储，一个 user 可绑定多个 providers。
- 使用 state validation，并在 provider 支持时使用 PKCE。
- 存储 provider subject ids、可选 WeChat unionid、email/profile metadata 和 binding status。

建议 APIs：

```text
GET /api/auth/providers?region=cn|global
GET /api/auth/oauth/:provider/start
GET /api/auth/oauth/:provider/callback
POST /api/auth/oauth/:provider/unlink
```

实现状态：

- Provider discovery 已支持区域登录列表，默认 provider ids 包含 Google、GitHub 和 WeChat。
- OAuth/OIDC start 会跳转到配置的 provider，记录 state，并在 provider 支持时使用 PKCE。
- OAuth/OIDC callback 会校验 state，调用配置的 exchange adapter，把 provider identities 与 users 分开绑定；未找到映射用户时可根据 provider email 创建 developer user。
- `POST /api/auth/oauth/:provider/unlink` 会移除当前用户绑定并记录 auth audit event。
- 存在 `huntianling.database` 时，provider identities 和临时 OAuth states 会持久化到 SQLite。
- Provider secrets 保留在 auth configuration 或调用时 exchange dependencies 中；public API responses 和 board records 不暴露 secrets。Client secrets 留在 config/env，不写入看板快照。独立登录页会列出已启用的 providers。

## 录入和需求分析

### REQ-INTAKE-001: Chat-Based Requirement Intake

HuntianLing 必须允许用户通过 chat-style intake session 提交 ideas。该流程的产品语言是 MKT（`REQ-MKT-001`）。intake 会话就是 MKT 的收集记录。

验收标准：

- 支持 project-scoped intake sessions。
- 支持文本消息、澄清问题和结构化补充回答。
- 原始用户输入与已确认需求分开保存。
- 记录 submitter、timestamps、source channel 和 analysis status。
- AI 生成 candidate requirements 后，用户批准才变成 WorkItems。

建议 APIs：

```text
GET    /api/v1/projects/:id/intake/sessions
POST   /api/v1/projects/:id/intake/sessions
GET    /api/v1/intake/sessions/:id
PATCH  /api/v1/intake/sessions/:id
POST   /api/v1/intake/sessions/:id/messages
POST   /api/v1/intake/sessions/:id/source-documents
POST   /api/v1/intake/sessions/:id/analyze
GET    /api/v1/intake/sessions/:id/candidates
POST   /api/v1/intake/sessions/:id/approve
```

实现状态：

- Board Service 持久化 Project-scoped intake sessions、messages、source document links、candidate ids、submitter、timestamps、source channel、status 和 analysis status。
- v1 Web API 支持创建和读取 intake sessions、追加 messages、运行 analysis、列出 candidates，编辑 candidate title、body、analysis、design、acceptance、open questions、status 和 Milestone，以及把 selected draft candidates 批准为正式 WorkItems；剩余 draft candidates 会继续保留供后续评审。
- 缺少的 MKT 字段会生成 `clarifying-question` 消息。`POST /api/v1/intake/sessions/:id/follow-ups` 记录结构化回答。original-requirement 草稿在客户确认前保持 untracked。含技术方案的回答会被拒绝。默认 live-model extractor 仍在计划中。

### REQ-INTAKE-002: Attachment Intake

用户必须能上传图片和文档作为需求材料。

支持输入：

- 图片文件
- Word documents
- PDF files
- Markdown files
- Plain text files

验收标准：

- 每个 upload 作为 source document 保存。
- 尽可能提取文本。
- 图片支持 OCR 或 image understanding。
- 保存 parse status、parse errors 和 extracted chunks。
- 每个 candidate requirement 回链到 source document chunks 或 image references。

实现状态：

- Board Service 持久化 source documents，包含 kind、name、MIME type、size、parse status、parse error、extracted text 和 extracted chunks。
- 浏览器 intake workspace 接受 image、Word、PDF、Markdown 和 plain-text files。Markdown 和 plain-text files 会在浏览器中读取为 extracted text。
- Candidate review 显示 source references，包含 message 或 source document labels、可用的 chunk positions、confidence 和保留的 quote。
- PDF 和 Word 字节会抽取成 parse status、errors 和 chunks。图片在提供 understanding 或已配置托管 OCR 时抽取文本；否则保持 pending 并记录 parse error。无文本 PDF 会回退到托管 OCR。SVG 文本无需 OCR 即可抽取。通用文件仍为 unsupported。令牌在调用时或从环境提供，不会被持久化。

### REQ-INTAKE-003: AI Requirement Candidate Generation

AI 分析必须把 raw ideas 和 source documents 转成 candidate requirements，而不是直接写成 committed WorkItems。

验收标准：

- 提取 business goals、actors、scenarios、constraints、risks、assumptions、open questions 和 acceptance criteria。
- 生成候选 Epic、Feature、Requirement/Story、Task、Bug 和 Research nodes。
- 尽可能为每个 candidate node 保留 source references。
- 标记 confidence 和 open questions。
- 写入 WorkItems 前必须要求 human approval。

实现状态：

- 确定性分析从带标签的来源文本抽取 goals、actors、scenarios、constraints、risks、assumptions、open questions 和 acceptance，并在材料提到缺陷时追加 Bug candidate。
- `POST /api/v1/intake/sessions/:id/analyze` 在 `mode: llm` 时使用 intake 配置或环境中的 live-model extractor，测试中也可注入 extractor；未配置时失败而不是静默写入。LLM 结果可包含 Bug nodes。写入 WorkItems 前仍需 human approval。
- 托管模型集群不是产品。

## MKT 收集

### REQ-MKT-001: MKT 收集角色

状态：规划中。

MKT 是需求收集角色。人或 Agent 都可以执行。只有输入、Skill、工具、输出和传感器保持不变时，替换才算等价。

验收标准：

- 输入是客户对话和附件。原始客户语言与已确认的原始需求分开保存。
- 输出是看板上的原始需求记录，带上来源原话，以及已有的目标、角色、场景、约束、非目标和未决问题字段。
- MKT 不冻结技术方案、不拆实现 Task、不改代码、不宣布验收。那些属于 Planner、Generator 和 Evaluator。
- 客户能立刻看到自己的原话。只有经过配置的确认路径后，记录才成为跟踪中的原始需求：客户确认、开发提升，或两者都要。
- 缺少必填项时，问题回到客户的 MKT 对话框。产品歧义留在 MKT。
- 每次运行记录执行者为人工、外部 Agent 或 HuntianLing 运行时 MKT，并记录 Skill id、Skill 版本和深度档。
- 测试证明人执行的 MKT 与 Agent 执行的 MKT 在使用同一组 Skill、工具和传感器时，写出同类记录。

实现状态：

- 缺少 goal、actors、scenarios 或 confirm 时，澄清问题回到客户 MKT 对话框。结构化 follow-up 填写 original-requirement 草稿。确认后带 source quotes 跟踪；确认前保持 untracked。Agent Channel 的 `customer.question_needed` 出现在该对话框。客户不必进入开发界面即可回答。

关联需求：`REQ-INTAKE-001`、`REQ-INTAKE-002`、`REQ-INTAKE-003`、`REQ-MKT-002`、`REQ-SKILL-005`、`REQ-SKILL-006`、`REQ-WEB-007`。

### REQ-MKT-002: MKT Skill 包

状态：规划中。

第一包 MKT Skill 提供收集角色所需能力。它不是 Product Owner、Business Analyst 或营销目录。

验收标准：

- 该包包含追问与澄清、区分愿望与可跟踪需求、抽出原始需求字段、保留原话、确认后才跟踪，以及把产品问题送回客户对话框的 Skill。
- 包中每个 Skill 声明能力边界和深度配置（`REQ-SKILL-005`、`REQ-SKILL-006`）。
- 该包带有输出 schema、校验器和通过/失败示例。原始需求的写入走工具。
- 未测评或弱模型默认使用深度 1（按 schema 填写、工具校验、人确认）。无模型运行时仍可使用深度 0。
- 缺少包内 Skill 时记可见缺口，并阻止 MKT 声称收集已完成。
- 测试在深度 0 和深度 1 运行该包，拒绝缺少来源原话的写入，并拒绝包含技术方案字段的写入。

实现状态：

- Host Skill 服务已内置 MKT 收集包、带版本的注册表和 `original-requirement.write` 工具。深度 0 和 1 已校准；缺少包内 Skill 时不能声称收集完成。

关联需求：`REQ-MKT-001`、`REQ-SKILL-001`、`REQ-SKILL-002`、`REQ-SKILL-005`、`REQ-SKILL-006`、`REQ-TOOL-001`。

## 需求设计和优先级

### REQ-METHOD-001: 需求设计 Method Packs

方法包必须按 `REQ-HARNESS-007` 在标准三 Agent 环境中可执行，内置默认组合首次使用即可用。首个产品里程碑交付该基线，其余方法包作为后续项目选项。

HuntianLing 必须支持多种需求设计方法论。

必需 method packs：

- User Story
- Use Case
- BDD / Gherkin
- Example Mapping
- Event Storming
- Domain-Driven Design
- API Design
- ADR
- Threat Modeling

验收标准：

- Project configuration 选择启用的 method packs。
- WorkItem 记录由哪个 method pack 产生或改进。
- Agent tasks 可以要求 method-specific skills 和 output schemas。
- 缺失 method skills 时报告为 skill gaps。

实现状态：

- 方法目录包含 User Story，以及 Use Case、BDD、Example Mapping、Event Storming、DDD、API Design、ADR 和 Threat Modeling。新项目只启用 User Story；其余 packs 在选中前保持禁用。
- 启用一个 pack 后，planner run 会产出该方法的输出字段。WorkItem 记录产生它的 method pack。缺失或禁用的 method skills 会作为 skill gaps 报告并阻止 planner run。客户不能启用 method packs。fused `/board` cockpit 未改。

### REQ-METHOD-002: 优先级 Method Packs

HuntianLing 必须支持多种排序方式。

必需 method packs：

- MoSCoW
- RICE
- WSJF
- Kano
- Risk-first
- Dependency-first
- Milestone-first

验收标准：

- Project configuration 选择 prioritization method。
- WorkItems 保存所选方法需要的 inputs。
- ranking output 可以解释，并可追踪到 inputs。
- 排序后的 Story output 输入 workflow scheduling 使用的 Story priority queue。
- 用户可以用 audit reason override ranking。

实现状态：

- 浏览器 Backlog 工作台会显示 WorkItem priority，可以按 rank、priority、status、Milestone 或 type 排序，并显示 Board Service 生成的 Story priority queue。
- 浏览器 Backlog 工作台可以按 business Backlog level 和 lifecycle status 筛选，因此 Story priority queue 可以和对应的 portfolio、product、execution 以及 risk context 一起评审。
- 用户可以保存按 Project 归属的 Backlog views，包含 filters 和 visible columns，并通过现有 WorkItem APIs 批量更新所选可见 WorkItems 的 priority、Milestone 或 lifecycle status。
- Backlog decision panel 会把当前确定性的 Story queue order 解释为 Priority、due date 和 WorkItem order，并显示 Board Service queue 返回的 visible skip reasons。
- Project configuration 可选择 MoSCoW、RICE、WSJF、Kano、risk-first、dependency-first 或 milestone-first。WorkItems 保存 ranking inputs。Story priority queue 使用该排序，带解释和可审计覆盖。客户不能选择 pack。fused `/board` cockpit 未改。

## 敏捷 AI 团队

### REQ-AGENT-001: Agile Team Agent Registry

HuntianLing 必须定义完整的敏捷 AI 团队模型。

必需的内置可执行编码 Agent 是 Planner、Generator 和 Evaluator（`REQ-HARNESS-006`）。MKT 是内置收集角色（`REQ-MKT-001`）；列出它本身不等于实现 Agent。后续 MKT Agent 只有使用 MKT 的 Skill、工具和传感器时才算等价。以下专业角色为这些 Agent 或后续专业扩展提供职责与 Skill 配置；列出角色不等于实现 Agent。

专业角色配置：

- MKT
- Product Owner
- Business Analyst
- UX Designer
- Architect / Tech Lead
- Frontend Developer
- Backend Developer
- QA Engineer
- DevOps / Release Engineer
- Security Reviewer
- Scrum Master
- Technical Writer

验收标准：

- 保存 role、responsibilities、allowed task types、allowed tools、required skills 和 output expectations。
- Agents 按项目归属，并可在每个项目启用、停用或定制。
- Agent runs 把 outputs 和 feedback 附加到 WorkItems。
- Agent actions 可审计。

实现状态：

- Agent 目录保留 Planner、Generator 和 Evaluator 作为编码基线，并增加 Product Owner、Business Analyst、UX Designer、Architect、Frontend Developer、Backend Developer、QA Engineer、DevOps、Security Reviewer、Scrum Master 和 Technical Writer 的 specialist definitions。每条定义保存 role、responsibilities、allowed task types、allowed tools、required skills 和 output expectations。
- 新项目只启用三个编码 Agent。Specialists 可按项目启用、停用，或在内置 tool 和 skill 边界内定制。specialist run 会把 output 附加到 WorkItem 并写入审计事件。客户不能启用 specialist agents。技术 Skill packs 和 fused `/board` cockpit 未改。

### REQ-AGENT-002: Agent Task Runtime

Agent 工作必须通过明确 task specifications 运行。

验收标准：

- 定义 task type、required role、required skills、required tools、input schema、output schema、checks、depth level 和 feedback channels。
- 只加载任务需要、且符合各 Skill 能力边界的 skills 和 tools。
- 按当前模型与任务的校准结果或项目策略选择 Skill 深度；未测评模型使用声明的默认值（MKT 默认为深度 1）。
- 缺少必需 input、permissions 或 skills，或输出违反 Skill schema 时阻塞任务。
- 传感器反复失败时降档或停止，不对同一提示词无界重试。
- 保存 task run status、result、tool evidence、Skill version、depth level、errors 和 next-step recommendations。

实现状态：

- Agent runs 保存 task type、skills、tools、depth 和 feedback。深度从已校准 Skill 深度或声明默认值中选择。反复无效输出会降档或停止。

### REQ-AGENT-003: Agile Feedback Surface

看板必须在上下文中显示 AI 团队反馈。

验收标准：

- WorkItem 详情显示 agent feedback、open questions、decisions、blockers、missing evidence 和 suggested next actions。
- feedback 链接到 producing agent run 和 skill version。
- 用户可以 accept、reject 或 request revision。
- 被拒绝反馈保留审计记录，但不更新 WorkItem。

实现状态：

- 评价 WorkItem 会把 Agent 反馈写到所属记录，包含 open questions、decisions、blockers、missing evidence、next actions、producing run id 和 skill versions。
- 开发者可在 WorkItem 详情和进度详情中 accept、reject 或 request revision。Accept 可以更新 analysis、design 和 acceptance。Reject 写入 `agent_feedback.rejected`，不更新 WorkItem。客户不能调度工作或决定 Agent 反馈。

### REQ-AGENT-004: Agent Capability Boundaries

每个 agent role 必须先定义明确 capability limits，才可以在项目上工作。

验收标准：

- 保存每个 role 允许的 WorkItem types、project scopes、repository scopes、file scopes、tools、write permissions、approval requirements 和 forbidden actions。
- 区分 read-only analysis、editable draft output、code modification、Git commit、branch push、CI trigger、review approval 和 merge permissions。
- 当 role、task spec、project policy 或 human approval 不允许时阻止 agent action。
- push branches、open pull requests、change protected files、trigger production deployments 或 merge 等高风险动作要求 human approval。
- 每个 blocked action、approval request、approval result 和 policy reason 都写入 audit log。
- 在任务开始前，在 WorkItem、Agent 和 Team Chat views 中显示 capability boundaries。

实现状态：

- `huntianling.authority` 保存每个 role 允许的 WorkItem types、tools、write permissions、需审批动作和 forbidden actions。read、draft、code change、commit、push、pull request、local CI、production CI、review approval 和 merge 是分开的权限。
- Planner 不能 push 或打开 pull request。Generator 的 push、pull request、受保护文件写入和 merge 需要另一人授予的 human approval。Evaluator 可以跑 local CI；production CI 需要审批。
- 被拒绝的动作以及审批请求/结果会写入项目 audit log。开发界面进度详情在任务开始前显示 capability boundaries。托管 GitHub、Gitea 和 GitLab 的 pull-request 写入适配器使用与本地 Git 相同的 C1 审批门。

### REQ-AGENT-005: Agent State Recognition

Agent 行动前必须识别当前 workflow 和 delivery state。

验收标准：

- 从 WorkItem status、workflow run status、workflow step status、collaboration task status、Team Chat context、Milestone、approvals、gates、resource leases、branch state、CI state、evidence state 和 open blockers 构建 state snapshot。
- 每个 executable agent step 都必须识别 allowed actions、blocked actions、required inputs、missing approvals、missing skills、unavailable tools、held resources 和 next safe action。
- 当 state snapshot stale、incomplete、contradictory 或 outside capability boundary 时，阻止 agent 执行。
- Agent 可以请求缺失信息或 human approval，而不是猜测下一状态流转。
- state recognition results 保存到 workflow step，并在状态阻塞或改变 planned action 时发出可见 Agent Team Chat event。
- Workflow Test Lab 可以模拟 stale state、conflicting state、missing approval、missing evidence 和 resource conflict。

建议 APIs：

```text
GET  /api/v1/workflow-runs/:id/state
POST /api/v1/workflow-runs/:id/steps/:stepId/recognize-state
GET  /api/v1/agent-runs/:id/state-recognition
```

实现状态：

- `GET /api/v1/workflow-runs/:id/state` 返回 WorkItem status、workflow run 和 step status、collaboration task status、Team Chat 消息数、Milestone、pending approvals、resource leases、branch owners、CI status、evidence readiness 和 open blockers。
- `POST /api/v1/workflow-runs/:id/steps/:stepId/recognize-state` 把 allowed/blocked actions、required inputs、missing approvals、missing skills、unavailable tools、held resources 和 next safe action 记到步骤上。Start 拒绝 stale、incomplete、contradictory 或越界识别。缺失审批命名 `request-approval`；他人独占 lease 会发 Team Chat 事件。
- `GET /api/v1/agent-runs/:id/state-recognition` 返回 Agent run 上保存的识别结果。`startRun` 拒绝被阻塞的识别。
- Workflow Test Lab 把 stale、冲突、缺失审批、缺失证据和资源冲突的 dry-run 作为发布证据。

## 团队成员和并发工作

HuntianLing 必须把项目团队作为 humans 和 agents 的混合体管理。Agent definitions 描述角色和能力；team membership 描述项目中谁可用、有多少容量，以及可承担哪些并发工作。

### REQ-TEAM-001: Project Team Member Management

每个 Project 必须有明确 team roster。

验收标准：

- team members 可为 humans、agents、service accounts 或 external reviewers。
- 保存 display name、member type、status、roles、permissions、capability profile、skill profile、region、timezone 和 project membership。
- 支持项目级角色分配，同一个 human 或 agent 可在不同 Projects 拥有不同 roles。
- 成员可为 active、inactive、suspended、unavailable 或 observer-only。
- WorkItems 和 Milestones 显示 current assignee、reviewers、approvers、watchers 和 collaboration participants。
- membership changes 写入 audit log。

建议 APIs：

```text
GET  /api/v1/projects/:id/team/members
POST /api/v1/projects/:id/team/members
PATCH /api/v1/team/members/:id
POST /api/v1/team/members/:id/roles
DELETE /api/v1/team/members/:id/roles/:roleId
```

当前实现基线：

- Board Store 持久化 Project team members，包含 member type、status、role ids、permissions、capability profile、skill profile、region、timezone、capacity units 和 concurrent WorkItem limit。
- Web API 已实现 `GET /api/v1/projects/:id/team/members`、`POST /api/v1/projects/:id/team/members` 和 `PATCH /api/v1/team/members/:id`。
- 浏览器侧边栏可以创建 team members，并显示 Project roster status、roles、assigned work、blocked work、WIP 和 member warnings。
- Project-scoped `claimedRole` board views 会为每个 Project role 预置一条泳道并追加未认领泳道，显示角色名称，并支持按 claimed role id 过滤卡片。
- `POST /api/v1/team/members/:id/roles` 和 `DELETE /api/v1/team/members/:id/roles/:roleId` 会增删项目角色并写入 audit events。WorkItems 保存来自项目 roster 的 reviewers、approvers 和 watchers。成员创建、角色和参与者变更会被审计。

### REQ-TEAM-002: Capacity, Availability, and WIP Limits

系统必须知道每个 team member 可以安全承担多少并发工作。

验收标准：

- 保存 member availability、working region、timezone、planned absence、capacity units 和 concurrent task limit。
- 支持 role-level 和 member-level WIP limits，用于 WorkItems、collaboration tasks、code changes、reviews 和 CI-sensitive tasks。
- human 和 agent 可使用不同 capacity policies。
- 计算 agent capacity 时包含 model、tool、repository、CI 和 environment limits。
- 当 member、role、project、repository 或 shared resource 超出 WIP limit 时阻止新分配。
- team view 显示 available capacity、assigned work、blocked work 和 overload warnings。

建议 APIs：

```text
GET  /api/v1/projects/:id/team/capacity
PATCH /api/v1/team/members/:id/availability
PATCH /api/v1/projects/:id/team/wip-policies
```

当前实现基线：

- Member availability 由 team member status 表示；capacity units、region、timezone 和 member-level concurrent WorkItem limits 已持久化。
- `GET /api/v1/projects/:id/team/capacity` 返回 active members、assigned WorkItems、unassigned WorkItems、blocked assigned WorkItems、unavailable members、overloaded members 和 warnings。
- `PATCH /api/v1/team/members/:id/availability` 更新与通用 member update endpoint 相同的 member status、capacity、region、timezone 和 profile 字段。
- 手动分配会阻止 inactive、unavailable、suspended 或 observer-only members，拒绝错误 Project membership，拒绝成员不具备的 roles，并在达到 member-level WIP limit 后阻止分配。
- `PATCH /api/v1/projects/:id/team/wip-policies` 保存 role、repository、CI、environment、member-type 和 collaboration-task 限额。匹配策略达到上限时阻止分配。human 和 agent 可以使用不同的 member-type 限额。Team capacity warnings 包含这些策略代码。model/tool-aware capacity accounting 仍在规划中。

### REQ-TEAM-003: Concurrent Work Dispatch

并发工作必须通过 dispatch policy 分配，而不是随意启动 agent。

验收标准：

- Dispatch 评估 priority、Milestone、dependencies、blocked status、required role、required skills、required tools、capacity、WIP limits、branch ownership 和 approval requirements。
- 支持 manual assignment、automatic recommendation 和 policy-approved automatic dispatch。
- 防止两个成员在不知情情况下处理同一个 exclusive task。
- 当 task policy 允许 multiple participants 时，支持 pair work 或 review work。
- work blocked、declined、cancelled 或 transferred 后重新平衡 assignments。
- assignment、claim、release、transfer 和 reassignment events 写入 Team Chat 和 audit log。

建议 APIs：

```text
POST /api/v1/work-items/:id/assignments
POST /api/v1/work-items/:id/claim
POST /api/v1/work-items/:id/release
POST /api/v1/team/dispatch/recommend
POST /api/v1/team/dispatch/run
```

当前实现基线：

- `POST /api/v1/work-items/:id/assignments` 通过 Board Service 执行 manual assignment，并校验 Project membership、role、active status 和 member WIP rules。
- 当 assignee 是 Project team member 时，主看板卡片和 Team board 会按 display name 显示 assigned owner。
- `huntianling.dispatch` 按可用 WIP slots、role、skills 和 blocked status 给合格成员排序。`POST /api/v1/team/dispatch/recommend` 和 `POST /api/v1/team/dispatch/run` 把 exclusive work 分配给一名成员，并写入 audit event 和 Agent Channel note。
- `POST /api/v1/work-items/:id/claim` 和 `POST /api/v1/work-items/:id/release` 取得或释放 exclusive WorkItem lease。lease 持有期间第二名成员不能 claim。shared read leases 允许 pair 或 review 参与者。
- `POST /api/v1/projects/:id/dispatch/rebalance` 在工作 blocked 或 cancelled 时释放 leases 和 assignees。
- Dispatch recommendation 会给 branch ownership 和 pending approvers 计分。`POST /api/v1/work-items/:id/transfer` 转移 exclusive work，并写入 `work_item.transferred` 而不是新的 assignment event。Token-cost capacity accounting 仍在规划中。

### REQ-TEAM-004: Resource Leases and Conflict Control

并发 agent 工作必须避免冲突编辑、重复评审和共享资源竞争。

验收标准：

- 支持 WorkItems、collaboration tasks、repositories、branches、files、environments、CI runners 和 external tools 的 leases。
- 使用短期 leases，包含 renewal、expiration、owner、reason 和 linked task。
- 当另一个成员尝试编辑同一 exclusive resource 时阻塞或警告。
- analysis 使用 shared read leases，code、configuration、migration 和 release actions 使用 exclusive write leases。
- 开始工作前检测 branch conflicts、file overlap、migration conflicts、CI runner contention 和 environment contention。
- WorkItem、Team Chat、Code View 和 team capacity views 显示 active leases 和 conflicts。

建议 APIs：

```text
POST /api/v1/resource-leases
GET  /api/v1/resource-leases?projectId=:projectId
POST /api/v1/resource-leases/:id/renew
POST /api/v1/resource-leases/:id/release
GET  /api/v1/projects/:id/conflicts
```

当前实现基线：

- Team capacity views 和 WorkItem cards 已显示 assignment-related conflicts：unassigned open work、unknown assignees、unavailable assignees、unavailable members with open work、blocked assigned work 和 member WIP overload。
- `huntianling.dispatch` 持久化 WorkItems、collaboration tasks、repositories、branches、files、environments、CI runners 和 tools 的短期 leases，包含 owner、reason、linked task、renewal、expiration、shared read 和 exclusive write。
- Exclusive write 会阻止冲突编辑。`GET /api/v1/projects/:id/conflicts` 列出 exclusive contention、file-path overlap 和 migration conflicts。WorkItem Code View 包含活动 lease badges。开发界面进度详情仍显示活动 leases。

## 团队工作流编排

HuntianLing 应通过 project workflow templates 编排团队工作。workflow engine 决定下一步必须发生什么、需要哪些角色、哪些工作可以并行、哪些门禁必须通过、何时必须由人审批。

详细工作流引擎设计见 [../architecture/workflow-orchestration-engine.zh.md](../architecture/workflow-orchestration-engine.zh.md)，用于集中讨论术语、运行行为、可视化、测试、扩展点和实现阶段。

首个产品里程碑使用有版本的内置编码工作流，运行 Planner、Generator 和 Evaluator。下面更长的模板是后续项目选项。可视化设计器、扩展目录和第三方包不属于首个里程碑。

推荐默认 workflow：

```text
Intake
  -> Analysis
  -> Design
  -> Breakdown
  -> Planning
  -> Dispatch
  -> Implementation
  -> Code Review
  -> QA Verification
  -> Security / Reliability / Trust Gates
  -> Release
  -> Retrospective
```

### REQ-FLOW-001: Project Workflow Templates

Projects 必须能选择或定制团队工作流。

验收标准：

- 支持 Scrum、Kanban、Scrumban、compliance-heavy delivery、hotfix delivery 和 research-only work templates。
- 保存每个 workflow template 的 stages、allowed transitions、required roles、required skills、required tools、inputs、outputs、checks、approvals 和 evidence。
- Project 可选择一个 default workflow，并按 WorkItem type、Milestone、risk level 或 delivery slice override。
- 保留 workflow template versions，使历史 WorkItems 可解释。
- 防止删除或改变 active WorkItems 仍在使用的 workflow version。

建议 APIs：

```text
GET  /api/v1/workflow-templates
POST /api/v1/projects/:id/workflow
GET  /api/v1/projects/:id/workflow
PATCH /api/v1/projects/:id/workflow
```

实现状态：

- 内置已发布模板包括 `huntianling.user-story`、`huntianling.scrum`、`huntianling.kanban`、`huntianling.hotfix` 和 `huntianling.research`。每个模板保存 stages、roles、skills、tools、checks、approvals 和 evidence。内置版本不能就地编辑。
- 项目通过 `GET/PATCH /api/v1/projects/:id/workflow` 和 `GET /api/v1/workflow-templates` 选择一个默认模板。新 plan 使用所选模板。未结束的 run 保留原来的 template id 和 version。
- Scrumban、compliance-heavy 模板，以及按 WorkItem type、Milestone、risk level 或 delivery slice 覆盖，仍在计划中。

### REQ-FLOW-002: Stage Gates and State Machine

Workflow stages 必须强制 entry rules、exit rules 和 valid transitions。

验收标准：

- 定义 stage states、allowed transitions、required fields、required evidence、required reviews 和 required approvals。
- 按 Project、Milestone、WorkItem type 和 risk level 支持 Definition of Ready 与 Definition of Done。
- 阻止 invalid transitions，并说明缺少的 fields、tasks、checks、approvals 或 evidence。
- manual override 必须有 permission、reason、scope 和 audit record。
- 每次 accepted transition 后更新 board columns、WorkItem status、milestone rollups、Team Chat events 和 audit logs。

建议 APIs：

```text
POST /api/v1/work-items/:id/workflow/transition
GET  /api/v1/work-items/:id/workflow/gates
POST /api/v1/work-items/:id/workflow/override
```

实现状态：

- `huntianling.workflow` 检查阶段门的 required fields、evidence、reviews 和 approvals，并用这些缺失项阻止非法流转。
- Override 需要 actor、reason 和 scope，写入 `work_item.transition_overridden` 审计记录，并继续拒绝 delivered 回到 inbox 这类禁止生命周期移动。
- Definition of Ready 使用项目 delivery policy 作为 ready/in_progress 门。可视化编辑 gates 仍在计划中。

### REQ-FLOW-003: Agent Orchestration Plan

workflow engine 必须把 WorkItem 转换成可执行 human-agent plan。

验收标准：

- 构建带 steps、dependencies、required roles、required skills、required tools、input data、expected outputs、checks、timeouts、retries 和 handoffs 的 plan。
- 标记 steps 为 sequential、parallel、exclusive、review-only、approval-required 或 manual-only。
- 启动 steps 前使用 team capacity、WIP limits、resource leases、branch ownership 和 skill coverage。
- 为计划中的 agent work 创建 collaboration tasks 和 Team Chat messages。
- 当 agent 提出 blocker、missing information、failed check、permission gap 或 required human decision 时暂停 plan。
- 保存每个 workflow run、step result、retry、handoff 和 failure reason。

建议 APIs：

```text
POST /api/v1/work-items/:id/workflow/plan
POST /api/v1/workflow-runs/:id/start
GET  /api/v1/workflow-runs/:id
POST /api/v1/workflow-runs/:id/pause
POST /api/v1/workflow-runs/:id/resume
```

实现状态：

- 按所选 template 规划 WorkItem 会创建带 sequential、review-only、approval-required 和 manual steps 的存储 run，包含 roles、skills、tools、checks、dependencies 和 handoffs。
- 启动 run 会为 agent steps 创建 Agent 频道协作任务，并且不会启动 blocked 或未批准 steps。
- 当 assignee 超出 WIP、exclusive lease 由他人持有、或关联 branch 属于其他成员时，启动 step 会被阻止。

### REQ-FLOW-004: Human Approval and Escalation

当决策超出 agent 权限时，workflow orchestration 必须纳入 humans。

验收标准：

- 当策略要求时，为 requirement acceptance、scope changes、risk acceptance、code push、pull request creation、merge、release、production deployment、compliance exceptions 和 security exceptions 创建 approval requests。
- 每个 approval request 声明 requester role、required approver roles、allowed decision roles、quorum、sequence、delegation rules、escalation rules 和 conflict-of-interest rules。
- 为 request、assignment、approval、rejection、revision request、delegation、expiration、cancellation 和 escalation 发出 role-scoped approval events。
- 在 WorkItem detail、Team Chat、milestone view 和 project workflow view 显示 approval requests。
- 授权 humans 可以 approve、reject、request revision、delegate 或 expire approval request。
- dependent workflow steps 在 required approvals 解决前保持 blocked。
- audit log 保存 approver、approver role、decision、reason、timestamp、scope、resulting transition、emitted events 和 impacted gates。

建议 APIs：

```text
POST /api/v1/approval-requests
GET  /api/v1/approval-requests?projectId=:projectId
POST /api/v1/approval-requests/:id/approve
POST /api/v1/approval-requests/:id/reject
POST /api/v1/approval-requests/:id/request-revision
POST /api/v1/approval-requests/:id/delegate
```

实现状态：

- Approval requests 保存 requester role、required approver roles、allowed decision roles 和 quorum。approve、reject、request-revision 和 delegate 会写入 role-scoped events 和频道可见备注。
- 依赖审批的 steps 会保持 queued 或 waiting，直到所需 approval 被解决。
- push/PR/merge 仍同时使用 C1 authority grants 和 workflow approval requests。

### REQ-FLOW-005: Workflow Visibility and Control

用户必须能在不读 raw logs 的情况下看到和控制 active workflows。

验收标准：

- 显示 active workflow stage、current agent or human owner、running steps、blocked steps、waiting approvals、failed checks、next recommended action 和 expected downstream impact。
- 显示 parallel branches 及其 dependencies。
- 把 workflow steps 链接到 Team Chat messages、WorkItems、branches、code changes、CI runs、security checks、reliability checks、trust evidence 和 audit records。
- 授权用户可以 pause、resume、cancel、reassign、retry 或 rerun workflow steps。
- 提供 project-level views 展示 active workflows、blocked workflows、overdue approvals、overloaded roles 和 release readiness。

建议 APIs：

```text
GET  /api/v1/projects/:id/workflow-runs
GET  /api/v1/work-items/:id/workflow
POST /api/v1/workflow-runs/:id/steps/:stepId/retry
POST /api/v1/workflow-runs/:id/cancel
```

当前实现基线：

- Board Store 持久化每个 WorkItem 的 workflow board summary，包含 run status、active owner、next action、downstream impact、scheduler reason、running steps、blocked steps、waiting approvals、waiting reviews、failed checks、controls 和 workflow links。
- Web API 已实现 `GET /api/v1/projects/:id/main-board/workflow`、`GET /api/v1/projects/:id/workflow-runs`、`GET /api/v1/work-items/:id/workflow`、`PATCH /api/v1/work-items/:id/workflow`、`GET /api/v1/work-items/:id/workflow-board-summary` 和 `PATCH /api/v1/work-items/:id/workflow-board-summary`。
- 浏览器看板包含 Workflow board view，并在 WorkItem detail inspector 中提供可编辑 Workflow summary section。
- `huntianling.workflow` 存储可执行 runs。Pause、resume、cancel、retry 和 reassign 已在这些 runs 上实现。Project 和 WorkItem workflow 读取包含 live run、next action、blocked/waiting steps、scheduler reasons 和 timeline。
- `GET /api/v1/projects/:id/workflow-rollups` 返回 overloaded roles（active steps 对比成员 capacity）以及 blocked runs、pending approvals、pending reviews、pending handoffs、missing evidence 和 open stories 的 release-readiness 原因。

### REQ-FLOW-006: Visual Workflow Designer

编排引擎必须提供 workflow templates 的可视化编辑器。用户应该能设计 engine workflows，而不需要编辑 raw JSON 或 code。

验收标准：

- 提供 canvas 展示 stages、agent steps、human steps、gates、approvals、handoffs、parallel branches、retries、timers、resource leases 和 failure paths。
- 每个 node 可编辑 required roles、required skills、allowed tools、input fields、output fields、checks、evidence requirements、WIP rules 和 approval rules。
- workflow 保存前显示 invalid 或 incomplete nodes。
- 每个 canvas 保存为 versioned workflow template，同时可导出 machine-readable workflow DSL。
- 支持 draft、review、published、deprecated 和 archived template states。
- schema validation、dependency validation、permission validation 或 required test cases 失败时禁止 publish。
- 显示每个 visual node 如何映射到 runtime stages、run steps、Team Chat events、board status 和 evidence records。

建议 APIs：

```text
GET  /api/v1/workflow-templates/:id/canvas
PUT  /api/v1/workflow-templates/:id/canvas
POST /api/v1/workflow-templates/:id/validate
POST /api/v1/workflow-templates/:id/publish
POST /api/v1/workflow-templates/:id/archive
```

实现状态：

- `GET/PUT /api/v1/workflow-templates/:id/canvas` 读取并保存含 stages、agent/human steps、gates 和 approvals 的版本化画布。每个 node 映射到 runtime stage、run step、board status、Team Chat event 和 evidence。内置模板不能就地编辑。
- 保存时返回 invalid 或 incomplete nodes。`POST .../validate` 和 `POST .../publish` 阻止 schema、dependency、capability 和 tool 错误。存在 draft、review、published、deprecated 和 archived 状态；仍有 active run 使用该模板时拒绝归档。
- 作者在 `/developer/workflow-lab` 编辑并 dry-run。fused `/board` cockpit 未改。

### REQ-FLOW-007: Workflow Test Lab

workflow authors 必须能在真实 Project 工作使用模板前测试 workflow template。

验收标准：

- 用 sample WorkItems、Milestones、team members、agent profiles、skills、tools、repositories、CI results、approvals 和 evidence fixtures 支持 dry-run execution。
- 支持 happy path、missing input、blocked task、declined handoff、failed gate、failed CI、missing skill、missing approval、timeout、retry、cancellation、resource conflict 和 cross-Milestone delivery。
- test cases 可断言 expected final status、emitted events、created collaboration tasks、Team Chat messages、gate results、evidence records、blocked reasons 和 audit events。
- 提供 visual replay，帮助 authors 检查 step order、parallel execution、waiting points、retries 和 failure paths。
- test runs 和 reports 作为 workflow template publication evidence 保存。
- 发布 workflow template 前要求配置 minimum test suite。
- third-party workflow packs 可以随 template 带 conformance tests。

建议 APIs：

```text
POST /api/v1/workflow-templates/:id/test-cases
GET  /api/v1/workflow-templates/:id/test-cases
POST /api/v1/workflow-templates/:id/test-runs
GET  /api/v1/workflow-test-runs/:id
GET  /api/v1/workflow-test-runs/:id/report
```

实现状态：

- Test Lab 对 happy-path、missing-approval、resource-conflict、stale-state 和 missing-evidence 做 dry-run，把 replay frames 和 report 存为发布证据，并在没有通过的 happy-path run 时阻止发布。
- Test Lab 可模拟 custom-node fixtures。Timeout 和 retry 套件仍在计划中。

### REQ-FLOW-008: Workflow Pack Conformance

三方 workflow packs 必须通过 contract 和 behavior checks，才能为 Project 启用。

验收标准：

- 按 public workflow schema、node catalog、event catalog、gate catalog、permission model 和 API version 验证 workflow templates。
- 每个 workflow pack 声明 supported WorkItem types、required agents、required skills、required tools、required evidence、approval points 和 unsupported scenarios。
- pack 发布或安装前运行 Workflow Test Lab conformance suite。
- 生成 conformance report，包含 passed checks、failed checks、warnings、unsupported features 和 required fixes。
- 当 pack 使用 unknown node types、undeclared tools、missing skills、unsafe permissions 或 untested high-risk paths 时阻止安装。
- conformance reports 版本化保存，使团队能看到历史 workflow runs 使用的 pack version。

建议 APIs：

```text
POST /api/v1/workflow-packs/import
POST /api/v1/workflow-packs/:id/conformance
GET  /api/v1/workflow-packs/:id/conformance/:runId
POST /api/v1/projects/:id/workflow-packs/:id/enable
```

实现状态：

- `POST /api/v1/workflow-packs/import` 保存带 namespace 的 pack，含声明的 WorkItem types、agents、skills、tools、evidence、approvals、templates、events、nodes 和 extensions。
- `POST /api/v1/workflow-packs/:id/conformance` 写入版本化报告。unknown nodes、undeclared tools、missing skills、unsafe permissions 或 Test Lab happy-path 失败会阻止启用。`POST /api/v1/projects/:id/workflow-packs/:id/enable` 需要通过的报告。

### REQ-FLOW-009: Custom Workflow Event Catalog

workflow authors 和三方 workflow packs 必须能通过受控 catalog 定义 custom workflow events。

验收标准：

- 区分 system event types 和 custom event types。
- custom event names 必须使用 workflow pack 或 Project 拥有的 namespace。
- 保存 event name、version、JSON schema、producer roles、target roles、required decision roles、allowed consumers、visibility、retention policy、redaction policy 和 audit behavior。
- 支持 runtime-only、Team Chat、board-visible 和 audit 等 event visibility levels。
- 拒绝不符合 declared schema 的 events。
- 防止 custom events 重定义 system event names 或改变 system event semantics。
- workflow tests 可以断言 emitted custom events。
- 保留 event versions，使历史 workflow runs 可 replay 和解释。

建议 APIs：

```text
GET  /api/v1/workflow-event-types
POST /api/v1/workflow-event-types
GET  /api/v1/workflow-event-types/:id
POST /api/v1/workflow-events
GET  /api/v1/workflow-runs/:id/events
```

实现状态：

- `GET /api/v1/workflow-event-types` 列出 system 和 custom events。自定义 id 必须使用 pack 或 project namespace，且不能重定义 system events。
- `POST /api/v1/workflow-events` 拒绝缺少声明必填字段的 payload，并保存 event version 供后续 replay。

### REQ-FLOW-010: Custom Plan and Node Types

workflow plan 必须支持 custom node types，而不是每种新 workflow style 都改 core engine。

验收标准：

- 提供 built-in node types：stages、agent steps、human steps、gates、approvals、handoffs、parallel branches、timers、retries、resource leases 和 failure handlers。
- workflow packs 可用 namespace、input schema、output schema、UI form schema、required capabilities、required permissions、supported events 和 test fixtures 注册 custom plan node types。
- workflow pack 通过 conformance checks 后，custom node types 才出现在 Visual Workflow Designer。
- Workflow Test Lab 可通过 declared fixtures 或 registered test adapter 模拟 custom nodes。
- 阻止请求 undeclared tools、unsafe permissions、unknown events 或 unsupported runtime capabilities 的 custom nodes。
- 防止 custom nodes 绕过 stage gates、approvals、resource leases、audit logging 或 evidence requirements。
- custom node versions 链接到 workflow runs 和 conformance reports。

建议 APIs：

```text
GET  /api/v1/workflow-node-types
POST /api/v1/workflow-node-types
GET  /api/v1/workflow-node-types/:id
POST /api/v1/workflow-templates/:id/nodes
POST /api/v1/workflow-templates/:id/nodes/:nodeId/validate
```

实现状态：

- 内置节点类型覆盖 stages、agent/human steps、gates、approvals、handoffs、parallel branches、timers、retries、resource leases 和 failure handlers。
- Pack 自定义节点仅在 conformance 通过后出现在 `GET /api/v1/workflow-node-types`。Test Lab 用声明的 fixtures 模拟它们。不安全的 bypass 权限会被拒绝。

### REQ-FLOW-011: Workflow Extension Points

workflow behavior 必须通过 declared extension points 扩展，不通过 hidden runtime hooks。

验收标准：

- 定义 template validation、plan generation、dispatch recommendation、step start、step completion、gate evaluation、evidence ingestion、approval request creation、event emission、failure handling 和 report generation extension points。
- 每个 extension 声明 scope、input schema、output schema、side effects、required permissions、timeout、retry policy、idempotency behavior 和 test cases。
- Projects 可按 workflow template 启用或停用 extension packages。
- extensions 按受控顺序运行，产生 deterministic results 或 explicit conflict errors。
- enabled extensions 冲突、缺少测试、要求缺失工具或请求超出 Project policy 的权限时阻止 publishing。
- extension execution 写入 workflow run history 和 audit events。
- 支持通过同一 validated extension model 增加 stages、transitions、gates、events、plan nodes 和 approval rules。

建议 APIs：

```text
GET  /api/v1/workflow-extension-points
POST /api/v1/workflow-extension-packages/import
GET  /api/v1/workflow-extension-packages/:id
POST /api/v1/projects/:id/workflow-extension-packages/:id/enable
POST /api/v1/workflow-templates/:id/extensions/validate
```

实现状态：

- `GET /api/v1/workflow-extension-points` 列出声明的扩展点。Pack 注册带 order、schemas、permissions 和 test cases 的 extension packages。
- 同一 point 和 order 启用两个 extension 会以显式冲突失败。启用 pack 会写入 `workflow_pack.enabled` 审计事件。

### REQ-FLOW-012: Harness Workflow Management

workflow authors 必须能通过 Harness-facing UI 和 APIs 管理 workflow templates。

验收标准：

- 支持通过 Harness 创建、编辑、保存、克隆、选择、替换、发布、弃用、归档、导入和导出 workflow templates。
- Project 可选择 default workflow template，并按 WorkItem type、Milestone、risk level 或 delivery slice override。
- 替换前显示 template version、owner、publication state、test status、conformance status、active Project usage 和 active workflow runs。
- replacement preview 显示 changed stages、nodes、events、gates、approvals、Agent bindings、Skill bindings 和 active WorkItems 的可能影响。
- 支持 future WorkItems only、selected WorkItems、selected Milestones 和 explicit migration of active workflow runs 等 safe replacement modes。
- 支持回滚到 previously published workflow template version。
- template selection、replacement、migration 和 rollback events 写入 audit log。

建议 APIs：

```text
GET  /api/v1/harness/workflows
POST /api/v1/harness/workflows
POST /api/v1/harness/workflows/:id/clone
POST /api/v1/projects/:id/workflow-template/select
POST /api/v1/projects/:id/workflow-template/replace
POST /api/v1/projects/:id/workflow-template/rollback
```

实现状态：

- `GET/POST /api/v1/harness/workflows` 列出并克隆 templates。Project 可选择默认 template。内置 templates 不能原地修改；定制需要 clone 或 import。
- `POST /api/v1/projects/:id/workflow-template/replace` 返回 changed stages、steps、gates、approvals 和 bindings 的 preview。`future` 模式让 active runs 留在旧 template；`migrate-active` 重映射 open runs；`selected` 迁移列出的 WorkItems。`POST /api/v1/projects/:id/workflow-template/rollback` 恢复 previous template。导入和导出为 `POST /api/v1/harness/workflows/import` 与 `GET /api/v1/harness/workflows/:id/export`。selection、replacement 和 rollback 写入 audit events。

### REQ-FLOW-013: Built-In Orchestration Capability Library

系统必须默认提供通用 workflow capabilities，使团队在增加 custom extensions 前也能构建有用 workflows。

验收标准：

- 提供 intake、requirement analysis、requirement design、decomposition、prioritization、planning、dispatch、implementation、code review、QA verification、security review、reliability review、trust review、approval、release、retrospective、Team Chat、Git、CI、evidence 和 audit actions 的 built-in capabilities。
- 为这些能力提供 built-in events、plan node types、gate types、approval types、Team Chat message types 和 evidence types。
- 提供使用 built-in capabilities 的 default workflow templates。
- built-in capabilities 版本化，并在 Visual Workflow Designer 可见。
- 团队可以按 Project policy select、copy、extend 或 disable built-in workflow capabilities。
- 防止 destructive edits to built-in capability definitions；定制必须 clone 或 extend。
- built-in capabilities 必须包含 schemas、UI forms、test fixtures、documentation 和 conformance results。

建议 APIs：

```text
GET  /api/v1/workflow-capabilities/builtin
GET  /api/v1/workflow-capabilities/:id
POST /api/v1/projects/:id/workflow-capabilities/:id/enable
POST /api/v1/projects/:id/workflow-capabilities/:id/disable
```

实现状态：

- intake、analysis、design、decomposition、implementation、review、evaluation、approval、git、CI、evidence 和 audit 的内置 capabilities 以版本化方式通过 `GET /api/v1/workflow-capabilities/builtin` 提供。
- Project 可以 enable 或 disable 某个 capability。内置定义不能原地编辑。
- `GET /api/v1/workflow-capabilities/:id` 返回打包 documentation、happy-path fixture 和 conformance schema result。可视化设计器可见性仍在计划中。

### REQ-FLOW-014: Agent and Skill Binding

workflow nodes 必须在运行前绑定 agent roles、concrete team members、required skills 和 allowed tools。

验收标准：

- 每个 executable workflow node 声明 required role、optional preferred agent、agent selection policy、required skills、optional skill packs、allowed tools、inputs、outputs、checks 和 approval requirements。
- workflow planner 通过 project membership、role、capability profile、skill profile、availability、WIP limits、resource leases 和 permissions 把 node 解析到 eligible team member。
- Agent Runtime 只加载 selected node 需要的 skills，并记录 skill id、skill version、input data、output data 和 validation results。
- 当无 eligible agent/human、required skills missing/unvalidated、required tools unavailable 或 approval unresolved 时，node 不能启动。
- Agent Team Chat 接收可见 event，说明选择了哪个 agent、加载了哪些 skills、为什么可运行或不可运行。
- Skill outputs 必须映射回 WorkItem fields、Team Chat messages、evidence records、gate results 或 follow-up collaboration tasks。
- Workflow Test Lab 可以用 fixtures 模拟 agent and skill binding decisions。

建议 APIs：

```text
GET  /api/v1/workflow-templates/:id/agent-bindings
PUT  /api/v1/workflow-templates/:id/agent-bindings
GET  /api/v1/workflow-templates/:id/skill-bindings
PUT  /api/v1/workflow-templates/:id/skill-bindings
POST /api/v1/workflow-runs/:id/steps/:stepId/resolve-agent
POST /api/v1/workflow-runs/:id/steps/:stepId/start-agent
```

### REQ-FLOW-015: Plan Scheduling

workflow engine 必须调度 executable plan steps，而不是立即启动所有 generated steps。

验收标准：

- 维护 workflow plan steps 的 schedule，包含 dependencies、priority、due date、Milestone、required role、required skills、allowed tools、estimated duration、retry policy、timeout 和 resource requirements。
- 只有 dependencies、stage gates、approvals、skill coverage、team capacity、WIP limits、resource leases 和 repository state 允许时，才把 ready steps 入队。
- 支持 sequential、parallel、exclusive、delayed、recurring、retry、manual-only、approval-gated 和 event-triggered steps。
- 当 WorkItem state、Team Chat tasks、approvals、blockers、resource leases、CI results、branch state 或 agent availability 变化时重新计算 scheduling decisions。
- 记录每个 step 为什么 scheduled、delayed、blocked、retried、cancelled 或 reassigned。
- 通过 aging、priority override、deadline risk 和 blocked-duration signals 防止 starvation。
- 授权用户可 pause、resume、reorder、reprioritize、reassign 或 cancel scheduled plan steps。
- Workflow Test Lab 提供 deterministic scheduling simulation。

建议 APIs：

```text
GET  /api/v1/workflow-runs/:id/schedule
POST /api/v1/workflow-runs/:id/schedule/recompute
POST /api/v1/workflow-runs/:id/schedule/pause
POST /api/v1/workflow-runs/:id/schedule/resume
POST /api/v1/workflow-runs/:id/steps/:stepId/reprioritize
POST /api/v1/workflow-runs/:id/steps/:stepId/reassign
```

实现状态：

- Scheduler 只在 dependencies 完成后排队 steps，记录 step 被 scheduled、delayed、blocked 或 waiting for approval 的原因，并在 approvals 或 capability 变化后重算。
- 已实现 pause、resume、reassign、retry 和 cancel。Recurring steps 在完成后重新排队；event-triggered steps 在 `POST /api/v1/workflow-runs/:id/events` 之前保持 queued。Workflow Test Lab simulation 仍在计划中。

### REQ-FLOW-016: Static Workflow Visualization

workflow authors 和 Project readers 必须能在不运行 workflow 的情况下理解 template。

验收标准：

- 显示 static workflow map，包含 stages、steps、gates、approvals、handoffs、parallel branches、retry paths、timers、resource leases、failure handlers、events 和 evidence outputs。
- 同一 workflow template 支持 stage swimlane、role swimlane、dependency graph 和 compact outline presentations。
- 提供 lifecycle stages、Agent and Skill binding、tools、events、gates、approvals、evidence、data inputs、source documents、compliance controls 和 risk signals 的 layer toggles。
- 对 missing fields、invalid schemas、missing skills、unsafe permissions、unresolved approvals、untested paths 和 conformance failures 显示 validation badges。
- node inspector 显示 description、required role、selected/eligible agents、required skills、allowed tools、inputs、outputs、checks、evidence requirements、state transitions 和 failure behavior。
- 可对比两个 template versions，显示 added、removed、changed 和 risky nodes/transitions。
- 导出 image、Markdown summary 和 workflow DSL 静态快照，并保留 node ids 和 version references。

建议 APIs：

```text
GET  /api/v1/workflow-templates/:id/visualization
GET  /api/v1/workflow-templates/:id/visualization/layers
POST /api/v1/workflow-templates/:id/visualization/export
GET  /api/v1/workflow-templates/:id/versions/:versionId/diff
```

实现状态：

- `GET /api/v1/workflow-templates/:id/visualization` 从同一模板返回 stage swimlane、role swimlane、dependency graph 和 outline，以及 layer toggles、validation badges 和 node inspector。
- `GET .../visualization/layers`、`POST .../visualization/export` 和 `GET .../versions/:versionId/diff` 导出 Markdown/DSL/SVG 快照，并比较 added、removed、changed 和 risky steps。作者可在 `/developer/workflow-lab` 查看地图而不编辑 JSON。fused `/board` cockpit 未改。

### REQ-FLOW-017: Runtime Scheduling Visualization

用户必须能看到 scheduler 如何推动真实 workflow run。

验收标准：

- 显示 live workflow run view，包含 `pending`、`ready`、`queued`、`scheduled`、`running`、`waiting_for_input`、`waiting_for_approval`、`blocked`、`retrying`、`completed`、`failed`、`skipped` 和 `cancelled`。
- scheduler timeline 显示每个 step 何时 ready、queued、assigned、started、paused、retried、reassigned、completed 或 blocked。
- 通过 role swimlanes、agent swimlanes、resource lease lanes 和 dependency edges 显示 parallel execution。
- 显示每个 decision 的 scheduler reason，包含 dependency state、gate result、approval state、team capacity、WIP limit、resource lease、repository state、CI state、missing skill、missing tool 或 permission limit。
- 每个 step 显示 selected agent、eligible alternatives、loaded skills、allowed tools、input data、output data、evidence records、Team Chat events、branch、pull request 和 CI run。
- 授权用户可从 visual run view pause、resume、retry、reassign、reprioritize、cancel 或 rerun step。
- event stream 与 canvas 和 timeline 同步，使用户无需读 server logs 即可检查 raw scheduling events。
- completed runs 支持 time scrubbing 和 replay。

建议 APIs：

```text
GET  /api/v1/workflow-runs/:id/timeline
GET  /api/v1/workflow-runs/:id/scheduler-decisions
GET  /api/v1/workflow-runs/:id/steps/:stepId/trace
POST /api/v1/workflow-runs/:id/replay
GET  /api/v1/workflow-runs/:id/replay/:replayId
```

当前实现基线：

- 浏览器 Runs 工作区基于 Project workflow board payload 显示 Story 交付轨道，包含候选排序、启动条件、实现执行、角色交接、验证门禁和完成交付阶段。
- Runs 工作区显示 Story 优先级队列、角色交接、approval/review 等待、workflow blockers、failed checks 和状态泳道，使用户不需要检查 server logs。
- `GET /api/v1/workflow-runs/:id/timeline` 和 `GET /api/v1/workflow-runs/:id/scheduler-decisions` 返回已存储 run events 和 scheduler reasons。开发者进度显示 live workflow run。
- Canvas replay、time scrubbing 和 swimlane maps 仍在计划中。

### REQ-FLOW-018: Workflow Test Replay Visualization

Workflow Test Lab 必须用可回放可视化证据展示 workflow test 为什么通过或失败。

验收标准：

- 一个 test report view 中显示 test scenario、fixture data、expected assertions、actual events、final states 和 failed assertions。
- 在 designer 使用的同一 workflow map 上 replay test execution，并用 time scrubber 查看 state transitions、scheduling decisions、retries、waits、blockers 和 failures。
- 高亮 expected 与 actual 在 node order、emitted events、created collaboration tasks、Team Chat messages、gate results、evidence records、approvals 和 audit events 上的差异。
- 当 template version 和 scenario 相同，支持 dry-run、real run 和 replay data side-by-side comparison。
- replay report 可作为 workflow template publication evidence，也可作为 third-party workflow packs 的 debugging evidence。
- replay frames 和 trace events 保存 workflow template version、workflow pack version、fixture version、scheduler version 和 conformance run id。

建议 APIs：

```text
GET  /api/v1/workflow-test-runs/:id/timeline
GET  /api/v1/workflow-test-runs/:id/replay
GET  /api/v1/workflow-test-runs/:id/assertions
POST /api/v1/workflow-test-runs/:id/export-report
```

实现状态：

- `GET /api/v1/workflow-test-runs/:id/replay` 把 Test Lab frames 叠在设计器 dependency graph 上，含 timeline、assertions 和 highlights。Frames 保存 template、pack、fixture、scheduler 和 conformance versions。
- `POST /api/v1/workflow-test-runs/:id/export-report` 写出 Markdown 发布证据。dry-run 与 live-run 并排比较仍在计划中。

### REQ-FLOW-019: Role-Scoped Approval and Review Events

Approvals 和 reviews 必须建模为带角色关联的 workflow events，而不只是 WorkItems 或 workflow steps 上的字段。

验收标准：

- workflow templates 可以声明哪些 roles 能 request、perform、approve、reject、request revision、delegate、expire、cancel 和 escalate approval/review。
- approval/review events 保存 event type、actor、actor role、target role、requester role、reviewer role、approver role、scope、WorkItem、Milestone、workflow run、step、branch、pull request、CI run、evidence、reason、timestamp 和 correlation id。
- 支持 `approval.requested`、`approval.assigned`、`approval.approved`、`approval.rejected`、`approval.revision_requested`、`approval.delegated`、`approval.expired`、`approval.cancelled` 和 `approval.escalated`。
- 支持 `review.requested`、`review.assigned`、`review.started`、`review.commented`、`review.approved`、`review.changes_requested`、`review.rejected`、`review.completed` 和 `review.cancelled`。
- Stage gates 和 scheduler decisions 可以等待 required role-scoped events、required quorum、ordered approvals、separation of duties 或 delegated reviewer completion。
- Agent Team Chat 把 approval/review events 显示为可见 conversation entries，包含责任 roles 和 unresolved next actions。
- Workflow Test Lab 可以模拟 approval/review event sequences、missing role authorization、wrong-role approval、expired approvals、delegated reviews 和 conflicting decisions。
- Audit records 保存完整 event chain，使用户看到谁请求、谁评审、谁批准、持有什么角色，以及哪个 gate 或 transition 发生变化。

建议 APIs：

```text
GET  /api/v1/workflow-role-event-policies
POST /api/v1/workflow-role-event-policies
GET  /api/v1/workflow-runs/:id/role-events
POST /api/v1/workflow-runs/:id/role-events
POST /api/v1/review-requests
GET  /api/v1/review-requests?projectId=:projectId
POST /api/v1/review-requests/:id/complete
```

实现状态：

- Approval events `approval.requested`、`assigned`、`approved`、`rejected`、`revision_requested` 和 `delegated` 会保存 actor role、target role、WorkItem、run、step、reason 和 correlation id，并写入 Agent 频道。
- 阶段门和 scheduler 会等待所需 approval events。`POST /api/v1/review-requests`、`GET /api/v1/review-requests?projectId=:projectId` 和 `POST /api/v1/review-requests/:id/complete` 保存 `review.requested`、`review.assigned` 和 `review.completed` role-scoped events。Workflow Test Lab simulation 仍在计划中。

### REQ-FLOW-020: Priority-Ordered Story E2E Delivery

workflow engine 必须支持按优先级选择 Stories，并驱动一个 Story 完成端到端团队交付。

验收标准：

- 维护 Project 或 Milestone Story priority queue，由 selected prioritization method、dependencies、risk、deadline、delivery slice、blocked state 和 human overrides 生成。
- 只有 Story 通过 Definition of Ready，并且 analysis、design、acceptance criteria、dependency、approval、Skill、tool、team-capacity 和 resource checks 满足时，才启动 Story delivery run。
- 每个 Story delivery run 链接 Story、parent Feature/Epic、Milestone/delivery slice、workflow template version、priority rank、selected team members、Agent runs、collaboration tasks、branches、pull requests、CI runs、reviews、approvals 和 evidence。
- 使用 Story-level WIP limits 和 resource leases，让团队聚焦受控数量 active Stories，同时允许 Story 内部安全并行。
- 从 Story workflow template 生成 child Tasks、Agent collaboration tasks、review requests、approval requests、branch work、CI checks 和 evidence requirements。
- 按 dependency 和 role 调度 Story 内部 steps，使 analysis、design、implementation、review、QA、security、reliability、trust 和 release 工作按必需顺序或批准的并行分支发生。
- 只有更高优先级 Story blocked、not ready、missing roles、missing Skills、missing tools、waiting for approval 或 blocked by resources 时，scheduler 才能跳过；skip reason 必须可见且可审计。
- Story completion 必须证明 acceptance coverage、child WorkItem completion、review decisions、approval events、code evidence、CI evidence、configured security/reliability/trust gates 和 Definition of Done。
- board、workflow visualization、Agent Team Chat、Code View、Milestone rollups、runtime scheduler timeline 和 test replay 显示 Story delivery progress。
- 授权用户可带 reason 和 audit records pause、resume、cancel、reprioritize、split 或 move Story delivery run。
- Workflow Test Lab 可以模拟 priority queues、blocked top-priority Stories、WIP limits、missing Skills、branch conflicts、failed CI、wrong-role approval 和 successful end-to-end Story delivery。

建议 APIs：

```text
GET  /api/v1/projects/:id/story-queue
POST /api/v1/projects/:id/story-queue/recompute
POST /api/v1/projects/:id/story-queue/reorder
POST /api/v1/work-items/:id/story-delivery/start
GET  /api/v1/work-items/:id/story-delivery
GET  /api/v1/story-delivery-runs/:id
POST /api/v1/story-delivery-runs/:id/pause
POST /api/v1/story-delivery-runs/:id/resume
POST /api/v1/story-delivery-runs/:id/cancel
GET  /api/v1/story-delivery-runs/:id/evidence
```

当前实现基线：

- `GET /api/v1/projects/:id/story-queue` 返回确定性的 Project 或 Milestone Story queue，按 priority、due date 和 WorkItem order 排序。
- `POST /api/v1/projects/:id/story-queue` 重新计算并返回同一队列，不创建独立 workflow run。
- Queue items 使用 machine-readable reasons 解释被跳过的 Stories，例如 missing analysis、missing design、missing acceptance criteria、missing Milestone、missing assignee、unavailable assignee、WIP overload、waiting approvals、waiting reviews、blocked workflow steps 和 failed checks。
- Developer assignment、developer role claims 和 `in_progress` WorkItem transitions 要求工作已处于 Ready，并且 requirement/story 满足 Definition-of-Ready 字段。
- Workflow board 显示 agile lifecycle swimlanes、ready、skipped、active、blocked、approval、review 和 failed-check counts，并提供 Runs workbench，把 Story queue、delivery runway、role handoff waits、workflow blockers 和 status lanes 分开呈现。
- 需求 Backlog 会在 priority queue 旁显示 Story Ready 和 delivery evidence signals，并且可以通过现有 workflow summary API 把一个 Ready Story 更新为 `queued`，同时写入 scheduler reason。该动作记录调度意图，尚不创建未来的 Story delivery run entity。
- `huntianling.delivery` 在通过 Definition of Ready 后启动一次 Story 交付运行，依次驱动 Planner、Generator、Evaluator，并提供 start、get、advance、pause、resume、cancel 和 evidence API。开发界面进度详情可以开始、暂停、恢复或取消该运行。
- 自动生成子任务、协作任务、资源租约、branch/PR/CI 执行、Definition of Done 强制和 Workflow Test Lab 模拟仍在规划中。

### REQ-FLOW-021: Event-Driven State Transitions and Handoffs

workflow tasks 必须把不可变 events 与持久 current state 组合起来，才能从开始到结束完成整条流水线交付。

验收标准：

- WorkItems、workflow runs、run steps、Story delivery runs、collaboration tasks、approval requests 和 review requests 都保存 current state 和 owner。
- Workflow events 是不可变事实，带 actor、actor role、target object、reason、timestamp、correlation id 和可选 evidence references。
- Events 不替代 current state；current state 不替代 event log。
- State Transition Engine 在改变 state 前，用 current state、role policy、gate rules、approvals、reviews、evidence、Skills、tools、resource leases 和 idempotency keys 验证每个 event。
- Role handoff 从 handoff 或 review event 开始，只有 target object 在同一个 accepted transition 中改变 state 和 owner 后才完成。
- Rejected、duplicate、stale、out-of-order 或 wrong-role events 不能改变 state；系统必须记录 rejection reason。
- Scheduler decisions 用 current state 控制执行，用 events 解释状态为何变化。
- Board、workflow visualization、Agent Team Chat、Code View、audit log 和 test replay 必须同时显示 current state 和背后的 event history。
- Workflow Test Lab 可以断言 event sequences、state transitions、rejected transitions、duplicate events、stale events 和 successful role handoffs。

建议 APIs：

```text
GET  /api/v1/workflow-state-transition-rules
POST /api/v1/workflow-runs/:id/events
GET  /api/v1/workflow-runs/:id/events
GET  /api/v1/workflow-runs/:id/state-transitions
POST /api/v1/workflow-runs/:id/handoffs
POST /api/v1/workflow-handoffs/:id/accept
POST /api/v1/workflow-handoffs/:id/reject
```

当前实现基线：

- WorkItem workflow summaries 持久化 current run state、active owner 或 role、scheduler reason、running steps、blocked steps、waiting approvals、waiting reviews、failed checks、controls 和 links。
- 浏览器 Runs 工作区把 role handoff、approval/review waits 和 blocker reasons 放在一起呈现，使用户可以看到哪个 role 拥有下一次 transition，以及 current state 为什么没有推进。
- Role-scoped events 作为不可变事实与 current run state 并存。`POST /api/v1/workflow-runs/:id/handoffs` 的 accept/reject 只在 accepted transition 中改变 owner；rejected、duplicate 或 wrong-role events 写入 rejection record 且不改变 state。`GET /api/v1/workflow-runs/:id/state-transitions` 列出这些 rejections。Event-history playback 仍在计划中。

### REQ-FLOW-022: Agile Lifecycle Swimlane Coverage

Runs workspace 必须把 agile development lifecycle 作为一等泳道展示，并与底层 workflow run status 分离。

验收标准：

- 覆盖 requirement intake、requirement analysis、solution design、breakdown review、milestone planning、Ready dispatch、implementation、code review、QA verification、security/reliability/trust gates、delivery complete 和 exception closed 等 agile lifecycle lanes。
- 每个 WorkItem status 必须映射到且只映射到一个 agile lifecycle lane；否则报告为 unmapped lifecycle coverage gap。
- workflow run status lanes 保留为 secondary diagnostic view，不能作为 primary business lifecycle view。
- 每个 lifecycle lane 显示 lane owner role、mapped WorkItem statuses、required evidence areas、blocked card count、ready card count 和 missing evidence count。
- 高亮被 waiting approvals、waiting reviews、failed checks、blocked workflow steps 或 required delivery evidence gaps 阻塞的 lifecycle lanes 和 cards。
- 用户可以从 lifecycle lane 打开 WorkItem，且不离开 Runs workspace。

建议 APIs：

```text
GET /api/v1/projects/:id/main-board/workflow
```

当前实现基线：

- `GET /api/v1/projects/:id/main-board/workflow` 在现有 run-status lanes 旁返回 `lifecycleLanes` 和 `lifecycleCoverage`。
- lifecycle coverage 映射所有当前 WorkItem statuses：`inbox`、`analyzing`、`designing`、`triaged`、`planned`、`ready`、`in_progress`、`in_review`、`verifying`、`gates_passing`、`delivered`、`rejected` 和 `stopped`。
- 浏览器 Runs workspace 把 agile lifecycle swimlanes 渲染为主面板，并将 run-status lanes 保留为可折叠诊断区。

## 团队协作

### REQ-COLLAB-001: Agent Team Chat Window

HuntianLing 必须在开发界面提供独立 Agent 频道。该窗口与客户的 MKT 对话框、以及用户普通 LLM 任务聊天分离，用于展示 MKT、Planner、Generator、Evaluator 和开发者如何协作。

验收标准：

- 每个 conversation 属于一个 Project，且只能从开发界面进入（`REQ-WEB-007`）。客户和管理员界面不承载该频道。
- MKT、Planner、Generator、Evaluator 和人类开发者可以参加。Agent 只能按其角色契约和 Skill 边界参加。
- 消息使用 `REQ-COLLAB-004` 中的信封和 `type` 目录。
- Messages 可以包含 Milestone、WorkItem、branch、pull request、CI run 或 source document context tags。这些 tags 支持 navigation、filtering 和 traceability，不会把 chat window 变成 board、Code View、SCM tool、CI tool、客户 MKT 对话框或 normal LLM task window。
- humans 和 agents 可以加入同一 conversation。
- 普通 `note.chat`、mentions、role-targeted messages 和 threaded replies 可见，且本身不改变 WorkItem 状态。
- messages 只作为 references 链接到 related WorkItems、acceptance criteria、Milestones、code changes、CI evidence 和 audit events，除非该 type 的写入路径更新所属记录。
- 区分 human messages、agent messages、tool-generated evidence、system events 和类型化协作消息。
- conversation history 作为 project data 保存，并应用项目级开发访问控制。

建议 APIs：

```text
POST /api/v1/team/conversations
GET  /api/v1/team/conversations?projectId=:projectId
GET  /api/v1/team/conversations/:id
POST /api/v1/team/conversations/:id/messages
POST /api/v1/team/conversations/:id/participants
POST /api/v1/team/conversations/:id/decisions
POST /api/v1/team/conversations/:id/approvals
```

实现状态：

- `huntianling.collab` 保存仅开发者可见的 Agent 频道会话和消息。`POST /api/v1/team/conversations/:id/decisions` 和 `/approvals` 记录会话决策和审批。客户访问返回 403。

### REQ-COLLAB-002: Agent Collaboration Protocol

Agent-to-agent collaboration 必须在 Agent Team Chat 中可见，而不是只存在于临时模型上下文。

验收标准：

- Agents 使用 structured chat messages 请求信息、委派工作、报告 findings、提出 blockers、请求 review 和 hand off tasks。
- 每条 agent message 可显示 producing role、collaboration task、skill versions、referenced WorkItems、tool evidence、confidence、open questions 和 next action。
- Agent handoff messages 定义 expected receiver role、required inputs、expected output、deadline or Milestone 和 validation checks。
- Human participants 可以 interrupt、answer、approve、reject 或 redirect agent collaboration flow。
- Board 和 WorkItem views 显示 unresolved team-chat questions 和 decisions。
- Agent runtime 在开始 collaboration task 前读取 task policy 选择的相关 Agent Team Chat messages，并把 conclusions 写回该 conversation。

实现状态：

- Board-detail 和 developer-board 进度会列出该 WorkItem 的 unresolved team-chat questions 和 recorded decisions。
- Agent runtime 在开始 collaboration task 前读取 task-policy 选择的频道消息，并把 `progress.update` 或 `report.findings` 写回该 conversation。pending approval 会阻止启动。

### REQ-COLLAB-003: Conversation-Driven Agent Task Management

Agent Team Chat messages 必须能在 agents 之间创建、分配、转交和更新 collaboration tasks。collaboration task 是内部 agent-team work record；创建它不会自动创建新的 dsh LLM chat task。

验收标准：

- structured chat message 可以在当前 Project 创建 agent collaboration task，并附加 Milestone、WorkItem、branch、pull request、CI run 或 source document context tags。
- Collaboration tasks 保存 requester、assignee role、assignee agent/human、objective、inputs、expected output、required skills、allowed tools、due Milestone/date、status、priority、blockers 和 acceptance checks。
- 支持状态 `proposed`、`accepted`、`in_progress`、`waiting_for_input`、`blocked`、`ready_for_review`、`completed`、`rejected` 和 `cancelled`。
- Agents 可通过 typed chat messages accept、decline、ask questions、request missing information、transfer、split、merge 或 complete collaboration task。
- Humans 可在同一 conversation 中 create tasks、join tasks、answer questions、approve transfers、override assignments、request revisions 或 cancel tasks。
- 每次 task update 写入 visible conversation event 和 auditable state transition。
- task transfer message 命名 sending role、receiving role、reason、transferred context、expected next action、required evidence 和 unresolved questions。
- WorkItem 和 board views 显示 open collaboration tasks、pending handoffs、missing answers 和 completed task results。
- Agent runtime 使用 task record 作为 runnable input；当 chat-created task 缺少必需 fields、skills、tools 或 approvals 时拒绝启动。

任务消息类型见 `REQ-COLLAB-004`。首个切片的任务类型为 `task.propose`、`task.accept`、`task.decline`、`task.question`、`task.answer`、`task.transfer`、`task.block`、`task.unblock`、`task.complete` 和 `task.cancel`。

建议 APIs：

```text
POST  /api/v1/team/conversations/:id/tasks
GET   /api/v1/team/conversations/:id/tasks
GET   /api/v1/agent-collaboration-tasks/:id
PATCH /api/v1/agent-collaboration-tasks/:id
POST  /api/v1/agent-collaboration-tasks/:id/messages
POST  /api/v1/agent-collaboration-tasks/:id/transfer
POST  /api/v1/agent-collaboration-tasks/:id/complete
```

实现状态：

- 首个切片任务类型会创建和更新 collaboration tasks，保存 requester、assignee、objective、inputs、skills、tools、checks、due milestone/date、priority、blockers 和 context tags。
- accept、decline、question、answer、transfer、block、unblock、complete 和 cancel 会写入可审计的 conversation event。transfer payload 要求 sending role、receiving role、reason、transferred context、expected next action、required evidence 和 unresolved questions。
- 当 collaboration task 缺少 required skills、tools、checks、expected output 或 required approval，或已 completed、rejected、cancelled 时，Agent runtime 拒绝启动。
- 开发者进度看板和 WorkItem board-detail 会列出开放协作任务、unresolved questions 和 recorded decisions。客户访问任务、决策和审批写入返回 403。
- `task.split` 会从父任务创建子协作任务。`task.merge` 保留一个 remaining task 并取消其余任务。

### REQ-COLLAB-004: Agent 频道消息 Schema

状态：规划中。

Agent 频道消息使用同一信封和带类型的 payload。实现按 `type` 判别字段分支。首个切片类型是以 `assertNever` 收尾的封闭联合。后续目录类型可合并扩展，写入时必须落入已记录的 default 并拒绝未知类型。

信封字段：

- `id`、`conversationId`、`projectId`、`schemaVersion`
- `type`
- `createdAt`
- `from`：`kind`（`human` | `agent` | `system`）、`role`、`memberId` 或 `agentRunId`；发送方是 Agent 时带 Skill id 和深度
- `to`：`kind`（`channel` | `role` | `member`），可选 `role`、可选 `memberId`
- `threadId`、`inReplyTo`
- `refs`：WorkItem、Milestone、协作任务、workflow run、Skill、证据、客户 MKT 会话
- `visibility`：本频道为 `developer`；客户可见事实走 MKT 或客户进度投影

分配工作、报告结果、交接、阻塞或做决定的类型化消息，必须在同一次被接受的写入中更新所属协作任务、WorkItem、证据或 MKT 记录。`note.chat` 从不这样做。隐藏的模型上下文不能替代频道消息。

首个切片类型：

| 族 | 类型 | 用途 |
| --- | --- | --- |
| 备注 | `note.chat` | 人或 Agent 说话。不改状态。 |
| 任务 | `task.propose`、`task.accept`、`task.decline`、`task.question`、`task.answer`、`task.transfer`、`task.block`、`task.unblock`、`task.complete`、`task.cancel` | 协作任务的分配与生命周期跟踪（`REQ-COLLAB-003`）。 |
| 进度 | `progress.update` | 当前步骤、下一步、预算或阻塞摘要。不标记客户交付。 |
| 报告 | `report.findings` | Evaluator 或评审发现，带标准 id 和证据引用。Generator 自检必须设 `kind: self_check`。 |
| 交接 | `handoff.request`、`handoff.accept`、`handoff.decline` | 角色到角色的转交，带 `handoffKind`、必需输入、预期输出和检查。 |
| 提问 | `question.ask`、`question.answer` | 开发频道内的缺失信息。 |
| 阻塞 | `blocker.raise`、`blocker.resolve` | 工作无法继续；解除时点名证据或决策。 |
| 人工 | `human.redirect`、`human.stop` | 打断、改道或停止 Agent 流程。 |
| 客户桥接 | `customer.question_needed` | 产品问题必须进入客户 MKT 对话框；客户不加入本频道。 |

首个切片的 `handoffKind`：`collect_complete`（MKT → Planner）、`design_ready`（Planner → 确认范围）、`implement`（→ Generator）、`evaluate`（→ Evaluator）、`repair`（Evaluator → Generator）、`clarify`（→ MKT 或 Planner）、`complete`。

后续目录类型，不属于首个里程碑：`task.split`、`task.merge`、`task.review_request`、`task.revision_request`、`review.request`、`review.comment`、`approval.request`、`approval.granted`、`approval.rejected`、`decision.record`、`skill.gap`、`environment.blocked`、`run.started`、`run.paused`、`run.resumed`、`run.failed`、`checkpoint.saved`、`customer.decision_received`。

验收标准：

- 写入拒绝未知的首个切片 `type`，以及未通过该类型 JSON schema 的 payload。
- 交接和任务分配 payload 包含接收角色、必需 Skill、允许的工具、输出 schema 或预期产物，以及传感器。缺少这些字段时运行时拒绝启动（`REQ-AGENT-002`、`REQ-SKILL-005`）。
- `report.findings` 不能单独完成客户可见的已交付状态；`REQ-HARNESS-008` 仍要求所属记录上的 Evaluator 证据。
- `customer.question_needed` 创建或更新客户 MKT 对话框，不向客户暴露 Agent 频道历史。
- 测试覆盖 MKT → Planner → Generator → Evaluator 交接序列、拒绝未知类型、`note.chat` 不改变 WorkItem 状态，以及人工 stop 取消当前协作任务。

实现状态：

- `huntianling.collab` 保存仅开发者可见的 Agent 频道会话、首个切片类型化消息、后续目录类型 `task.split`/`task.merge`/`decision.record`/`approval.request`/`approval.granted`/`approval.rejected`、协作任务和不可变事件。`/developer/channel` 是开发界面入口；其余后续目录类型写入仍被拒绝；客户访问返回 403。

关联需求：`REQ-COLLAB-001`、`REQ-COLLAB-002`、`REQ-COLLAB-003`、`REQ-WEB-007`、`REQ-MKT-001`、`REQ-HARNESS-006`、`REQ-FLOW-021`。

## Skills 和覆盖度

### REQ-SKILL-001: Skill Registry

HuntianLing 必须跟踪 available skills 和 skill versions。

验收标准：

- 保存 skill id、name、version、description、supported roles、supported task types、required tools、validation status、capability boundary 和 depth profile。
- 知道 skill 是否通过 `skill-creator` 创建。
- 支持 project-specific skill enablement。
- 保留 skill version history，使旧 agent runs 可解释。
- 缺少边界或深度元数据的 Skill 不能启用给 Agent 执行。

实现状态：

- `huntianling.skills` 保存 Skill id、版本、边界、深度配置、校验状态和历史。项目可停用必需的 MKT Skill 并产生覆盖缺口。已校验的 skill-creator 草稿可按项目启用、保留版本历史，并从 `.huntianling/skills.json` 重新加载。

### REQ-SKILL-002: Agile Skill Creation

产品必须包含创建敏捷开发 skills 的 workflow。

验收标准：

- 使用 `skill-creator` 创建或更新 skills。
- 为 requirement intake、analysis、story splitting、acceptance criteria、prioritization、sprint planning、UX review、architecture、implementation planning、code review、test design、QA verification、security review、release、documentation 和 retrospective analysis 创建 skills。
- 用 skill validator 验证每个 created skill。
- validation results 记录到 `agent_skill_validations`。

实现状态：

- `skill-creator` 从敏捷模板目录起草 Skill（requirement intake、analysis、story splitting、acceptance criteria、prioritization、sprint planning、UX review、architecture、implementation planning、code review、test design、QA verification、security review、release、documentation 和 retrospective analysis）。
- 草稿保持 `unvalidated`，不会注册给 agent 执行。skill validator 写入 `agent_skill_validations`。invalid 或 unvalidated 草稿不能启用。已校验草稿为项目启用后可加载到 Agent run；其他项目和其他草稿仍 gated。内置 MKT 和 coding Skills 除非项目停用否则保持启用。

### REQ-SKILL-003: Skill Coverage Matrix

HuntianLing 不能假设能覆盖每个软件领域；必须为每个项目计算 skill coverage。

验收标准：

- 扫描 project language、framework、package manager、build commands、test commands、CI config、deployment files 和 documentation。
- 输出 required skills versus available skills matrix。
- 把 gaps 分类为 missing、unvalidated、outdated 或 blocked by missing tools。
- 为 missing 或 insufficient skills 创建 Skill Gap WorkItems。
- 必需 skills 缺失时，防止 agent 声称 task 被支持。

实现状态：

- 环境准备会扫描 language、package manager、build、test、CI 和 documentation，计算 MKT 与 coding Skill 的 required-vs-available 覆盖，把缺口分类为 missing、unvalidated、outdated、disabled 或 blocked-by-tool，在提供 project id 时创建 Skill Gap WorkItem，覆盖不全时阻止开始实现。
- `GET /api/v1/projects/:id/skill-coverage` 返回该矩阵，包含推荐和已安装的 technology skill packs。

### REQ-SKILL-004: Technology Skill Packs

HuntianLing 必须支持 technology-specific skill packs。

初始分类：

- Frontend web
- Backend service
- API integration
- Database
- Mobile
- Desktop
- Data / ML
- Infrastructure
- Security
- QA automation
- Documentation

验收标准：

- Skill packs 可安装且版本化。
- Project scan 推荐 skill packs。
- WorkItems 可声明 required skill packs。
- Agent runtime 只为 selected task 加载相关 skill packs。

实现状态：

- 目录提供带版本的 frontend-web、backend-service、API integration、database、mobile、desktop、data/ML、infrastructure、security、QA automation 和 documentation packs。它们可按项目安装，不属于 coding environment baseline。
- Project scan 根据工作区依赖和文件推荐 packs。WorkItems 声明 required pack ids。Agent runtime 只加载与 selected task 匹配的已安装 pack skills。缺少 required pack 会拦住 run。客户不能安装 packs。fused `/board` cockpit 未改。

### REQ-SKILL-005: Skill 能力边界

状态：规划中。

Skill 必须声明覆盖什么、拒绝什么。这是能力范围，不是 Git 或审批权限（`REQ-AGENT-004`）。

验收标准：

- 每个 Skill 声明覆盖的角色、任务类型、产物、必需工具、输出 schema，以及明确的 `does_not_cover` 项。
- 任务运行时只加载边界匹配该任务的 Skill。输出 schema 之外的字段被拒绝。
- 缺少必需 Skill 时创建 Skill Gap WorkItem，并阻止任务声称已支持（`REQ-SKILL-003`）。
- MKT Skill 拒绝技术方案、代码变更和验收决定。编码 Agent 的 Skill 拒绝把未确认聊天当作已接受范围。
- 测试拒绝越界写入，并在缺少必需 Skill 时拦住任务。

关联需求：`REQ-SKILL-001`、`REQ-SKILL-003`、`REQ-SKILL-006`、`REQ-AGENT-002`、`REQ-MKT-002`。

实现状态：

- 内置 MKT 和 coding Skills 声明 roles、task types、artifacts、required tools、output schema 和 `does_not_cover`。Agent runtime 只加载边界匹配该任务的 Skill。覆盖缺口会阻止声称已支持。

### REQ-SKILL-006: Skill 能力深度

状态：规划中。

Skill 深度是当前模型使用的脚手架，不是更长的提示词。Harness 不假设模型很强。

验收标准：

- 每个 Skill 声明深度 0–4：清单（人）、填表、追问环、方法约束、校准质检。每一步标明执行者是模型、工具还是人。
- Skill 同时提供指南文本、schema、深度配置、确定性校验器和通过/失败示例。原始需求和代码的写入走工具。
- 运行时选择该模型与任务已通过校准的最低档（`REQ-HARNESS-004`），或项目策略。未测评或弱模型使用 Skill 的默认档；MKT 默认为深度 1，并保留深度 0。
- 校验器反复失败则降档或停止任务。禁止对同一提示词无界重试。
- 产出运行把 Skill 版本和深度档记在 WorkItem 或 MKT 记录上。
- 测试执行深度 0 和深度 1，在反复无效输出后强制降档，传感器失败时拒绝完成。

关联需求：`REQ-SKILL-001`、`REQ-SKILL-005`、`REQ-HARNESS-004`、`REQ-HARNESS-008`、`REQ-AGENT-002`、`REQ-MKT-002`。

实现状态：

- Skills 声明深度 0–4 并标明执行者。深度 2 追问缺失字段，深度 3 要求 actors 和 scenarios，深度 4 要求 confirm 且没有 open questions。未校准的深度 2–4 产品写入在 harness comparison 被采用前会被拒绝。反复无效输出会降档或停止。

## Harness 工具

### REQ-TOOL-001: Harness Tool Registry

HuntianLing 必须建模 agents 在 dsh 中可使用的 tools。

验收标准：

- 保存 tool id、capability、permission level、risk level 和 supported task types。
- 把 tools 映射到 agent roles 和 task specs。
- 拒绝当前 role/task 不允许的 tool usage。
- 当 tool calls 影响 delivery conclusions 时，把它们记录为 evidence。

实现状态：

- 内置工具注册表按角色和任务类型允许 original-requirement 写入、typecheck、test、doc-sync、git、CI、`browser.navigate`、`image.analyze`、`document.parse`、`database.migrate` 和 `web-api.call`，拒绝越权使用，并在环境准备时记录调用。
- 调用剩余类别工具会写入 `ToolCallEvidence`。当调用影响交付时，WorkItem evidence summary 会写入 `tool` producer check。托管 browser fleets 会失败并报错。Web-api transport 仅在调用时使用，不持久化 secrets。

Tool categories：

- Filesystem and code editing
- Terminal commands
- Browser automation
- Git and repository inspection
- Document parsing
- Image analysis
- Test execution
- CI/CD integration
- Database migration
- Web API calls

### REQ-TOOL-002: Tool Feedback and Required Information

Agent tasks 必须接收正确工作需要的信息。

验收标准：

- 注入 WorkItem context、parent/child tree、milestone、acceptance criteria、project tech profile、relevant source documents、prior agent feedback、tool permissions 和 checks。
- 要求 agents 返回 structured feedback、assumptions、open questions、evidence references 和 next actions。
- 任务开始前显示 missing required information。

实现状态：

- `inspectTask` 在开始前注入 WorkItem context、parent/child tree、milestone、acceptance、tech profile、intake source documents、prior agent feedback、tool permissions 和已执行 checks，并列 missing required information。
- 带 WorkItem 的 `startRun` 在缺少 required information 时被阻止。已完成的 Planner、Generator 和 Evaluator runs 包含 structured feedback、assumptions、open questions、evidence references 和 next actions。客户不能检查 agent task context。

## SCM、Git 和 CI/CD

### REQ-SCM-001: Source Control Service

HuntianLing 必须支持把代码变更链接到 WorkItems。

验收标准：

- 发现 repository metadata 和 current branch。
- 创建链接到 WorkItems 的 branches。
- 把 commits、diffs、tags 和 pull/merge requests 关联到 WorkItems。
- 按配置支持 GitHub、Gitea、GitLab 和 local Git。
- 核心运行不要求 GitHub。

建议 service：

```text
huntianling.scm
```

实现状态：

- `huntianling.scm` 通过注入的 runner 检查本地 Git 的 branch、HEAD、remotes 和 dirty 状态，不要求 GitHub。
- 关联 HEAD 会把 commit code link 和一条已执行的 `scm` 检查写到 WorkItem delivery evidence summary。
- 已实现本地仓库登记、WorkItem 分支、changeset 和 pull-request 记录。托管 GitHub、Gitea 和 GitLab 写入适配器通过同一套记录 push、开 pull request 和 merge。令牌在调用时或从环境提供，不会被持久化。

### REQ-SCM-002: Branch Management

开发分支必须作为项目数据管理，并链接到需求和交付证据。

验收标准：

- 为 project 注册一个或多个 repositories。
- 保存 branch name、base branch、target branch、linked WorkItems、linked Milestone、owner、creator、status、protection policy 和 last synchronization result。
- 支持为 WorkItems、Milestones、fixes、experiments 和 release stabilization 创建 branches。
- 应用 configurable branch naming rules 和 protected-branch rules。
- 检测 stale branches、merge conflicts、diverged bases、unpushed commits 和 branches without linked WorkItems。
- 当需求拆到多个 delivery slices 时，支持 stacked 或 dependent branches。
- branch operations 采用 adapter-based 模型，使 local Git、GitHub、Gitea 和 GitLab 使用同一内部模型。

建议 APIs：

```text
GET  /api/v1/projects/:id/repositories
POST /api/v1/projects/:id/repositories
GET  /api/v1/work-items/:id/branches
POST /api/v1/work-items/:id/branches
POST /api/v1/branches/:id/sync
POST /api/v1/branches/:id/rebase-check
```

实现状态：

- `huntianling.scm` 可为 project 登记本地 Git repository，并创建链接到 WorkItems 的托管分支。分支名使用可配置的 `{workItemId}` 模板；`main` 等受保护名称会被拒绝。
- sync 和 rebase-check 会记录 unpushed、diverged、conflict 和 unlinked 信号。stacked 分支可以把 parent branch 作为 base。托管 GitHub、Gitea 和 GitLab 仓库登记到与本地 Git 相同的分支记录上。未知提供方和缺失的托管远程元数据会失败即报错。

### REQ-SCM-003: Code Submission Workflow

代码提交必须把 commits、reviews、checks 和 merge decisions 回链到需求。

验收标准：

- 把 commits、diffs、tags、pull requests、merge requests、reviews 和 merge results 链接到 WorkItems 和 Milestones。
- 支持带 WorkItem identifiers 的 configurable commit message templates。
- 把 patch generation、commit creation、branch push、pull request creation、review request 和 merge 拆成独立可审计动作。
- agent push、open pull request 或 merge 前必须满足 configured approvals。
- 记录 author、committer、actor、tool run、branch、repository、changed files 和 related acceptance criteria。
- 缺少 required code submission evidence 时阻止 delivered 状态。

建议 APIs：

```text
POST /api/v1/work-items/:id/changesets
GET  /api/v1/work-items/:id/changesets
POST /api/v1/changesets/:id/commit
POST /api/v1/branches/:id/push
POST /api/v1/branches/:id/pull-request
POST /api/v1/pull-requests/:id/merge
```

实现状态：

- Changeset 把 patch generation 和 commit 分开。Commit message 使用包含 WorkItem id 的可配置模板。push、创建 pull request 和 merge 仍是独立动作，并且仍需要 C1 的 human approval。
- commit、changed-file、diff 和 pull-request 记录会写到 WorkItem delivery evidence summary。托管 push、创建 pull request 和 merge 是针对 GitHub、Gitea 和 GitLab 的独立动作，并且仍需要 C1 的 human approval。托管 review 适配器仍在计划中。

### REQ-CODE-001: Requirement Code View

每个需求必须有 Code View，显示与该需求相关的代码和交付证据。

验收标准：

- 显示 linked repositories、branches、commits、diffs、changed files、pull requests、reviews、CI runs、coverage、security findings 和 deployment evidence。
- 按 WorkItem、Milestone、delivery slice、acceptance criterion 和 agent/human contributor 分组代码变更。
- 用户可以在不离开 requirement detail flow 的情况下查看 changed files 和 diffs。
- 显示哪些 acceptance criteria 拥有 code、tests、reviews 和 CI evidence。
- 标记没有链接到 WorkItem 或 acceptance criterion 的 code changes。
- 除非 project policy 授权写操作，否则 external users 只拥有 read-only views。

建议 APIs：

```text
GET /api/v1/work-items/:id/code-view
GET /api/v1/milestones/:id/code-view
GET /api/v1/projects/:id/unlinked-code
```

实现状态：

- JSON Board Store 现在为 WorkItems 持久化 `DeliveryEvidenceSummary` 记录，包含 code links、pull requests、review links、CI runs、deployment links、evidence links、checks、compliance obligations、risk acceptances、provenance links、notes 和 timestamps。
- v1 Web API 暴露 WorkItem Code View 读取、Milestone Code View 读取、Project unlinked-code 读取，以及 WorkItem delivery evidence 读写。Milestone Code View 同时包含直接分配到 Milestone 的 WorkItems 和通过显式 delivery slices 参与该 Milestone 的父 WorkItems。
- 浏览器主看板包含 Evidence board 视图，并在卡片上显示 PR、review、CI、missing required checks 和 governance blockers badges。
- `huntianling.scm` 会检查本地 Git，并把 HEAD 作为已执行 code evidence 关联。Code View 现在还会显示托管的 repositories、branches、changeset diffs、changed files 和 pull requests，包括托管提供方和 pull-request URL。未关联分支会出现在 project unlinked-code 中。托管 CI adapters 仍在计划中。

### REQ-CI-001: CI/CD Service

HuntianLing 必须读取并使用 CI/CD results 作为 verification evidence。

验收标准：

- 发现 CI provider 和 workflow config。
- 授权后触发 pipelines。
- 等待 run completion。
- 在可用时读取 logs、job status、artifacts、JUnit reports、coverage reports、SARIF reports 和 Playwright reports。
- 把 CI runs 和 reports 链接到 WorkItems 和 milestones。
- 通过 adapters 支持 GitHub Actions、Gitea Actions、GitLab CI、Jenkins 和 local command runners。

建议 service：

```text
huntianling.ci
```

实现状态：

- CI runs 可以作为 delivery evidence links 记录，也可以作为 WorkItem 上 required 或 optional CI checks 记录。
- Project 和 Milestone delivery evidence rollups 会统计带 CI evidence 的 WorkItems，并暴露 pending、missing、failing 或 blocked required CI checks。
- `huntianling.ci` 通过注入的 runner 运行本地 typecheck 和 test，并把 ci-run 链接以及已执行的 `ci` 检查写到 WorkItem。
- 托管 GitHub Actions、Gitea Actions 和 GitLab CI 适配器可发现 workflows、触发已授权 pipelines、等待完成后把 JUnit、coverage、SARIF 和 Playwright artifacts 作为已执行 CI evidence 附加。令牌在调用时或从环境提供，不会被持久化。Jenkins 适配器仍在计划中。

### REQ-EVIDENCE-001: Evidence-Based Delivery Gates

WorkItems 不能因为 agent 声称完成就被标记为 delivered。

验收标准：

- 交付要求 acceptance coverage、涉及代码时的 linked code change、test results、review status 和 configured security checks。
- 缺少 evidence 会阻止 `delivered` transition，并解释缺失内容。
- Check results 附加到 WorkItems，并汇总到 Milestones。
- 按 project 支持 Definition of Ready 和 Definition of Done checks。
- 外部 Issue cards 只有在投影 WorkItem 已发布包含 WorkItem、acceptance、code、review、CI、evidence 和 gate results 的 delivery gate certificate 后，才能以 Done 关闭。

建议 service：

```text
huntianling.checks
```

实现状态：

- WorkItem delivery evidence summaries 保存 acceptance、code、review、CI、evidence、governance、security、reliability 和 trust 领域的 required checks。
- Project delivery evidence rollups 暴露 ready WorkItems、blocked WorkItems、missing required checks、pending required checks、failed required checks、open risk acceptances、active obligations 和 unapproved obligations。
- 如果 WorkItem 配置了 blocking delivery evidence、unapproved compliance obligations 或 open risk acceptances，它不能流转到 `delivered`。
- Browser WorkItem detail 会显示 pre-delivery gate panel，把 acceptance、child completion、Milestone slices、workflow handoffs、code、review、CI、required checks、governance 和 dependency readiness 分开呈现。当 preflight 存在 blockers 时，`delivered` action 会被禁用，同时 server transition 仍是最终 enforcement point。
- Evidence workspace 会从同一个 Evidence board payload 渲染 project-level gate summary、evidence gap matrix、blocker queue、governance risk queue 和 status lanes，使团队可以在打开单个 WorkItem 前看到 delivery gaps。
- GitHub Issue projection 在 card 进入 Done 前要求 `huntianling-delivery-gate` certificate。非法 completed closes 会被重新打开，并回到之前的开放泳道；如果之前泳道缺失或已经是终态，则回到 In review。
- 定时和手动触发的 recovery sweep 会扫描 completed closed GitHub Issue projections，并重新打开缺少该 certificate 的 card，同时让已通过门禁的 Done cards 保持关闭。
- 客户可见的已交付要求通过的 Evaluator、CI 或本地 Git 已执行检查。Generator 自检、备注，以及设计版本变化后的过期证据都不能完成交付。
- `GET/PATCH /api/v1/projects/:id/delivery-policy` 配置 Definition of Ready 和 Definition of Done 检查。缺少已执行证据仍阻止 `delivered`。`GET /api/v1/work-items/:id/delivery-gates` 会点名缺失项。

## 外部 Issue Tracker 集成

### REQ-ISSUE-001: Optional Issue Tracker Synchronization

外部 issue trackers 可以 mirror 或 import work，但不能替代 HuntianLing 的内部 WorkItem 模型。

验收标准：

- 按配置支持 GitHub Issues、Gitea Issues 和 GitLab Issues adapters。
- 通过 stored external references 把 external issues 映射到 internal WorkItems。
- 即使 external tracker 缺少对应概念，也保留 internal parent-child hierarchy、milestones、acceptance coverage、agent feedback 和 evidence。
- 支持 import、export 和 sync conflict reporting。
- 清楚标记 externally synchronized fields 和 internally owned fields。
- Projects 可以在没有 issue tracker integration 的情况下运行。
- External tracker 的 completed close 只有在 linked internal delivery evidence 和 gate result 已发布到 external card projection 后才会成为有效关闭；否则它是 recovery event。

建议 service：

```text
huntianling.issueSync
```

实现状态：

- Repository workflows 会把 GitHub Issues 投影到配置的 user Project。Issue open 和 reopen events 更新投影 Status 泳道；显式 `workflow_event` dispatches 推动卡片进入 Backlog、Ready、In progress、In review 和 gated completion。Pull request events 只初始化被引用 Issues 的 Start Date，不负责 Status 泳道切换。
- GitHub lifecycle policy 会阻止缺少 delivery gate certificate 的 `completed` workflow dispatch；没有该 certificate 的 completed native Issue close events 会重新打开 Issue，并把 Project card 恢复到之前的开放泳道或 In review。
- 手动 `recover_closed` workflow event 会重新打开已经非法关闭的 Issue card，并把它返回 In review，让未完成 tasks、evidence 和 gate checks 继续可见。
- `recover_illegal_closed` workflow event 和 scheduled lifecycle sweep 会批量恢复非法 completed closes，避免未完成 tasks 从 board 上消失。
- 完整内部 issue-sync adapters、stored external references、import/export flows 和 conflict reporting 仍在计划中。

## 治理、合规、安全、可靠性和可信

HuntianLing 必须把治理需求转成 project policies、controls、checks、evidence 和 auditable decisions。系统不作法律判断；它记录 project owner、compliance owner 或 legal reviewer 选择的适用义务，并执行配置的交付规则。

Reference framework packs 应可配置。初始 packs 应包含 NIST CSF 2.0 用于 cybersecurity governance、OWASP ASVS 用于 application security verification、NIST AI RMF 用于 AI risk management，以及 ISO/IEC 42001 用于 AI management systems。

### REQ-GOV-001: Compliance Obligation Registry

Projects 必须跟踪适用的法律、监管、合同和认证义务。

验收标准：

- 保存 obligation id、title、jurisdiction、source、applicability reason、owner、reviewer、effective date、review date、status 和 linked controls。
- 支持项目选择 regional laws、industry rules、internal policies、customer contracts 和 certification programs。
- 把 obligations 链接到 WorkItems、acceptance criteria、data categories、user roles、source documents、controls、risks、checks 和 evidence。
- obligation 变成 enforcement policy 前必须 reviewer approval。
- 标记影响 regulated data、authentication、authorization、audit、retention、AI output、payment、security、privacy 或 availability 的 WorkItems。

建议 APIs：

```text
GET  /api/v1/projects/:id/compliance/obligations
POST /api/v1/projects/:id/compliance/obligations
POST /api/v1/compliance/obligations/:id/approve
GET  /api/v1/work-items/:id/compliance
```

实现状态：

- WorkItem delivery evidence summaries 可以保存 compliance obligation summaries，包含 jurisdiction、source、owner、reviewer、effective date、review date、status、control ids 和 evidence links。
- WorkItem compliance 读取会暴露 obligations、governance checks、security checks、reliability checks、trust checks、risk acceptances 和当前 governance blockers。
- 未批准 obligations 会阻止已配置的 WorkItem delivery transition 进入 `delivered`。
- Project 级 obligation registries、approval workflows、framework pack selection 和 obligation lifecycle APIs 仍在计划中。

### REQ-GOV-002: Certification Control Packs

认证要求必须表示为版本化 control packs，并映射到 WorkItems 和 evidence。

验收标准：

- 保存 control pack id、framework name、version、control id、control text summary、applicability、owner、required evidence 和 check rules。
- 支持 internal security baselines 和 customer audit requirements 的 custom control packs。
- 把 controls 映射到 WorkItems、checks、code evidence、CI reports、manual approvals 和 audit events。
- 按 Project、Milestone 和 WorkItem 显示 certification readiness。
- 保留 old control pack versions，使历史 evidence 可解释。

建议 service：

```text
huntianling.governance
```

### REQ-SEC-001: Security Requirement Gates

Security requirements 必须是一等交付门禁。

验收标准：

- 按 security impact、data sensitivity、permission impact、exposed API surface、dependency risk 和 deployment risk 分类 WorkItems。
- 对配置的 high-risk WorkItems 要求 threat modeling。
- 把 security controls 映射到 acceptance criteria 和 Definition of Done checks。
- 从 tests、code review、dependency scans、secret scans、static analysis、dynamic tests 和 manual reviews 摄取 security evidence。
- required security controls 或 evidence 缺失时阻止交付。
- residual risk acceptance 记录 approver、reason、scope、expiration 和 compensating controls。

建议 APIs：

```text
GET  /api/v1/work-items/:id/security
POST /api/v1/work-items/:id/security/threat-model
POST /api/v1/work-items/:id/security/risk-acceptance
```

实现状态：

- WorkItem security 读取会从 delivery evidence summary 暴露 security checks 和 security risk acceptances。
- 状态为 `missing`、`failing` 或 `blocked` 的 required security checks 会显示为看板 blockers，并阻止已配置的 delivery completion。
- Threat model records、scan ingestion、security classification、compensating controls 和 dedicated risk-acceptance write APIs 仍在计划中。

### REQ-REL-001: Reliability and Resilience Gates

Reliability 必须作为可度量需求捕获，并在交付前检查。

验收标准：

- 保存 service-level objectives、availability targets、latency targets、error budgets、capacity assumptions、backup requirements、restore objectives 和 dependency assumptions。
- 把 reliability requirements 链接到 WorkItems、Milestones、CI evidence、load tests、operational checks 和 incident records。
- 对配置的 production-facing WorkItems 要求 observability plans。
- 跟踪 reliability risks、mitigations 和 residual risk approvals。
- required reliability tests、rollback plans、backup checks 或 monitoring evidence 缺失时阻止交付。
- reliability readiness 汇总到 Milestones 和 release views。

建议 APIs：

```text
GET  /api/v1/projects/:id/reliability
POST /api/v1/work-items/:id/reliability
POST /api/v1/work-items/:id/reliability/evidence
```

实现状态：

- WorkItem reliability 读取会从 delivery evidence summary 暴露 reliability checks 和 reliability risk acceptances。
- Required reliability checks 会汇总到 Project、Milestone、WorkItem 和 Evidence board 视图。
- SLO records、load-test ingestion、observability plans、rollback evidence、backup checks、incident links 和 dedicated reliability write APIs 仍在计划中。

### REQ-TRUST-001: AI Trustworthiness and Provenance

AI 生成的分析、需求、代码、测试和结论必须可解释、可评审。

验收标准：

- 记录 source inputs、prompt templates、model identity、skill versions、tool calls、retrieved context、generated output、human edits、approvals 和 verification evidence。
- AI 生成 requirement analysis 和 design 时必须带 confidence、assumptions、limitations 和 open questions。
- 对使用 AI 或实质依赖 AI 输出的 features 支持 AI risk assessment。
- 把 AI outputs 链接到 WorkItems、source documents、Team Chat messages、agent runs、checks 和 audit events。
- provenance 或 verification evidence 缺失时阻止 automated delivery claims。
- AI 生成 requirements 成为 committed WorkItems 前支持 human review 和 correction。

建议 APIs：

```text
GET  /api/v1/work-items/:id/trust
GET  /api/v1/agent-runs/:id/provenance
POST /api/v1/work-items/:id/ai-risk-assessment
```

实现状态：

- WorkItem trust 读取会从 delivery evidence summary 暴露 trust checks、trust risk acceptances、evidence links 和 provenance links。
- Required trust checks 和 open risk acceptances 会汇总到 cards、Evidence board lanes、Project evidence rollups 和 delivery transition blockers。
- Agent-run provenance records、prompt/model/tool-call capture、AI risk assessment writes、confidence/assumption capture 和 human correction workflows 仍在计划中。

### REQ-TRUST-002: Evidence Reports and Attestations

系统必须产出 humans 可用于 audit、certification 和 release decisions 的 evidence reports。

验收标准：

- 生成 Project、Milestone、WorkItem、release 和 certification evidence reports。
- 报告包含 applicable obligations、mapped controls、completed checks、missing checks、risk acceptances、approvals、source code links、CI evidence、security evidence、reliability evidence、AI provenance 和 audit events。
- human owner 签署或批准前，reports 标记为 draft。
- immutable report snapshots 包含 timestamp、actor、source data version 和 export hash。
- 支持 JSON 和 Markdown export；PDF export 可通过 document rendering adapter 增加。

建议 APIs：

```text
POST /api/v1/projects/:id/evidence-reports
GET  /api/v1/evidence-reports/:id
POST /api/v1/evidence-reports/:id/approve
GET  /api/v1/evidence-reports/:id/export
```

## Web 和 API 扩展

### REQ-WEB-007: 三种人群 Web 界面

状态：规划中。

Web 服务提供一次登录和三种人群界面，投影同一组 WorkItem 记录。

验收标准：

- 登录后 UI 是该主体人群 `customer`、`developer` 或 `admin` 的界面。其他界面返回授权错误。
- 客户界面：只创建和打开该客户的项目；MKT 对话框；列出自己提交的原始需求；显示客户侧进度标签：已提出、待客户确认、分析中、开发中、已交付。
- 客户界面隐藏环境搭建、Agent 内部、门禁、开发看板控件和其他客户的项目。
- 开发界面：用于收集、设计和进度的标准开发看板；Agent 频道（`REQ-COLLAB-001`）；并能把仓库和环境配置绑到客户项目。
- 管理员界面：用户、项目归属、环境是否就绪和插件配置。它不是客户需求正文的主编辑界面。
- 客户侧进度是有证据状态的投影。手工编辑的摘要不能向客户显示已交付。
- 产品问题、缺失决策和验收提示回到客户的 MKT 对话框。
- 测试覆盖每种人群一个用户、跨人群路由被拒绝，以及由交付证据驱动的客户进度变化。

关联需求：`REQ-AUTH-001`、`REQ-WEB-002`、`REQ-WEB-003`、`REQ-MKT-001`、`REQ-HARNESS-008`。

### REQ-WEB-002: Authenticated Web UI

浏览器 UI 必须从 token-protected writes 升级到 full user login。

验收标准：

- 登录页支持 regional provider sets。
- 所有 Web API calls 返回清晰 authentication 和 authorization errors。
- WorkItem、Milestone、Intake、Team Chat、Agent、Skill、SCM、Code View、CI、Governance、Security、Reliability、Trust 和 Check pages 遵守 project permissions。

实现状态：

- 浏览器表面已有登录面板，支持 region selection、password login、provider discovery display、logout 和外部 API token 输入。
- Web auth 启用后，非 auth API calls 在没有有效 session、API token 或兼容静态 token 时返回 `authentication required`。
- Project-scoped 用户只能看到允许的 Projects；访问无权 Project、WorkItem 和 Milestone routes 会返回 `project access denied`。
- Admin 用户目录创建和登录审计列表复用同一个 auth context。OAuth provider 页面仍在计划中。

### REQ-WEB-006: Workspace Information Architecture

浏览器 UI 必须把主要工作流拆成清晰的 Project 工作区，不能把所有控制项放在一个混合页面里。

验收标准：

- 一个 Project 有录入、需求、计划、团队、工作流、证据和治理、设置等顶层工作区。
- 视图选择器只显示属于当前工作区的 board views。
- 侧栏 forms 和 lists 按当前工作区显示。
- WorkItem detail panels 只显示当前工作区需要的 sections。
- Web auth 启用时，未登录用户进入 settings 和 access 工作区。
- 每个 workspace 必须有一个 primary job、一个 primary work surface 和一个 secondary inspection area；product UI 不能把无关的 planning、execution、evidence 和 administration controls 混到一个页面。
- Backlog pages 使用 list、hierarchy、ranking、rollup 和 scoped display controls；planning pages 使用 timeline 或 Milestone-oriented views；team pages 使用 capacity 和 ownership views；workflow pages 使用 run state 和 handoff views；evidence pages 使用 gate matrices。
- 与用户 primary task 无关的重复 summary metrics、generic cards 和 creation controls 必须从页面移除。

实现状态：

- 开发界面 `/developer` 使用五项工作：收集、设计、进度、频道、环境。融合的七模块驾驶舱暂留在 `/board`，待后续拆除。设计字段仍可通过 WorkItem API 编辑。
- Workspace navigation 使用 Intake、Backlog、Plans、Team、Runs、Evidence 和 Admin 这些产品计划标签；每个 workspace 会显示负责角色、主要记录、预期产出和交付阶段。
- 当前工作区控制哪些侧栏 panels、board views 和 WorkItem detail sections 可见。
- 桌面端 view switching 使用 workspace-scoped tabs，移动端保留同一组 scoped view selector。
- Workspace health metrics 会按当前业务 workflow 切换：intake sessions、backlog traceability、Milestone slices、WIP、workflow runs、evidence gates 或 admin state。
- Workspace shell 使用 compact segmented view tabs、page-scoped KPI summaries 和 conditional inspector panel，让 navigation、primary work 和 detail inspection 保持视觉分离，同时不会为空详情内容预留空间。
- Sidebar 不再在 planning、workflow 和 evidence workspaces 显示 requirements tree；这些页面的 side context 会聚焦各自的 setup、scope 或 inspector model。
- 需求工作区包含 Backlog 工作台，支持 search、type filters、warning filters、Milestone filters、priority/status/Milestone/type sorting、可点击风险桶和 Story priority queue strip。
- 需求工作区会渲染更专业的 Backlog 工作台，包含 business-level filters、主 Backlog list 和 lifecycle flow summary，而不是只把 status board 作为唯一的主组织方式。
- Backlog 工作台包含按 Project 归属、存储在浏览器中的 saved views，以及用于 planning、definition readiness、traceability 和 next-action signals 的 column visibility controls。
- 主 Backlog list 支持 visible-item selection，以及批量 priority、Milestone 和 status 更新，同时保留 server-side transition gates。
- 需求工作区把 view controls 和 filters 放在 work list 上方，以 Backlog list 作为 primary surface，并把 portfolio、Milestone、risk、Ready/Done、queue 和 lifecycle-flow panels 移到 secondary insight drawer，而不是默认展开所有辅助面板。
- WorkItem composer 默认折叠，并且只在需求工作区显示，避免评审和交付工作区被创建控件占据。
- Plans 工作区显示 Milestone roadmap workbench 用于 timeline planning，并显示 Delivery Slice workbench 用于 cross-Milestone parent requirement delivery，不再退回 generic status cards。
- Admin workspace 包含 Business CRUD coverage view，因此 project owners 可以在 workflow 依赖某个对象前看到哪些 business objects 具备 create、read、update、lifecycle 以及 delete 或 archive policies。
- Admin workspace 会把 access settings 和 Audit Trail view 分开；Audit Trail 提供 Project-level filters、event timeline，以及 action/object/actor summaries。
- URL 保存 `areaId`、`projectId`、`viewId`，并在适用时保存选中的 `intakeSessionId`，直接链接会重新打开同一个工作区上下文。

### REQ-WEB-003: Intake Chat UI

浏览器 UI 必须包含 project-scoped requirement intake chat。

验收标准：

- 用户可以输入 text ideas。
- 用户可以上传 supported files。
- 用户可以审查 extracted content、AI analysis、candidate requirements 和 source references。
- 用户可以批准 selected candidate nodes 进入 WorkItem tree，并分配到 Milestone。

实现状态：

- 浏览器表面包含 intake workspace，支持 Project-scoped session creation、session selection、chat-style message entry、file upload、source document review、candidate review、source reference review、candidate field editing、candidate selection、candidate rejection/restore、Milestone assignment、analysis，以及批准生成正式 WorkItems。
- UI 在浏览器中读取 Markdown 和 plain-text files，并把 image、PDF、Word 和 generic file records 以 pending parser status 保存。
- Candidate approval 会把 selected candidate ids 发送给 v1 API。Child candidates 通过 approval path 自动包含必需 ancestors，或复用已经批准的 parent candidates，从而保留 parent traceability。
- 从 approved candidates 生成的 WorkItems 会在 requirement detail 中显示 intake-origin panel，包含 source session、candidate、message/file references、chunks、confidence 和 quote text。
- 客户界面会列出开放的 clarifying questions，并在 MKT 对话框接受结构化 follow-up，包括确认跟踪。开放问题会把进度标为待客户确认。

### REQ-WEB-004: Agent and Evidence Panels

浏览器 UI 必须显示 AI team 和 delivery evidence。

验收标准：

- WorkItem detail 有 Details、Tree、Acceptance、Milestone、Agent Feedback、Source Evidence、Code、CI 和 Audit tabs 或 panels。
- Team Chat view 显示 project、Milestone、WorkItem、branch、pull request 和 CI conversations。
- Milestone view 显示 readiness、delivery evidence、blockers 和 risk summaries。
- Project view 显示 skill coverage 和 missing skills。

实现状态：

- WorkItem requirement detail 现在为从 approved intake candidates 生成的 WorkItems 显示 Source Evidence，使用 v1 board-detail API 返回的同一组 intake-origin source references。
- WorkItem requirement detail 也会为 manually split WorkItems 显示可编辑的 source input 和 decomposition reason 字段。
- WorkItem detail panels 包含 scoped Audit tab，会通过 v1 API 读取当前 WorkItem 的 audit timeline。
- WorkItem detail panels 包含 delivery gate panel 和 status action summary，使 agent、evidence、workflow、governance 和 dependency blockers 在用户把 WorkItem 标记为 delivered 前可见。
- Evidence workspace 会分离 gate matrix、blocker queue、governance queue 和 status lanes，使 delivery evidence 成为 project-level operating surface，而不只是 WorkItem detail tab。
- 开发界面的进度详情会从 WorkItem 上的本地 Git、本地检查和 Evaluator 记录显示 Agent、代码、CI 和证据面板。

### REQ-WEB-005: Governance and Trust Dashboard

浏览器 UI 必须在同一 delivery workflow 中显示 compliance、security、reliability 和 trust readiness。

验收标准：

- Project view 显示 applicable obligations、control coverage、risk register、open exceptions、security readiness、reliability readiness、AI trust assessments 和 evidence report status。
- WorkItem detail 显示 required controls、mapped checks、missing evidence、residual risks、approval requirements 和 trust provenance。
- Milestone view 汇总 planned delivery scope 的 compliance、security、reliability 和 trust readiness。
- 当 role 允许时，用户可以 request review、approve obligations、accept residual risk 和 sign evidence reports。

实现状态：

- WorkItem detail 会在 delivery gate、Evidence 和 Governance panels 中显示 governance blocker counts，包含会阻止 delivery 的 unapproved obligations 和 open risk acceptances。
- Evidence workspace 包含 governance risk queue，会在 delivery blocker queue 旁边展示带有 unapproved obligations、open risk acceptances 和 governance blockers 的 WorkItems。
- Project-level governance dashboards、review requests、approval actions、residual-risk acceptance actions 和 signed evidence reports 仍在计划中。

## 审计和合规

### REQ-AUDIT-001: Audit Log

重要变化必须可审计。

验收标准：

- 记录 actor、action、target、project、timestamp、request source 和 changed fields。
- 覆盖 auth events、WorkItem changes、milestone changes、intake approvals、team messages、decisions、approvals、agent runs、skill changes、tool calls、governance policy changes、compliance approvals、risk acceptances、security checks、reliability checks、trust assessments、SCM actions、code submissions、CI actions 和 gate decisions。
- 支持按 project、actor、target 和 date range 过滤。

建议 APIs：

```text
GET /api/v1/projects/:id/audit-events
GET /api/v1/work-items/:id/audit-events
```

实现状态：

- JSON Board Store 会持久化 `AuditEvent` records，包含 actor、action、target、Project、timestamp、request source、changed fields、reason 和 correlation id。
- Board Store write paths 会为 Projects、Milestones、WorkItems、team members、workflow summaries、delivery evidence、intake sessions、intake messages、intake source documents、intake candidates、intake approvals 和 Milestone delivery slices 记录 audit events。
- v1 Web API 暴露 Project-scoped audit reads，支持 actor、action、target、date range 和 limit filters，并提供 WorkItem-scoped audit reads。
- 浏览器 Admin workspace 包含 Audit Trail view，支持 actor、action、target type、target id、date range 和 limit filters，并显示 Project event timeline 以及 action、object、actor summaries。
- WorkItem detail panels 会使用 WorkItem audit API 显示 scoped audit timelines。
- Login、failed login、logout 和 API-token 创建会持久化为 `auth_events`，并通过 `GET /api/v1/admin/auth-events` 列出。Governance policy audit writes 和 report signing audit records 仍在计划中。
- `/admin` 管理员界面可列出用户、创建目录用户、分配人群、授予项目归属并写审计事件、查看登录审计、访问设置和最近一次环境准备，以及读取项目审计。开发者访问返回 403。

## 实现顺序

保留已实现的基线记录及 B/C、D 切片限定范围内的成果。切片实现不能证明完整 harness 产品已经验收。[2026-09-12 运行能力一致性审查](reviews/2026-09-12-runtime-alignment.zh.md) 记录了当时所查工作区快照中的虚假完成复现，不代表对 D6 或后续代码的新一轮审查。界面重排跟 [Web 界面重构计划](../architecture/web-shell-refactor.zh.md)。我们自己做这些工作时的 Skill 短板见 [Harness Engineering 产品定位](harness-engineering.zh.md#自身-harness-的-skill-短板)。

用户确认 Grok 已推进到 D6，并要求将缺陷修正排在既有 D 序列之后。保留 D1–D15 及其当前进度，在下方追加 D16–D21。不要依据本审查打断或重置既有切片。这些修正对应既有需求，仍是完整 harness 产品验收的必需条件。Grok 开始实现前应按最新源码复核每项发现：已修复的补充证据，仍存在的通过仓库 self-harness 流程实现并独立评价。

### 阶段 A — 已交付（保留，不重做）

`REQ-BOARD-001`、`REQ-BOARD-002`、`REQ-BOARD-003`（部分）、`REQ-BOARD-004`（部分）、`REQ-BOARD-005`、`REQ-REQ-001`（字段）、`REQ-MILESTONE-001`、`REQ-MILESTONE-002`、`REQ-WEB-001`、`REQ-WEB-002`（部分）、`REQ-WEB-003`（基础）、`REQ-WEB-004`（部分）、`REQ-WEB-006`（一块融合驾驶舱）、`REQ-AUTH-001`（持久用户目录）、`REQ-INTAKE-001`（基础）、`REQ-INTAKE-002`（文本/Markdown）、`REQ-INTAKE-003`（确定性）、`REQ-TEAM-001`（部分）、`REQ-TEAM-002`（部分）、`REQ-FLOW-005`（摘要）、`REQ-FLOW-022`、`REQ-TRACE-001`、`REQ-AUDIT-001`（基础）。

### 阶段 B — 首个产品里程碑（按此顺序）

| 顺序 | 切片 | REQ 编号 |
| ---: | --- | --- |
| B1 | 拆开 `page.ts`；登录按人群落地；拒绝其他界面 | `REQ-WEB-007`、`REQ-AUTH-001`、`REQ-WEB-001` |
| B2 | 客户界面：自己的项目、MKT 对话框、原始需求、客户侧进度 | `REQ-WEB-007`、`REQ-MKT-001`、`REQ-INTAKE-001`、`REQ-WEB-003` |
| B3 | MKT Skill 包深度 0–1，含边界、schema、校验器、示例 | `REQ-MKT-002`、`REQ-SKILL-001`、`REQ-SKILL-005`、`REQ-SKILL-006` |
| B4 | 本仓库和第二项目共用的一份版本化环境配置；就绪或阻塞 | `REQ-HARNESS-001`、`REQ-TOOL-001`、`REQ-SKILL-003` |
| B5 | Planner、Generator、Evaluator 三个任务定义；默认方法基线 | `REQ-HARNESS-006`、`REQ-HARNESS-007`、`REQ-AGENT-002`、`REQ-FLOW-014`、`REQ-METHOD-001`（仅 User Story） |
| B6 | 开发 Agent 频道首个切片类型；类型化交接 | `REQ-COLLAB-001`、`REQ-COLLAB-002`、`REQ-COLLAB-004`、`REQ-FLOW-021` |
| B7 | 开发界面重排：收集、设计、进度、频道、环境 | `REQ-WEB-007`、`REQ-REQ-001`、`REQ-WEB-006` |
| B8 | 管理员界面：用户、归属、环境就绪、访问、审计 | `REQ-WEB-007`、`REQ-AUDIT-001` |
| B9 | 本地 Git + 本地检查 + 所属记录上的 Evaluator 证据；客户进度来自证据 | `REQ-SCM-001`、`REQ-CI-001`、`REQ-HARNESS-003`、`REQ-HARNESS-008`、`REQ-EVIDENCE-001`、`REQ-WEB-004` |
| B10 | 持久检查点、中断、恢复；一次 Story 交付运行 | `REQ-HARNESS-002`、`REQ-FLOW-020` |
| B11 | 衡量一次 Skill 深度变化；HuntianLing 自身开发演示 | `REQ-HARNESS-004`、`REQ-HARNESS-005` |

### 阶段 C — 第一条闭环能跑之后

| 顺序 | 切片 | REQ 编号 |
| ---: | --- | --- |
| C1 | push/PR/CI 前的权限边界 | `REQ-AGENT-004` |
| C2 | 分支、PR、Code View | `REQ-SCM-002`、`REQ-SCM-003`、`REQ-CODE-001` |
| C3 | 在当前 JSON 存储后接 SQLite | `REQ-DATA-001`（SQLite）、`REQ-DATA-002` |
| C4 | 密码哈希升级；其余协作任务类型 | `REQ-AUTH-002`、`REQ-COLLAB-003` |
| C5 | 阶段门禁、审批、工作流可见性、内置工作流管理 | `REQ-FLOW-002`、`REQ-FLOW-003`、`REQ-FLOW-004`、`REQ-FLOW-005`、`REQ-FLOW-012`、`REQ-FLOW-013`、`REQ-FLOW-015`、`REQ-FLOW-017`、`REQ-FLOW-019` |
| C6 | 调度、租约、看板上的 Agent 反馈 | `REQ-TEAM-003`、`REQ-TEAM-004`、`REQ-AGENT-003` |
| C7 | 工具缺输入反馈；用 skill-creator 起草 Skill，仍要门禁 | `REQ-TOOL-002`、`REQ-SKILL-002` |
| C8 | Markdown/纯文本以外的附件；LLM 候选抽取 | `REQ-INTAKE-002`、`REQ-INTAKE-003` |

### 阶段 C 之后 — 已交付切片的残留

阶段 C 在 C8 结束。没有 C9。CR 行补齐已经交付切片里还没做完的部分。只在有实测需要时做，并且排在阶段 D 外壳之前。Outcome 是客户可见结果；Depends on 是最早前置；Out of scope 放到更后的行。

| 顺序 | 切片 | Outcome | Depends on | Out of scope | REQ 编号 |
| ---: | --- | --- | --- | --- | --- |
| CR1 | 澄清 MKT 追问 | 客户在 MKT 对话框补齐缺字段，不必进入开发界面 | C8 | 默认 live-model extractor | `REQ-INTAKE-001` 剩余、`REQ-WEB-003` 剩余、`REQ-MKT-001` 剩余 |
| CR2 | 托管 SCM 写入适配器 | 项目可通过同一套 WorkItem 记录在 GitHub、Gitea 或 GitLab 上 push、开 PR 和 merge | C2 | 托管 CI | `REQ-SCM-001` 剩余、`REQ-SCM-002` 剩余、`REQ-SCM-003` 剩余、`REQ-CODE-001` 剩余、`REQ-AGENT-004` 剩余 |
| CR3 | 托管 CI 适配器 | 授权后触发流水线，并把 JUnit/coverage/SARIF/Playwright 产物写成已执行 CI 证据 | CR2 或 B9 本地 CI | GitHub Issue 同步 | `REQ-CI-001` 剩余 |
| CR4 | 托管 OCR 和默认 live-model intake extractor | 图片/PDF/Word 无需测试桩即可抽取，且 `mode: llm` 有已配置 extractor | C8 | 把托管模型集群当产品 | `REQ-INTAKE-002` 剩余、`REQ-INTAKE-003` 剩余 |
| CR5 | 团队名册残留 | 项目可增删 role、reviewers、approvers、watchers，并应用 role/repo/CI/environment WIP policies | C6 | 调度打分残留 | `REQ-TEAM-001` 剩余、`REQ-TEAM-002` 剩余 |
| CR6 | 调度残留 | 推荐考虑 branch ownership 和 approvals；transfer 是独立事件；Code View 显示 lease badges；列出 migration conflicts | C6、CR5 | token-cost 容量记账 | `REQ-TEAM-003` 剩余、`REQ-TEAM-004` 剩余、`REQ-FLOW-003` 剩余 |
| CR7 | 工作流残留 | 模板替换/回滚、能力文档/夹具、周期/事件触发步骤、review-request APIs、handoff accept/reject、overload 和 release-readiness 汇总 | C5 | 可视化设计器和 Test Lab | `REQ-FLOW-002` 剩余、`REQ-FLOW-004` 剩余、`REQ-FLOW-005` 剩余、`REQ-FLOW-012` 剩余、`REQ-FLOW-013` 剩余、`REQ-FLOW-014` 剩余、`REQ-FLOW-015` 剩余、`REQ-FLOW-017` 剩余、`REQ-FLOW-019` 剩余、`REQ-FLOW-020` 剩余、`REQ-FLOW-021` 剩余 |
| CR8 | Skill 和 harness 残留 | MKT 以外的覆盖扫描、Skill 深度 2–4、live-model 重复试验、标注自身开发运行时步骤 | C7、B11 | 技术 Skill packs | `REQ-SKILL-003` 剩余、`REQ-SKILL-005` 剩余、`REQ-SKILL-006` 剩余、`REQ-AGENT-002` 剩余、`REQ-HARNESS-004` 剩余、`REQ-HARNESS-005` 剩余、`REQ-HARNESS-006` 剩余、`REQ-HARNESS-007` 剩余、`REQ-HARNESS-008` 剩余 |
| CR9 | 看板、API、Web 和审计残留 | 版本化 agent/skill/tool/SCM/CI API 组、剩余看板 CRUD、额外已认证页面、持久用户目录、登录审计、父计划更新 | C3 | OAuth providers | `REQ-BOARD-003` 剩余、`REQ-BOARD-004` 剩余、`REQ-BOARD-005` 剩余、`REQ-REQ-001` 剩余、`REQ-WEB-002` 剩余、`REQ-WEB-004` 剩余、`REQ-WEB-006` 剩余、`REQ-WEB-007` 剩余、`REQ-AUDIT-001` 剩余、`REQ-MILESTONE-002` 剩余、`REQ-AUTH-001` 剩余 |
| CR10 | Agent 频道残留 | 会话 decisions/approvals APIs、看板上的未决问题、后续目录类型 `task.split`/`task.merge`、运行前读取所选频道消息 | B6、C4 | 专业 Agent 名单 | `REQ-COLLAB-001` 剩余、`REQ-COLLAB-002` 剩余、`REQ-COLLAB-003` 剩余、`REQ-COLLAB-004` 剩余 |
| CR11 | 其余工具类别 | 注册表覆盖 browser、image analysis、document parsing、database migration 和 web-api 工具，含允许/拒绝和交付证据 | C7 | 托管浏览器集群 | `REQ-TOOL-001` 剩余 |
| CR12 | 项目 Definition of Ready 和 Done | 项目策略配置 Ready/Done 检查；缺证据仍阻止 `delivered` | C5、B9 | 治理认证包 | `REQ-EVIDENCE-001` 剩余、`REQ-HARNESS-003` 剩余 |
| CR13 | 远程环境集群 | 可按配置准备替换用远程环境，且不丢失未提交工作 | B4 | PostgreSQL | `REQ-HARNESS-001` 剩余、`REQ-HARNESS-002` 剩余 |
| CR14 | 启用已门禁的 skill-creator 草稿 | 已校验的 skill-creator 草稿可启用给 Agent 执行，未校验草稿不会自动启用 | C7 | 技术 Skill packs | `REQ-SKILL-001` 剩余、`REQ-SKILL-002` 剩余 |

### 阶段 D — 后续，仅在有实测需要时

保留既有 D1–D15 顺序及当前工作，其对应残留应完成或明确延后。D16–D21 作为必需的缺陷修正接续推进，验收见下方。目录和可视化成果不能证明真实三个 Agent 的产品基线成立。

| 顺序 | 切片 | Outcome | Depends on | Out of scope | REQ 编号 |
| ---: | --- | --- | --- | --- | --- |
| D1 | Agent 状态识别 | 步骤运行前检查仓库、CI、leases 和证据，并记录识别到的状态 | CR6、CR7、CR12 | 可视化设计器 | `REQ-AGENT-005` |
| D2 | 额外工作流模板 | 项目可在内置 user-story 之外选择 Scrum、Kanban、hotfix 或 research 模板 | C5 | 第三方包 | `REQ-FLOW-001` |
| D3 | 可视化工作流设计器和 Test Lab | 作者可在画布上编辑并 dry-run 模板后再发布 | D2、CR7 | 第三方包一致性 | `REQ-FLOW-006`、`REQ-FLOW-007` |
| D4 | 工作流包、自定义事件、节点、扩展 | 第三方包通过一致性检查；自定义事件和节点类型进入目录 | D3 | Issue tracker 同步 | `REQ-FLOW-008`、`REQ-FLOW-009`、`REQ-FLOW-010`、`REQ-FLOW-011` |
| D5 | 静态可视化和回放可视化 | 作者可查看模板图并回放测试运行，不必编辑 JSON | D3 | 治理看板 | `REQ-FLOW-016`、`REQ-FLOW-018` |
| D6 | 其余设计 method packs | Use Case、BDD、Example Mapping、Event Storming、DDD、API Design、ADR 和 Threat Modeling 可作为 method packs | CR8 | 优先级 packs | `REQ-METHOD-001` 剩余 |
| D7 | 优先级 method packs | MoSCoW、RICE、WSJF、Kano、risk-first、dependency-first 和 milestone-first 排序可解释，且可用审计覆盖 | D6 | 专业 Agent | `REQ-METHOD-002` |
| D8 | 专业 Agent 名单 | UX、QA、security 等角色作为带边界的显式 agent definitions 存在 | D1、CR14 | 技术 Skill packs | `REQ-AGENT-001` |
| D9 | 技术 Skill packs | Frontend、backend、database 等相关包作为版本化覆盖安装 | CR8、CR14 | OAuth | `REQ-SKILL-004` |
| D10 | 区域登录和 OAuth | 登录按区域路由，并绑定 OAuth/OIDC 账号，不把密钥写入看板记录 | CR9 | PostgreSQL | `REQ-AUTH-003`、`REQ-AUTH-004` |
| D11 | PostgreSQL 驱动 | `huntianling.database` 可使用 PostgreSQL；SQLite 仍是本地默认 | C3 | 治理包 | `REQ-DATA-001` PostgreSQL |
| D12 | 合规义务登记 | 项目可选择 framework packs 并跟踪义务生命周期 | CR12 | 安全扫描接入 | `REQ-GOV-001`、`REQ-GOV-002` |
| D13 | 安全、可靠性和 AI 信任门禁 | 威胁模型、SLO、provenance 和 attestations 在配置后可阻止交付 | D12、D1 | Issue 同步 | `REQ-SEC-001`、`REQ-REL-001`、`REQ-TRUST-001`、`REQ-TRUST-002` |
| D14 | 治理和信任看板 | 一个已认证看板显示义务、残余风险和已签名证据 | D13 | GitHub Issue 所有权 | `REQ-WEB-005` |
| D15 | 可选 GitHub Issue/Project 同步 | 外部卡片镜像 WorkItems，带出处和冲突处理；不拥有生命周期 | CR2、CR12 | 替换内部看板 | `REQ-ISSUE-001` |
| D16 | 执行与交付门禁真实性 | 模拟或未执行的结果不能完成交付或显示客户已交付 | B9、CR12 | 真实 Agent 执行 | `REQ-HARNESS-003`、`REQ-HARNESS-006`、`REQ-HARNESS-008`、`REQ-WEB-007` |
| D17 | 真实标准环境准备 | 实际准备和必需检查决定本仓库及第二项目的就绪状态 | D16、B4 | 远程集群扩展 | `REQ-HARNESS-001`、`REQ-HARNESS-005`、`REQ-TOOL-001` |
| D18 | 可执行的三个 Agent 交付与修复 | dsh 任务生成可运行代码，独立评价并修复真实失败 | D17、B5 | 专业角色扩展 | `REQ-HARNESS-006`、`REQ-HARNESS-008`、`REQ-AGENT-002` |
| D19 | 执行中的方法与 Skill 传感器 | 所选方法和深度步骤约束真实任务并发现无效结果 | D18、D6、CR8 | 更多方法目录 | `REQ-HARNESS-007`、`REQ-SKILL-005`、`REQ-SKILL-006`、`REQ-METHOD-001` |
| D20 | 真实任务恢复与代码版本证据 | 恢复时核对会话和副作用；代码变化使受影响证据失效 | D18、B10 | 分布式调度扩展 | `REQ-HARNESS-002`、`REQ-HARNESS-003`、`REQ-FLOW-020` |
| D21 | 新项目与自身开发验收 | 独立证据证明需求收集、设计、环境、编码、修复和客户交付闭环 | D16–D20、B2、B11 | 更多看板视图 | `REQ-HARNESS-005`、`REQ-HARNESS-008`、`REQ-MKT-001`、`REQ-WEB-007` |

### D16–D21 — 缺陷修正验收

六个切片均为待实现；审查发现不等于实现或验收记录。放在 D15 之后是用户要求的交付顺序；表中依赖列表示技术前置。预期实现者为 Grok。每个切片开始前，先读取关联审查，检查最新源码和既有修复证据，记录问题是否仍可复现。已独立验证的修复可以满足切片，无须重复实现。每份完成记录必须关联 REQ 编号、已审查设计、实际变更集、执行检查、审查决定和剩余阻塞。缺少真实执行时，即使确定性测试通过，仍保持阻塞。

#### D16 — 真实门禁

- 复核[隔离复现](reviews/2026-09-12-runtime-repro.mjs)，再覆盖生产启动、评价、状态转换 API 及客户进度。空应用且检查失败、未配置执行器、模拟评价这三种情况均不能产生已验收交付。
- 在证据生产服务中区分演示、自检、人工和实际执行。调用方声明的 `independent: true`、`environmentReady: true` 或 producer 标签不能证明已执行成功。既有受影响证据必须失效或被排除，直至重新验证。
- 有可验证出处且满足项目策略的真实外部 CI 和评价证据应继续有效。增加反向回归与真实证据正向用例；不能只在界面隐藏已交付标签。

#### D17 — 真实环境准备

- 核实 dsh 宿主实际执行接口，通过生产插件组合接入可配置的准备与检查命令。使用同一版本化配置准备本仓库及第二个全新项目，不依赖仅供测试的执行器。
- 按项目范围的命令结果和必需能力探测决定就绪状态。缺失命令、检查失败和没有执行器均保持可见阻塞；`canStartImplementation` 不能用合成通过覆盖结果。
- 记录配置版本、工作区、命令、退出结果和产物。证明必需检查失败会阻塞 Generator，修复环境后才变为就绪。准确标记仍不可用的 lint/hygiene 门禁。

#### D18 — 真实 Agent 任务与修复

- 将 Planner、Generator、Evaluator 绑定到实际 dsh 任务、会话和工具执行，使用独立上下文并保留持久引用。保留已授权的原始需求和设计决定；合成确认标志不是审批。缺失的宿主原语列为明确依赖，不另建替代模型运行时。
- Generator 必须实际创建代码并执行自检。Evaluator 必须独立检查待交付版本和验收行为，保留逐条证据，并将具体发现交给下一次 Generator 尝试使用。
- 展示一次真实失败、有界修复和独立复评。除运行状态外，还要断言文件存在及行为成立。保留模型、工具和会话引用；确定性函数仅用于测试或演示支持。

#### D19 — 可执行方法与 Skill 传感器

- 解析默认或所选方法，将其版本、Skill 指令和所选深度步骤绑定到实际任务。复用 D6 方法包及既有 Skill 记录；仅在目录中选择不能满足执行要求。
- 使用有效和无效示例运行声明的输出校验及行为传感器。缺少需求信息、输出无效或质量检查失败时，按适用情况触发有记录的澄清、修复、深度调整或阻塞。
- 展示真实任务执行所需方法步骤，并由传感器拒绝无效结果。记录方法、Skill 版本和证据；元数据、`valid` 和 `{ok: true}` 示例本身不能证明能力成立。

#### D20 — 恢复与证据版本

- 检查点必须标识仓库、工作树和待交付版本，包含真实任务和会话引用、已完成动作、待处理副作用，以及恢复所需的预算使用信息。
- 中断真实任务、重启执行，并在恢复前核对当前代码和待处理副作用。证明不会重复已完成动作，未解决副作用会阻塞或请求决定。
- 在需求文本不变时修改待交付代码，证明受影响证据变为过期并阻塞交付，直至重新验证。代码和执行出处之外，继续保留需求及设计版本校验。

#### D21 — 新项目与自身开发验收

- 通过生产插件和不同人群界面，从全新项目及客户原始输入开始。展示 MKT 收集与澄清、已审查的需求分析和设计、真实环境准备、三个 Agent 编码，以及可运行的客户行为。
- 覆盖真实验收条目失败、证据驱动修复、独立评价，以及实际验收前保持未完成的客户安全进度。预先准备的 Story、`demoRunner` 或强制评价结果不能代替此场景。
- 使用同一方法执行一个范围明确的 HuntianLing 自身开发切片，保留独立证据。关联 D17 的第二项目准备及 D20 的真实恢复。仅按这些产物核对需求状态和产品完成声明，并保留人工、外部 Agent、runtime 标记及未解决阻塞。
