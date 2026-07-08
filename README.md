# Skulk Results Ledger (web)

An honest, static results ledger for the [Skulk](https://github.com/Foxlight-Foundation/Skulk)
distributed-inference fabric. It renders the benchmark and end-to-end runs
produced by `skulk-test-harness` as an interactive site: a speed-vs-latency
model explorer, per-model throughput history, a full run audit trail, suite
coverage, and an in-browser run-vs-run comparison.

It is a **ledger, not a leaderboard**. Failed, partial, single-rep, and
short-output runs are all kept and shown with their caveats. Throughput
headlines are the median of *credible* samples only (multi-rep, not
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

## Data contract

`src/data/schema.ts` is the single source of truth for the generated-data
shapes, shared by the importer (`scripts/import-runs.ts`) and the app. The
ledger schema version is independent of the harness report schema.

## Checks

```bash
npm run typecheck   # tsc -b
npm run lint        # eslint
npm run build       # tsc + vite build
```

## Privacy

Raw harness artifacts can contain node names, local paths, and topology
details. `public/data/` is gitignored; generate it locally, or run the
importer with `--redact` before publishing a public build.
