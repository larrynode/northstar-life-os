# Privacy model

Northstar is designed to work without accounts, telemetry, cloud sync, or an
external API. The application listens on `127.0.0.1:18766` and stores ordinary
records on the local machine.

## Local data

The default data directory contains a SQLite database, attachments, and
verified backups. These are user data, not project assets. They must never be
committed, attached to issues, or included in bug reproductions.

`NORTHSTAR_DATA_DIR` can point to a disposable directory for testing. Public
fixtures must be synthetic and must not be derived from a personal database.

## Private vault

Private-vault plaintext is encrypted in the browser with a key derived from the
user's passphrase. The server stores ciphertext only. The vault is excluded
from ordinary search, CLI projections, JSON/CSV/ICS exports, and knowledge
graph features.

Full backups retain vault ciphertext. Encryption does not make a backup
non-sensitive: metadata, access patterns, and future cryptographic risks still
matter. Store backups in a trusted encrypted location.

## Automation

Codex and other automation should use only `doctor`, `context`, `list`, and
`review` CLI projections. Generated plans, triage, and inferred changes become
pending drafts. A human must review and approve the exact draft before it is
applied.

## Public contributions

Before sharing a report or screenshot, remove:

- names, task and project titles, journal text, dates, and record IDs;
- databases, exports, backups, attachments, and vault ciphertext;
- credentials, cookies, tokens, local paths, and host details; and
- logs or screenshots that reveal personal routines or relationships.

Use GitHub private vulnerability reporting for sensitive security findings.
