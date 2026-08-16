# AGENTS.md — CERNBox Web

CERNBox Web is CERN's fork of [ownCloud Web](https://github.com/owncloud/web): a Vue 3 +
TypeScript single-page app for file management, sharing and collaborative editing. It runs
against a [reva](https://github.com/cs3org/reva) backend on EOS storage rather than against
oCIS, which is the source of most of the divergence described below.

## Repository structure

`packages/` is a pnpm workspace. Each entry is a package; apps are loaded at runtime from
configuration, so not everything here ships in a given deployment.

| package | purpose |
|---|---|
| `web-client/` | HTTP/WebDAV/graph/OCS client. No Vue. Everything else depends on it |
| `web-pkg/` | Shared library: composables, pinia stores, file actions, shared components |
| `web-runtime/` | App shell: auth, routing, theming, app loading, top bar, sidebar nav |
| `design-system/` | `Oc*` UI components and design tokens |
| `web-app-files/` | The file browser — spaces, shares, trash, favourites |
| `web-app-external/` | WOPI office integration (Collabora, MS365, EuroOffice) |
| `web-app-preview/` | Image, audio and video preview |
| `web-app-search/` | Search UI |
| `web-app-pdf-viewer/`, `web-app-text-editor/`, `web-app-epub-reader/`, `web-app-html-editor/` | Viewers and editors |
| `web-app-admin-settings/`, `web-app-activities/`, `web-app-app-store/`, `web-app-ocm/`, `web-app-webfinger/`, `web-app-password-protected-folders/` | Upstream apps **not currently loaded in CERNBox production** |
| `web-test-helpers/` | Mount helpers, pinia mocks, `defaultComponentMocks` |
| `extension-sdk/`, `web-container/` | Extension build tooling and static assets |
| `babel-preset/`, `eslint-config/`, `prettier-config/`, `tsconfig/` | Shared build/lint configuration |

Also relevant: `config/` (config examples), `dev/` (docker compose stack for local development),
`tests/e2e/` (upstream Playwright suite), `changelog/unreleased/` (changelog entries).

Two sibling repositories sit outside this one:

- `web-extensions/` — ~20 CERN extension packages, loaded as external apps
- `web-release/` — deployment and release tooling

## Runtime versions

`node 24.15.0`, `pnpm 10.33.3`. Pinned in `.mise.toml`, `package.json#volta` and
`package.json#packageManager`. With [mise](https://mise.jdx.dev) installed, `mise install`
gives you the right versions; otherwise match them manually, since the lockfile and several
test behaviours are version-sensitive.

## Commands

```bash
pnpm install                 # install workspace dependencies
pnpm vite                    # dev server
pnpm build                   # production build
pnpm build -c vite.cern.config.ts   # CERN production build (see "CERN build variant")

pnpm check:types             # build design tokens, then vue-tsc --noEmit
pnpm lint                    # eslint across packages and tests
pnpm check:format            # prettier check
pnpm format                  # prettier write
pnpm check:all               # types + lint --fix + format + unit tests

pnpm test:unit --run                                    # all unit tests, once
pnpm test:unit --run packages/web-pkg/tests/unit/x.spec.ts   # a single file
pnpm --filter @ownclouders/web-pkg test:unit --run      # one package
pnpm --filter web-app-files test:unit --run -t "name"   # one test by name

pnpm test:e2e:playwright     # Playwright suite (needs a running backend)
./tests/e2e/run-e2e.sh       # same, with the docker stack wired up
```

Package filter names are the `name` field in each `package.json`, which is not always the
directory name: `web-app-external` is `external`, `web-app-preview` is `preview`,
`web-pkg` is `@ownclouders/web-pkg`.

## Coding conventions

- **Vue**: `<script setup lang="ts">` with the Composition API. Typed props via
  `defineProps<Props>()` and typed emits. Avoid `any`.
- **Reactivity**: `unref()` to read, `.value` to write. Prefer `computed` over watchers.
- **Translations**: every user-facing string goes through `$gettext`. Never hand-edit
  `l10n/translations.json` — it is generated.
- **Imports across packages**: always by package name (`@ownclouders/web-pkg`), never by
  relative path into another package. Check the package's `exports` field before adding a
  new import path.
- **Formatting**: Prettier and ESLint decide. Do not hand-format.
- **Comments**: explain *why*, not *what*. A comment restating the code is noise; a comment
  explaining a non-obvious constraint is worth keeping.

### Known trap: import cycles

`web-pkg`'s barrels (`composables/index.ts`, `helpers/index.ts`, `components/index.ts`) form
roughly 200 mutual import cycles, inherited from upstream. Consequences you will hit:

- A module that only imports **types** from a barrel gets elided, which can leave unrelated
  composables (`useRouter`, `ResourceTransfer`) undefined at call time. `ActionMenuItem.vue`
  carries a deliberate side-effect import for exactly this reason.
- Importing a symbol from its defining module instead of the barrel sometimes *fixes* one
  file and breaks thirty others, because it changes evaluation order.

This mostly manifests in unit tests rather than production builds. If a test fails with
"X is not a function" or "X is not a constructor" for something that obviously exists,
suspect this before suspecting your change.

## Testing

Unit tests are Vitest, colocated per package under `tests/unit/`, mirroring `src/`.

- Mount with the helpers from `@ownclouders/web-test-helpers`: `defaultPlugins()`,
  `defaultComponentMocks()`, `getComposableWrapper()`.
- Seed pinia state through `defaultPlugins({ piniaOptions: { spacesState, configState,
  resourcesStore, ... } })` rather than by mutating stores after mount.
- `vitest-mock-extended`'s `mock<T>()` returns an **auto-mocked function** for any property
  you do not set, not `undefined`. Code branching on `resource.spaceId` or calling
  `resource.canDownload()` will therefore see a truthy function. Set such properties
  explicitly, including to `undefined`.
- Avoid adding new snapshot tests. Existing ones are fine; assert on behaviour for new code.
- Never run `test:unit -u` with a path argument expecting it to scope the update — it runs
  the whole project and will delete snapshots it considers obsolete.

E2E lives in `tests/e2e/` and is plain Playwright specs (`tests/e2e/specs/`) — there is no
Cucumber and no Gherkin, despite what older tooling configuration may suggest. CERN-specific
journeys are covered by a separate suite that drives a full deployment, not by this one.

## CERN-specific behaviour

Two configuration options change a great deal:

- **`cernFeatures`** — the largest single divergence. Beyond its own call sites it *derives*
  three further options at config load time, which cannot be set from `config.json`:
  `ocm.openRemotely`, `routing.idBased` (inverted) and `routing.fullShareOwnerPaths`. In
  other words, `cernFeatures: true` switches the whole app to **path-based routing**. Any
  behaviour keyed on a `fileId` query parameter is dead in production.
- **`runningOnEos`** — the deployment runs against EOS through reva. Gates the catch-all
  space, the recipient type filters, shortcut wording and several action removals.

Others: `useRevaToken` (exchange the OIDC token for a reva token at sign-in), `listVersions`
(show backend versions in the sidebar), `alertRwFolders` (per-locale notice when a read-write
folder link is created), `embed.target: 'inline-attach'`, `embed.messagesOrigin`.

None of these appear in `config/config.json.dist`; the real configuration lives in
`web-extensions/theme-cernbox/` and `web-release/`.

Subsystems that exist only here: the EOS catch-all explorer space, My Office Files, the
Projects view filters, the office postMessage registry, reva token auth and low-assurance
handling, date-bound URL signing, read-write folder link expiration, notify-by-mail,
sharing-hierarchy conflict handling, the trashbin date filter.

### CERN build variant

`vite.cern.config.ts` wraps the standard config and swaps `CreateSpace.vue` for the CERN one,
which links to the service portal instead of opening a dialog the backend cannot serve. It
also enables the history-mode routing plugin. `Makefile.release` builds with it.

The override matches on the **resolved file**, not on an import specifier, because the
component is reached through the package barrel. If you move the component, update the path
in `vite.cern.config.ts` — nothing will fail loudly if you do not; the stock component simply
ships instead.

### Branch discipline

`dev_future` is maintained as two blocks on top of an upstream release tag:

1. **Block 0 and Block A** — generic changes, each one intended to be offerable to upstream.
   Every commit here carries a `changelog/unreleased/<type>-<slug>.md` entry.
2. **Block B** — CERN-specific changes. No changelog entries; these are not going upstream.

Keep the boundary intact. If a change is generic, put it in Block A with a changelog entry;
if it only makes sense with `cernFeatures` or `runningOnEos` on, it belongs in Block B. When
a file needs both, split the change rather than mixing them in one commit.

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org/) for the subject line, then a
  body explaining **what changed and why** — the failure or requirement that motivated it,
  and any behaviour change or caveat. Describe the problem, not just the patch.
- One commit per logical change. Fold fixes into the commit they belong to with
  `git commit --fixup=<sha>` and `git rebase -i --autosquash`, rather than stacking
  "fix review comment" commits.
- Anything destined for upstream needs a `changelog/unreleased/` entry in the format
  described in `changelog/README.md`.
- Rebase, do not merge.
