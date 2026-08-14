---
name: northstar-project-health
description: Assess active Northstar project health from safe CLI context, lists, and reviews, then prepare a reviewable risk-and-action draft. Use when a project is drifting, blocked, overloaded, or due for a health check; never access the SQLite file or private vault.
---

# Northstar project health

Use only `northstar` CLI projections. Treat health findings as recommendations until the user approves a draft.

## Workflow

1. Run `pnpm northstar doctor --json`; stop on failure.
2. Read:
   - `pnpm northstar context week --json`
   - `pnpm northstar list project --status active --json`
   - `pnpm northstar list task --status active --json`
   - `pnpm northstar list event --json`
   - `pnpm northstar review weekly --json` when available.
3. For each requested or at-risk project, evaluate evidence: outcome clarity, recent movement, overdue work, dependency/waiting states, workload, and next milestone. Use `healthy`, `watch`, `blocked`, or `needs_decision`; cite record IDs and dates.
4. Recommend the smallest next action, owner, and decision needed. Never infer private context or promise a deadline not present in the CLI output.
5. Create one pending draft:

   ```sh
   pnpm northstar draft create project_health \
     --title "Project health YYYY-MM-DD" \
     --data '{"as_of":"YYYY-MM-DD","projects":[{"project_id":"...","health":"watch","evidence":[],"risks":[],"next_action":"...","decision":"...","source_ids":[]}]}' \
     --json
   ```

6. Report the draft ID, project statuses, evidence, and unresolved decisions. Do not approve, apply, reject, or discard the draft automatically.

## Guardrails

- Never open or query SQLite; never access attachments, credentials, or the private library. Consume only CLI JSON.
- Do not change project status, links, milestones, or tasks during assessment. Use `pnpm northstar draft create` for proposed changes.
- Use `pnpm northstar capture` or `pnpm northstar log` only when the user explicitly requests a low-risk factual record.
