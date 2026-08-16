---
name: upstream-sync
description: Refresh the local ocis web mirror and rebase CERNBox web onto it. Use when picking up upstream changes from the ocis monorepo.
---

# Following ocis web as upstream

## Why this is not a normal remote

Upstream development moved into the [ocis monorepo](https://github.com/owncloud/ocis) under
`web/`, imported as a single squashed commit. The two object graphs share nothing: commits
from the old `owncloud/web` history do not exist there, so no `git cherry-pick` or `git merge`
across them is possible. ocis also relicensed `web/` to Apache-2.0 while CERNBox web is
AGPL-3.0 — **raise that with CERN legal/OSPO before adopting their tree**. It is not a
technical decision.

## One-time setup

Derive a `web`-only mirror. `git filter-repo` is deterministic: the same input commits and
options always produce the same output SHAs, which is what makes later syncs fast-forwards
rather than fresh unrelated histories.

```bash
dev/scripts/sync-upstream.sh
```

The script does the derivation and the fetch. Two things it encodes, both learned the hard
way:

- **A full clone is required.** `git filter-repo` fails on a partial clone
  (`--filter=blob:none`) with a `BrokenPipeError` partway through, and leaves `HEAD` at the
  *unfiltered* tip - which looks exactly like success. The ocis clone takes about a minute.
- **The filtered root is not the web import.** `web/` existed in ocis years earlier holding
  unrelated konnectd content, so the filtered history has roots in 2019. The commit to graft
  is the squashed *"merge and relicense ownCloud Web into oCIS"* import; the script finds and
  prints it.

Fetch it into this repository and graft the filtered root onto the upstream release this fork
was based on:

```bash
git replace --graft <import-sha> b16a34fdf5   # the script prints the import sha
git push origin 'refs/replace/*'              # so colleagues get the graft too
```

After the graft, `git rebase --onto ocis-web/master b16a34fdf5 dev_future` behaves like any
other rebase. The first one surfaces the import's file removals (`LICENSE`, `CHANGELOG.md`,
`changelog/`, `.github/`, `CONTRIBUTING.md`, and others) as upstream changes; resolve once.

## Each sync

```bash
dev/scripts/sync-upstream.sh
```

Then rebase with the `cern-rebase` skill, which covers the conflict hot-spots and the
post-rebase verification.

## Reading what changed

Commit boundaries upstream are not clean: many web-touching commits also carry a changelog
file at the ocis root, and dependency bumps mix Go `vendor/` with `web/pnpm-lock.yaml`.
Review by file, not by commit:

```bash
git log --oneline <last-synced>..ocis-web/master
git diff --stat <last-synced>..ocis-web/master
```

Record the last synced upstream SHA somewhere tracked, so the next sync knows where it
started.

## Verifying determinism

The approach rests on filter-repo being reproducible. This has been verified - two
derivations from scratch produced the same tip - and `dev/scripts/sync-upstream.sh --verify`
re-checks it. If it ever diverges, the graft breaks and every rebase looks like an unrelated
history, so re-run the check after upgrading git-filter-repo.
