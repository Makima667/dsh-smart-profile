# Changelog

## 0.8.0 - 2026-08-18

- Add a zero-dependency, read-only local web dashboard for project detection, recommendations, and task-scoped composition.
- Bind to loopback by default and reject remote exposure unless explicitly overridden by library callers.
- Add CSP, no-store responses, output escaping, and no web endpoints for plugin installation/removal.
- Add `web [path] --port <port>` CLI support and `/api/profile` JSON output.

## 0.7.0 - 2026-08-18

- Add task-aware capability composition that narrows the project profile to the smallest useful capability set.
- Keep project runtimes when code execution/inspection is implied while excluding unrelated high-privilege capabilities.
- Add `compose <task>` CLI support and the read-only `smart_profile_compose` Harness tool.
- Preserve explicit reasons for selected and excluded capabilities.

## 0.6.0 - 2026-08-18

- Add an explicit DSH compatibility matrix with `ci-target`, `verified`, and `unknown` semantics.
- Add a `compat` CLI report and read-only `smart_profile_compat` Harness tool.
- Add GitHub Actions coverage for Node 20/22/24, npm packaging, local bundle installation, and `--dump-config` verification against `@deepseek-ai/dsh@next`.
- Never present a declared CI target as verified until external test evidence exists.

## 0.5.0 - 2026-08-18

- Add explicit install planning, approval gates, DSH bundle checks and lifecycle-script blocking.
- Verify installed layers with `--dump-config` and automatically remove the package when verification fails.
- Record configuration hashes instead of persisting dump-config contents.
- Add `plan` and `apply --approve` CLI flows plus a non-writing Harness install-plan tool.

## 0.4.0 - 2026-08-18

- Add candidate metadata inspection and advisory scoring.
- Score project fit, maintenance recency, package health, supply-chain signals and DSH bundle declarations.
- Flag lifecycle install scripts, missing repositories/licenses, large dependency trees and unavailable metadata.
- Add `score` CLI command and `smart_profile_score` Harness tool.

## 0.3.0 - 2026-08-18

- Add public npm registry plugin candidate discovery.
- Map candidates to recommended capability categories and matching terms.
- Filter for Harness-oriented package markers and keep discovery non-executing.
- Add `discover` CLI command and `smart_profile_discover` Harness tool.
- Tolerate partial registry failures without losing successful capability results.

## 0.2.0 - 2026-08-18

- Add confidence scores, evidence sources, deterministic ordering and TypeScript/JavaScript conflict collapse.
- Add PHP/Laravel/Symfony, Ruby/Rails/Sinatra, .NET/ASP.NET Core and Dart/Flutter detection.
- Add Terraform, Kubernetes, Helm and AWS/Azure/Google Cloud signals.
- Add package-manager lockfile detection and deeper workspace scanning.
- Expand regression fixtures for polyglot and infrastructure-heavy projects.

## 0.1.0 - 2026-08-18

- First public-ready npm + DeepSeek Harness bundle.
- Project stack scan and explainable capability recommendations.
