---
doc_status: active
doc_version: 2026-09-17.1
created: 2026-09-17
last_reviewed: 2026-09-17
review_after: 2026-10-01
archive_after: 2026-12-17
---

# DSH Bundle 集成记录

[English](2026-09-17-dsh-bundle-integration.md) | 中文

## 结论

HuntianLing 包已作为 dsh `0.1.3-alpha.1` 的私有 tarball bundle 完成资格验证。包通过 `package.json#dsh.bundle.patch` 声明 `cordis.patch.yml`；安装后增加唯一、稳定的 `huntianling` Cordis 行，并导入 `@kenylerich/dsh-huntianling/host`。bundle 默认不启动服务。只有 profile 完整替换该行，明确工作区、SQLite、认证、主机和端口后，HuntianLing HTTP 界面才会启动。

这完成了 `REQ-HARNESS-001` 中有界的内部 bundle 集成切片，并为 `REQ-HARNESS-005` 提供真实宿主证据。两项需求仍未整体完成：真实模型任务、三个 Agent 的自身开发运行、公开/客户分发以及客户交付验收仍然开放。

## 触发条件、做法和理由

- 触发条件：HuntianLing 需要在已安装的 dsh 宿主内运行，而不是作为独立 Node 进程运行时，采用本集成。
- 具体做法：dsh 读取包清单、应用 `cordis.patch.yml`、导入根插件，并按依赖顺序启动子项。专用资格验证 profile 提供只属于运行时的路径和秘密。`cordis.yml` 继续作为旧版直接 Cordis 夹具。
- 选择理由：bundle 契约让 dsh 负责 profile 组合与生命周期。默认不启动可防止安装包时未经操作者决定就绑定第二个监听器、选择工作区或削弱认证。被否决的方案是把旧版完整 `cordis.yml` 当作 dsh bundle 清单；dsh 不用它发现 bundle。

## 变更集

| 范围 | 结果 |
| --- | --- |
| Bundle 契约 | `package.json` 导出并打包 `cordis.patch.yml`，清单将其声明为 dsh bundle patch。 |
| 组合 | 唯一稳定行导入公开 `./host` export；其中没有路径、token、密码或已启用监听器。 |
| 生命周期 | 根插件声明 workspace provider，并按 provider 先于 consumer 的顺序等待子 fiber。子项可读取仍处于激活过程的父 provider。 |
| 验证 | 插件冒烟测试优先使用已安装 dsh 的 Cordis runtime，并验证生产 SQLite 子项确实就绪。 |
| 操作入口 | README 记录 add、dump、boot，以及 bundle patch 与旧版夹具的不同职责。 |

## 真实 DSH 证据

资格验证采用源码版本 `15efd66ec08726252640b6d1ceb955ed9db9997d` 加本变更集、Node `24.20.0`、pnpm `11.21.0` 和 dsh `0.1.3-alpha.1`。隔离 profile 为 `huntianling-qualification`；已有 `web` profile 没有作为测试数据库或工作区。其测试前 manifest 和用户 patch 哈希保持为 `b07f71cba5c341f6bd6ebf1316573588817e3a15629a86f11d34d4a01a82c94b` 与 `7bf2f2c53a74f37e452302901f19fa9d9c1e31ab75006b83e3bff3fc53defb14`。

