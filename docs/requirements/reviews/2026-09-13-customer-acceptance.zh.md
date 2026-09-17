---
doc_status: active
doc_version: 2026-09-13.1
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
