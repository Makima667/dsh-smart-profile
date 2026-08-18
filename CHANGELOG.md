# Changelog

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
