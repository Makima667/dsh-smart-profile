# dsh-smart-profile

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

[![npm version](https://img.shields.io/npm/v/dsh-smart-profile.svg)](https://www.npmjs.com/package/dsh-smart-profile)
[![license](https://img.shields.io/npm/l/dsh-smart-profile.svg)](./LICENSE)

> 面向 DeepSeek Harness 的项目感知能力配置工具：识别项目技术栈、根据任务裁剪能力、发现并评分插件候选、预览精确变更、在明确授权后安全安装、验证，并在失败时回滚。

`dsh-smart-profile` 用来解决“Everything is a Plugin”生态中的配置门槛。用户不需要先知道所有插件，而是从**当前项目 + 当前任务**出发，得到尽可能小且可审查的能力配置方案。

## 1.0 能做什么

```text
项目
  ↓
技术栈识别 + 证据/置信度
  ↓
能力推荐
  ↓
可选：按具体任务裁剪
  ↓
从公开 npm 中发现插件候选
  ↓
项目匹配度 / 维护状态 / 包结构 / 供应链风险评分
  ↓
DSH 兼容状态
  ↓
安全候选筛选
  ↓
生成精确安装 + 验证 + 回滚计划
  ↓
显式 --apply --approve
  ↓
逐个安装
  ↓
DSH --dump-config 验证
  ↓
成功

失败 → 回滚当前插件，并逆序回滚本轮已安装插件
```

默认行为是**仅预览**。除非用户同时提供 `--apply` 和 `--approve`，CLI 不会修改 DSH profile。

## 快速开始

无需全局安装，直接运行：

```bash
npx dsh-smart-profile --help
npx dsh-smart-profile scan .
```

当前 npm 正式版本：

```bash
npm view dsh-smart-profile version
```

将本插件安装到 DeepSeek Harness profile：

```bash
npx --yes @deepseek-ai/dsh@next plugin --profile web add dsh-smart-profile@1.0.0
```

也可以使用本插件提供的辅助命令：

```bash
npx dsh-smart-profile install --profile web
```

## 一条命令生成项目配置方案

先预览完整方案：

```bash
npx dsh-smart-profile setup .
```

针对具体任务裁剪能力：

```bash
npx dsh-smart-profile setup . --task "修复前端 Playwright 测试"
```

指定 profile 和插件最低评分：

```bash
npx dsh-smart-profile setup . --profile web --min-score 75
```

确认方案后真正执行：

```bash
npx dsh-smart-profile setup . --profile web --apply --approve
```

`--apply` 和 `--approve` 必须同时存在。只传 `--approve` 仍然不会执行安装。

## 独立命令

```bash
npx dsh-smart-profile scan .
npx dsh-smart-profile recommend .
npx dsh-smart-profile compose "排查数据库迁移问题" .
npx dsh-smart-profile discover .
npx dsh-smart-profile score .
npx dsh-smart-profile compat next
npx dsh-smart-profile web . --port 4173
```

单插件安全流程：

```bash
npx dsh-smart-profile plan dsh-example@1.2.3 --profile web
npx dsh-smart-profile apply dsh-example@1.2.3 --profile web --approve
```

## Harness 内提供的工具

插件在 Harness 中注册以下以读取/预览为主的工具：

- `smart_profile_scan` — 技术栈识别并返回证据
- `smart_profile_recommend` — 根据项目推荐能力
- `smart_profile_discover` — 从公开 npm 发现候选插件，不安装
- `smart_profile_score` — 插件评分与风险标记
- `smart_profile_install_plan` — 生成单候选安装计划，不执行
- `smart_profile_compose` — 根据任务动态裁剪能力
- `smart_profile_setup_plan` — 生成完整 1.0 配置计划，不执行
- `smart_profile_compat` — 读取本地 DSH 兼容策略/矩阵

**Harness 中的模型不会获得自动安装工具。** 真正修改 profile 的操作必须通过 CLI 显式执行，避免模型调用在用户不知情的情况下安装主机级代码。

## 技术栈识别范围

目前覆盖：

- JavaScript / TypeScript / Node.js
- Python
- Java / Kotlin
- Go
- Rust
- PHP
- Ruby
- .NET
- Dart / Flutter
- React、Next.js、Vue、Nuxt、Svelte、Angular
- Express、Fastify、NestJS、FastAPI、Django、Flask
- Spring Boot、Gin、Axum、Actix Web
- Laravel、Symfony、Rails、Sinatra、ASP.NET Core
- PostgreSQL、MySQL、MongoDB、Redis、SQLite 信号
- Docker / Compose
- Kubernetes / Helm
- Terraform
- AWS / Azure / Google Cloud 部分信号
- GitHub Actions、Azure Pipelines、Google Cloud Build
- Playwright、Cypress、Vitest、Jest、Pytest、PHPUnit、RSpec、xUnit
- npm/yarn/pnpm workspaces、Turborepo、Nx、Lerna

识别采用启发式规则，并返回证据和置信度，不把单一弱信号伪装成确定结论。

## 插件评分

评分只用于辅助决策，1.0 主要考虑：

1. 项目/能力匹配度
2. 最近发布时间
3. npm 搜索相关度（弱信号）
4. 仓库、许可证和主页元数据
5. 依赖规模
6. 生命周期安装脚本
7. 是否声明 DSH bundle

自动配置会拒绝以下候选：

- 分数低于阈值
- 标记为 `review-required`
- 存在阻断级生命周期安装脚本风险
- 没有声明 `dsh.bundle.patch`

高分**不等于安全保证**。在敏感环境中仍应人工审查源码。

## 安全安装与回滚

安装前，1.0 使用 DSH `--dump-config` 作为内存中的快照/验证信号。原始组合配置不会被本插件持久化，只返回哈希。

如果候选插件在配置前已经存在，本轮不会删除它。对于本轮新安装的插件：

- 每个插件单独安装
- 每次安装后都使用 `--dump-config` 验证
- 当前插件验证失败时先移除当前插件
- 然后逆序移除本轮此前安装成功的插件

回滚属于 best-effort：如果主机或包管理器在进程外部发生故障，无法保证绝对原子性。

## DSH 兼容矩阵

`compatibility.json` 区分：

- `ci-target` — 仓库 CI 尝试测试的目标
- `verified` — 只有存在真实验证证据时才使用
- `unknown` — 当前矩阵未记录的目标

仓库工作流覆盖 Node 20/22/24、npm 包结构、本地 bundle 安装以及 `@deepseek-ai/dsh@next` 的 `--dump-config` 验证。声明测试目标不代表自动标记为 verified。

```bash
npx dsh-smart-profile compat next
```

## 本地 Web UI

```bash
npx dsh-smart-profile web . --port 4173
```

Web 面板：

- 默认仅绑定 `127.0.0.1`
- 只读
- 展示识别到的技术栈和能力推荐
- 支持任务级能力组合
- 不提供安装/删除接口
- 对项目提供的文本做 HTML 转义
- 使用 CSP 和 `no-store` 响应

## 隐私

扫描器刻意避免读取任意业务源码，主要读取已知 manifest、lockfile 名称、部分配置文件以及目录/文件结构信号。

它不会主动读取：

- `.env`
- 私钥
- 凭证文件
- 任意应用源码

同时会跳过生成目录、构建目录和 vendor 目录，并限制扫描深度与 manifest 数量。

## 开发

要求 Node.js 20+。

```bash
npm test
npm run pack:check
```

运行时 npm 第三方依赖数量：**0**。

## 版本路线

- **0.1** — 基础技术栈识别 + 能力推荐
- **0.2** — 置信度/证据 + 更广识别范围
- **0.3** — 插件候选发现
- **0.4** — 插件评分 / 风险信号
- **0.5** — 安全安装计划、验证和回滚
- **0.6** — DSH 兼容矩阵 + CI 目标
- **0.7** — 根据具体任务动态裁剪能力
- **0.8** — 只读本地 Web UI
- **1.0** — 带显式写入授权的完整自动项目能力配置闭环

详细变化见 [CHANGELOG.md](./CHANGELOG.md)。

## 1.0 之后的方向

1.x 会优先提升可信度和生态质量，而不是单纯增加识别器：

- 插件签名、attestation 与来源证明
- 更强的 GitHub 仓库健康度/安全信号
- 缓存型 Registry 索引，加速候选发现
- 团队级 per-capability policy
- 可供 CI 使用的机器可读 setup plan
- 从真实成功工作流生成 verified 兼容结果
- 如果 Harness 提供稳定事务 API，则实现原子 profile snapshot/restore
- 功能更丰富但仍需要明确审批的 Web UI
- 社区维护的兼容性/能力 Registry 适配器

## License

MIT
