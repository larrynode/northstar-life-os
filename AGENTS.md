# Northstar Life OS agent rules

## Data boundary

- Use the project `northstar` CLI for every read or write. Do not open SQLite, attachments, backups, environment secrets, or private-library paths directly.
- Start read workflows with `pnpm northstar doctor --json`; use only `context`, `list`, and `review` projections for analysis.
- Put generated or inferred changes in `pnpm northstar draft create <type> --title ... --data ... --json`. Show the pending draft and wait for explicit human approval before `draft approve`, `draft apply`, `draft reject`, or `draft discard`.
- Call `capture` or `log` directly only for a clearly requested, low-risk factual record. Treat `import apply` and `backup restore --confirm` as destructive and never run them autonomously.
- Preserve source IDs, dates, and the CLI's versioned JSON envelope. Report uncertainty instead of guessing.
- Treat the private library as inaccessible. Never infer private content from filenames, errors, timing, or filesystem metadata.

## Repository and security

- Run commands from the repository root and keep `NORTHSTAR_DATA_DIR` disposable for tests.
- Never commit databases, attachments, exports, backups, logs, credentials, cookies, tokens, or private notes.
- Keep the dashboard loopback-only at `127.0.0.1:18766`; do not install, expose, restart, or publish services without explicit authorization.
- Preserve existing schema, data paths, CLI JSON contract, and draft approval gates unless the task explicitly changes them.

## Verification

- After TypeScript or CLI changes, run `pnpm typecheck`, `pnpm lint`, and `pnpm test`; run `pnpm test:e2e` when dashboard/browser assets change.
- After editing a Codex skill, run the Skill Creator validator from the local Codex installation against `<skill-dir>`.
- Review the final diff and keep unrelated user changes intact. Do not use destructive git commands or mutate personal data to make a test pass.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
