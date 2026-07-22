# Skulk Results Ledger (web)

An honest, static results ledger for the [Skulk](https://github.com/Foxlight-Foundation/Skulk)
distributed-inference fabric. It renders the benchmark and end-to-end runs
produced by `skulk-test-harness` as an interactive site: a speed-vs-latency
model explorer, per-model throughput history, a full run audit trail, suite
coverage, and an in-browser run-vs-run comparison.

It is a **ledger, not a leaderboard**. Failed and excluded observations remain
visible on run detail, while text trends accept only passed, structurally valid
chat/code/artifact measurements. Reports with missing or partially unknown
hardware remain in the durable results store but are omitted dashboard-wide.
Every throughput row belongs to an explicit test, protocol, metric source,
exact hardware, backend, placement, tier, and time context.

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
repo, imports with `--redact`, builds with `DEPLOY_BASE=/`, and publishes to
Cloudflare Pages at `benchmarks.foxlight.ai`.

## Data contract

`src/data/schema.ts` is the single source of truth for the generated-data
shapes, shared by the importer (`scripts/import-runs.ts`) and the app. The
ledger schema version is independent of the harness report schema.

Schema 2.0 retains every repetition on run detail as a
`PerformanceObservation`, then computes one `RunSeriesPoint` median from valid
repetitions of the same test and exact series identity. A `PerformanceSeries`
never crosses model, tier, suite, test, protocol, metric source, exact hardware,
hardware attribution, backend, instance type, or sharding boundaries.

Text decode trends accept only chat, code, and artifact flows. Their sources
remain separate:

- `client_exact`: exact generated tokens divided by the measurable streamed
  decode interval; at least 20 exact tokens and two generated chunks.
- `engine_reported`: the engine diagnostic rate, labeled as such.
- `client_approx`: the legacy character-derived rate, validated against its
  own approximate token count.

Failed results and invalid measurements remain on run detail. Missing protocol,
backend, exact placement hardware, or placement shape produces a neutral legacy
observation that cannot enter comparison, headlines, or stability. Unknown or
partially known hardware is omitted from all public dashboard views.

`Stable` requires the newest ten distinct run-level points in the selected time
window to span at least seven days and have sample CV at most 10%. Enough
longitudinal evidence above that threshold is `Variable`; fewer comparable runs
are `Observed`; incomplete provenance is `Legacy`.

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
