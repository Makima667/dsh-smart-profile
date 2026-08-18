# dsh-smart-profile

<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-smart-profile"><img src="https://img.shields.io/npm/v/dsh-smart-profile.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-smart-profile"><img src="https://img.shields.io/npm/dm/dsh-smart-profile.svg" alt="npm downloads"></a>
  <a href="https://github.com/Makima667/dsh-smart-profile/releases"><img src="https://img.shields.io/github/v/release/Makima667/dsh-smart-profile" alt="GitHub release"></a>
  <a href="https://github.com/Makima667/dsh-smart-profile/actions/workflows/compat.yml"><img src="https://github.com/Makima667/dsh-smart-profile/actions/workflows/compat.yml/badge.svg" alt="DSH compatibility"></a>
  <a href="https://github.com/Makima667/dsh-smart-profile/actions/workflows/publish.yml"><img src="https://github.com/Makima667/dsh-smart-profile/actions/workflows/publish.yml/badge.svg" alt="npm publish"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/dsh-smart-profile.svg" alt="license"></a>
</p>

> Project-aware capability setup for DeepSeek Harness: detect the repository, trim to the task, discover and score plugin candidates, preview exact changes, install with explicit approval, verify, and rollback on failure.

`dsh-smart-profile` is designed to solve the configuration gap created by an “everything is a plugin” ecosystem. Instead of asking users to know every plugin in advance, it starts from the repository and the task.

## Why use it?

- **Project-aware** — starts from your actual repository instead of a generic plugin list.
- **Task-aware** — trims capabilities for the concrete task you are trying to complete.
- **Safety-first** — preview by default; installation requires explicit `--apply --approve`.
- **Explainable** — detection returns evidence/confidence and plugin selection exposes scoring/risk signals.
- **Recoverable** — verifies each installation and rolls back packages installed by the current run on failure.
- **Low overhead** — zero runtime npm dependencies.

## Quick start

The package is publicly available on npm.

```bash
npx dsh-smart-profile --help
npx dsh-smart-profile scan .
npx dsh-smart-profile setup .
```

Check the current published version:

```bash
npm view dsh-smart-profile version
```

Install the bundle into a DeepSeek Harness profile:

```bash
npx --yes @deepseek-ai/dsh@next plugin --profile web add dsh-smart-profile@latest
```

Or use the helper command:

```bash
npx dsh-smart-profile install --profile web
```

## What 1.0 does

```text
project
  ↓
stack detection + evidence/confidence
  ↓
capability recommendations
  ↓
optional task-aware trimming
  ↓
public npm candidate discovery
  ↓
project-fit / maintenance / package / supply-chain scoring
  ↓
DSH compatibility status
  ↓
safe candidate selection
  ↓
exact install + verify + rollback preview
  ↓
explicit --apply --approve
  ↓
install one by one
  ↓
DSH --dump-config verification
  ↓
success

failure → remove the current package and roll back packages installed by this run in reverse order
```

The default behavior is **preview-only**. The CLI does not write to a DSH profile unless the user supplies both `--apply` and `--approve`.

## One-command project setup

Preview a complete setup plan:

```bash
npx dsh-smart-profile setup .
```

Trim the setup to a concrete task:

```bash
npx dsh-smart-profile setup . --task "fix the frontend Playwright tests"
```

Choose another profile or candidate score threshold:

```bash
npx dsh-smart-profile setup . --profile web --min-score 75
```

Actually apply the reviewed plan:

```bash
npx dsh-smart-profile setup . --profile web --apply --approve
```

Both write flags are intentional. `--approve` without `--apply` still does not install anything.

## Standalone commands

```bash
npx dsh-smart-profile scan .
npx dsh-smart-profile recommend .
npx dsh-smart-profile compose "debug the database migration" .
npx dsh-smart-profile discover .
npx dsh-smart-profile score .
npx dsh-smart-profile compat next
npx dsh-smart-profile web . --port 4173
```

Manual single-package safety flow:

```bash
npx dsh-smart-profile plan dsh-example@1.2.3 --profile web
npx dsh-smart-profile apply dsh-example@1.2.3 --profile web --approve
```

## Harness tools

The bundle registers read-oriented/preview tools:

- `smart_profile_scan` — stack detection with evidence
- `smart_profile_recommend` — project capability recommendations
- `smart_profile_discover` — public npm candidate discovery; no install
- `smart_profile_score` — candidate scoring and risk flags
- `smart_profile_install_plan` — exact single-candidate command plan; no execution
- `smart_profile_compose` — task-aware capability trimming
- `smart_profile_setup_plan` — full 1.0 setup preview; no execution
- `smart_profile_compat` — local compatibility policy/matrix report

**The Harness model is deliberately not given an auto-install tool.** Profile writes remain an explicit CLI action so a model call cannot silently install host-level code.

## Detection coverage

Current detectors include:

