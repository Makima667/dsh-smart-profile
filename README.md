# dsh-smart-profile

> Project stack detection and explainable capability recommendations for DeepSeek Harness.

`dsh-smart-profile` helps answer one question: **what capabilities does this repository actually need?**

The first release scans known project metadata, detects the stack, and produces a minimal set of capability recommendations. It intentionally does **not** silently install unknown third-party plugins.

## v0.1.0

### Features

- DeepSeek Harness bundle package via `dsh.bundle.patch`
- npm-ready package with no runtime dependencies
- standalone `npx` CLI
- Harness tool: `smart_profile_scan`
- Harness tool: `smart_profile_recommend`
- detects common Node.js / TypeScript / Python / Java / Kotlin / Go / Rust projects
- detects React, Next.js, Vue, Nuxt, Svelte, Angular, Express, Fastify, NestJS, FastAPI, Django, Flask, Spring Boot, Gin, Axum and Actix Web
- detects Docker, GitHub Actions, common databases, testing frameworks and monorepo signals
- reads known manifests only; does not read `.env` or arbitrary source files

## Install

After the package is published to npm:

```bash
npm exec --yes dsh-smart-profile@latest -- install --profile web
```

Equivalent Harness command:

```bash
npx --yes @deepseek-ai/dsh@next plugin --profile web add dsh-smart-profile@latest
```

Standalone usage:

```bash
npx dsh-smart-profile scan
npx dsh-smart-profile recommend
npx dsh-smart-profile recommend . --json
```

## Harness tools

### `smart_profile_scan`

Scans the current Harness session workspace and returns detected languages, frameworks, databases, infrastructure, CI, tests and project structure with evidence.

### `smart_profile_recommend`

Converts the scan into explainable capability categories such as browser automation, API testing, database tooling, containers and GitHub integration.

## Safety

v0.1 keeps filesystem behavior deliberately narrow:

- no `.env` reads
- no private-key or credential reads
- no arbitrary source-code reads
- generated/build directories are ignored
- third-party Harness plugins are not auto-installed

The intended future installation flow is:

```text
scan
  ↓
recommend capabilities
  ↓
resolve candidate plugins
  ↓
score candidates
  ↓
preview exact changes
  ↓
user approval
  ↓
install
  ↓
verify
  ↓
success ─────────────┐
                     │
failure → rollback ←─┘
```

# Roadmap / 阶段路线

Every stage is intended to be reviewed, tested, and published separately to GitHub.

## v0.2 — Better detection / 更准确识别

- improve workspace and monorepo analysis
- add PHP, Ruby, .NET and Flutter detection
- detect Terraform, Kubernetes and cloud-provider signals
- improve dependency confidence and conflict handling
- add realistic fixture-based regression tests

**Goal:** reduce false positives before adding plugin discovery.

## v0.3 — Plugin candidate discovery / 插件候选发现

- map capability categories to actual DeepSeek Harness plugin candidates
- keep discovery separate from installation
- expose source/repository, compatibility metadata and requested capabilities

**Goal:** tell users which plugins may satisfy a need without installing them.

## v0.4 — Plugin scoring / 插件评分

Rank candidates using:

1. project fit
2. DSH version compatibility
3. maintenance recency
4. repository health
5. dependency/supply-chain risk
6. requested permissions/services
7. popularity as a weak signal only

**Goal:** recommend trustworthy candidates, not merely popular ones.

## v0.5 — Safe install & rollback / 安全安装与回滚

- preview changes before install
- require explicit approval
- snapshot current profile
- install selected plugin
- verify import/boot
- rollback automatically on failure

**Goal:** make installation reversible and auditable.

## v0.6 — DSH compatibility matrix / DSH兼容矩阵

- CI against supported Harness releases
- record verified/failed combinations
- surface compatibility status before install

**Goal:** reduce breakage as Harness evolves.

## v0.7 — Dynamic task-based trimming / 根据任务动态裁剪插件

- combine repository profile with current task intent
- select only the minimal relevant capability set for a session
- avoid loading unrelated high-privilege tools

**Goal:** smaller tool surface, less model confusion, lower overhead.

## v0.8 — Web UI / Web可视化界面

- show detected stack
- show recommendations and candidate scores
- preview planned changes
- provide install/rollback controls

**Goal:** make the workflow accessible to non-expert users.

## v1.0 — Automatic project capability configuration / 自动项目能力配置

Desired user experience:

```bash
npx dsh-smart-profile setup
```

The tool should then:

- understand the repository
- infer useful capabilities
- discover candidate plugins
- explain and score candidates
- check DSH compatibility
- preview exact changes
- obtain approval
- install safely
- verify the result
- rollback on failure
- optionally compose a minimal task-specific profile

That is the long-term product promise: **a project-aware capability entry point for DeepSeek Harness, not another plugin marketplace.**

## Development

```bash
npm test
npm run pack:check
```

## License

MIT
