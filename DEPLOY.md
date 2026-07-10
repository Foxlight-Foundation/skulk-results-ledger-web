# Deploying the ledger to GitHub Pages

The data lifecycle end to end:

```
harness battery  ->  runs/<id>/report.json          (ephemeral, local, heavy)
     |  publish_results.sh at battery end  (auto: push + prune + deploy)
     |  or manual: npm run publish -- --data ../skulk-results-data --push --prune
     v
skulk-results-data (private)  reports/<run_id>.json   (permanent record, slimmed)
     |  GitHub Action: import --redact  ->  vite build
     v
Cloudflare Pages  https://benchmarks.foxlight.ai      (public, static)
```

Publishing is what lets you prune local disk: once a run is in
`skulk-results-data`, delete its local `runs/<id>` (or publish with `--prune`).

## Automatic publishing (the normal path)

Each e2e / mtp / throughput battery calls
`skulk-test-harness/examples/foxlight/publish_results.sh` at the end. It slims and
pushes the new runs to `skulk-results-data`, triggers an immediate Pages rebuild
(only when something was actually pushed), and prunes the published local run dirs
so disk does not grow without bound. It never fails the battery and skips
stability-suite / failed / no-result runs.

It is **off unless enabled**, by either:

- a `.autopublish-results` marker file at the harness repo root (gitignored;
  the "this is my publishing machine" switch, created once), **or**
- `SKULK_PUBLISH_RESULTS=1` in the environment.

Repo paths default to the sibling `skulk-results-data` / `skulk-results-ledger-web`
checkouts; override with `SKULK_RESULTS_DATA_DIR` / `SKULK_RESULTS_WEB_DIR`. The
immediate deploy needs an authenticated `gh`; without it, the site's 6-hourly
schedule still picks the runs up. So the ledger stays fresh with no manual step.

## One-time setup

These steps need repo/org settings and a secret, so they are done by a human
once. Nothing here has to be repeated per run.

Since 2026-07-10 the site deploys to **Cloudflare Pages** at
**https://benchmarks.foxlight.ai** (project `skulk-benchmarks`; the old
`foxlight-foundation.github.io/skulk-results-ledger-web` URL serves a
redirect).

1. **`DATA_REPO_TOKEN` secret.** A fine-grained PAT with **Contents: read** on
   `Foxlight-Foundation/skulk-results-data`, added to this repo's Actions
   secrets. Until it exists the build still runs (validating CI) but the
   deploy is gated off, so no empty page is published.

2. **`CLOUDFLARE_API_TOKEN` secret.** Scoped to the account: Cloudflare Pages
   (edit), Workers/D1/R2 (edit, for the future ingest plane), and DNS (edit)
   on the `foxlight.ai` zone. The deploy workflow creates the Pages project if
   it is ever missing; the custom domain + proxied CNAME were attached via the
   API at cutover.

3. **Base path.** The workflow builds with `DEPLOY_BASE=/` (root on the custom
   domain). The old GitHub Pages project-path base is gone.

4. **github.io redirect.** `github-pages-redirect.yml` (dispatch-only)
   publishes the path-preserving redirect page to GitHub Pages; run it once
   after any change to the canonical domain.

## Behind a reverse proxy (cloudflared) instead

The build is host-agnostic. To serve it from a box behind a Cloudflare tunnel:

```bash
npm run import -- --runs ../skulk-results-data/reports --redact
DEPLOY_BASE=/ npm run build          # or /benchmarks/ if proxied at a subpath
npx serve dist                       # any static server
cloudflared tunnel run <name>        # -> benchmarks.foxlight.ai
```

Cloudflare Pages serves its native SPA fallback (the deploy removes the
postbuild `404.html`, which is a GitHub-Pages-ism); for nginx use
`try_files $uri /index.html;` so client-side routes resolve.
