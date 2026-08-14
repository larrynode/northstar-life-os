# Northstar Life OS

[![CI](https://github.com/larrynode/northstar-life-os/actions/workflows/ci.yml/badge.svg)](https://github.com/larrynode/northstar-life-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg)](https://nodejs.org/)

[简体中文](README.zh-CN.md) · [Architecture](docs/ARCHITECTURE.md) · [Privacy](docs/PRIVACY.md) · [Contributing](CONTRIBUTING.md) · [Maintainers](docs/MAINTAINERS.md)

Northstar is a local-first life operating system for projects, tasks, habits,
events, inbox captures, reviews, and safe, reviewable automation. It combines a
loopback-only dashboard with a versioned CLI and an encrypted private vault.

Northstar does not require an account, telemetry, cloud sync, or an external AI
API. The dashboard binds to `127.0.0.1:18766`; the CLI is the supported
automation and data boundary.

> **Project status:** `v0.1.0` is an early public release. The core daily loop is
> usable, while strategy, learning, finance, health, relationships, and graph
> views remain extension points. Real mode shows honest empty states instead of
> fabricated personal data.

## Quick start

```sh
git clone https://github.com/larrynode/northstar-life-os.git
cd northstar-life-os
corepack enable
pnpm install --frozen-lockfile
pnpm build:cli
pnpm dev
```

Open <http://127.0.0.1:18766>. Keep the service on loopback; Northstar is not a
multi-user or internet-facing application.

## Requirements and setup

- Node.js 24 (the repository pins this in `.nvmrc` and `.node-version`).
- pnpm 10 or newer; the lockfile/package metadata uses pnpm 11.
- A local build of the CLI before invoking the `northstar` binary:

  ```sh
  pnpm install
  pnpm build:cli
  pnpm northstar doctor --json
  ```

`pnpm northstar …` is the repository-local entry point. The package also exposes the conventional `northstar` binary when installed or linked as a Node package; no global link is created automatically.

Run the dashboard with `pnpm dev`, then open <http://127.0.0.1:18766>. Do not expose this development server beyond loopback.

The dashboard starts in real-data mode. A new or empty database shows onboarding and honest empty states rather than sample personal data. Settings includes an explicit interactive demo mode; demo changes stay in the current browser session, reset on refresh, and never access real imports, exports, or private-vault content.

## Data and privacy boundary

By default Northstar stores data under `~/Library/Application Support/NorthstarLifeOS/`:

```text
db/northstar.sqlite       structured records and drafts
attachments/              user attachments (if enabled)
backups/                  verified backup archives
```

Set `NORTHSTAR_DATA_DIR` to an absolute or `~`-relative directory for tests or a portable vault (the example file uses `./northstar-data`). Directories are created with owner-only permissions when the CLI opens them. Never commit this directory, database files, attachments, logs, exports, or backup archives.

The public Northstar library excludes a separate private library by design. Skills and automation must use only the `northstar` CLI projections (`doctor`, `context`, `list`, and `review`) and must never open SQLite or discover private paths. Generated changes go through `pnpm northstar draft create <type> --data JSON`; a person explicitly reviews with `draft show`, then chooses `draft apply` or `draft discard`.

## Features

- Persistent projects, tasks, habits/check-ins, events, inbox captures, and
  journal/review records.
- Honest extension views for strategy, ventures, learning, finance, health,
  relationships, and the knowledge graph; these do not invent personal data.
- Daily, weekly, and monthly review projections.
- Draft-first planning, triage, review, and project-health workflows.
- Persistent dashboard workflows for projects, tasks, habits/check-ins, upcoming events, inbox captures, and reviews; project progress is derived from completed tasks.
- JSON CLI envelopes for scripts, with CSV/JSON/ICS export and JSON/CSV/ICS import preview/apply.
- Browser JSON import with explicit preview, duplicate detection, and transactional apply.
- Verified, manifest-backed backups and an explicit confirmation gate for restore.
- A loopback-only dashboard for inspecting the same public projection.

## CLI quick reference

Commands return a versioned JSON envelope when `--json` is present:

```json
{"schema_version":"1","ok":true,"command":"...","data":{}}
```

Failures return `ok: false` with an `error` object. Start with a health check and read data through the CLI:

```sh
pnpm northstar doctor --json
pnpm northstar context today --json
pnpm northstar context week --json
pnpm northstar list task --status active --json
pnpm northstar review daily --json
pnpm northstar review weekly --json
```

Use low-risk writes only when the user clearly asks to record a fact:

```sh
pnpm northstar capture "Call with Sam" --type note --json
pnpm northstar log mood "3" --json
```

Use drafts for generated plans, triage, reviews, reprioritization, links, and updates. Keep the payload JSON explicit and preserve source IDs:

```sh
pnpm northstar draft create daily_plan \
  --title "Daily plan 2026-08-10" \
  --data '{"date":"2026-08-10","priorities":[],"source_ids":[]}' \
  --json
pnpm northstar draft list --json
pnpm northstar draft show <draft-id> --json
pnpm northstar draft approve <draft-id> --json
pnpm northstar draft apply <draft-id> --json
pnpm northstar draft reject <draft-id> --json
pnpm northstar draft discard <draft-id> --json
```

Only after the user approves the exact pending draft may an operator run `pnpm northstar draft approve <draft-id> --json` and then `pnpm northstar draft apply <draft-id> --json`; use `pnpm northstar draft reject` or `pnpm northstar draft discard` to reject it. Skills and scheduled jobs never approve, apply, reject, or discard drafts themselves.

Preview imports before applying them and export only to an explicitly chosen path:

```sh
pnpm northstar import preview ./inbox.json --json
pnpm northstar import apply ./inbox.json --json
pnpm northstar export json --output ./export.json --json
pnpm northstar export csv --output ./export.csv --json
pnpm northstar export ics --output ./calendar.ics --json
```

Create and verify backups before considering restore. Restore is destructive and requires an explicit confirmation:

```sh
pnpm northstar backup create --output ./northstar-backup --json
pnpm northstar backup verify --path ./northstar-backup --json
pnpm northstar backup restore --path ./northstar-backup --confirm --json
```

A complete backup is a directory containing the SQLite database, attachments, and a SHA-256 manifest. It therefore retains private-vault ciphertext but never plaintext. Ordinary JSON/CSV/ICS exports exclude the vault entirely.

Treat imported files, exports, and backup paths as sensitive. Keep them outside version control and inspect a preview before any apply or restore.

## Optional scheduled templates

`automation-templates/northstar.cron.example` describes disabled cron entries for 08:00 daily planning, 21:30 daily review, and 20:00 Sunday weekly review in `Asia/Shanghai`. Replace its absolute repository path and wire an approved agent runner before installing it; copying the file does not enable anything. The runner may read safe CLI projections and create pending drafts only. It must not call `draft apply`, `draft discard`, `import apply`, or `backup restore`; human approval remains a separate step.

## Tests and checks

Run checks from the repository root:

```sh
pnpm typecheck
pnpm lint
pnpm test                 # unit and CLI/data-boundary tests
pnpm test:e2e             # dashboard/browser flows
```

Playwright uses an isolated data directory under `/private/tmp` and a dedicated loopback test port (`18767` by default, configurable with `NORTHSTAR_E2E_PORT`) so it does not reuse or interrupt the normal dashboard on port `18766`.

The test suite covers the CLI JSON contract and error paths, schema/data access, draft lifecycle, import/export validation, backup verification/restore gates, privacy boundaries, and critical dashboard flows. Keep `NORTHSTAR_DATA_DIR` pointed at a disposable test directory; never run tests against a personal vault.

## Threat model and recovery limits

Northstar assumes the local OS account and its filesystem permissions are the primary trust boundary. It mitigates accidental exposure with loopback binding, owner-only data directories, a CLI allowlist, draft confirmation, import previews, backup manifests/checksums, and a hard private-library boundary. It does not protect data from a compromised OS account, root access, malware, screen capture, or an untrusted backup/sync provider; encrypt sensitive backups and use normal OS controls.

The private password/passphrase is intentionally not stored in recoverable form. If it is forgotten, Northstar cannot retrieve or reset it; recovery requires the user's own password manager, escrow, or an existing unlocked backup. Do not put passwords, tokens, cookies, or private notes in issues, logs, exports, or scheduled-job arguments.

## Community and license

Northstar is released under the [MIT License](LICENSE). Contributions are
welcome through focused pull requests. Please read [CONTRIBUTING.md](CONTRIBUTING.md),
[SECURITY.md](SECURITY.md), and the [Code of Conduct](CODE_OF_CONDUCT.md) first.

Public issues and pull requests must use synthetic data. Never upload a real
database, backup, export, attachment, private-vault material, or screenshot
containing personal information.
