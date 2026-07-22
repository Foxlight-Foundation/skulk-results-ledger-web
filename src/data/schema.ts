/** Generated ledger schema 2.0: provenance-first performance observations. */

export const LEDGER_SCHEMA_VERSION = '2.0';

export type ProvenanceTier = 'foxlight' | 'community';
export type MetricSource = 'client_exact' | 'engine_reported' | 'client_approx';
export type SeriesStatus = 'Stable' | 'Variable' | 'Observed' | 'Legacy';
export type HardwareAttribution = 'placement' | 'cluster' | 'unknown';
export type EngineFamily = 'mlx' | 'llama_cpp' | 'llama_server' | 'unknown';
export type CacheClass = 'unknown' | 'cold' | 'warm' | 'mixed';
export type Caveat =
  | 'has_failures'
  | 'issue_marked'
  | 'missing_fingerprint'
  | 'legacy_provenance';

/** Canonical display profile plus an exact raw-hardware identity digest. */
export interface HardwareProfile {
  classes: string[];
  label: string;
  nodeCount: number;
  homogeneous: boolean;
  known: boolean;
  /** SHA-256 over sorted exact accelerator/memory facts; null if incomplete. */
  profileId: string | null;
}

export interface NodeInfo {
  nodeId: string;
  friendlyName: string | null;
  ramTotalBytes: number | null;
  acceleratorVendor: string | null;
  acceleratorName: string | null;
  vramTotalBytes: number | null;
  gttTotalBytes: number | null;
  memoryGb: number | null;
  skulkVersion: string | null;
}

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
  hardware: HardwareProfile;
  tier: ProvenanceTier;
  submitter: string | null;
}

export type ObservationExclusionReason =
  | 'non_text_workload'
  | 'failed_result'
  | 'missing_metric'
  | 'non_finite_metric'
  | 'non_positive_metric'
  | 'missing_exact_output'
  | 'short_exact_output'
  | 'missing_approximate_output'
  | 'short_approximate_output'
  | 'missing_stream_interval'
  | 'insufficient_stream_chunks'
  | 'unknown_hardware';

/** One metric-source view of one test repetition. */
export interface PerformanceObservation {
  observationId: string;
  runId: string;
  startedAt: string | null;
  modelId: string;
  suiteId: string;
  testName: string;
  testKind: string | null;
  testDescription: string;
  repetition: number;
  passed: boolean;
  protocolId: string | null;
  protocolFamilyId: string | null;
  source: MetricSource;
  decodeTps: number | null;
  ttftS: number | null;
  elapsedS: number | null;
  decodeElapsedS: number | null;
  exactGeneratedTokens: number | null;
  approximateGeneratedTokens: number | null;
  chunks: number | null;
  validDecode: boolean;
  validTtft: boolean;
  exclusionReasons: ObservationExclusionReason[];
  hardware: HardwareProfile;
  hardwareAttribution: HardwareAttribution;
  resolvedBackends: string[];
  instanceType: string | null;
  sharding: string | null;
  shardTypes: string[];
  tier: ProvenanceTier;
  submitter: string | null;
  skulkVersion: string | null;
  skulkCommit: string | null;
  issueCount: number;
  /** True only when protocol, exact placement hardware, backend, and shape exist. */
  comparable: boolean;
}

/** Median of valid repetitions for one exact series in one run. */
export interface RunSeriesPoint {
  runId: string;
  startedAt: string | null;
  decodeTps: number;
  ttftS: number | null;
  repetitionCount: number;
  validRepetitionCount: number;
  skulkVersion: string | null;
  skulkCommit: string | null;
}

/** Longitudinal summary over a selected population of run-level points. */
export interface SeriesSummary {
  latestTps: number | null;
  medianTps: number | null;
  minimumTps: number | null;
  maximumTps: number | null;
  latestTtftS: number | null;
  medianTtftS: number | null;
  runCount: number;
  repetitionCount: number;
  meanTps: number | null;
  sampleStandardDeviation: number | null;
  coefficientOfVariation: number | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  spanDays: number | null;
  status: SeriesStatus;
}

/** Exact boundary for a longitudinal performance series. */
export interface PerformanceSeries {
  seriesId: string;
  modelId: string;
  slug: string;
  displayName: string;
  family: EngineFamily;
  tier: ProvenanceTier;
  suiteId: string;
  testName: string;
  testKind: string | null;
  testDescription: string;
  protocolId: string | null;
  protocolFamilyId: string | null;
  source: MetricSource;
  hardware: HardwareProfile;
  hardwareAttribution: HardwareAttribution;
  resolvedBackends: string[];
  instanceType: string | null;
  sharding: string | null;
  shardTypes: string[];
  comparable: boolean;
  points: RunSeriesPoint[];
  summary: SeriesSummary;
}

export interface ModelCatalogEntry {
  modelId: string;
  slug: string;
  displayName: string;
  family: EngineFamily;
}

export interface ConcurrencyPoint {
  concurrency: number;
  aggregateTps: number | null;
  perRequestTpsP50: number | null;
  perRequestTpsP90: number | null;
  ttftP50S: number | null;
  ttftP90S: number | null;
  totalRequests: number | null;
  succeeded: number | null;
  failed: number | null;
}

export interface ConcurrencyCurve {
  runId: string;
  startedAt: string | null;
  modelId: string;
  testName: string;
  protocolFamilyId: string | null;
  hardware: HardwareProfile;
  resolvedBackends: string[];
  instanceType: string | null;
  sharding: string | null;
  shardTypes: string[];
  tier: ProvenanceTier;
  points: ConcurrencyPoint[];
}

export interface RunDetail extends RunSummary {
  testSetDescription: string;
  nodes: NodeInfo[];
  apiBaseUrl: string | null;
  repositories: { name: string; branch: string | null; commit: string | null }[];
  harnessPackages: Record<string, string>;
  python: string | null;
  platform: string | null;
  observations: PerformanceObservation[];
  concurrencyCurves: ConcurrencyCurve[];
  issues: { severity: string; message: string }[];
}

export interface ModelHistory extends ModelCatalogEntry {
  series: PerformanceSeries[];
  concurrencyCurves: ConcurrencyCurve[];
}

export interface SuiteRollup {
  testSet: string;
  runCount: number;
  modelCount: number;
  totalResults: number;
  passRate: number;
  lastRunAt: string | null;
  title: string | null;
  description: string | null;
  measures: string | null;
  category: string | null;
}

export interface LedgerIndex {
  schemaVersion: '2.0';
  generatedAt: string;
  runCount: number;
  modelCount: number;
  suiteCount: number;
  skulkVersions: string[];
  hardwareLabels: string[];
  backends: string[];
  runs: RunSummary[];
  models: ModelCatalogEntry[];
  series: PerformanceSeries[];
  suites: SuiteRollup[];
}
