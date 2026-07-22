/** Import harness reports into the provenance-first ledger schema 2.0. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
  CacheClass,
  Caveat,
  ConcurrencyCurve,
  ConcurrencyPoint,
  EngineFamily,
  HardwareAttribution,
  HardwareProfile,
  LedgerIndex,
  MetricSource,
  ModelCatalogEntry,
  ModelHistory,
  ObservationExclusionReason,
  PerformanceObservation,
  PerformanceSeries,
  ProvenanceTier,
  RunDetail,
  RunSeriesPoint,
  RunSummary,
  SuiteRollup,
} from '../src/data/schema.ts';
import { LEDGER_SCHEMA_VERSION } from '../src/data/schema.ts';
import { summarizePoints } from '../src/data/series.ts';
import { suiteCatalogEntry } from '../src/data/suite-catalog.ts';
import { nodeMemoryGb, profileOf } from './hardware-taxonomy.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const TEXT_KINDS = new Set(['chat', 'code', 'artifact']);
const SPECIALIZED_NAME = /(tool|cancel|concurr|error|speech|audio|embed|transcri|realtime|vision)/i;
const MINIMUM_DECODE_TOKENS = 20;

export interface RawMetrics {
  elapsed_s?: number | null;
  ttft_s?: number | null;
  chunks?: number | null;
  approx_output_tokens?: number | null;
  wall_tps?: number | null;
  decode_elapsed_s?: number | null;
  observed_decode_tps?: number | null;
  skulk_generation_tps?: number | null;
  skulk_generation_tokens?: number | null;
  concurrency?: number | null;
  aggregate_generation_tps?: number | null;
  per_request_generation_tps_p50?: number | null;
  per_request_generation_tps_p90?: number | null;
  ttft_p50_s?: number | null;
  ttft_p90_s?: number | null;
  concurrent_total_requests?: number | null;
  concurrent_succeeded?: number | null;
  concurrent_failed?: number | null;
}

interface RawIssue {
  severity?: string;
  message?: string;
}

export interface RawResult {
  model_id: string;
  test_name: string;
  kind?: string | null;
  description?: string | null;
  protocol_id?: string | null;
  protocol_family_id?: string | null;
  repetition: number;
  passed: boolean;
  metrics: RawMetrics;
  tool_calls?: unknown[];
  issues?: RawIssue[];
}

interface RawPlacement {
  model_id: string;
  node_ids?: string[];
  resolved_backends?: string[];
  shard_types?: string[];
  sharding?: string | null;
  instance_meta?: string | null;
}

interface RawNode {
  node_id: string;
  friendly_name?: string | null;
  ram_total_bytes?: number | null;
  accelerator_vendor?: string | null;
  accelerator_name?: string | null;
  vram_total_bytes?: number | null;
  gtt_total_bytes?: number | null;
  skulk_version?: string | null;
}

interface RawFingerprint {
  source_context?: {
    run_reason?: string | null;
    operator_note?: string | null;
    repositories?: {
      name: string;
      path?: string | null;
      branch?: string | null;
      commit?: string | null;
    }[];
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

export interface RawReport {
  report_schema_version?: string;
  run_id: string;
  started_at?: string | null;
  finished_at?: string | null;
  spec: {
    model_set: string;
    test_set: string;
    mode: string;
    run_name?: string | null;
  };
  test_set_description?: string | null;
  placements?: RawPlacement[];
  results?: RawResult[];
  issues?: RawIssue[];
  fingerprint?: RawFingerprint | null;
  suite?: string;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function finitePositive(value: number | null | undefined): number | null {
  const parsed = finite(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
}

function displayName(modelId: string): string {
  return modelId.split('/').at(-1) ?? modelId;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function familyOf(modelId: string, backends: string[]): EngineFamily {
  if (backends.some((backend) => backend.startsWith('llama_server'))) return 'llama_server';
  if (backends.some((backend) => backend.startsWith('llama_cpp'))) return 'llama_cpp';
  if (backends.some((backend) => backend.startsWith('mlx'))) return 'mlx';
  const lower = modelId.toLowerCase();
  if (lower.includes('gguf')) return 'llama_cpp';
  if (lower.includes('mlx')) return 'mlx';
  return 'unknown';
}

function textEligibility(result: RawResult): { text: boolean; kindRecorded: boolean } {
  if (result.kind != null) {
    return { text: TEXT_KINDS.has(result.kind), kindRecorded: true };
  }
  const metrics = result.metrics;
  const safeLegacyText =
    !SPECIALIZED_NAME.test(result.test_name) &&
    (result.tool_calls?.length ?? 0) === 0 &&
    metrics.concurrency == null &&
    finite(metrics.chunks) != null &&
    (metrics.chunks as number) >= 2 &&
    finitePositive(metrics.ttft_s) != null &&
    finitePositive(metrics.elapsed_s) != null;
  return { text: safeLegacyText, kindRecorded: false };
}

function sourceMeasurement(
  result: RawResult,
  source: MetricSource,
): {
  value: number | null;
  decodeElapsedS: number | null;
  reasons: ObservationExclusionReason[];
} {
  const metrics = result.metrics;
  const reasons: ObservationExclusionReason[] = [];
  const eligibility = textEligibility(result);
  if (!eligibility.text) reasons.push('non_text_workload');
  if (!result.passed) reasons.push('failed_result');

  let value: number | null = null;
  let decodeElapsedS = finitePositive(metrics.decode_elapsed_s);
  if (source === 'client_exact') {
    const exactTokens = finitePositive(metrics.skulk_generation_tokens);
    if (decodeElapsedS == null) {
      const elapsed = finitePositive(metrics.elapsed_s);
      const ttft = finite(metrics.ttft_s);
      if (elapsed != null && ttft != null && elapsed > ttft) decodeElapsedS = elapsed - ttft;
    }
    if (exactTokens != null && decodeElapsedS != null) value = exactTokens / decodeElapsedS;
    if (exactTokens == null || decodeElapsedS == null) reasons.push('missing_stream_interval');
    if ((finite(metrics.chunks) ?? 0) < 2) reasons.push('insufficient_stream_chunks');
    if (exactTokens != null && exactTokens < MINIMUM_DECODE_TOKENS) {
      reasons.push('short_exact_output');
    }
  } else if (source === 'engine_reported') {
    value = metrics.skulk_generation_tps ?? null;
    const exactTokens = finitePositive(metrics.skulk_generation_tokens);
    if (exactTokens == null) {
      reasons.push('missing_exact_output');
    } else if (exactTokens < MINIMUM_DECODE_TOKENS) {
      reasons.push('short_exact_output');
    }
  } else {
    value = metrics.wall_tps ?? null;
    const approximateTokens = finite(metrics.approx_output_tokens);
    if (approximateTokens == null) {
      reasons.push('missing_approximate_output');
    } else if (approximateTokens < MINIMUM_DECODE_TOKENS) {
      reasons.push('short_approximate_output');
    }
  }

  if (value == null) reasons.push('missing_metric');
  else if (typeof value !== 'number' || !Number.isFinite(value)) reasons.push('non_finite_metric');
  else if (value <= 0) reasons.push('non_positive_metric');
  return { value, decodeElapsedS, reasons: [...new Set(reasons)] };
}

function concurrencyPoint(result: RawResult): ConcurrencyPoint | null {
  const concurrency = finitePositive(result.metrics.concurrency);
  if (concurrency == null) return null;
  return {
    concurrency,
    aggregateTps: finite(result.metrics.aggregate_generation_tps),
    perRequestTpsP50: finite(result.metrics.per_request_generation_tps_p50),
    perRequestTpsP90: finite(result.metrics.per_request_generation_tps_p90),
    ttftP50S: finite(result.metrics.ttft_p50_s),
    ttftP90S: finite(result.metrics.ttft_p90_s),
    totalRequests: finite(result.metrics.concurrent_total_requests),
    succeeded: finite(result.metrics.concurrent_succeeded),
    failed: finite(result.metrics.concurrent_failed),
  };
}

function seriesIdentity(observation: PerformanceObservation): Omit<PerformanceSeries, 'points' | 'summary'> {
  const identity = {
    modelId: observation.modelId,
    tier: observation.tier,
    suiteId: observation.suiteId,
    testName: observation.testName,
    protocolId: observation.protocolId,
    source: observation.source,
    hardwareProfileId: observation.hardware.profileId,
    hardwareAttribution: observation.hardwareAttribution,
    resolvedBackends: observation.resolvedBackends,
    instanceType: observation.instanceType,
    sharding: observation.sharding,
    shardTypes: observation.shardTypes,
  };
  return {
    seriesId: hash(identity),
    modelId: observation.modelId,
    slug: slugify(observation.modelId),
    displayName: displayName(observation.modelId),
    family: familyOf(observation.modelId, observation.resolvedBackends),
    tier: observation.tier,
    suiteId: observation.suiteId,
    testName: observation.testName,
    testKind: observation.testKind,
    testDescription: observation.testDescription,
    protocolId: observation.protocolId,
    protocolFamilyId: observation.protocolFamilyId,
    source: observation.source,
    hardware: observation.hardware,
    hardwareAttribution: observation.hardwareAttribution,
    resolvedBackends: observation.resolvedBackends,
    instanceType: observation.instanceType,
    sharding: observation.sharding,
    shardTypes: observation.shardTypes,
    comparable: observation.comparable,
  };
}

export function buildRunDetail(
  report: RawReport,
  redact: boolean,
  tier: ProvenanceTier = 'foxlight',
  submitter: string | null = null,
): RunDetail {
  const fingerprint = report.fingerprint;
  const rawNodes = fingerprint?.cluster?.nodes ?? [];
  const nodes = rawNodes.map((node) => ({
    nodeId: node.node_id,
    friendlyName: node.friendly_name ?? null,
    ramTotalBytes: finite(node.ram_total_bytes),
    acceleratorVendor: node.accelerator_vendor ?? null,
    acceleratorName: node.accelerator_name ?? null,
    vramTotalBytes: finite(node.vram_total_bytes),
    gttTotalBytes: finite(node.gtt_total_bytes),
    memoryGb: nodeMemoryGb(
      node.accelerator_vendor ?? null,
      finite(node.ram_total_bytes),
      node.accelerator_name,
      {
        vramTotalBytes: finite(node.vram_total_bytes),
        gttTotalBytes: finite(node.gtt_total_bytes),
        trustApuFallback: tier === 'foxlight',
      },
    ),
    skulkVersion: node.skulk_version ?? null,
  }));
  const clusterHardware = profileOf(nodes, tier === 'foxlight');
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  const placementByModel = new Map(
    (report.placements ?? []).map((placement) => [placement.model_id, placement]),
  );

  function executionProfile(modelId: string): {
    hardware: HardwareProfile;
    attribution: HardwareAttribution;
    placement: RawPlacement | null;
  } {
    const placement = placementByModel.get(modelId) ?? null;
    if (placement?.node_ids?.length) {
      const placementNodes = placement.node_ids
        .map((nodeId) => nodesById.get(nodeId))
        .filter((node): node is (typeof nodes)[number] => node != null);
      if (placementNodes.length === placement.node_ids.length) {
        return {
          hardware: profileOf(placementNodes, tier === 'foxlight'),
          attribution: 'placement',
          placement,
        };
      }
    }
    return {
      hardware: clusterHardware,
      attribution: clusterHardware.known ? 'cluster' : 'unknown',
      placement,
    };
  }

  const observations: PerformanceObservation[] = [];
  const concurrencyGroups = new Map<string, { curve: ConcurrencyCurve; points: ConcurrencyPoint[] }>();
  const publishableModelIds = new Set<string>();
  for (const result of report.results ?? []) {
    const profile = executionProfile(result.model_id);
    if (!profile.hardware.known || profile.hardware.profileId == null) continue;
    publishableModelIds.add(result.model_id);
    const resolvedBackends = [...new Set(profile.placement?.resolved_backends ?? [])].sort();
    const shardTypes = [...new Set(profile.placement?.shard_types ?? [])].sort();
    const instanceType = profile.placement?.instance_meta ?? null;
    const sharding = profile.placement?.sharding ?? null;
    const eligibility = textEligibility(result);
    const comparable = Boolean(
      eligibility.kindRecorded &&
        result.protocol_id &&
        profile.attribution === 'placement' &&
        resolvedBackends.length > 0 &&
        instanceType &&
        sharding &&
        shardTypes.length > 0,
    );

    for (const source of ['client_exact', 'engine_reported', 'client_approx'] as const) {
      const measurement = sourceMeasurement(result, source);
      const ttft = finite(result.metrics.ttft_s);
      const validTtft =
        eligibility.text && result.passed && ttft != null && Number.isFinite(ttft) && ttft >= 0;
      observations.push({
        observationId: hash([report.run_id, result.model_id, result.test_name, result.repetition, source]),
        runId: report.run_id,
        startedAt: report.started_at ?? null,
        modelId: result.model_id,
        suiteId: report.spec.test_set,
        testName: result.test_name,
        testKind: result.kind ?? null,
        testDescription: result.description ?? '',
        repetition: result.repetition,
        passed: result.passed,
        protocolId: result.protocol_id ?? null,
        protocolFamilyId: result.protocol_family_id ?? null,
        source,
        decodeTps: measurement.value,
        ttftS: ttft,
        elapsedS: finite(result.metrics.elapsed_s),
        decodeElapsedS: measurement.decodeElapsedS,
        exactGeneratedTokens: finite(result.metrics.skulk_generation_tokens),
        approximateGeneratedTokens: finite(result.metrics.approx_output_tokens),
        chunks: finite(result.metrics.chunks),
        validDecode: measurement.reasons.length === 0,
        validTtft,
        exclusionReasons: measurement.reasons,
        hardware: profile.hardware,
        hardwareAttribution: profile.attribution,
        resolvedBackends,
        instanceType,
        sharding,
        shardTypes,
        tier,
        submitter,
        skulkVersion: fingerprint?.runtime?.skulk_version ?? null,
        skulkCommit: fingerprint?.runtime?.skulk_commit ?? null,
        issueCount: result.issues?.length ?? 0,
        comparable,
      });
    }

    const point = concurrencyPoint(result);
    if (point != null) {
      const curveIdentity = {
        modelId: result.model_id,
        testName: result.test_name,
        protocolFamilyId: result.protocol_family_id ?? null,
        hardwareProfileId: profile.hardware.profileId,
        resolvedBackends,
        instanceType,
        sharding,
        shardTypes,
        tier,
      };
      const key = hash(curveIdentity);
      const group = concurrencyGroups.get(key) ?? {
        curve: {
          runId: report.run_id,
          startedAt: report.started_at ?? null,
          modelId: result.model_id,
          testName: result.test_name,
          protocolFamilyId: result.protocol_family_id ?? null,
          hardware: profile.hardware,
          resolvedBackends,
          instanceType,
          sharding,
          shardTypes,
          tier,
          points: [],
        },
        points: [],
      };
      group.points.push(point);
      concurrencyGroups.set(key, group);
    }
  }

  const publishableResults = (report.results ?? []).filter((result) =>
    publishableModelIds.has(result.model_id),
  );
  const passCount = publishableResults.filter((result) => result.passed).length;
  const failCount = publishableResults.length - passCount;
  const issueCount =
    (report.issues?.length ?? 0) +
    publishableResults.reduce((total, result) => total + (result.issues?.length ?? 0), 0);
  const caveats: Caveat[] = [];
  if (fingerprint == null) caveats.push('missing_fingerprint');
  if (issueCount > 0) caveats.push('issue_marked');
  if (failCount > 0) caveats.push('has_failures');
  if (observations.some((observation) => !observation.comparable)) {
    caveats.push('legacy_provenance');
  }

  return {
    runId: report.run_id,
    startedAt: report.started_at ?? null,
    finishedAt: report.finished_at ?? null,
    mode: report.spec.mode,
    modelSet: report.spec.model_set,
    testSet: report.spec.test_set,
    testSetDescription:
      typeof report.test_set_description === 'string' ? report.test_set_description : '',
    runName: redact ? null : report.spec.run_name ?? null,
    passCount,
    failCount,
    issueCount,
    modelCount: publishableModelIds.size,
    nodeCount: fingerprint?.cluster?.node_count ?? nodes.length,
    topologyLabel: fingerprint?.cluster?.topology_label ?? null,
    skulkVersion: fingerprint?.runtime?.skulk_version ?? null,
    skulkCommit: fingerprint?.runtime?.skulk_commit ?? null,
    cacheClass: fingerprint?.cache_state?.classification ?? 'unknown',
    hasFingerprint: fingerprint != null,
    runReason: fingerprint?.source_context?.run_reason ?? null,
    caveats,
    hardware: clusterHardware,
    tier,
    submitter,
    nodes: redact
      ? nodes.map((node) => ({
          ...node,
          friendlyName: null,
          nodeId: hash(node.nodeId).slice(0, 10),
        }))
      : nodes,
    apiBaseUrl: redact ? null : fingerprint?.cluster?.api_base_url ?? null,
    repositories: (fingerprint?.source_context?.repositories ?? []).map((repository) => ({
      name: repository.name,
      branch: repository.branch ?? null,
      commit: repository.commit ?? null,
    })),
    harnessPackages: fingerprint?.runtime?.harness_packages ?? {},
    python: fingerprint?.runtime?.python ?? null,
    platform: fingerprint?.runtime?.platform ?? null,
    observations,
    concurrencyCurves: [...concurrencyGroups.values()].map(({ curve, points }) => ({
      ...curve,
      points: points.sort((a, b) => a.concurrency - b.concurrency),
    })),
    issues: [
      ...(report.issues ?? []),
      ...publishableResults.flatMap((result) => result.issues ?? []),
    ].map((issue) => ({
      severity: issue.severity ?? 'info',
      message: issue.message ?? '',
    })),
  };
}

function toSummary(detail: RunDetail): RunSummary {
  const {
    testSetDescription: _description,
    nodes: _nodes,
    apiBaseUrl: _api,
    repositories: _repositories,
    harnessPackages: _packages,
    python: _python,
    platform: _platform,
    observations: _observations,
    concurrencyCurves: _curves,
    issues: _issues,
    ...summary
  } = detail;
  return summary;
}

export function buildSeries(details: RunDetail[]): PerformanceSeries[] {
  const groups = new Map<
    string,
    { identity: Omit<PerformanceSeries, 'points' | 'summary'>; observations: PerformanceObservation[] }
  >();
  for (const detail of details) {
    for (const observation of detail.observations) {
      if (!observation.validDecode || !TEXT_KINDS.has(observation.testKind ?? '')) {
        if (!(observation.validDecode && observation.testKind == null)) continue;
      }
      const identity = seriesIdentity(observation);
      const group = groups.get(identity.seriesId) ?? { identity, observations: [] };
      group.observations.push(observation);
      groups.set(identity.seriesId, group);
    }
  }

  const series: PerformanceSeries[] = [];
  for (const group of groups.values()) {
    const byRun = new Map<string, PerformanceObservation[]>();
    for (const observation of group.observations) {
      const values = byRun.get(observation.runId) ?? [];
      values.push(observation);
      byRun.set(observation.runId, values);
    }
    const points: RunSeriesPoint[] = [];
    for (const [runId, observations] of byRun) {
      const valid = observations.filter(
        (observation) => observation.validDecode && observation.decodeTps != null,
      );
      const decodeTps = median(valid.map((observation) => observation.decodeTps as number));
      if (decodeTps == null) continue;
      const ttftS = median(
        observations
          .filter((observation) => observation.validTtft && observation.ttftS != null)
          .map((observation) => observation.ttftS as number),
      );
      const first = observations[0];
      points.push({
        runId,
        startedAt: first.startedAt,
        decodeTps,
        ttftS,
        repetitionCount: observations.length,
        validRepetitionCount: valid.length,
        skulkVersion: first.skulkVersion,
        skulkCommit: first.skulkCommit,
      });
    }
    points.sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
    series.push({
      ...group.identity,
      points,
      summary: summarizePoints(points, group.identity.comparable),
    });
  }
  series.sort((a, b) =>
    [a.modelId, a.suiteId, a.testName, a.source, a.seriesId]
      .join('\u0000')
      .localeCompare([b.modelId, b.suiteId, b.testName, b.source, b.seriesId].join('\u0000')),
  );
  return series;
}

function buildSuites(details: RunDetail[]): SuiteRollup[] {
  const bySuite = new Map<string, RunDetail[]>();
  for (const detail of details) {
    const values = bySuite.get(detail.testSet) ?? [];
    values.push(detail);
    bySuite.set(detail.testSet, values);
  }
  return [...bySuite.entries()]
    .map(([testSet, runs]) => {
      const totalResults = runs.reduce((total, run) => total + run.passCount + run.failCount, 0);
      const passes = runs.reduce((total, run) => total + run.passCount, 0);
      const models = new Set(runs.flatMap((run) => run.observations.map((item) => item.modelId)));
      const catalog = suiteCatalogEntry(testSet);
      const reportDescription = runs
        .map((run) => run.testSetDescription.trim())
        .filter(Boolean)
        .at(-1);
      return {
        testSet,
        runCount: runs.length,
        modelCount: models.size,
        totalResults,
        passRate: totalResults ? passes / totalResults : 0,
        lastRunAt:
          runs.map((run) => run.startedAt).filter((value): value is string => value != null).sort().at(-1) ?? null,
        title: catalog?.title ?? null,
        description: reportDescription ?? catalog?.blurb ?? null,
        measures: catalog?.measures ?? null,
        category: catalog?.category ?? null,
      };
    })
    .sort((a, b) => b.runCount - a.runCount);
}

function modelCatalog(details: RunDetail[], series: PerformanceSeries[]): ModelCatalogEntry[] {
  const modelIds = new Set([
    ...series.map((item) => item.modelId),
    ...details.flatMap((detail) => detail.observations.map((item) => item.modelId)),
    ...details.flatMap((detail) => detail.concurrencyCurves.map((item) => item.modelId)),
  ]);
  return [...modelIds]
    .map((modelId) => {
      const modelSeries =
        series.find(
          (item) => item.modelId === modelId && item.comparable && item.family !== 'unknown',
        ) ?? series.find((item) => item.modelId === modelId && item.family !== 'unknown');
      return {
        modelId,
        slug: slugify(modelId),
        displayName: displayName(modelId),
        family: modelSeries?.family ?? familyOf(modelId, []),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function collectReportFiles(sourceDir: string): string[] {
  if (!existsSync(sourceDir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const nested = join(sourceDir, entry.name, 'report.json');
      if (existsSync(nested)) files.push(nested);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(join(sourceDir, entry.name));
    }
  }
  return files;
}

function loadReportFile(file: string): RawReport | null {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as RawReport;
    if (raw.suite != null || raw.results == null) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data));
}

export interface ImportOptions {
  runs: string[];
  community: string | null;
  out: string;
  redact: boolean;
}

export function parseArgs(argv: string[]): ImportOptions {
  const runs: string[] = [];
  let out = resolve(REPO, 'public/data');
  let redact = false;
  let community: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--runs') runs.push(resolve(argv[++index]));
    else if (argv[index] === '--community') community = resolve(argv[++index]);
    else if (argv[index] === '--out') out = resolve(argv[++index]);
    else if (argv[index] === '--redact') redact = true;
  }
  if (runs.length === 0) runs.push(resolve(REPO, '../skulk-test-harness/runs'));
  return { runs, community, out, redact };
}

export function runImport({ runs, community, out, redact }: ImportOptions): string {
  const details: RunDetail[] = [];
  const seen = new Set<string>();
  let omittedWithoutCompleteHardware = 0;

  function importSource(
    source: string,
    tier: ProvenanceTier,
    manifest: Record<string, { submitter?: string }> = {},
  ): void {
    for (const file of collectReportFiles(source)) {
      const report = loadReportFile(file);
      if (report == null || seen.has(report.run_id)) continue;
      seen.add(report.run_id);
      const detail = buildRunDetail(
        report,
        redact,
        tier,
        tier === 'community' ? manifest[report.run_id]?.submitter ?? 'unknown' : null,
      );
      if (!detail.hardware.known) {
        omittedWithoutCompleteHardware += 1;
        continue;
      }
      details.push(detail);
    }
  }

  for (const runsDirectory of runs) importSource(runsDirectory, 'foxlight');
  if (community != null) {
    let manifest: Record<string, { submitter?: string }> = {};
    try {
      manifest = JSON.parse(readFileSync(join(community, 'manifest.json'), 'utf8'));
    } catch {
      manifest = {};
    }
    importSource(join(community, 'reports'), 'community', manifest);
  }

  details.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  const series = buildSeries(details);
  const models = modelCatalog(details, series);
  const suites = buildSuites(details);
  const index: LedgerIndex = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    generatedAt: process.env.LEDGER_GENERATED_AT ?? new Date().toISOString(),
    runCount: details.length,
    modelCount: models.length,
    suiteCount: suites.length,
    skulkVersions: [
      ...new Set(details.map((detail) => detail.skulkVersion).filter((value): value is string => value != null)),
    ].sort(),
    hardwareLabels: [
      ...new Set(series.filter((item) => item.hardware.known).map((item) => item.hardware.label)),
    ].sort(),
    backends: [...new Set(series.flatMap((item) => item.resolvedBackends))].sort(),
    runs: details.map(toSummary),
    models,
    series,
    suites,
  };

  for (const subdirectory of ['runs', 'models', 'suites']) {
    rmSync(join(out, subdirectory), { recursive: true, force: true });
  }
  writeJson(join(out, 'index.json'), index);
  for (const detail of details) {
    writeJson(join(out, 'runs', `${detail.runId}.json`), detail);
  }
  for (const model of models) {
    const history: ModelHistory = {
      ...model,
      series: series.filter((item) => item.modelId === model.modelId),
      concurrencyCurves: details.flatMap((detail) =>
        detail.concurrencyCurves.filter((curve) => curve.modelId === model.modelId),
      ),
    };
    writeJson(join(out, 'models', `${model.slug}.json`), history);
  }

  return (
    `Imported ${details.length} run(s), ${models.length} model(s), ${suites.length} suite(s)` +
    `; emitted ${series.length} performance series` +
    `; omitted ${omittedWithoutCompleteHardware} run(s) without complete hardware` +
    `${redact ? ' [redacted]' : ''} -> ${out}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${runImport(parseArgs(process.argv.slice(2)))}\n`);
}
