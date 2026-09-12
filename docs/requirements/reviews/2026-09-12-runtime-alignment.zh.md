---
doc_status: active
doc_version: 2026-09-12.2
created: 2026-09-12
last_reviewed: 2026-09-12
review_after: 2026-09-26
archive_after: 2026-12-12
---

# Harness 运行能力一致性审查

[English](2026-09-12-runtime-alignment.md) | 中文

## 摘要

所查工作区快照包含 D2 工作流模板及 D3 实现和评价材料。该快照中的默认 Story 交付路径在没有创建应用代码、没有执行验收检查时报告了完成，并生成客户可见的交付证据。这份按日期保存的复现不能证明后续 D6 或更晚变更是否已修复问题。后续切片及验收义务由 [backlog D16–D21](../backlog.zh.md#d16d21--缺陷修正验收) 负责。

本审查覆盖 2026-09-12 的共享工作区，包含未提交文件，不代表已发布构建或固定提交。保留内部 WorkItem 模型、看板界面、需求记录、流程持久化及 D2/D3 的限定范围成果。本审查没有重新评价 D2/D3 的全部标准，也不为这些切片签发验收。预期实现接收方是用户确认已推进到 D6 的 Grok；记录完成前，必须由独立 Evaluator 验证每项修正。仓库中存在交接文档不代表接收方已经收到或确认。

## 目录

- [复现](#复现)
- [未解决问题](#未解决问题)
- [交接与验收](#交接与验收)
- [验证范围](#验证范围)

## 复现

在仓库根目录构建当前源码，并运行隔离诊断：

```sh
pnpm run build
node docs/requirements/reviews/2026-09-12-runtime-repro.mjs
```

诊断创建一个没有应用代码、`typecheck` 和 `test` 脚本均为 `exit 1` 的临时项目。它使用生产服务构造函数，传入与开发者启动操作相同的 `environmentReady: true` 声明，并在结束后删除临时项目。它输出观察结果；退出码为零不代表验收通过。它不调用真实模型，也不覆盖浏览器认证流程。

| 观察对象 | 2026-09-12 的结果 | 应有行为 |
| --- | --- | --- |
| 默认环境准备 | `ready: false` | 必需检查必须实际执行，否则阻塞准备。 |
| `canStartImplementation` | 脚本失败仍返回 `true` | 调用不能凭空产生通过的检查。 |
| Story 交付 | `completed` | 没有真实实现和独立评价就不能完成。 |
| 声称生成的文件 | `src/login-application.ts` 不存在 | 实现必须标识实际产生的交付物。 |
| Generator 自检 | 类型检查和测试均为 `pass` | 状态必须来自实际执行的检查。 |
| Evaluator | 条目为 `pass`，证据为 `deterministic-evaluator` | 评价必须检查待交付代码并保留可复现证据。 |
| 交付证据与状态转换 | 被识别为执行证据；允许 `delivered` | 模拟输出不能满足正式交付门禁。 |
| 客户进度 | `delivered` | 进度必须反映已经验证的客户行为。 |

## 未解决问题

| 优先级 | 问题与源码 | 关联需求 |
| --- | --- | --- |
| P0 | [Agent runtime](../../../src/host/agents/runtime.ts) 生成未实际写入的文件名及通过的自检。Evaluator 将验收字符串映射为通过条目，除非调用方主动提供失败项。[证据持久化](../../../src/host/agents/evidence.ts) 将这些结果标为 `executed`，[交付证据检查](../../../src/host/board/executed-evidence.ts) 随后接受它们。 | `REQ-HARNESS-003`、`REQ-HARNESS-006`、`REQ-HARNESS-008`、`REQ-WEB-007` |
| P0 | [环境服务](../../../src/host/environment/service.ts) 默认跳过检查，却在 `canStartImplementation` 中注入始终通过的执行器。[开发者启动操作](../../../src/host/web/pages/developer.ts) 传入 `environmentReady: true`。这些声明不能证明生产环境已经就绪。 | `REQ-HARNESS-001`、`REQ-HARNESS-005` |
| P1 | [Story 交付](../../../src/host/delivery/service.ts) 调用确定性任务函数。输入没有把真实代码版本、评价发现和后续代码修复连起来。Planner 输入直接声明 `confirmed: true`；应保留实际范围决定及其授权依据。 | `REQ-HARNESS-006`、`REQ-HARNESS-007`、`REQ-HARNESS-008` |
| P1 | [编码 Skill](../../../src/host/skills/coding-pack.ts) 声明 `valid`、深度步骤和简单示例。Story 路径没有选择已有方法。这不能证明 Skill 指令、传感器和深度选择实际约束了编码任务。MKT 独立的校验工作不属于此问题。 | `REQ-SKILL-005`、`REQ-SKILL-006`、`REQ-HARNESS-007` |
| P1 | [交付检查点](../../../src/host/delivery/service.ts) 持久化阶段，却将 `repositoryRevision` 初始化为空字符串。[证据版本](../../../src/host/board/executed-evidence.ts) 计算需求和设计字段的哈希，没有绑定待交付代码。真实会话恢复和代码变化后的证据失效需要单独验收。 | `REQ-HARNESS-002`、`REQ-HARNESS-003` |
| P1 | [自身开发演示](../../../src/host/harness/service.ts) 使用 `demoRunner` 并强制首次评价失败。记录确定性执行与真实模型的差异有价值，但脚本演示不能证明新项目接入或真实 Agent 交付。 | `REQ-HARNESS-005`、`REQ-HARNESS-008` |

## 交接与验收

Grok 应保留既有 D1–D15 顺序及当前进度，随后执行追加的 D16–D21 修正切片。按最新源码复核每项发现，已修复的补充独立证据；这份按日期保存的审查不要求中断当前切片。不要移除已实现的看板或模板能力，不要批量重置需求，也不要另建一套竞争性的模型运行时。应核实 dsh 宿主实际提供的任务、会话和工具 API，将缺失的集成能力列为明确依赖。

每项修正均通过仓库 self-harness 技能包记录关联需求、已审查设计、可测试验收、实现证据和独立评价。准确标记外部 Agent、人工、确定性演示和 HuntianLing-runtime 执行。仅有 `independent: true` 字段或符合 schema 的评价文件，不能证明独立评价者已经执行检查。

首先通过生产入口验证上述反例：没有应用且检查失败时，完成状态和客户交付状态都必须阻塞。正向验收必须从全新项目开始，收集并确认需求，通过 dsh 执行三个 Agent，产出可运行代码，让真实验收条目失败，根据发现修复，再通过独立评价。在第二个项目重复环境准备。中断真实任务，并在恢复前核对代码、会话和待执行副作用。保留命令、会话和交付物引用，供独立审查者验证。

## 验证范围

本审查复现了默认服务路径的虚假完成。此前针对 Agent、环境、Story 交付、客户进度和 harness 测量的定向测试共通过 36 项；这些确定性测试没有发现该反例。本审查没有验证真实三个 Agent 编码运行，也没有完成新项目客户端到端验收。其余问题列出代码层面的缺口及所需验收，不构成新的运行能力完成声明。
