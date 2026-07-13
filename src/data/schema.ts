/**
 * The generated-data contract shared by the importer (scripts/import-runs.ts)
 * and the site. The importer reads harness `report.json` artifacts and emits
 * these shapes into `public/data/`; the site fetches and renders them. There is
 * no backend and no database: the generated JSON files ARE the API.
 *
 * Keep this file the single source of truth. If the importer writes a field,
 * it is declared here; if the site reads a field, it is declared here.
 */

export const LEDGER_SCHEMA_VERSION = '1.3';

/**
 * Provenance tier (the open-ledger's load-bearing concept): `foxlight` =
 * first-party fleet runs from the git archive; `community` = third-party
 * submissions through the ingest API (validated + manually approved, not
 * independently verified). Tiers never blend into one headline number.
 */
export type ProvenanceTier = 'foxlight' | 'community';

/**
 * Canonical hardware shape for a set of nodes (a whole cluster or one
 * placement's subset), derived at import by scripts/hardware-taxonomy.ts.
 * Classes are opaque canonical strings (today `<vendor>-<tier>gb`, e.g.
 * `apple-16gb`); the site renders `label` and filters on `classes`/`label`.
 */
export interface HardwareProfile {
  /** Sorted distinct canonical node classes present. */
  classes: string[];
  /** Human label, e.g. "2x Apple 16GB + 1x AMD 64GB"; "unknown hardware" when unknown. */
  label: string;
  nodeCount: number;
  homogeneous: boolean;
  /** False when the run's fingerprint carries no classifiable node data (pre-fingerprint seed runs). */
  known: boolean;
}

/**
 * How a model result's hardware was attributed: `placement` = exact (the
 * run recorded which nodes served this model), `cluster` = the whole-cluster
 * shape (placement unknown; honest upper bound), `unknown` = no node data.
 */
export type HardwareAttribution = 'placement' | 'cluster' | 'unknown';

/** One model-by-hardware aggregate cell (for the hardware matrix). */
export interface HardwareCell {
  /** Profile label this cell aggregates over (a placement/cluster shape). */
  label: string;
  classes: string[];
  runCount: number;
  credibleRunCount: number;
  /** Median across this model's credible per-run medians ON this hardware. */
  decodeTpsTypical: number | null;
  passRate: number;
  lastRunAt: string | null;
  /**
   * How many of this cell's runs used the whole-cluster fallback (placement
   * nodes not recorded) rather than exact placement attribution. When > 0 the
   * cell's shape is an upper bound, and the UI marks it.
   */
  clusterAttributedRunCount: number;
}

/** Coarse engine family, derived from placement + fingerprint, for grouping. */
export type EngineFamily = 'mlx' | 'llama_cpp' | 'llama_server' | 'unknown';

/** Cache warmth as classified by the harness (never asserts a cold benchmark). */
export type CacheClass = 'unknown' | 'cold' | 'warm' | 'mixed';

/**
 * A trust caveat attached to a metric or run. Mirrors the harness comparison
 * guards plus ledger-specific ones (e.g. `single_rep`). Rendered as a chip so a
 * reader is never shown a number without its asterisks.
 */
export type Caveat =
  | 'low_sample'
  | 'single_rep'
  | 'short_output_dominant'
  | 'issue_marked'
  | 'missing_fingerprint'
  | 'decode_tps_estimated'
  | 'has_failures';

/** One metric aggregated over a population, median-first with sample counts. */
export interface MetricAggregate {
  metric: string;
  unit: string;
  median: number | null;
  min: number | null;
  max: number | null;
  sampleCount: number;
  shortSampleCount: number;
}

/** One node as recorded in a run's fingerprint. */
export interface NodeInfo {
  nodeId: string;
  friendlyName: string | null;
  ramTotalBytes: number | null;
  acceleratorVendor: string | null;
  /** Marketing name of the accelerator (e.g. `NVIDIA A40`), null when unmeasured. */
  acceleratorName: string | null;
  skulkVersion: string | null;
}

/** Compact per-run row for the runs feed and index. */
export interface RunSummary {
  runId: string;
  startedAt: string | null;
  finishedAt: string | null;
  mode: string;
  modelSet: string;
  testSet: string;
  runName: string | null;
  passCount: number;
  failCount: number;
  issueCount: number;
  modelCount: number;
  nodeCount: number;
  topologyLabel: string | null;
  skulkVersion: string | null;
  skulkCommit: string | null;
  cacheClass: CacheClass;
  hasFingerprint: boolean;
  runReason: string | null;
  caveats: Caveat[];
  /** Whole-cluster hardware shape for this run. */
  hardware: HardwareProfile;
  tier: ProvenanceTier;
  /** GitHub login of the community submitter; null for tier `foxlight`. */
  submitter: string | null;
}

