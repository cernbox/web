---
name: cern-rebase
description: Rebase a CERNBox web branch onto a newer upstream base. Use when moving dev_future (or a feature branch) to a new ownCloud/ocis web release, or when a rebase has stalled on conflicts.
---

# Rebasing CERNBox web onto a new upstream

## The invariant

The tree at the end must be functionally identical to the tree at the start, except where
upstream changed something. Before starting, tag the current tip:

```bash
git tag pre-rebase-$(date +%Y%m%d)
```

After the rebase, `git diff pre-rebase-<date> <new-tip>` should contain only changes you can
name and justify. Anything you cannot explain is a conflict resolved wrongly.

## Conflict hot-spots

These files carry CERN changes on lines upstream also edits, and account for most conflicts:

| file | why it conflicts |
|---|---|
| `web-app-files/src/views/spaces/GenericSpace.vue` | breadcrumbs, auto-open watcher, single-resource detection |
| `web-app-files/src/index.ts` | nav items and their `activeFor` functions |
| `.../Collaborators/InviteCollaborator/InviteCollaboratorForm.vue` | recipient types, email paste, share flow |
| `web-pkg/src/components/FilesList/ResourceTable.vue` | embed mode, avatar tooltips, delete queue |
| `web-pkg/src/composables/piniaStores/config/{config,types}.ts` | the CERN options block |
| `web-pkg/src/composables/piniaStores/spaces.ts` | on-demand loading and the catch-all space |
| `web-runtime/src/services/auth/{authService,userManager}.ts` | token exchange, popup login, low assurance |
| `web-app-external/src/App.vue` | postMessage registry, alerts, lock handling |

## Path moves

Upstream relocates files between releases. When a rebase reports "deleted by them" for a file
you still change, it usually moved. Known moves so far:

- `web-app-files/src/services/folder/loader*.ts` → `web-pkg/src/services/folder/loaders/`
- `web-runtime/src/container/versions.ts` → `web-pkg/src/helpers/versions.ts`
- `web-app-files/src/components/AppBar/CreateSpace.vue` → `web-pkg/src/components/AppBar/`

Find the new home before resolving:

```bash
git log --diff-filter=R --name-status <old>..<new> -- '*<basename>*'
```

## Procedure

1. Work on a copy: `git switch -c rebase-attempt <branch>`.
2. `git rebase --onto <new-base> <old-base> rebase-attempt`.
3. Resolve conflicts one commit at a time. Prefer keeping upstream's structure and
   re-applying the CERN change on top of it, rather than keeping the CERN version wholesale —
   the latter silently reverts upstream fixes.
4. After each conflicted commit: `pnpm exec vue-tsc --noEmit` on the affected package.
5. When the rebase completes, run the gate: `pnpm check:types && pnpm lint && pnpm test:unit --run`.
6. Verify the CERN build still applies its override:
   `pnpm vite build -c vite.cern.config.ts` and check the bundle contains the CERN
   `CreateSpace` ("Request new project") and not the stock one ("new-space-menu-btn-enabled").
7. Diff against the pre-rebase tag and account for every remaining difference.

## Gotchas

- `git checkout <tree> -- <path>` **stages** what it writes. If you then edit the file, you
  must `git add` again or the unedited version is what gets committed.
- Editing a file after `git checkout <tree> --` and before committing is the single most
  common way to commit the wrong content. Check `git diff --cached` before every commit.
- A `git rebase -i --autosquash` only reorders fixups whose target is inside the rebase
  range. Always rebase from the branch base, not from a recent commit.
