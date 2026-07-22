# Skulk Results Ledger (web)

An honest, static results ledger for the [Skulk](https://github.com/Foxlight-Foundation/Skulk)
distributed-inference fabric. It renders the benchmark and end-to-end runs
produced by `skulk-test-harness` as an interactive site: a speed-vs-latency
model explorer, per-model throughput history, a full run audit trail, suite
coverage, and an in-browser run-vs-run comparison.

It is a **ledger, not a leaderboard**. Failed, partial, single-rep, and
short-output runs with classifiable hardware are all kept and shown with their
caveats. Reports with missing or partially unknown hardware remain in the
durable results store but are omitted from the public dashboard and its
aggregates. Throughput headlines are the median of *credible* samples only (multi-rep, not
short-output-dominated, physically plausible), so a five-token answer can never
become a record.

## No backend

There is no server and no database. An importer reads harness `report.json`
artifacts and emits static JSON into `public/data/`; the React app fetches
those files. To deploy, build and host the `dist/` directory anywhere static.

## Stack

React 18 · TypeScript · styled-components · Vite · Recharts. The theme is the
[foxlight.ai](https://foxlight.ai) design system (night canvas, Foxfire amber,
Starlight cyan), ported in `src/theme/`.

## Develop

```bash
npm install

# Live mode: regenerate data on every harness run + serve with hot reload.
# The watcher sees each new report.json and re-imports automatically, so the
# site is never stale. This is the usual way to run it.
npm run dev:live

# Or the two halves separately:
npm run import        # one-shot generate data from ../skulk-test-harness/runs
npm run import:watch  # regenerate whenever a run appears/changes
npm run dev           # dev server against whatever data is on disk

# Importer flags (import / import:watch):
#    --runs <dir>   add a runs directory (repeatable)
#    --out  <dir>   output dir (default public/data)
#    --redact       strip operator-identifying fields for public publishing

# Production build (static, deployable)
npm run build && npm run preview
```

The site is **static** in how it is *served* (no server, no database, deploy
`dist/` anywhere), but the data is *not frozen*: `import:watch` keeps
`public/data/` in step with the harness as runs land.

For a subpath deploy (e.g. GitHub Pages under `/ledger/`), set `DEPLOY_BASE`:

```bash
DEPLOY_BASE=/ledger/ npm run build
```

## Publishing (durable store + deploy)

The published site does not read a local `runs/` directory. The permanent record
lives in the private **`Foxlight-Foundation/skulk-results-data`** repo as
slimmed `reports/<run_id>.json` files (metrics + fingerprint; prompt/output text
stripped). This decouples the record from any laptop and lets local `runs/` be
deleted freely.

**Publish new runs** (from any harness box, into a checkout of the data repo):

```bash
npm run publish -- --data ../skulk-results-data --push
#    --runs <dir>   source runs (default ../skulk-test-harness/runs)
#    --push         commit + push to the data repo
#    --prune        delete the local run dirs after publishing
```

**Deploy** is a GitHub Action (`.github/workflows/deploy.yml`): on push to
`main` (and every 6h, to pick up newly published runs), it checks out the data
repo, imports with `--redact`, builds with `DEPLOY_BASE=/benchmarks/`, and
publishes to GitHub Pages. A `404.html` fallback (created by `postbuild`) makes
deep links work on Pages.

One-time setup (see `DEPLOY.md`): make this repo's Pages source "GitHub Actions",
add a `DATA_REPO_TOKEN` secret with read access to `skulk-results-data`, and set
the repo/plan so Pages can serve it.

## Data contract

`src/data/schema.ts` is the single source of truth for the generated-data
shapes, shared by the importer (`scripts/import-runs.ts`) and the app. The
ledger schema version is independent of the harness report schema.

## Checks

```bash
npm test            # focused importer and taxonomy regressions
npm run typecheck   # tsc -b
npm run lint        # eslint
npm run build       # tsc + vite build
```

## Privacy

Raw harness artifacts can contain node names, local paths, and topology
details. `public/data/` is gitignored; generate it locally, or run the
importer with `--redact` before publishing a public build.
