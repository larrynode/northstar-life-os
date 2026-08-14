---
name: northstar-daily-review
description: Summarize a day's Northstar activity and prepare a structured reflection draft from safe CLI projections. Use at the end of a day to capture outcomes, blockers, energy, lessons, and a small set of next steps without reading private storage.
---

# Northstar daily review

Use only `northstar` commands. Keep reflection and proposed follow-up changes reviewable.

## Workflow

1. Run `pnpm northstar doctor --json` and stop on failure.
2. Read the day's safe projections:
   - `pnpm northstar context today --json`
   - `pnpm northstar list task --json`
   - `pnpm northstar list event --json`
   - `pnpm northstar list habit --json`
   - `pnpm northstar review daily --json` to avoid repeating an existing review.
3. Compare planned versus completed work using record IDs and timestamps. Separate facts from interpretation; mark missing data as unknown. Ask concise questions for feelings or context that the CLI cannot provide.
4. Prepare a payload with `date`, `wins`, `unfinished`, `blockers`, `energy`, `lesson`, `next_actions`, and `source_ids`, then create one pending draft:

   ```sh
   pnpm northstar draft create daily_review \
     --title "Daily review YYYY-MM-DD" \
     --data '{"date":"YYYY-MM-DD","wins":[],"unfinished":[],"blockers":[],"energy":null,"lesson":"...","next_actions":[],"source_ids":[]}' \
     --json
   ```

5. Show the draft ID and distinguish observed facts from suggested text. Do not approve, apply, reject, or discard it unless the user explicitly chooses that action.

## Guardrails

- Never access SQLite, attachments, credentials, or the private library; do not inspect files to fill gaps.
- Do not rewrite a prior review or mark tasks complete. Generated updates belong in `pnpm northstar draft create`.
- Use `pnpm northstar capture` or `pnpm northstar log` only when the user clearly asks to record a low-risk fact (for example, a workout or metric).
