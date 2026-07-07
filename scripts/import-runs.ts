/**
 * Results-ledger importer (Phase 3).
 *
 * Reads harness `report.json` artifacts from one or more `runs/` directories,
 * aggregates them into the generated-data contract (src/data/schema.ts), and
 * writes `public/data/{index,runs/*,models/*,suites/*}.json`. There is no
 * database: these files are the site's entire data layer.
 *
 * Usage:
 *   tsx scripts/import-runs.ts [--runs <dir> ...] [--out <dir>] [--redact]
 *
 * Defaults: reads ../skulk-test-harness/runs, writes ./public/data. `--redact`
 * strips operator-identifying fields (node friendly names, API URLs, local
 * repo paths, operator notes) for public publishing; the ledger never stores
 * prompt/output text in the generated data regardless.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CacheClass,
  Caveat,
  EngineFamily,
  LedgerIndex,
  MetricAggregate,
  ModelHistory,
  ModelRollup,
  ModelTimePoint,
  NodeInfo,
  RunDetail,
  RunModelResult,
  RunSummary,
  SuiteRollup,
} from '../src/data/schema.ts';
import { LEDGER_SCHEMA_VERSION } from '../src/data/schema.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const SHORT_OUTPUT_TOKENS = 20;
const LOW_SAMPLE_THRESHOLD = 3;
const SHORT_DOMINANT_FRACTION = 0.5;

// Decode rates above this are treated as timing artifacts, not measurements.
// Nothing on this fleet decodes faster than a few hundred tok/s; a four-digit
// wall-throughput figure comes from a near-zero elapsed time (a cache hit or a
// clock-resolution floor), not real generation. Such points are excluded from
// credible headline numbers but still shown, dimmed, in the history.
const IMPLAUSIBLE_TPS = 1000;

// ---- raw report.json shapes (loose; only the fields we read) ---------------

interface RawMetrics {
  ttft_s?: number | null;
  approx_output_tokens?: number | null;
  wall_tps?: number | null;
  skulk_generation_tps?: number | null;
  skulk_generation_tokens?: number | null;
}
interface RawIssue {
  severity?: string;
  message?: string;
}
interface RawResult {
  model_id: string;
  test_name: string;
  repetition: number;
  passed: boolean;
  metrics: RawMetrics;
  issues?: RawIssue[];
}
interface RawPlacement {
  model_id: string;
  node_ids?: string[];
}
interface RawNode {
  node_id: string;
  friendly_name?: string | null;
  ram_total_bytes?: number | null;
  accelerator_vendor?: string | null;
  skulk_version?: string | null;
}
interface RawFingerprint {
  source_context?: {
    run_reason?: string | null;
    operator_note?: string | null;
    repositories?: { name: string; path?: string | null; branch?: string | null; commit?: string | null }[];
  };
  runtime?: {
    python?: string | null;
    platform?: string | null;
    harness_packages?: Record<string, string>;
    skulk_version?: string | null;
    skulk_commit?: string | null;
  };
  cluster?: {
    api_base_url?: string | null;
    node_count?: number;
    nodes?: RawNode[];
    topology_label?: string | null;
  };
  cache_state?: { classification?: CacheClass };
}
interface RawReport {
  run_id: string;
  started_at?: string | null;
  finished_at?: string | null;
  spec: { model_set: string; test_set: string; mode: string; run_name?: string | null };
  models?: unknown[];
  placements?: RawPlacement[];
  results?: RawResult[];
  issues?: RawIssue[];
  fingerprint?: RawFingerprint | null;
  suite?: string; // stability report marker; such reports are skipped
}

// ---- aggregation -----------------------------------------------------------

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function tokensOf(m: RawMetrics): number | null {
  if (m.skulk_generation_tokens != null) return m.skulk_generation_tokens;
  if (m.approx_output_tokens != null) return m.approx_output_tokens;
  return null;
}

function isShort(m: RawMetrics): boolean {
  const t = tokensOf(m);
  return t == null || t < SHORT_OUTPUT_TOKENS;
}

function decodeOf(m: RawMetrics): number | null {
  // Prefer Skulk's steady-state decode rate; fall back to wall throughput.
  return m.skulk_generation_tps != null ? m.skulk_generation_tps : m.wall_tps ?? null;
}

function aggregate(
  metric: string,
  unit: string,
  results: RawResult[],
  extract: (m: RawMetrics) => number | null,
  excludeShort: boolean,
): MetricAggregate {
  const values: number[] = [];
  let short = 0;
  for (const r of results) {
    const v = extract(r.metrics);
    if (v == null) continue;
    if (excludeShort && isShort(r.metrics)) {
      short += 1;
      continue;
    }
    values.push(v);
  }
  return {
    metric,
    unit,
    median: median(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    sampleCount: values.length,
    shortSampleCount: short,
  };
}

function slugify(modelId: string): string {
  return modelId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function displayName(modelId: string): string {
  return modelId.split('/').pop() ?? modelId;
}

function familyOf(modelId: string, nodes: NodeInfo[]): EngineFamily {
  const lower = modelId.toLowerCase();
  // Artifact type is the strongest signal: GGUF runs on the llama.cpp family
  // (served vs in-process is not observable from the report).
  if (lower.includes('gguf')) return 'llama_cpp';
  // Any AMD accelerator in the run set implies a llama.cpp-family engine.
  if (nodes.some((n) => n.acceleratorVendor === 'amd')) return 'llama_cpp';
  if (nodes.some((n) => n.acceleratorVendor === 'apple')) return 'mlx';
  // Fall back to naming conventions for runs that predate fingerprints: the
  // mlx-community org and bit-quant suffixes are MLX safetensors artifacts.
  if (lower.startsWith('mlx-community/') || /-\d+bits?\b/.test(lower)) return 'mlx';
  return 'unknown';
}

// ---- per-run transform -----------------------------------------------------

function nodesFrom(report: RawReport): NodeInfo[] {
  const raw = report.fingerprint?.cluster?.nodes ?? [];
  return raw.map((n) => ({
    nodeId: n.node_id,
    friendlyName: n.friendly_name ?? null,
    ramTotalBytes: n.ram_total_bytes ?? null,
    acceleratorVendor: n.accelerator_vendor ?? null,
    skulkVersion: n.skulk_version ?? null,
  }));
}

function modelCaveats(agg: MetricAggregate, failCount: number, issueCount: number, reps: number): Caveat[] {
  const caveats: Caveat[] = [];
  if (agg.sampleCount > 0 && agg.sampleCount < LOW_SAMPLE_THRESHOLD) caveats.push('low_sample');
  if (reps <= 1) caveats.push('single_rep');
  const total = agg.sampleCount + agg.shortSampleCount;
  if (total > 0 && agg.shortSampleCount / total > SHORT_DOMINANT_FRACTION) {
    caveats.push('short_output_dominant');
  }
  if (issueCount > 0) caveats.push('issue_marked');
  if (failCount > 0) caveats.push('has_failures');
  return caveats;
}

function buildRunDetail(report: RawReport, redact: boolean): RunDetail {
  const nodes = nodesFrom(report);
  const fp = report.fingerprint;
  const results = report.results ?? [];
  const placementNodes = new Map<string, number>();
  for (const p of report.placements ?? []) {
    if (p.node_ids && p.node_ids.length) placementNodes.set(p.model_id, p.node_ids.length);
  }

  const byModel = new Map<string, RawResult[]>();
  for (const r of results) {
    const arr = byModel.get(r.model_id) ?? [];
    arr.push(r);
    byModel.set(r.model_id, arr);
  }

  const models: RunModelResult[] = [];
  for (const [modelId, rs] of byModel) {
    const decode = aggregate('decode_tps', 'tok/s', rs, decodeOf, true);
    const ttft = aggregate('ttft_s', 's', rs, (m) => m.ttft_s ?? null, false);
    const passCount = rs.filter((r) => r.passed).length;
    const failCount = rs.length - passCount;
    const issueCount = rs.reduce((n, r) => n + (r.issues?.length ?? 0), 0);
    const reps = new Set(rs.map((r) => r.repetition)).size;
    models.push({
      modelId,
      passCount,
      failCount,
      issueCount,
      nodeCount: placementNodes.get(modelId) ?? 0,
      decodeTps: decode,
      ttft,
      caveats: modelCaveats(decode, failCount, issueCount, reps),
    });
  }
  models.sort((a, b) => a.modelId.localeCompare(b.modelId));

  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.length - passCount;
  const issueCount =
    (report.issues?.length ?? 0) + results.reduce((n, r) => n + (r.issues?.length ?? 0), 0);
  const hasFingerprint = fp != null;
  const runCaveats: Caveat[] = [];
  if (!hasFingerprint) runCaveats.push('missing_fingerprint');
  if (failCount > 0) runCaveats.push('has_failures');
  if (results.some((r) => decodeOf(r.metrics) == null && r.metrics.wall_tps == null)) {
    runCaveats.push('decode_tps_estimated');
  }

  const nodeCount = fp?.cluster?.node_count ?? nodes.length;
  const repositories = (fp?.source_context?.repositories ?? []).map((r) => ({
    name: r.name,
    branch: r.branch ?? null,
    commit: r.commit ?? null,
  }));

  return {
    runId: report.run_id,
    startedAt: report.started_at ?? null,
    finishedAt: report.finished_at ?? null,
    mode: report.spec.mode,
    modelSet: report.spec.model_set,
    testSet: report.spec.test_set,
    runName: redact ? null : report.spec.run_name ?? null,
    passCount,
    failCount,
    issueCount,
    modelCount: byModel.size,
    nodeCount,
    topologyLabel: fp?.cluster?.topology_label ?? null,
    skulkVersion: fp?.runtime?.skulk_version ?? null,
    skulkCommit: fp?.runtime?.skulk_commit ?? null,
    cacheClass: fp?.cache_state?.classification ?? 'unknown',
    hasFingerprint,
    runReason: fp?.source_context?.run_reason ?? null,
    caveats: runCaveats,
    nodes: redact
      ? nodes.map((n) => ({ ...n, friendlyName: null, nodeId: shortHash(n.nodeId) }))
      : nodes,
    apiBaseUrl: redact ? null : fp?.cluster?.api_base_url ?? null,
    repositories,
    harnessPackages: fp?.runtime?.harness_packages ?? {},
    python: fp?.runtime?.python ?? null,
    platform: fp?.runtime?.platform ?? null,
    models,
    issues: [
      ...(report.issues ?? []),
      ...results.flatMap((r) => r.issues ?? []),
    ].map((i) => ({ severity: i.severity ?? 'info', message: i.message ?? '' })),
  };
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function toSummary(detail: RunDetail): RunSummary {
  const { nodes: _n, repositories: _r, harnessPackages: _h, python: _p, platform: _pl, models: _m, issues: _i, apiBaseUrl: _a, ...summary } = detail;
  return summary;
}

// ---- rollups ---------------------------------------------------------------

function buildModelHistories(details: RunDetail[]): ModelHistory[] {
  const byModel = new Map<string, { detail: RunDetail; result: RunModelResult }[]>();
  for (const detail of details) {
    for (const result of detail.models) {
      const arr = byModel.get(result.modelId) ?? [];
      arr.push({ detail, result });
      byModel.set(result.modelId, arr);
    }
  }

  const histories: ModelHistory[] = [];
  for (const [modelId, entries] of byModel) {
    entries.sort((a, b) => (a.detail.startedAt ?? '').localeCompare(b.detail.startedAt ?? ''));
    const nodes = entries.at(-1)?.detail.nodes ?? [];
    const timeline: ModelTimePoint[] = entries.map(({ detail, result }) => {
      const total = result.passCount + result.failCount;
      const credible =
        result.decodeTps.sampleCount >= LOW_SAMPLE_THRESHOLD &&
        !result.caveats.includes('short_output_dominant') &&
        (result.decodeTps.median == null || result.decodeTps.median <= IMPLAUSIBLE_TPS);
      return {
        runId: detail.runId,
        startedAt: detail.startedAt,
        decodeTpsMedian: result.decodeTps.median,
        ttftMedian: result.ttft.median,
        sampleCount: result.decodeTps.sampleCount,
        nodeCount: result.nodeCount,
        skulkVersion: detail.skulkVersion,
        cacheClass: detail.cacheClass,
        passRate: total ? result.passCount / total : 0,
        caveats: result.caveats,
        credible,
      };
    });

    // Headline numbers rest on credible points only: a single-rep wall spike
    // (e.g. a 5-token "415 tok/s") can never set the record.
    const credible = timeline.filter((t) => t.credible && t.decodeTpsMedian != null);
    const typical = median(credible.map((t) => t.decodeTpsMedian as number));
    const latestCredible = credible.at(-1);
    const totalResults = entries.reduce((n, e) => n + e.result.passCount + e.result.failCount, 0);
    const totalPass = entries.reduce((n, e) => n + e.result.passCount, 0);
    const latest = entries.at(-1);
    const nodeCounts = [...new Set(entries.map((e) => e.result.nodeCount).filter((n) => n > 0))].sort(
      (a, b) => a - b,
    );

    histories.push({
      modelId,
      slug: slugify(modelId),
      displayName: displayName(modelId),
      family: familyOf(modelId, nodes),
      runCount: entries.length,
      totalResults,
      passRate: totalResults ? totalPass / totalResults : 0,
      decodeTpsTypical: typical,
      decodeTpsLatest: latestCredible?.decodeTpsMedian ?? null,
      ttftLatestMedian: latestCredible?.ttftMedian ?? null,
      credibleRunCount: credible.length,
      nodeCountsObserved: nodeCounts,
      lastRunAt: latest?.detail.startedAt ?? null,
      caveats: [...new Set(entries.flatMap((e) => e.result.caveats))],
      timeline,
    });
  }
  histories.sort((a, b) => (b.decodeTpsTypical ?? -1) - (a.decodeTpsTypical ?? -1));
  return histories;
}

function buildSuites(details: RunDetail[]): SuiteRollup[] {
  const bySuite = new Map<string, RunDetail[]>();
  for (const detail of details) {
    const arr = bySuite.get(detail.testSet) ?? [];
    arr.push(detail);
    bySuite.set(detail.testSet, arr);
  }
  const suites: SuiteRollup[] = [];
  for (const [testSet, runs] of bySuite) {
    const totalResults = runs.reduce((n, d) => n + d.passCount + d.failCount, 0);
    const totalPass = runs.reduce((n, d) => n + d.passCount, 0);
    const models = new Set(runs.flatMap((d) => d.models.map((m) => m.modelId)));
    const lastRunAt = runs
      .map((d) => d.startedAt)
      .filter((v): v is string => v != null)
      .sort()
      .at(-1);
    suites.push({
      testSet,
      runCount: runs.length,
      modelCount: models.size,
      totalResults,
      passRate: totalResults ? totalPass / totalResults : 0,
      lastRunAt: lastRunAt ?? null,
    });
  }
  suites.sort((a, b) => b.runCount - a.runCount);
  return suites;
}

function toRollup(h: ModelHistory): ModelRollup {
  const { timeline: _t, ...rollup } = h;
  return rollup;
}

// ---- IO --------------------------------------------------------------------

function findReportDirs(runsDir: string): string[] {
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(runsDir, d.name))
    .filter((p) => existsSync(join(p, 'report.json')));
}

function loadReport(dir: string): RawReport | null {
  try {
    const raw = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')) as RawReport;
    if (raw.suite != null || raw.results == null) return null; // skip stability reports
    return raw;
  } catch {
    return null;
  }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

function parseArgs(argv: string[]): { runs: string[]; out: string; redact: boolean } {
  const runs: string[] = [];
  let out = resolve(REPO, 'public/data');
  let redact = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--runs') runs.push(resolve(argv[++i]));
    else if (argv[i] === '--out') out = resolve(argv[++i]);
    else if (argv[i] === '--redact') redact = true;
  }
  if (runs.length === 0) runs.push(resolve(REPO, '../skulk-test-harness/runs'));
  return { runs, out, redact };
}

function main(): void {
  const { runs, out, redact } = parseArgs(process.argv.slice(2));

  const details: RunDetail[] = [];
  for (const runsDir of runs) {
    for (const dir of findReportDirs(runsDir)) {
      const report = loadReport(dir);
      if (report) details.push(buildRunDetail(report, redact));
    }
  }
  details.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));

  const histories = buildModelHistories(details);
  const suites = buildSuites(details);
  const skulkVersions = [
    ...new Set(details.map((d) => d.skulkVersion).filter((v): v is string => v != null)),
  ].sort();

  const index: LedgerIndex = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    // A fixed clock is passed by callers that need determinism; the CLI stamps
    // now. Using an env override keeps the output reproducible in CI if needed.
    generatedAt: process.env.LEDGER_GENERATED_AT ?? new Date().toISOString(),
    runCount: details.length,
    modelCount: histories.length,
    suiteCount: suites.length,
    skulkVersions,
    runs: details.map(toSummary),
    models: histories.map(toRollup),
    suites,
  };

  // Fresh output tree so deleted runs do not linger.
  for (const sub of ['runs', 'models', 'suites']) {
    rmSync(join(out, sub), { recursive: true, force: true });
  }
  writeJson(join(out, 'index.json'), index);
  for (const detail of details) writeJson(join(out, 'runs', `${detail.runId}.json`), detail);
  for (const history of histories) writeJson(join(out, 'models', `${history.slug}.json`), history);

  process.stdout.write(
    `Imported ${details.length} run(s), ${histories.length} model(s), ${suites.length} suite(s)` +
      `${redact ? ' [redacted]' : ''} -> ${out}\n`,
  );
}

main();
