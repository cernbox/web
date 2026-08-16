#!/usr/bin/env bash
#
# Refresh the local ocis `web/` mirror and fetch it as the `ocis-web` remote.
#
# Upstream development moved into the ocis monorepo under web/, imported as a single squashed
# commit. Its object graph shares nothing with this repository, so upstream cannot be tracked
# as an ordinary remote and no commit can be cherry-picked across. This derives a web-only
# history with git-filter-repo, which is deterministic - the same input commits and options
# always produce the same output SHAs - so repeated syncs fast-forward rather than producing
# an unrelated history each time. That property has been verified; see --verify.
#
# Usage:
#   dev/scripts/sync-upstream.sh              # refresh the mirror and fetch it
#   dev/scripts/sync-upstream.sh --verify     # derive twice and confirm the SHAs match
#
# Afterwards, rebase using the `cern-rebase` skill.
#
# Two things worth knowing before reading further:
#
#   * git-filter-repo does NOT work on a partial clone (--filter=blob:none). It fails with a
#     BrokenPipeError partway through and leaves HEAD at the unfiltered tip, which looks like
#     success. The clone below is deliberately full.
#
#   * `web/` existed in ocis long before the web import, holding unrelated konnectd content,
#     so the filtered history has roots going back to 2019 and the earliest commits are not
#     web at all. The commit to graft onto is the *import*, found below, not a root.

set -euo pipefail

OCIS_URL="${OCIS_URL:-https://github.com/owncloud/ocis.git}"
MIRROR="${MIRROR:-/tmp/ocis-web-mirror}"
REMOTE="ocis-web"
# the squashed "merge and relicense ownCloud Web into oCIS" commit, in filtered-history terms
IMPORT_SUBJECT="merge and relicense ownCloud Web into oCIS"
REPO_ROOT="$(git rev-parse --show-toplevel)"

command -v git-filter-repo >/dev/null 2>&1 || {
  echo "git-filter-repo is required: pip install git-filter-repo" >&2
  exit 1
}

derive() {
  local dest="$1"
  rm -rf "$dest"
  # full clone on purpose - see the note at the top
  git clone --no-checkout "$OCIS_URL" "$dest" >/dev/null 2>&1
  git -C "$dest" filter-repo --subdirectory-filter web --force >/dev/null 2>&1
  git -C "$dest" rev-parse HEAD
}

if [ "${1:-}" = "--verify" ]; then
  echo "Deriving twice to confirm filter-repo is reproducible (a few minutes)..."
  a="$(derive "${MIRROR}-verify-a")"
  b="$(derive "${MIRROR}-verify-b")"
  rm -rf "${MIRROR}-verify-a" "${MIRROR}-verify-b"
  if [ "$a" = "$b" ]; then
    echo "OK - both derivations produced $a"
    exit 0
  fi
  echo "MISMATCH: $a vs $b" >&2
  echo "The graft will not hold and every rebase will look like unrelated history." >&2
  exit 1
fi

echo "Deriving the web-only mirror from $OCIS_URL ..."
tip="$(derive "$MIRROR")"
echo "  tip:     $tip"
echo "  commits: $(git -C "$MIRROR" rev-list --count HEAD)"

import_sha="$(git -C "$MIRROR" log --format='%H %s' | grep -F "$IMPORT_SUBJECT" | head -1 | cut -d' ' -f1 || true)"
if [ -n "$import_sha" ]; then
  echo "  import:  $import_sha"
fi

cd "$REPO_ROOT"
git remote get-url "$REMOTE" >/dev/null 2>&1 || git remote add "$REMOTE" "$MIRROR"
git remote set-url "$REMOTE" "$MIRROR"
# --no-tags matters: an explicit refspec does not stop git auto-following tags, and the
# mirror carries ocis' ~160 release tags (v1.x .. v8.x), which would land unqualified in
# this repository's tag namespace alongside web's own.
git fetch --no-tags --force "$REMOTE" "refs/heads/master:refs/remotes/${REMOTE}/master"

echo
echo "Fetched ${REMOTE}/master at $(git rev-parse --short "${REMOTE}/master")"
echo

if [ -n "$import_sha" ]; then
  cat <<MSG
First sync only - graft the import onto the release this fork is based on, so that a rebase
sees a shared ancestor instead of two unrelated histories:

  git replace --graft $import_sha b16a34fdf5
  git push origin 'refs/replace/*'      # so colleagues get the graft too

MSG
fi

cat <<'MSG'
Then rebase (see .claude/skills/cern-rebase for the conflict hot-spots):

  git rebase --onto ocis-web/master b16a34fdf5 <branch>

The first rebase surfaces the import's own file removals - LICENSE, CHANGELOG.md, changelog/,
.github/, CONTRIBUTING.md and others - as upstream changes. Resolve once; later syncs are quiet.
MSG
