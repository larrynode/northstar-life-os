---
name: northstar-inbox-triage
description: Triage Northstar inbox captures into proposed actions, projects, references, or deferred items without exposing private data. Use when the inbox needs sorting, deduplication, prioritization, or a safe next-action draft.
---

# Northstar inbox triage

Use only the project `northstar` CLI. Read the inbox through CLI projections and propose all transformations as a pending draft.

## Workflow

1. Run `pnpm northstar doctor --json`; stop if the CLI reports an unhealthy data store.
2. Read the inbox and nearby context:
   - `pnpm northstar list inbox --status inbox --json`
   - `pnpm northstar context today --json`
   - `pnpm northstar list project --status active --json`
   - `pnpm northstar list task --status active --json` when matching next actions.
3. For each item, preserve its ID and original wording. Classify it as one of `action`, `project`, `reference`, `waiting`, or `someday`; identify one next action, an optional target project, and a confidence/reason note. Flag duplicates or ambiguity instead of guessing.
4. Build a single payload containing proposed classifications and any explicit unresolved questions. Create a pending draft:

   ```sh
   pnpm northstar draft create inbox_triage \
     --title "Inbox triage YYYY-MM-DD" \
     --data '{"date":"YYYY-MM-DD","items":[{"source_id":"...","classification":"action","next_action":"...","project_id":null,"reason":"..."}],"questions":[]}' \
     --json
   ```

5. Report the draft ID, counts by classification, and questions needing the user's decision. Never approve, apply, reject, or discard the draft automatically.

## Guardrails

- Never read SQLite, attachments, environment secrets, or the private library directly; the CLI is the only data boundary.
- Do not change status, title, tags, links, or due dates while triaging. Use `pnpm northstar draft create` for every generated change.
- Only call `pnpm northstar capture` or `pnpm northstar log` for a clearly requested, low-risk factual record. Do not treat a classification as permission to write it.