/** One model's result within a single run (for the run-detail view). */
export interface RunModelResult {
  modelId: string;
  passCount: number;
  failCount: number;
  issueCount: number;
  nodeCount: number;
  decodeTps: MetricAggregate;
  ttft: MetricAggregate;
  caveats: Caveat[];
  /** Hardware that served this model (exact when attribution is `placement`). */
  hardware: HardwareProfile;
  hardwareAttribution: HardwareAttribution;
}

/** Full per-run detail file (`public/data/runs/<runId>.json`). */
export interface RunDetail extends RunSummary {
  nodes: NodeInfo[];
  apiBaseUrl: string | null;
  repositories: { name: string; branch: string | null; commit: string | null }[];
  harnessPackages: Record<string, string>;
  python: string | null;
  platform: string | null;
  models: RunModelResult[];
  issues: { severity: string; message: string }[];
}

/** One point in a model's throughput history over time. */
export interface ModelTimePoint {
  runId: string;
  startedAt: string | null;
  decodeTpsMedian: number | null;
  ttftMedian: number | null;
  sampleCount: number;
  nodeCount: number;
  skulkVersion: string | null;
  cacheClass: CacheClass;
  passRate: number;
  caveats: Caveat[];
  /**
   * A point is credible when it rests on enough real samples (multi-rep) and
   * is not dominated by short outputs. Headline numbers are computed from
   * credible points only, so a single-rep wall-throughput spike can never set
   * a record. Non-credible points are still plotted (dimmed) for honesty.
   */
  credible: boolean;
  /** Hardware that served this model in this run. */
  hardware: HardwareProfile;
  tier: ProvenanceTier;
}

/** Rollup card for one model in the explorer. */
/**
 * Compact per-run point carried in the index model rollups so the site can
 * recompute headline medians for any selected time window WITHOUT loading each
 * model's full history. Same credibility/tier rules as the baked aggregates
 * apply when re-aggregating (see src/data/window.ts). Timestamps are the run's
 * start (`startedAt`); a null timestamp is treated as always-in-window.
 */
export interface WindowPoint {
  startedAt: string | null;
  decodeTpsMedian: number | null;
  ttftMedian: number | null;
  credible: boolean;
  tier: ProvenanceTier;
  /** Hardware label for per-hardware cell grouping (matches HardwareProfile.label). */
  hardwareLabel: string;
  /** Canonical hardware classes, for class-level filtering parity with cells. */
  hardwareClasses: string[];
}

export interface ModelRollup {
  modelId: string;
  slug: string;
  displayName: string;
  family: EngineFamily;
  runCount: number;
  totalResults: number;
  passRate: number;
  /**
   * Typical decode tok/s: the median across this model's CREDIBLE per-run
   * medians. This is the explorer's headline axis. Deliberately not a "best
   * ever" number (that would reward the noisiest outlier and violate the
   * no-cherry-picking principle). Null when the model has no credible run.
   */
  decodeTpsTypical: number | null;
  /** Most-recent CREDIBLE run's median decode tok/s. */
  decodeTpsLatest: number | null;
  /** TTFT median from the most-recent credible run. */
  ttftLatestMedian: number | null;
  /** How many of this model's runs cleared the credibility bar. */
  credibleRunCount: number;
  nodeCountsObserved: number[];
  lastRunAt: string | null;
  caveats: Caveat[];
  /** Per-hardware aggregates (one cell per distinct hardware shape observed). */
  hardwareCells: HardwareCell[];
  /**
   * Compact per-run points for client-side time-window re-aggregation. Every
   * run this rollup summarizes, newest last. The baked hardwareCells /
   * decodeTpsTypical are the ALL-TIME view; window.ts recomputes them from
   * these points for a selected window.
   */
  windowPoints: WindowPoint[];
  /**
   * Community runs observed for this model. Headline numbers
   * (decodeTpsTypical/Latest) and hardware cells rest on tier `foxlight`
   * only (tiers never blend); community points appear in the timeline,
   * badged.
   */
  communityRunCount: number;
}

/** Full per-model history file (`public/data/models/<slug>.json`). */
export interface ModelHistory extends ModelRollup {
  timeline: ModelTimePoint[];
}

/** Rollup for one test suite (test set). */
export interface SuiteRollup {
  testSet: string;
  runCount: number;
  modelCount: number;
  totalResults: number;
  passRate: number;
  lastRunAt: string | null;
}

/** The top-level index the site loads first (`public/data/index.json`). */
export interface LedgerIndex {
  schemaVersion: string;
  generatedAt: string;
  runCount: number;
  modelCount: number;
  suiteCount: number;
  /** Distinct Skulk versions seen across all runs (mixed-version awareness). */
  skulkVersions: string[];
  /** Distinct KNOWN hardware labels from model cells (Explorer filter options; every label matches at least one model). */
  hardwareLabels: string[];
  runs: RunSummary[];
  models: ModelRollup[];
  suites: SuiteRollup[];
}