- JavaScript / TypeScript / Node.js
- Python
- Java / Kotlin
- Go
- Rust
- PHP
- Ruby
- .NET
- Dart / Flutter
- React, Next.js, Vue, Nuxt, Svelte, Angular
- Express, Fastify, NestJS, FastAPI, Django, Flask
- Spring Boot, Gin, Axum, Actix Web
- Laravel, Symfony, Rails, Sinatra, ASP.NET Core
- PostgreSQL, MySQL, MongoDB, Redis, SQLite signals
- Docker / Compose
- Kubernetes / Helm
- Terraform
- selected AWS / Azure / Google Cloud signals
- GitHub Actions, Azure Pipelines, Google Cloud Build
- Playwright, Cypress, Vitest, Jest, Pytest, PHPUnit, RSpec, xUnit
- npm/yarn/pnpm workspaces, Turborepo, Nx, Lerna

Detection is heuristic and returns evidence plus confidence instead of pretending every signal is certain.

## Candidate scoring

Scores are advisory. 1.0 combines:

1. project/capability fit
2. release recency
3. npm search relevance as a weak signal
4. repository/license/homepage metadata
5. dependency size
6. lifecycle install scripts
7. DSH bundle declaration

Automatic setup selection refuses candidates that:

- are below the configured score threshold
- are marked `review-required`
- expose blocking lifecycle install-script risk
- do not declare `dsh.bundle.patch`

A high score is not a security guarantee. Review source for sensitive environments.

## Safe install and rollback

Before installing a selected package, 1.0 uses DSH `--dump-config` as an in-memory snapshot/verification signal. Raw composed configuration is not persisted by this package; only hashes are returned in operation results.

If the package is already present in the composed profile, setup leaves it untouched. For packages installed during the current setup run:

- each package is installed separately
- each installation is verified with `--dump-config`
- the current package is removed if verification fails
- packages installed earlier in the same setup run are then removed in reverse order

Rollback is best-effort because host/package-manager failures can still interrupt processes outside this package's control.

## DSH compatibility matrix

`compatibility.json` distinguishes between:

- `ci-target` — a channel the repository workflow attempts to test
- `verified` — reserved for evidence-backed combinations
- `unknown` — exact targets not recorded in the matrix

The repository workflow tests Node 20/22/24, npm package shape, local bundle installation, and DSH `--dump-config` against `@deepseek-ai/dsh@next`. A declared target is **not** automatically labeled verified.

```bash
npx dsh-smart-profile compat next
```

## Local Web UI

```bash
npx dsh-smart-profile web . --port 4173
```

The dashboard:

- binds to `127.0.0.1` by default
- is read-only
- shows detected stack and capability recommendations
- supports task composition
- exposes no install/remove endpoint
- escapes repository-provided text
- uses CSP and `no-store` responses

## Privacy

The scanner intentionally avoids arbitrary source-code reads. It focuses on known manifests, lockfile names, selected configuration files, and directory/file signals.

It does not intentionally read:

- `.env`
- private keys
- credential files
- arbitrary application source files

Generated/build/vendor directories are skipped and scanning is bounded by depth and manifest limits.

## Automated npm publishing

The repository includes `.github/workflows/publish.yml` for npm Trusted Publishing with GitHub Actions OIDC.

For future releases:

1. bump `package.json` to the next version
2. commit and push the change
3. create and push a matching tag such as `v1.1.0`
4. the workflow checks that the tag matches `package.json`
5. tests and `npm run pack:check` must pass before `npm publish`

The workflow intentionally contains **no long-lived npm publish token**. npm Trusted Publishing must be configured once for this package with:

- GitHub owner: `Makima667`
- repository: `dsh-smart-profile`
- workflow filename: `publish.yml`
- allowed action: `npm publish`

## Development

Requires Node.js 20+.

```bash
npm test
npm run pack:check
```

The package has zero runtime npm dependencies.

## Version history

- **0.1** — baseline stack scan + capability recommendation
- **0.2** — confidence/evidence and broader detection
- **0.3** — plugin candidate discovery
- **0.4** — plugin scoring / risk signals
- **0.5** — safe install planning, verification, rollback
- **0.6** — DSH compatibility matrix + CI target workflow
- **0.7** — task-aware capability trimming
- **0.8** — read-only local Web UI
- **1.0** — complete automatic project capability configuration pipeline with explicit write approval

See [CHANGELOG.md](./CHANGELOG.md) for details.

## Next directions after 1.0

The 1.x line should focus on trust and ecosystem quality rather than simply adding more detectors:

- signed/attested plugin metadata and provenance
- stronger GitHub repository health/security signals
- cached registry index for faster discovery
- per-capability policy files for teams
- machine-readable setup plans for CI
- verified compatibility results generated from successful workflow runs
- atomic profile snapshot/restore if Harness exposes a stable profile transaction API
- richer but still approval-gated Web UI
- community-maintained compatibility/capability registry adapters

## License

MIT
