---
doc_status: active
doc_version: 2026-09-17.1
created: 2026-09-17
last_reviewed: 2026-09-17
review_after: 2026-10-17
---

# DSH 集成与所有权边界

[English](dsh-integration-boundaries.md) | 中文

## 决定

首个支持宿主采用私有、固定版本的 tarball bundle 分发 HuntianLing。DSH 负责包组合和通用宿主能力；HuntianLing 负责产品记录、策略和交付决定。双方通过明确的 adapter 和引用跨越边界，不复制对方的权威状态。

该边界适用于 bundle 运行在 DSH `0.1.3-alpha.1` 的场景。当 DSH 提供稳定的原生 seam，并能保留 HuntianLing 子系统的验收标准、迁移路径和回滚证据时，再重新评估。

## 分发策略

- 包版本 `0.1.0-alpha.1` 是首个固定的内部 bundle 版本。
- `private: true` 和 `UNLICENSED` 是明确选择：工件可安装到获授权的本地宿主，但不得发布到公开 registry，也不得作为开源软件再分发。
- 发布工件通过 `pnpm pack` 产生，包含预构建 `lib`，把 `workspace:^` Cordis 改写为已解析的包版本，并用 SHA256 标识。
- 兼容范围限定为 macOS arm64、Node 24.20.0、pnpm 11.21.0 和 DSH `0.1.3-alpha.1`，直到其他矩阵完成资格验证。
- 安装必须使用固定 tarball 路径或摘要。源码 link 和可变 Git 分支属于开发输入，不是发布工件。
- 升级和降级保留 profile 用户 patch 及 HuntianLing 工作区。卸载删除 bundle 组合和包依赖，但不删除产品数据。

被否决的方案包括：未确定许可证就公开发布 npm、安装时从可变 Git 构建，以及在 bundle 中复制第二份 Cordis runtime。

## 状态与生命周期所有权

| 能力 | 状态所有者 | 生命周期所有者 | 集成规则 |
| --- | --- | --- | --- |
| Profile、bundle 顺序、patch 层 | DSH | DSH | HuntianLing 只贡献一条 bundle 行，绝不编辑生成配置。 |
| 模型 endpoint、账号、provider 凭据 | DSH/操作者 | DSH | HuntianLing 只保存绑定引用；秘密不进入产品记录和证据。 |
| 模型 session 和通用工具执行 | DSH | DSH | 未来真实 Agent 调用 adapter，并保留 DSH session/tool receipt 标识。 |
| Project、WorkItem、需求、验收 | HuntianLing | HuntianLing | DSH session 接收限定范围的快照，不成为事实源。 |
| Planner、Generator、Evaluator 定义 | HuntianLing | HuntianLing | DSH 执行已绑定任务，HuntianLing 校验输出并控制交接。 |
| 工作流、调度、lease、预算 | HuntianLing | HuntianLing | DSH 通用取消属于执行信号；产品状态迁移与恢复仍由 HuntianLing 决定。 |
| 授权和交付策略 | HuntianLing | HuntianLing | DSH 宿主认证可以确认身份；HuntianLing 判断项目角色与动作策略。 |
| 执行凭证 | 产生凭证的 DSH 宿主 | 产生由 DSH 负责；验证/索引由 HuntianLing 负责 | 持久化不可变 producer 和 revision 引用；可编辑摘要不能生成验收资格。 |
| 产品数据库和工件 | HuntianLing | HuntianLing | 使用明确的持久工作区；卸载包绝不删除数据。 |
| DSH Web UI | DSH | DSH | HuntianLing 当前使用独立 loopback 界面；有文档化 UI extension seam 后才嵌入导航。 |
| HuntianLing Web/API | HuntianLing | HuntianLing | 绑定独立端口，执行自己的写边界，并随 bundle fiber 释放。 |

## Adapter 契约

每个 DSH adapter 必须接收项目范围请求，声明所需能力与预算，返回带宿主/session 身份的类型化凭证，并暴露取消及终止状态。缺少宿主能力、凭据绑定或凭证验证时必须关闭失败。Adapter 可以缓存展示数据，但不能复制 DSH 秘密，也不能把已提交任务宣称为已经执行。

## 迁移规则

只有兼容测试证明正反行为等价、状态迁移可回滚，并且切换后只剩一个所有者，才能一次迁移一个 seam。Bundle 能加载或两个界面显示同一信息不构成迁移证据。在满足条件前，以上所有权表就是有效边界。

## 开放工作

- 真实 DeepSeek provider 和三个 Agent 的真实运行仍需要另行批准的 provider 凭据及有界评价计划。
- DSH 原生 UI 导航、身份联邦和任务/session adapter 需要稳定宿主 API 后才能迁移。
- 公开或客户分发需要许可证决定和更广的兼容矩阵。
