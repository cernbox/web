# Local development

## Requirements

`node 24.15.0` and `pnpm 10.33.3`, pinned in `.mise.toml`. With
[mise](https://mise.jdx.dev): `mise install`. Docker is needed for the backend stack.

## The stack

`docker-compose.yml` at the repository root brings up an oCIS server behind traefik, plus
the app providers used for office integration:

```bash
docker compose up -d      # start
docker compose logs -f    # follow
docker compose down       # stop
```

Configuration lives in `dev/docker/`:

| path | what it is |
|---|---|
| `ocis.web.config.json` | the web config the container serves |
| `ocis.idp.config.yaml` | IdP clients and their allowed redirect URIs |
| `ocis.web-federated.config.json` | second instance, for federation and OCM |
| `ocis.storage.ocmproviders.json` | OCM provider list |
| `ocis-ca/` | local certificate authority |
| `traefik/` | reverse proxy configuration and certificates |
| `wopiserver/`, `onlyoffice/`, `ocis-appprovider-onlyoffice/` | office integration |

Note that this stack runs **oCIS**, not reva on EOS. Behaviour behind `cernFeatures`,
`runningOnEos` and `useRevaToken` cannot be exercised here; those need a CERN pre-production
backend.

## Certificates

The stack serves HTTPS with certificates signed by the CA in `dev/docker/ocis-ca`. Your
browser will not trust them until you add that CA to your trust store. Test tooling sets
`NODE_TLS_REJECT_UNAUTHORIZED=0` instead, which is why the Playwright scripts carry it.

## Running web against the stack

```bash
pnpm vite            # dev server, hot reload
pnpm build:w         # watch build, if you need the built output
```

The dev server is reachable through traefik. Its port is pinned in `vite.cern.config.ts`
(9201) for the CERN variant; the stock config uses the default.

To build the way production does, including the CERN component override and history-mode
routing:

```bash
pnpm build -c vite.cern.config.ts
```

## Running against a CERN backend

Point `server` in your local `config.json` at the pre-production instance and register the
dev server's origin as an allowed redirect URI with the IdP. Everything gated on
`cernFeatures` or `runningOnEos` needs this; the local oCIS stack cannot stand in for it.

## Embed mode

`dev/embed-demo.html` is a host page that frames web in embed mode and logs the postMessage
traffic. Serve it from any static server and point it at your dev server to exercise the
picker, the inline-attach target and the selection round-trip without a real integration.

## Tests

```bash
pnpm test:unit --run          # unit tests, no backend needed
pnpm test:e2e:playwright      # e2e, needs the stack running
./tests/e2e/run-e2e.sh        # e2e with the stack wired up
```

The e2e suite here is upstream's and has no CERN coverage; CERN journeys live in a separate
suite that drives a full deployment.