| 检查 | 实测结果 |
| --- | --- |
| 安装与回读 | 本地包链接形成一个 dsh bundle 和一条 Cordis 行；重复配置 dump 没有产生重复行。 |
| 真实启动 | dsh 通过正常 profile 生命周期加载包；根插件及生产子项均进入就绪状态。 |
| HTTP 边界 | `GET /api/status`、`GET /api/projects` 返回 200；未认证写入返回 403；已认证但内容无效的写入到达校验并返回 400。 |
| 持久化 | 已认证创建项目返回 201；优雅停止并重启后，项目仍在 SQLite 中。 |
| 卸载与重装 | 卸载删除依赖、bundle 条目及生成行；重装恢复唯一条目，服务再次成功启动。 |
| 热重载 | 将资格 profile 的监听端口从 3877 改为 3878 后，服务迁移且旧端口释放。 |
| 秘密处理 | 打包行不含秘密；写 token 由进程环境提供，未写入 bundle、profile patch 或本文档。 |
| 正常 Web profile | 保存精确回滚副本后，安装了由提交 `09cb93c` 构建、哈希为 `ca349f014507b9ca8ce4e10e3f303ce1e1073e3a5320b1d0054da9491acbb195` 的不可变工件。Bundle 顺序为 base、web-app、HuntianLing，且只有一条 HuntianLing 行。 |
| 共享 profile 共存 | 临时启动时，DSH Web 使用 3081，HuntianLing 使用 3878，未中断已运行的 desktop profile。DSH Web 要求认证；HuntianLing 读接口返回 200，未认证写入返回 403，已认证但内容无效的写入到达校验并返回 400。 |
| 可移植工件 | `0.1.0-alpha.1` 版本包含预构建输出和已解析 Cordis 依赖。工件 SHA256 为 `928d7562d68fb8dda99a4841361fb1df57793137220e95870887e4593792d7d9`。 |
| 全新 DSH Home | 新的一次性 Home 安装旧工件、升级到 `0.1.0-alpha.1`、保持唯一 bundle 行、降级到 `0.0.0`、卸载 bundle 并保留外部数据标记；重新安装 alpha 工件后，在没有源码 checkout 的情况下冷启动至 SQLite 就绪。 |

端口变更后资格 profile patch 的哈希为 `2ff37e72570c625339055451fe0d5ac3022464ec1591c6faf84b43e203b3ee5d`。该 profile 及其一次性工作区是资格验证产物，不是产品默认值。

## 仓库验证

| 命令 | 结果 |
| --- | --- |
| `pnpm run typecheck` | 通过 |
| `pnpm run build` | 通过 |
| Bundle 与宿主契约测试 | 9 通过，0 失败 |
| `pnpm run test` | 509 项：508 通过、1 项按条件跳过、0 失败 |
| `pnpm run test:e2e` | 使用已安装 dsh Cordis runtime 和真实 SQLite 子项通过 |
| `pnpm run lint` | 通过 |
| `pnpm run hygiene` | 通过 |
| `pnpm run duplication` | 失败：95 个 clone、1.93%，未达到既有的零阈值 |

完整测试会绑定 loopback 监听器。sandbox 运行返回 `EPERM`；经授权在宿主重试后通过。失败的 sandbox 尝试只是执行环境限制，不能算作产品通过证据。

重复度结果属于全仓仍开放的质量门禁，本文不把它报告为通过。合并 bundle workspace provider 读取后，实测基线从 99 个 clone / 2.01% 降至 95 个 / 1.93%；清理其余基线归入既有质量门禁修复范围。

## 剩余边界

- 长期 Web profile 使用不可变本地工件及持久隔离工作区。写 token 继续只在运行时从环境读取；缺少它时，界面只能读取。
- 未来 dsh 版本必须重新验证；当前验证对象是 alpha 版本，不声明 bundle schema 在 `0.1.3-alpha.1` 之外兼容。
- 公开或客户分发仍需许可证决定和更广兼容矩阵；当前合格工件保持私有及 `UNLICENSED`。
- 原生集成所有权已在 [DSH 集成与所有权边界](../../architecture/dsh-integration-boundaries.zh.md) 中确定。真实迁移模型 session、身份或 UI seam 前，仍需稳定 DSH API 和独立兼容证据。
- 关闭 `REQ-HARNESS-005` 前，完成真实模型 Planner、Generator、Evaluator 的自身开发场景。

验收结果：**私有内部 bundle 边界下的 DBI-0 至 DBI-6 已完成；真实模型执行、公开/客户分发以及未来原生 seam 迁移属于独立后续工作。**
