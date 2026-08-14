# Architecture

Northstar is a local-first, single-user application. The browser dashboard and
the CLI share one SQLite-backed service layer, but they serve different trust
boundaries.

```text
Local browser ──> Next.js route handlers ──> services ──> SQLite
                                              │
Codex/scripts ──> versioned Northstar CLI ────┘

Private-vault plaintext ──> browser WebCrypto ──> ciphertext-only vault table
```

## Components

- `src/app/` contains the loopback dashboard and local route handlers.
- `src/components/life-os-shell.tsx` owns the real/demo presentation boundary.
- `src/lib/services/` contains domain projections such as dashboard overview,
  habits, reviews, and goals.
- `src/lib/db/` owns migrations and records. Schema changes are versioned and
  must retain compatibility or provide an explicit migration.
- `src/cli/` exposes the stable JSON automation interface.
- `.codex/skills/` contains reusable workflows that consume safe CLI
  projections and create pending drafts.

## Write paths

Direct dashboard actions may persist only the record the user explicitly
creates or changes. Automated or inferred changes are draft-first:

```text
safe projection -> proposed draft -> human approval -> apply
```

Imports are previewed and validated before transactional application. Backup
restore requires an explicit confirmation flag.

## Compatibility promises

- Dashboard binding remains loopback-only.
- CLI JSON responses carry `schema_version`.
- Private-vault content never enters ordinary search, exports, or CLI context.
- Test data uses a disposable `NORTHSTAR_DATA_DIR`.

See [SECURITY.md](../SECURITY.md) and [PRIVACY.md](PRIVACY.md) before changing a
data or automation boundary.
