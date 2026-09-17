---
doc_status: active
doc_version: 2026-09-13.5
created: 2026-09-13
last_reviewed: 2026-09-13
review_after: 2026-09-27
archive_after: 2026-12-13
---

# 客户能力验收评审

[English](2026-09-13-customer-acceptance.md) | 中文

## 摘要

产品提交 `614dcd6` 的验收为 **revision-required**。客户不能将已交付标签视为软件可用的证明。抛异常的候选、伪造 CI 证据、评价后修改的代码均可进入已交付。D16 和 D18-D21 尚未满足 [Backlog](../backlog.zh.md)；D18-D21 切片记录中有限范围的组件通过结论不能证明客户验收通过。

验证使用真实 Cordis 根插件组合、SQLite、认证 HTTP、隔离 Chromium 浏览器及全新临时工作区。执行者是外部编码 Agent，另有两位只读评审者，并非 HuntianLing runtime Agent。未修改现有客户数据或远端 Issue。失败发现保持打开，本评审不授权发布。

## 目录

- [证据](#证据)
- [阻塞发现](#阻塞发现)
- [业务覆盖](#业务覆盖)
- [修复验收](#修复验收)
- [修复跟踪](#修复跟踪)

## 证据

| 检查 | 观察结果 | 限制 |
| --- | --- | --- |
| 构建与插件烟测 | 通过 | 烟测关闭 Web，只验证加载与导出，不执行客户交付。 |
| 仓库回归 | 466 通过、1 跳过、0 失败 | 跳过真实 PostgreSQL 测试；计数包含模拟及 HTML 字符串测试。 |
| 生产 HTTP 验收 | 10 通过、3 失败 | 客户开发数据隔离、伪造证据拒绝、本地 CI 执行失败。[结果记录](2026-09-13-customer-http-results.json)。 |
| 运行时反例 | 复现五个缺陷 | 诊断成功退出代表复现成立，不代表验收通过。 |
| 浏览器 | 已操作登录、创建项目、澄清、生成与批准候选、层级、创建里程碑、工作区导航、模板克隆及 dry-run | 客户确认与默认开发导航存在缺口；dry-run 是模拟。 |
| 质量门禁 | lint 和 hygiene 被占位脚本阻塞 | 两项门禁均不能记为通过。 |

在仓库根目录构建后运行：

```sh
pnpm run build
pnpm run test:e2e
pnpm run test:e2e:customer
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs runtime
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs forged
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs stale
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs approval
node docs/requirements/reviews/2026-09-13-customer-runtime-repro.mjs demo
```

HTTP 套件在必需行为失败时退出 1。它监听本机随机端口，释放服务后删除专有工作区。运行时诊断保留生成的专有目录并打印路径以便检查。两者均不使用远端仓库或已配置的客户数据库。沙箱 `listen EPERM` 需要宿主重试；重试后的仓库回归通过，HTTP 验收则暴露上述产品失败。

本次浏览器产物保存在本地 `output/playwright/`：`customer-confirmed.png`、`customer-mobile.png`、`developer-design-empty.png`、`backlog-approved.png`、`plans.png`、`team.png`、`runs.png`、`evidence.png`、`admin-board.png` 和 `workflow-dry-run.png`。桌面看板使用 1440 × 1000；客户移动端使用 390 × 844，未出现文档宽度溢出。这些观察不构成完整响应式或无障碍认证。

## 阻塞发现

| 优先级 | 复现与影响 | 源码及需求 |
| --- | --- | --- |
| P1 | `runtime`：文件包含验收注释后直接抛异常，执行退出 1，但 Evaluator 通过，重新加载 Board 后已交付状态仍在。生成后未运行测试命令。 | [runtime.ts](../../../src/host/agents/runtime.ts)：候选写入、`evaluateCandidate` 及生成的执行引用。`REQ-HARNESS-003`、`REQ-HARNESS-006`、`REQ-HARNESS-008`。 |
| P1 | `forged` 及 HTTP 套件：`ci:never-executed` 配合 passing/executed 标签，无真实 CI 或 Git 结果也允许交付，HTTP 返回 200。 | [executed-evidence.ts](../../../src/host/board/executed-evidence.ts)、[server.ts](../../../src/host/web/server.ts)：交付证据写入与状态 API。`REQ-EVIDENCE-001`、D16。 |
| P1 | `stale`：评价后替换候选代码，重载 Board 再转入已交付。代码哈希变化，证据却仍有效。 | [executed-evidence.ts](../../../src/host/board/executed-evidence.ts)：`workItemDesignRevision`。`REQ-HARNESS-002`、`REQ-HARNESS-003`、D20。 |
| P1 | `approval`：没有 MKT 会话和候选，来源为空、正文声明是草稿，Delivery 仍提供 `confirmed: true` 并完成。 | [delivery/service.ts](../../../src/host/delivery/service.ts)：Planner 输入。`REQ-MKT-001`、`REQ-HARNESS-006`、`REQ-HARNESS-008`。 |
| P1 | `demo`：检查命令使用 `process.exit(0)`，生成文件为标记模板。没有源应用、录入会话、自开发变更集引用，客户进度却为已交付。 | [harness/service.ts](../../../src/host/harness/service.ts)：`demonstrateSelfDevelopment`。`REQ-HARNESS-005`、D21。 |
| P1 | 客户 GET 自己项目的 developer-board，返回团队、权限、设计与进度记录。HTML 界面拒绝不能保护 API。 | [server.ts](../../../src/host/web/server.ts)：developer-board 处理器。`REQ-WEB-007`、`REQ-AUTH-001`。 |
| P1 | 生产本地 CI 返回 pending 及 `runner not configured`，两个命令均未写入预期标记文件。工具已注册不能证明命令执行。 | [ci/service.ts](../../../src/host/ci/service.ts)：默认 runner；[ci/plugin.ts](../../../src/host/ci/plugin.ts)。`REQ-CI-001`。 |
| P1 | 只读生产组合审计：OAuth 启动返回 302，回调因 exchange 未配置返回 503。通过的身份测试注入了生产组合没有的 exchange。未验证真实提供方登录。 | [auth.ts](../../../src/host/web/auth.ts)：`completeOAuth`；[web/plugin.ts](../../../src/host/web/plugin.ts)。`REQ-AUTH-004`。 |
| P1 | 浏览器：确认并生成候选后，客户仍显示待客户确认，却无待回答问题或批准操作。默认开发收集页无法打开未批准候选，设计页为空。手动导航到 `/board` 的 Intake 后才可批准。 | [customer.ts](../../../src/host/web/pages/customer.ts)、[developer.ts](../../../src/host/web/pages/developer.ts)。`REQ-WEB-006`、`REQ-WEB-007`、`REQ-MKT-001`。 |
| P2 | 浏览器：工作流页退出调用 `/api/auth/password/logout`，返回 404，用户仍保持登录。可用接口为 `/api/auth/logout`。 | [workflow-lab.ts](../../../src/host/web/pages/workflow-lab.ts)：退出处理器。`REQ-AUTH-001`、`REQ-WEB-002`。 |

## 业务覆盖

| 分区 | 已证明的范围 | 尚未验收或验证 |
| --- | --- | --- |
| Intake / MKT | 客户对话、补充；MD/TXT 上传及解析记录；候选批准 | 本次业务分析使用通用模板。真实模型、真实 OCR、浏览器 PDF/Word/图片往返未验证。 |
| Backlog | 已批准的 Epic/Feature/Story/Task 层级；API 投影；桌面列表 | 客户范围确认、批量编辑、保存视图及完整验收覆盖需要场景测试。首屏仍在实际行前重复标题与控件。 |
| Plans | 浏览器创建里程碑；API 列表；显示未计划范围 | 未操作跨里程碑发布验收及完整范围分配交互。 |
| Team / Chat | 容量页面及项目成员 API 可达；回归覆盖角色、WIP、租约和消息 | 未展示真实并发 Agent、多进程资源冲突及聊天持久恢复。 |
| Runs / 工作流 | 页面导航；静态画布 API；浏览器克隆及正常路径 dry-run | 未验证浏览器中的真实三 Agent 调度、实际失败修复或会话恢复。 |
| Evidence | 缺证据会阻塞；复现伪造证据反例 | 真实性与候选版本检查失败，已交付标签不可靠。 |
| Admin / 认证 | 密码登录退出、项目隔离、管理员 API 拒绝、访问页面 | 自己项目的开发数据泄露。归属界面复用用户列表，完整管理流程和 OAuth 未验收。 |
| 存储 / SCM / CI | 真实 SQLite 回归；本地产物存储；观察生产 CI 失败 | PostgreSQL、真实远端 push/PR/merge、托管 CI 产物及多服务完整重启恢复未验证。 |
| 治理 / Skills / 工具 | 既有聚焦回归及可用 API/目录组件 | 尚未证明法律认证验收、跨技能栈的真实工具执行及模型能力校准。 |

浏览器同时存在简化开发界面和独立完整看板。完整看板已有业务分区，但两者之间的可发现性、术语、范围确认及操作连续性需要修正。API 或页面可达不能证明每项 CRUD 操作及生命周期标准均已完成。

## 修复验收

继续由既有 REQ 编号负责。首先拒绝伪造与过期证据，阻止确定性输出冒充已执行交付。再接通 dsh 任务、会话、工具执行与真实本地 CI，用独立的先失败后通过检查验证客户行为。关闭客户 API 数据暴露，提供可见的确认与批准导航后，再执行新项目验收。

完整标准通过前，D18-D21 保持部分实现或 revision-required。保留失败 HTTP 用例和这些反例作为回归输入。修复必须同时证明无效证据被拒绝，以及精确候选版本上的真实执行能被接受。随后补做隔离 PostgreSQL、真实 OAuth/提供方集成、跨里程碑交付及团队并发场景，才能宣称客户能力完整。

## 修复跟踪

六个修复 Issue 均保持开放。上述原始发现对应 `614dcd6`；本地修复分支为 `codex/customer-acceptance-repairs`。尚无完整修复 Issue 合并或验收通过。独立评价仅覆盖下述明确的门禁收紧及质量检查行为。

| Issue | 剩余义务 | 本地结果 |
| --- | --- | --- |
| [#91](https://github.com/kenylerich/HuntianLing/issues/91) | 真实执行凭证、候选版本新鲜度、dsh 任务 | 部分完成。独立复核验证了必需检查缺失拒绝、最新批次替代旧结果、逐命令源码变化、执行权限变化，以及原生 CI 仅用于诊断。真实 dsh 任务仍缺失。 |
| [#92](https://github.com/kenylerich/HuntianLing/issues/92) | 来源批准与有实际功能的新项目交付 | 部分完成。绑定看板的规划与实现必须读取已持久化且有效的录入审批。普通 WorkItem、调用方确认标记、范围变化和陈旧恢复均被拒绝。未获审批的自开发演示不能启动。有实际功能的新项目交付仍待完成。 |
| [#93](https://github.com/kenylerich/HuntianLing/issues/93) | 客户隔离与可发现的开发审批 | 本地已实现。开发入口显示待审核候选、真实批准操作和项目工作台。客户状态区分待回答问题与开发审核。隔离浏览器流程和移动布局通过；发布门禁仍未满足。 |
| [#94](https://github.com/kenylerich/HuntianLing/issues/94) | 生产本地 CI 执行器 | 部分完成。显式启用脚本提供真实诊断结果。进程组不能约束脱离的后代进程，因此原生 CI 即使命令通过也不能生成验收凭证。完整日志、沙箱集成和托管证据仍待完成。 |
| [#95](https://github.com/kenylerich/HuntianLing/issues/95) | 生产 OAuth 与退出 | 部分完成。浏览器退出撤销会话，后续访问受保护；OAuth 仍待完成。 |
| [#96](https://github.com/kenylerich/HuntianLing/issues/96) | 质量检查及完整客户验收 | 部分完成。ESLint 和包检查通过，覆盖率和重复代码检查已执行并失败。一次性容器中真实 PostgreSQL 往返通过。独立负向对照验证门禁能拒绝错误；完整客户验收仍未完成。 |

`1349752` 的基线检查：typecheck、build、lint、hygiene 及冻结锁文件离线安装通过。使用一次性 PostgreSQL 16 容器时，`pnpm run test` 为 485 通过、零跳过、零失败；随后已移除容器。客户 HTTP 的 14 项通过，包含真实诊断失败与修复，以及缺少进程隔离时拒绝验收。浏览器证据覆盖客户提交、开发批准、工作台导航、移动布局及先前的退出验证。这些限定范围的检查不等于完整客户验收。

执行回归位于 `test/unit/execution-receipts.test.mjs`：实际命令失败和通过都保持诊断性质。显式可信 Host 夹具验证批次完整性、旧结果失效、源码及执行权限变化和 SQLite 重载，不证明执行进程受到隔离。独立评价重跑十项凭证测试及三项原生/HTTP 探针，全部通过。原生命令结果没有生成验收凭证，编辑后的摘要不能授权交付。

原生执行默认禁用，仅接受配置工作区内的包脚本语法。进程组超时控制不能保证脱离的后代进程结束，只可为可信脚本启用诊断。诊断结果不能授权验收。可信 Host 凭证存储不证明依赖完整性、受保护审计存储、独立评审或完整标准覆盖。这些义务、真实 dsh 会话、可配置确认策略、OAuth 和更广客户场景仍待完成。

来源审批修复记录在 `.agents/self-harness/slices/confirmed-intake-delivery/`。十九项专用测试覆盖伪造输入、认证审批身份、来源与 WorkItem 变化、重新审批、拒绝撤销、交付及 Agent 恢复、来源文件和 SQLite 重载。两项 Web 测试覆盖服务延迟注册与撤回，以及独立运行器兼容性。Agents 等待 Board 和 Environment；Web 在处理请求时读取可选的 Agents、Delivery 和 Harness 服务。原有独立方法测试使用外部 Agent 执行；绑定看板的测试显式提升录入夹具。演示测试要求拒绝，而不是接受伪造确认。这是在纠正不合法的演示行为，没有降低验收阈值；真实 dsh 执行和可用的新项目演示仍未验证。

质量门禁使用 ESLint、publint、TypeScript NodeNext、jscpd 和 c8。覆盖率强制重新构建并逐项核对源码；报告缺失、为空、陈旧或未知均失败。独立复核观察到十项负向对照被拒绝、两项正向对照通过。`1349752` 的全仓覆盖失败：行覆盖 90.40%、分支覆盖 70.94%，135 个文件中 109 个未达到逐文件阈值。来源审批修复尚未重跑全仓覆盖，因此该阻塞仍未解除。重复检查仍报告 98 处、2.00%，未满足配置的零重复阈值。没有豁免必需门禁。

来源审批最终检查：typecheck、build、lint、hygiene 和双语同步通过。仓库回归为 505 通过、零失败，一项 PostgreSQL 测试因未配置数据库 URL 而跳过。正式 Cordis HTTP 的 15 项通过，并确认规划使用已注册的 Agent 服务。修复会话拒绝撤销后，独立评估通过本切片全部五条验收、44 项测试及探针、15 项 HTTP 检查。日志位于 `output/verification/confirmed-intake-delivery/`。这些结果不代表 Issue 92 或真实 dsh 执行已验收。

PR 工作流包含这些门禁、客户 HTTP、PostgreSQL 及质量报告产物。这只是本地配置改动，不是远端 CI 成功的证据。基线日志保存在本地 `output/verification/customer-acceptance-repairs/`；门禁工具遵循 [typescript-eslint](https://typescript-eslint.io/getting-started/)、[publint](https://publint.dev/docs/cli) 和 [c8](https://github.com/bcoe/c8) 文档。

验证使用一次性本地工作区，没有使用既有客户记录或外部账户。未修改外部安全策略或 Issue 完成状态。完整范围验收及必需门禁仍未通过，因此不能推送、合并或签发完成证明。
