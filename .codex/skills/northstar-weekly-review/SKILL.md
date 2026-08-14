---
name: northstar-weekly-review
description: Review a Northstar week and prepare a decision-ready weekly reflection and next-week draft from safe CLI context, lists, and reviews. Use on a weekly cadence to surface progress, drift, capacity, and priorities without accessing private storage.
---

# Northstar weekly review

Use only the `northstar` CLI and leave all generated changes pending.

## Workflow

1. Run `pnpm northstar doctor --json`; stop and report the error if it fails.
2. Read bounded projections:
   - `pnpm northstar context week --json`
   - `pnpm northstar list project --status active --json`
   - `pnpm northstar list task --json`
   - `pnpm northstar list event --json`
   - `pnpm northstar list habit --status active --json`
   - `pnpm northstar review daily --json` and `pnpm northstar review weekly --json` when available.
3. Summarize facts for the week: shipped outcomes, meaningful progress, stalled items, commitments at risk, recurring patterns, and capacity constraints. Keep source IDs and dates; distinguish evidence from inference.
4. Propose no more than three next-week outcomes and the smallest supporting actions. Record trade-offs and questions rather than silently reprioritizing existing records.
5. Create one pending draft:

   ```sh
   pnpm northstar draft create weekly_review \
     --title "Weekly review YYYY-MM-DD" \
     --data '{"week":"YYYY-MM-DD/YYYY-MM-DD","wins":[],"drift":[],"patterns":[],"next_week":[],"tradeoffs":[],"questions":[],"source_ids":[]}' \
     --json
   ```

6. Return the draft ID and an executive summary. Never call `pnpm northstar draft approve`, `pnpm northstar draft apply`, `pnpm northstar draft reject`, or `pnpm northstar draft discard` without explicit approval.

## Guardrails

- Never read SQLite, attachments, credentials, or the private library directly. Do not use undocumented APIs or filesystem discovery.
- Do not create, complete, archive, link, or reschedule records during review. Put proposed changes in the draft payload.
- Use `pnpm northstar capture` or `pnpm northstar log` only for a clearly requested low-risk factual entry.
