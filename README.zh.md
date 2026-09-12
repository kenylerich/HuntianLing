---
doc_status: active
doc_version: 2026-09-11.5
created: 2026-09-10
last_reviewed: 2026-09-11
review_after: 2026-12-10
---

# HuntianLing

[English](README.md) | 中文

HuntianLing 是用于 [DeepSeek Harness](https://github.com/kenylerich/deepseek-harness) 的 Cordis 插件。插件界面是标准开发看板，用于需求收集、需求设计和开发进度。看板背后，插件在当前 dsh 中准备标准 vibe coding 环境，内置可执行 Planner、Generator、Evaluator Agent 和工程方法，用户接入项目即可开始工作，不必自行拼装环境。

请先阅读 [Harness Engineering 产品定位](docs/requirements/harness-engineering.zh.md)，了解背景原文、范围审视、需求到代码闭环，以及本仓库如何用同一方法开展自身开发。

> 产品基线状态：标准环境准备、三个内置 Agent 和可执行方法组合仍在规划中；当前可用实现是看板及支撑服务。

> 首个产品里程碑同时交付两面：客户/开发/管理员界面、带 Skill 边界和深度的 MKT 收集、展示收集/设计/进度的标准开发看板，以及包含 Planner、Generator、Evaluator 和方法的不可见标准 vibe coding 环境。后续能力面保持规划，不得取代该基线。

> 状态：内部看板模型已经建立。Host bundle 可以加载，本地 Board Service 持久化 Projects、Milestones、WorkItems、Project team members、workflow board summaries 和 delivery evidence summaries，并计算 Story priority queues 和 delivery evidence rollups；Requirement Service 管理需求拆分和覆盖度；Web Service 通过 dsh 浏览器表面和 JSON API 暴露相同数据，并可启用 session 认证和 API tokens。完整工作流编排、自动调度、资源租约和真实 SCM/CI adapters 仍在规划中。

## 能力面

- **需求录入**：从结构化需求提交创建内部 WorkItem；GitHub Issues 只是可选投影，不是事实源。
- **里程碑管理**：把项目工作组织到版本、阶段、MVP 或交付检查点，并在看板上显示进度汇总。
- **工作项层级**：跟踪 Epic -> Feature -> Requirement/Story -> Task，同时支持 Bug 和 Research，父子关系存储在 HuntianLing 内部。
- **看板**：作为需求分析、设计说明、验收标准、依赖、阻塞、负责人和交付进度的主要操作界面。
- **Web 表面**：提供浏览器可访问的看板 UI 和 JSON API，使 dsh 可以显示插件，外部用户也可以通过可选登录、session cookie、区域 provider 列表和 API tokens 打开配置 URL。
- **团队管理**：管理人和 Agent 成员、角色、可用性、容量、WIP 限制、手动分配、角色泳道和团队看板告警；自动调度和资源租约仍在规划中。
- **团队协作**：提供独立的 Agent Team Chat，让人可以观察和加入 Agent 间协作，不与普通 LLM 任务聊天混在一起。
- **代码视图**：显示与需求相关的分支、提交、diff、评审、检查和部署证据。
- **治理门禁**：把法律、认证、安全、可靠性和 AI 可信控制映射到需求、检查、证据、审批和发布决策。
- **工作流编排**：通过可配置模板、阶段门禁、编排计划、按优先级排序的 Story 交付运行、角色范围审批和评审事件、受控状态流转来协调人机交付。
- **工作流构建器**：提供 Harness 管理的工作流模板、内置编排能力、可视化编辑、静态流程图、运行时调度时间线、自定义事件、自定义计划节点、Agent/Skill 绑定、计划调度、状态识别、dry-run 测试、回放和发布前一致性检查。
- **可追踪性**：从子 WorkItem 汇总进度，并检查子项是否覆盖父需求的验收标准。

## 需求管理模型

HuntianLing 把需求作为按 Project 归属、可选分配到 Milestone 的内部 WorkItem 管理。一个卡片就是一个 WorkItem；详情面板保存需求分析、设计说明、验收标准、已覆盖验收项、依赖、阻塞、证据、优先级、估算、负责人、里程碑和排期字段。相同数据可以投影到多个视图，不改变底层记录。

完整产品需求记录在 [docs/requirements/backlog.zh.md](docs/requirements/backlog.zh.md)。主看板设计记录在 [docs/architecture/main-board-design.zh.md](docs/architecture/main-board-design.zh.md)，用于对齐看板信息架构、视图、卡片模型、API 和实现切片。工作流编排引擎记录在 [docs/architecture/workflow-orchestration-engine.zh.md](docs/architecture/workflow-orchestration-engine.zh.md)，用于对齐目标、术语、运行行为、可视化、测试方式和落地阶段。当前正式评审包记录在 [docs/requirements/reviews/2026-09-10.zh.md](docs/requirements/reviews/2026-09-10.zh.md)。文档导航在 [docs/README.zh.md](docs/README.zh.md)。这些文档同时记录已实现基线能力和仍需转成 WorkItem 的缺失需求。

产品层级采用 Azure Boards 常见模型：

```text
Epic
  Feature
    Requirement / Story
      Task
      Bug
```

看板是主要入口，但不是数据模型本身：

- **Portfolio board**：按目标或发布查看 Epic 和 Feature 进度。
- **Milestone board**：查看版本或阶段进度，包括总量、交付切片、未完成、阻塞和完成百分比。
- **Requirement board**：让 Requirement/Story 卡片在分析、设计和 ready 状态间流转。
- **Delivery board**：让 Task、Bug 和 Research 工作在实现、评审、验证和交付状态间流转。
- **Tree board**：按 Epic 或 Feature 分泳道，并内联显示子卡片。
- **Role board**：按已认领 Project role 分泳道，包含空角色泳道和未认领工作。
- **Coverage board**：把验收标准映射到子 WorkItem 和证据。
- **Code view**：显示与需求关联的分支、提交、diff、评审、CI 和部署证据。
- **Governance dashboard**：显示合规义务、安全控制、可靠性目标、AI 可信评估、风险接受和证据报告。

父项状态由子项状态和验收覆盖度推导。只要仍有未覆盖验收标准、未完成必需子项或未解决阻塞，父项就不能被视为已交付。

Milestone 是项目级交付目标，不是需求树父节点。把 Epic 分配到 Milestone 后，子 Feature、Requirement/Story、Task、Bug 和 Research 会继承该 Milestone，除非调用方显式修改。WorkItem 不能分配到其他 Project 的 Milestone。

大型父需求可以通过子 WorkItem 或交付切片跨多个 Milestone 交付。每个切片保留自己的范围、验收标准、证据、负责人和 Milestone；父项从整个交付计划汇总进度。

计划中的协作能力会增加独立的 Agent Team Chat 窗口。它是一个普通对话时间线，用来查看 Agent 如何讨论需求、阻塞、交接、评审请求和验证结论；它与用户普通 LLM 任务聊天分离。消息可以携带 WorkItem、Milestone、分支、PR、CI run 或源文档等上下文标签，帮助读者理解对话对象。结构化聊天消息可以创建、分配、转交、拆分、评审和完成内部 Agent 协作任务。Agent 能力边界定义哪些角色可以读取、编辑、提交、push、打开 PR、触发 CI、审批或合并，高风险操作可以要求人工审批。

并发团队工作通过项目 roster、成员可用性、WIP 限制、调度策略和资源租约管理。这让多个成员和 Agent 可以并行工作，同时避免重复认领、代码编辑冲突、评审者过载、共享 CI 或环境竞争。

工作流编排用于协调团队，但不替代看板。Project 可以选择工作流模板、应用阶段门禁、生成 Agent 编排计划、安排并行或串行步骤、暂停等待人工审批，并在看板、Team Chat 和 Milestone 视图中显示活动状态。按优先级排序的 Story 交付运行让调度器选择最高优先级的 ready Story，并控制它从 ready、实现、评审、CI、证据、门禁到交付的端到端路径。事件记录发生了什么以及由谁完成；受控状态流转记录当前负责人和进度。一次角色交接只有在引擎接受事件并更新目标状态和负责人后才完成。审批和评审工作通过角色范围事件表示，因此系统可以显示谁发起决策请求、哪个角色必须评审或审批、哪个角色完成决策、哪个门禁发生变化。Harness 管理工作流保存、克隆、选择、替换、回滚、导入和导出。内置工作流能力覆盖常见敏捷交付动作；可执行节点在 Agent Runtime 启动前绑定 Agent 角色、具体成员、必需 Skills 和允许工具。调度器只有在依赖、门禁、审批、容量、资源租约和仓库状态都允许时才启动计划步骤。被选中的 Agent 必须先识别当前工作流状态；当状态过期、不完整、矛盾或超出能力边界时必须停止。工作流作者可以使用可视化设计器和测试实验室，在真实项目工作使用模板前构建、验证、dry-run、回放和发布模板。工作流 UI 应提供三个关联视图：模板结构的静态流程图、真实执行的运行时调度时间线、测试断言和预期实际结果的回放视图。工作流包可以通过声明 schema、权限、测试和一致性检查扩展事件、计划节点类型、阶段、状态流转、门禁和审批规则。

治理工作把适用的法律、认证控制、安全要求、可靠性目标和 AI 可信要求映射到同一批 WorkItem 和 Milestone。系统跟踪证据和审批，但项目负责人和法律评审者决定哪些义务适用。

## Service APIs

HuntianLing 暴露三个 host-side Cordis service：

- `huntianling.requirements`：需求管理 API。创建和拆分 Epic、Feature、Requirement/Story、Task、Bug 和 Research；更新分析和设计文本；维护验收标准；把子项链接到已覆盖验收标准；读取需求树和覆盖度汇总。
- `huntianling.board`：看板管理 API。管理项目、里程碑、团队成员、容量汇总、WorkItem 分配、workflow board summaries、delivery evidence summaries、delivery evidence rollups、里程碑交付切片、WorkItem CRUD、状态流转、角色认领、看板视图、里程碑视图、树查询、覆盖度查询和流转门禁。
- `huntianling.web`：浏览器/API API。启动和停止本地 HTTP 服务，返回 dsh 显示表面，生成按项目过滤的看板 URL，并可要求 session 或 API token 认证。

典型需求管理调用：

```ts
const requirements = ctx.get('huntianling.requirements');

const epic = requirements.createEpic({ projectId, title, body });
const feature = requirements.createFeature({ epicId: epic.id, title, body });
const story = requirements.createStory({
  featureId: feature.id,
  title,
  body,
  analysis,
  design,
  acceptanceCriteria,
});
const task = requirements.createTask({
  parentId: story.id,
  title,
  body,
  coversAcceptanceIds: ['story-ac-1'],
});

requirements.updateRequirement(story.id, { analysis, design });
requirements.getRequirementTree(epic.id);
requirements.getAcceptanceCoverage(epic.id);
```

典型看板管理调用：

```ts
const board = ctx.get('huntianling.board');

const project = board.createProject({ name, description });
const milestone = board.createMilestone({ projectId: project.id, title: 'MVP', goal });
const item = board.createWorkItem({ projectId: project.id, type: 'task', title, body });
const member = board.createTeamMember({
  projectId: project.id,
  displayName: 'Dev Agent',
  memberType: 'agent',
  roleIds: ['developer'],
  concurrentWorkLimit: 1,
});

board.updateWorkItem(item.id, { assignee, priority: 'p1', milestoneId: milestone.id });
board.assignWorkItem(item.id, { memberId: member.id, roleId: 'developer', actorId });
board.transitionWorkItem(item.id, 'in_progress');
board.claimWorkItem(item.id, { roleId: 'developer', actorId });
board.getBoardView({ projectId: project.id, groupBy: 'milestone' });
board.getMilestoneSummary(milestone.id);
board.getTeamCapacity(project.id);
board.updateDeliveryEvidenceSummary(item.id, {
  codeLinks,
  pullRequests,
  ciRuns,
  checks,
  obligations,
  riskAcceptances,
});
board.getProjectDeliveryEvidenceRollup(project.id);
```

典型 Web 表面调用：

```ts
const web = ctx.get('huntianling.web');

await web.start();
web.getSurface();
web.boardUrl({ projectId: project.id, groupBy: 'status' });
```

## Browser and HTTP API

Web Service 默认在 `127.0.0.1` 上使用临时端口启动。dsh 可以通过读取 `ctx.get('huntianling.web').getSurface()` 显示它。运维人员可以通过配置监听地址和 public URL 让其他用户访问：

```ts
ctx.plugin(huntianling, {
  web: {
    host: '0.0.0.0',
    port: 8787,
    publicUrl: 'https://huntianling.example.com',
    writeToken: process.env.HUNTIANLING_WEB_WRITE_TOKEN,
    auth: {
      enabled: true,
      regionMode: 'auto',
      users: [{
        username: 'alice',
        displayName: 'Alice PO',
        passwordHash: process.env.HUNTIANLING_ALICE_PASSWORD_HASH,
        roles: ['product-owner'],
        projectIds: [],
        region: 'global',
      }],
    },
  },
});
```

等价环境变量：

- `HUNTIANLING_WEB_ENABLED`
- `HUNTIANLING_WEB_AUTO_START`
- `HUNTIANLING_WEB_HOST`
- `HUNTIANLING_WEB_PORT`
- `HUNTIANLING_PUBLIC_URL`
- `HUNTIANLING_WEB_WRITE_TOKEN`
- `HUNTIANLING_WEB_ALLOW_UNAUTHENTICATED_WRITES`
- `HUNTIANLING_WEB_AUTH_ENABLED`
- `HUNTIANLING_WEB_AUTH_SESSION_TTL_MS`
- `HUNTIANLING_WEB_AUTH_API_TOKEN_TTL_MS`
- `HUNTIANLING_WEB_AUTH_REGION_MODE`
- `HUNTIANLING_WEB_AUTH_USERS_JSON`

只有默认本地监听地址允许无 token 写入。当 `host` 是公开地址或设置了 `publicUrl` 时，POST/PATCH 请求需要 `Authorization: Bearer <token>` 或 `x-huntianling-token: <token>`，除非显式启用 `allowUnauthenticatedWrites`。

当 `web.auth.enabled` 为 true 时，每个非 auth API 请求都必须通过 session cookie、已签发 API token 或兼容的静态 Bearer token 认证。密码登录会校验配置的 PBKDF2-SHA256 密码哈希，并且除了创建 API token 的那次响应外，不返回 raw session 或 API token secret。配置了 `projectIds` 的用户只能看到这些 Projects；未配置 `projectIds` 的用户可以看到全部 Projects。OAuth flows、持久化 credential storage、Argon2id/bcrypt 支持、rotation 和完整 audit events 仍在规划中。

HTTP endpoints：

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` or `/board` | 浏览器看板 UI |
| `GET` | `/api/status` | Web 状态和 dsh 显示表面 |
| `GET` | `/api/auth/session` | 读取当前认证状态、session 和区域 provider set |
| `GET` | `/api/auth/providers` | 按 `cn`、`global` 或 `auto` 读取配置的登录 providers |
| `POST` | `/api/auth/password/login` | 通过配置的密码凭据创建 session cookie |
| `POST` | `/api/auth/logout` | 清除当前 session cookie |
| `GET/POST` | `/api/auth/api-tokens` | 列出或创建当前 session 用户的 API tokens |
| `DELETE` | `/api/auth/api-tokens/:id` | 删除当前 session 用户拥有的 API token |
| `GET/POST` | `/api/projects` | 列出或创建项目 |
| `GET/POST` | `/api/milestones` | 列出或创建项目里程碑 |
| `GET/PATCH` | `/api/milestones/:id` | 读取或更新里程碑 |
| `GET` | `/api/milestones/:id/summary` | 读取里程碑交付进度 |
| `GET` | `/api/milestone-board` | 读取里程碑泳道和工作项 |
| `GET/POST` | `/api/work-items` | 列出或创建 WorkItems |
| `GET/PATCH` | `/api/work-items/:id` | 读取或更新 WorkItem |
| `POST` | `/api/work-items/:id/transition` | 移动 WorkItem 状态 |
| `GET` | `/api/work-items/:id/tree` | 读取 WorkItem 子树 |
| `GET` | `/api/work-items/:id/coverage` | 读取验收覆盖度 |
| `GET` | `/api/board` | 读取投影后的看板列 |
| `GET` | `/api/requirements` | 列出 Epic/Feature/Requirement/Story 项 |
| `POST` | `/api/requirements/epics` | 创建 Epic |
| `POST` | `/api/requirements/features` | 创建 Feature |
| `POST` | `/api/requirements/requirements` | 创建 Requirement |
| `POST` | `/api/requirements/stories` | 创建 Story |
| `POST` | `/api/requirements/tasks` | 创建 Task |
| `POST` | `/api/requirements/bugs` | 创建 Bug |
| `POST` | `/api/requirements/research` | 创建 Research item |
| `POST` | `/api/requirements/:id/split` | 把一个需求拆分为子项 |
| `PATCH` | `/api/requirements/:id` | 更新分析、设计和验收字段 |
| `GET` | `/api/requirements/:id/tree` | 读取需求子树 |
| `GET` | `/api/requirements/:id/coverage` | 读取需求验收覆盖度 |

版本化主看板 endpoints：

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/v1/projects` | 列出或创建项目 |
| `GET` | `/api/v1/projects/:projectId/main-board` | 读取 Project 主看板、视图定义、卡片摘要、列、Milestone board、Team board、Role board、Workflow board、Evidence board、Story queue、Tree board、Coverage board、Milestones、team members 和看板健康 |
| `GET` | `/api/v1/projects/:projectId/main-board/views` | 读取内置主看板视图 |
| `GET` | `/api/v1/projects/:projectId/main-board/cards` | 读取某个视图的主看板卡片摘要 |
| `GET` | `/api/v1/projects/:projectId/main-board/milestones` | 读取包含 WorkItem 卡片、交付切片和泳道汇总的 Milestone board |
| `GET` | `/api/v1/projects/:projectId/main-board/team` | 读取包含 capacity、WIP、已分配卡片、未分配卡片和团队告警的 Team board |
| `GET` | `/api/v1/projects/:projectId/main-board/workflow` | 读取 Workflow board 泳道、workflow summaries、Story queue、approvals、reviews、failed checks 和 scheduler reasons |
| `GET` | `/api/v1/projects/:projectId/main-board/evidence` | 读取 Evidence board 泳道，以及 code、PRs、reviews、CI、checks、obligations、risk acceptances、security、reliability 和 trust 的 Project rollups |
| `GET` | `/api/v1/projects/:projectId/delivery-evidence` | 读取 Project delivery evidence summaries 和 rollup counts |
| `GET` | `/api/v1/projects/:projectId/unlinked-code` | 读取配置的 SCM adapters 发现的未关联 external code |
| `GET` | `/api/v1/projects/:projectId/workflow-runs` | 把项目 workflow board summaries 作为当前 run list 读取 |
| `GET/POST` | `/api/v1/projects/:projectId/story-queue` | 读取或重新计算按优先级排序的 Story queue，并显示 skipped reasons |
| `GET` | `/api/v1/projects/:projectId/main-board/tree` | 按嵌套看板卡片读取 Project 需求树、深度和树告警 |
| `GET` | `/api/v1/projects/:projectId/main-board/coverage` | 读取 Project 验收标准到子 WorkItems、证据数量和未覆盖告警的映射 |
| `GET/POST` | `/api/v1/projects/:projectId/team/members` | 列出或创建 Project team members |
| `PATCH` | `/api/v1/team/members/:memberId` | 更新 team member 的 display name、role ids、status、capacity、region、timezone、permissions 或 skill profile |
| `PATCH` | `/api/v1/team/members/:memberId/availability` | 更新成员可用性和容量字段 |
| `GET` | `/api/v1/projects/:projectId/team/capacity` | 读取 Project team capacity、assigned work、unassigned work、overloads 和 warnings |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/board-detail` | 读取或更新看板详情检查器使用的 WorkItem 字段 |
| `POST` | `/api/v1/work-items/:workItemId/assignments` | 把 WorkItem 分配给 active Project team member，并执行成员角色和 WIP 检查 |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/workflow` | 读取或更新 WorkItem workflow board summary |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/workflow-board-summary` | WorkItem workflow board summary 读写别名 |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/delivery-evidence` | 读取或更新 WorkItem code、PR、review、CI、check、obligation、risk 和 provenance evidence |
| `GET/PATCH` | `/api/v1/work-items/:workItemId/evidence` | WorkItem delivery evidence 读写别名 |
| `GET` | `/api/v1/work-items/:workItemId/code-view` | 读取 WorkItem 的 code、PR、review、CI、deployment、check 和 unlinked-code context |
| `GET` | `/api/v1/work-items/:workItemId/compliance` | 读取 WorkItem obligations、governance checks、risk acceptances 和 blockers |
| `GET` | `/api/v1/work-items/:workItemId/security` | 读取 WorkItem security checks 和 security risk acceptances |
| `GET` | `/api/v1/work-items/:workItemId/reliability` | 读取 WorkItem reliability checks 和 reliability risk acceptances |
| `GET` | `/api/v1/work-items/:workItemId/trust` | 读取 WorkItem trust checks、trust risk acceptances 和 provenance links |
| `GET` | `/api/v1/work-items/:workItemId/traceability` | 读取 WorkItem 层级、descendants、覆盖度和告警 |
| `GET` | `/api/v1/work-items/:workItemId/milestone-plan` | 读取父 WorkItem 跨 Milestones 的交付计划 |
| `POST` | `/api/v1/work-items/:workItemId/milestone-slices` | 为一个父 WorkItem 创建交付切片 |
| `PATCH` | `/api/v1/work-items/:workItemId/milestone-slices/:sliceId` | 更新交付切片的状态、负责人、Milestone、范围、预期证据或目标状态 |
| `GET` | `/api/v1/milestones/:milestoneId/requirement-slices` | 读取分配到一个 Milestone 的交付切片 |
| `GET` | `/api/v1/milestones/:milestoneId/code-view` | 从直接分配 WorkItems 和显式 delivery slices 读取 Milestone code evidence |

## Loader

HuntianLing 作为 host bundle 被 dsh 加载：

```sh
dsh --profile huntianling
```

包根目录的 `cordis.yml` 是加载入口；它导入 `@kenylerich/dsh-huntianling/host`，该入口的 default export 是根 `Plugin`，见 `src/host/plugin.ts`。

## Repository layout

```text
AGENTS.md            working agreement (see file)
README.md            English README
README.zh.md         this file
docs/                documentation map, requirements, reviews, and architecture notes
package.json         npm manifest (@kenylerich/dsh-huntianling)
tsconfig*.json       strict-mode TypeScript project refs
cordis.yml           dsh host composition
src/
  index.ts           package entry; re-exports the root plugin
  host/
    plugin.ts        root Plugin; wires board + agile + web sub-plugins
    agile/
      plugin.ts      agile Service Definition (skeleton)
      types.ts       Requirement / WorkflowState contracts
      intake.ts      intake form schema (stub)
      workflow.ts    state-machine driver (stub)
    board/
      plugin.ts      board Service Definition
      types.ts       Project / Milestone / Lane / WorkItem contracts
      work-item.ts   hierarchy and transition rules
      store.ts       persistence layer
    web/
      plugin.ts      web Service Definition
      server.ts      browser and JSON HTTP API
      page.ts        browser board UI
      types.ts       web config and display surface contracts
```

`.agents/` 是从 dsh 仓库复制来的 harness 参考资产。`.github/` 用于本仓库 CI 和可选 GitHub Issue/Project 同步策略；这些工作流必须与 HuntianLing 的独立需求模型保持一致。

## Development

```sh
pnpm install
pnpm run typecheck
pnpm run build
pnpm run doc-sync
```

`pnpm run typecheck` 是源代码平面的本地门禁。文档改动必须保持 `pnpm run doc-sync` 通过；当同时更新中英文文档后，运行 `pnpm run doc-sync:write` 重新记录配对。完整门禁列表在 [AGENTS.md](AGENTS.md#quality-gates) 中维护。

## License

UNLICENSED，private prototype。
