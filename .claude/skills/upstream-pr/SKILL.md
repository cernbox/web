---
name: upstream-pr
description: Prepare a CERNBox web commit as a pull request against ownCloud ocis web. Use when offering a generic fix or feature upstream.
---

# Offering a commit upstream

Upstream for web is now the `web/` directory of the
[ocis monorepo](https://github.com/owncloud/ocis). The archived `owncloud/web` repository no
longer takes changes.

## Before anything else

Confirm the change is actually generic. It is not upstreamable if it:

- reads `cernFeatures`, `runningOnEos`, `useRevaToken`, `listVersions` or `alertRwFolders`
- depends on `routing.idBased` being false or `routing.fullShareOwnerPaths` being true
  (`cernFeatures` forces both), unless it handles **either** setting correctly
- assumes reva or EOS behaviour: the catch-all space, the signing key endpoint, per-user
  capabilities, trashbin range headers

A change that only fires under a CERN option belongs in Block B and stays here.

## Changelog

Every upstream-bound change needs `changelog/unreleased/<type>-<slug>.md`, where type is one
of `bugfix`, `change`, `enhancement`, `security`:

```
Bugfix: One line in present tense, under 80 characters

A paragraph in past tense saying what was wrong and what now happens instead.

https://github.com/owncloud/ocis/pull/<n>
```

The URL line is what calens uses for the entry id. Point it at the upstream PR once it
exists.

## Preparing the branch

Because the two repositories share no git objects, a commit cannot be cherry-picked across.
Export and re-apply:

```bash
git format-patch -1 <sha> --stdout > /tmp/change.patch
# in an ocis checkout, from the repository root:
git apply --directory=web /tmp/change.patch
```

Then in the ocis checkout: rewrite the changelog entry to sit at the ocis root rather than
under `web/`, re-run their checks, and open the PR.

## Commit message

Upstream reviewers have no CERN context. Rewrite the message to describe the problem in
their terms: what breaks, for whom, under what configuration. Drop references to EOS, reva
and CERN deployment specifics unless they are the actual cause — in which case say so
plainly, since it explains why the bug was not noticed sooner.
