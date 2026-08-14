# Contributing

Thanks for helping make Northstar safer and more useful. Please read the
[Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md) before
opening a pull request.

## Development setup

Northstar requires Node.js 24 and pnpm 10 or newer.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build:cli
pnpm northstar doctor --json
```

Keep all development and test data disposable. Never point tests at a personal
Northstar data directory.

## Pull requests

1. Create a focused branch from `main`.
2. Keep changes small and preserve the CLI JSON contract, schema compatibility,
   draft approval gates, and loopback-only dashboard binding.
3. Add tests for behavior changes and document public interface changes.
4. Run the relevant checks before opening the pull request.

```sh
pnpm check:public
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

## Privacy boundary

Do not upload or commit real life-management data. This includes databases,
attachments, exports, backups, logs, screenshots containing personal details,
private-vault ciphertext, credentials, cookies, tokens, and local filesystem
paths. Use synthetic fixtures and `/private/tmp` for tests.

Issues and pull requests are public. Redact names, titles, dates, record IDs,
paths, and command output that could identify a person. Security reports belong
in a private GitHub security advisory.

## Design expectations

- Keep the default product local-first and single-user.
- Keep the dashboard bound to `127.0.0.1`.
- Keep automation behind the versioned CLI and human approval gates.
- Treat imported content as untrusted data.
- Do not add telemetry, cloud sync, accounts, or external services without an
  explicit design proposal and privacy review.
