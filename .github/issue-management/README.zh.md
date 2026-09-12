---
doc_status: active
doc_version: 2026-09-12.1
created: 2026-09-12
last_reviewed: 2026-09-12
review_after: 2026-10-12
---

# Project 泳道操作

[English](README.md) | 中文

## 摘要

仓库生命周期工作流将 Issue 事件投影到 Project #2。显式工作流事件控制开发泳道；PR 活动仅初始化 Start date。此实现覆盖 `REQ-ISSUE-001` 的仓库投影部分，以及 `REQ-EVIDENCE-001` 要求的完成记录检查。

## 部署与操作

使用新输入前，先将工作流和策略修改合并到 `master`。生命周期任务检出默认分支：创建 PR 或修改本地文件不会部署策略。本地 Agent 切片记录不会自动发送 GitHub 事件；该事件生产者属于产品的 Issue 同步适配器。

在 Actions 中选择 **Issue lifecycle**，再选择 **Run workflow**，分支使用 `master`。填写 `issue_number` 和对应的 `workflow_event`。运行成功后仍需核对 Issue 状态及 Project Status；校验失败会保留泳道，并生成 Issue 审计评论。

| 事件 | 所需当前泳道 | 结果 |
| --- | --- | --- |
| `intake` | Inbox 或缺少 Status | Inbox |
| `triaged` | Inbox | Backlog |
| `ready` | Backlog | Ready |
| `work_started` | Ready | In progress |
| `review_requested` | In progress | In review |
| `changes_requested` | In review | In progress |
| `completed` | In review | 通过完成记录检查后进入 Done，并按 completed 关闭 |
| `no_action` | 任一开放泳道 | No action，并按 not-planned 关闭 |

Issue 校验通过时，允许对已处于目标泳道的卡重复发送事件。原生打开或重新打开事件将卡放入 Inbox。原生 not-planned 关闭事件将其放入 No action。其他 Issue 编辑只校验元数据并初始化缺失的 Status，不推断开发进度。解决型 PR 引用要求 Issue 已通过工作流进入 In progress 或 In review。

## 完成记录与恢复

按 completed 关闭时，Issue 正文必须包含 `<!-- huntianling-delivery-gate -->` 块。应将其放入折叠详情区域，保持外露正文长度限制。该块包含 WorkItem、Acceptance、Code、Review、CI、Evidence 和 Gates，值不能缺失或使用占位内容。Gates 必须恰好为支持的成功标记，例如 `passed`、`approved` 或 `已通过`；`not passed` 会被拒绝。

此解析器校验声明的记录，不验证所引用证据是否存在、真实或对应当前版本。操作者必须保留真实关联的验收、代码、审查和检查证据。解析器不能替代独立评价，也不能证明 HuntianLing runtime 已完成交付。

缺少合格记录的 completed 关闭会被重新打开，Project 卡回到此前的开放泳道；若此前泳道缺失或已终结，则回到 In review。`recover_closed` 检查单个 Issue；`recover_illegal_closed` 和定时扫描检查按 completed 关闭的 Issue。恢复会重新读取当前 Issue：保留开放或 not-planned 的 Issue，将有合格记录但泳道滞后的已完成 Issue 投影到 Done。已正确投影且有合格记录的 Done 卡保持不变。

工作流需要已配置的 GitHub App 凭据或 `HUNTIANLING_PROJECT_TOKEN`，才能访问用户级 Project。缺少凭据时在 **Resolve board token** 阶段失败。Project 字段与仓库配置见 [AGENTS.md](../../AGENTS.md#issue-assets)。

## 验证

运行候选策略的定向测试：

```sh
node --test .github/issue-management/policy.test.mjs
```

CI 在包测试之外执行此测试集。测试模拟 GitHub 请求，核对发出的状态写入、转换拒绝、恢复和令牌分离。实际 GitHub dispatch 和 Project 写入验收应在部署后执行；本地测试不能证明已经部署。
