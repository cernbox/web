---
name: split-history
description: Re-derive a branch's history into clean, feature-coherent commits from a frozen target tree. Use when a branch's commits are tangled, when separating upstreamable changes from fork-specific ones, or when preparing a series to offer upstream.
---

# Re-deriving a history from a target tree

Reordering existing commits with `rebase -i` thrashes when they touch the same files.
Re-derive instead: freeze the tree you want, then rebuild the commits that produce it.

## Setup

```bash
git tag target-tree <branch-tip>          # the tree you must end up with
git switch -c rebuilt <upstream-base>     # start from the base
```

The invariant: at the end, `git diff rebuilt target-tree` is empty. If it is not, a hunk
was lost. Deliberate deviations (lint fixes, dropped dead code) are fine — record each one
as you make it, so the final diff can be explained line by line rather than re-derived.

## Per commit

```bash
git checkout target-tree -- <paths for this feature>
# if a file spans several features, edit it down to just this one's part
pnpm exec vue-tsc --noEmit          # catch what you pulled in too early
git add -A && git commit
```

Order matters: put a feature's dependencies before it. Types and client code first, then
composables, then components, then views.

## Splitting a file across commits

Most files belong to one feature. For the rest, two approaches:

- **Take the target version, remove what belongs later.** Best when the file is mostly this
  feature.
- **Start from upstream, apply only this feature's hunks.** Best when the file is mostly
  other features — as with a form that hosts three unrelated changes.

Either way, verify with `git diff <upstream-base> -- <file>` that what remains is only this
feature.

## Traps

- `git checkout <tree> -- <path>` **stages**. A subsequent editor change is *not* staged.
  Re-`git add` and check `git diff --cached` before committing.
- Because checkout stages, a later `git add <one-file>` followed by `git commit` will commit
  **everything already staged**, not just that file. Run `git reset` first when you intend a
  selective commit.
- Deferring a feature usually means deferring its tests too. A spec that references a symbol
  you have not added yet fails at collection, not with a clear error.
- Specs that index nav items or actions positionally break when you defer one. Prefer
  looking items up by name, which is more robust anyway.

## Finishing

```bash
git diff rebuilt target-tree            # must be empty, modulo recorded deviations
pnpm check:types && pnpm lint && pnpm test:unit --run
```

A green tip does not mean the series is good. Each commit has to stand on its own, or the
history is not reviewable and not bisectable. Validate every commit, not just the last:

```bash
# whitespace: trailing spaces, blank line at EOF
for sha in $(git rev-list --reverse <base>..HEAD); do git show --check $sha; done

# type-check each commit, in a throwaway worktree so the branch is untouched
git worktree add --detach /tmp/percommit <base>
for sha in $(git rev-list --reverse <base>..HEAD); do
  git -C /tmp/percommit checkout -q --detach $sha
  (cd /tmp/percommit && pnpm exec vue-tsc --noEmit) || echo "FAILS: $sha"
done
```

Prefer a worktree loop over `git rebase --exec`: rebase rewrites every commit id, so a failure
part-way leaves the branch in a state you then have to reconcile.

Two things this catches that a tip-only check cannot:

- **A commit that references something a later commit adds.** Splitting a feature out of a
  file usually means splitting its tests and its barrel exports too.
- **A dependency added in one commit and locked in another.** If a commit adds a package to
  `package.json`, the lockfile entry belongs in that same commit, or every commit in between
  has a manifest the lockfile does not satisfy.

If part of the series is meant to be offered upstream, also check out that block's tip on its
own and verify it type-checks and passes tests without the later commits — that is the tree
the upstream PR would contain.
