# Maintainer guide

The public GitHub repository is the source of truth for releasable Northstar
code. Personal databases, runtime services, backups, and local Codex session
history are never part of the repository.

## Repository policy

- `main` is the stable branch and should remain releasable.
- Use focused branches and pull requests for normal changes.
- Require CI, end-to-end tests, secret scanning, and CodeQL before merging.
- Prefer signed maintainer commits and signed release tags.
- Use squash or rebase merges to keep public history reviewable.
- Keep issues enabled; keep the wiki and repository projects disabled so
  durable documentation remains versioned with the code.

## Release policy

Northstar follows Semantic Versioning and records user-visible changes in
`CHANGELOG.md`. The package is marked `private` to prevent accidental npm
publication; releases are source releases on GitHub unless a separate package
distribution plan is approved.

Before a release:

```sh
pnpm install --frozen-lockfile
pnpm check:public
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Then verify that `main` is clean and CI is green, update the changelog and
version, create a signed `vX.Y.Z` tag, and publish a GitHub Release with concise
upgrade and privacy notes. Never create a release from a personal database or
from a working tree containing unreviewed files.

## Compatibility review

Changes to the following boundaries require an explicit migration or design
note and focused tests:

- SQLite schema or data paths;
- CLI JSON envelopes and command semantics;
- draft approval and destructive-operation gates;
- import, export, backup, and restore formats;
- vault encryption or exclusion guarantees; and
- loopback host/origin enforcement.

## Security response

Handle vulnerability reports privately. Reproduce with synthetic data, prepare
the fix on a private branch when necessary, add a regression test, and disclose
only after a patched release is available. Never ask a reporter to share their
real Northstar database.
