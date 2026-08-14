---
name: northstar-daily-plan
description: Prepare a focused daily plan from Northstar's safe local context, active tasks, events, habits, and recent reviews. Use when starting a day, choosing priorities, or turning yesterday's notes into a reviewable plan; never access the SQLite file or private vault directly.
---

# Northstar daily plan

Run this skill from the Northstar repository and use only the `northstar` CLI. Keep all generated changes in a pending draft.

## Workflow

1. Check availability with `pnpm northstar doctor --json`. Stop on a failed check and report the CLI error.
2. Read only safe projections:
   - `pnpm northstar context today --json`
   - `pnpm northstar list task --status active --json`
   - `pnpm northstar list event --json`
   - `pnpm northstar list habit --status active --json`
   - `pnpm northstar review daily --json` when a prior-day review is relevant.
3. Respect dates, due times, dependencies, and explicit user constraints. Keep the plan small: identify the day's outcome, three or fewer priorities, bounded focus blocks, and a short fallback list.
4. Preserve source record IDs in the proposed items. Do not invent commitments or silently mutate existing records.
5. Create one pending draft, for example:

   ```sh
   pnpm northstar draft create daily_plan \
     --title "Daily plan YYYY-MM-DD" \
     --data '{"date":"YYYY-MM-DD","outcome":"...","priorities":[],"blocks":[],"fallback":[],"source_ids":[]}' \
     --json
   ```

6. Show the resulting draft ID and a concise summary. Leave it pending; never run `pnpm northstar draft approve`, `pnpm northstar draft apply`, `pnpm northstar draft reject`, or `pnpm northstar draft discard` without explicit user approval.

## Guardrails

- Never open, query, copy, or infer paths to SQLite, attachments, credentials, or the private library.
- Treat CLI JSON as the complete input boundary. Do not use ad-hoc filesystem reads, SQL, browser automation, or undocumented endpoints.
- Ask before recording a new task, event, or habit. If the user clearly requests a low-risk factual record, use `pnpm northstar capture` or `pnpm northstar log` instead of bypassing the CLI; otherwise draft it.
