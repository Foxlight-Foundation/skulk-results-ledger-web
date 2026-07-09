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
GitHub Pages                                          (public, static)
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

1. **Repo visibility / plan.** GitHub Pages serves free from a *public* repo.
   Either make `skulk-results-ledger-web` public (it holds only app code, no
   data and no secrets), or ensure the org plan allows Pages on private repos.

2. **Enable Pages from Actions.** Repo → Settings → Pages → Build and
   deployment → Source: **GitHub Actions**.

3. **Grant the build read access to the private data repo.** Deploy keys are
   disabled org-wide, so use a token: create a fine-grained PAT with
   **Contents: read** on `Foxlight-Foundation/skulk-results-data`, and add it to
   `skulk-results-ledger-web` → Settings → Secrets and variables → Actions as
   **`DATA_REPO_TOKEN`**. Until this exists the build still runs (validating CI)
   but the **deploy job is gated off**, so no empty page is published. The first
   public deploy happens automatically on the next run once the token is set.

4. **Confirm the base path.** The workflow sets `DEPLOY_BASE=/benchmarks/`. If
   Pages serves the site at the default project path instead
   (`<org>.github.io/skulk-results-ledger-web/`), change that env to
   `/skulk-results-ledger-web/`, or point a custom domain at `/benchmarks`.

## Behind a reverse proxy (cloudflared) instead

The build is host-agnostic. To serve it from a box behind a Cloudflare tunnel:

```bash
npm run import -- --runs ../skulk-results-data/reports --redact
DEPLOY_BASE=/ npm run build          # or /benchmarks/ if proxied at a subpath
npx serve dist                       # any static server
cloudflared tunnel run <name>        # -> benchmarks.foxlight.ai
```

The `404.html` fallback is emitted for Pages; for nginx use
`try_files $uri /index.html;` so client-side routes resolve.
