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
git clone --filter=blob:none git@github.com:owncloud/ocis.git /tmp/ocis-mirror
cd /tmp/ocis-mirror && git filter-repo --subdirectory-filter web
```

Fetch it into this repository and graft the filtered root onto the upstream release this fork
was based on:

```bash
git remote add ocis-web /tmp/ocis-mirror
git fetch ocis-web 'refs/heads/master:refs/remotes/ocis-web/master'
git replace --graft <filtered-root-sha> b16a34fdf5
git push origin 'refs/replace/*'    # so colleagues get the graft too
```

After the graft, `git rebase --onto ocis-web/master b16a34fdf5 dev_future` behaves like any
other rebase. The first one surfaces the import's file removals (`LICENSE`, `CHANGELOG.md`,
`changelog/`, `.github/`, `CONTRIBUTING.md`, and others) as upstream changes; resolve once.

## Each sync

```bash
rm -rf /tmp/ocis-mirror
git clone --filter=blob:none git@github.com:owncloud/ocis.git /tmp/ocis-mirror
cd /tmp/ocis-mirror && git filter-repo --subdirectory-filter web
cd - && git fetch ocis-web 'refs/heads/master:refs/remotes/ocis-web/master'
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

The approach rests on filter-repo being reproducible. Confirm it once: derive the mirror
twice from scratch and check the tip SHAs match. If they ever diverge, the graft breaks and
every rebase looks like an unrelated history.
