/** Pure observation-series selection, summarization, and comparison helpers. */

import type {
  MetricSource,
  PerformanceSeries,
  RunSeriesPoint,
  SeriesSummary,
} from './schema';
import { isWithinWindow, type TimeWindow } from './window';

export interface SeriesContext {
  suiteId: string;
  testName: string;
  protocolId: string;
  source: MetricSource;
}

/** Restore a benchmark context with URL state taking precedence over session fallback. */
export function contextFromSearch(
  params: globalThis.URLSearchParams,
  fallback: SeriesContext | null,
  session: Partial<SeriesContext> = {},
): SeriesContext | null {
  if (fallback == null) return null;
  const requestedSource = params.get('source') ?? session.source ?? fallback.source;
  const source: MetricSource =
    requestedSource === 'engine_reported' || requestedSource === 'client_approx'
      ? requestedSource
      : 'client_exact';
  return {
    suiteId: params.get('suite') ?? session.suiteId ?? fallback.suiteId,
    testName: params.get('test') ?? session.testName ?? fallback.testName,
    protocolId: params.get('protocol') ?? session.protocolId ?? fallback.protocolId,
    source,
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function pointTimestamp(point: RunSeriesPoint): number | null {
  if (point.startedAt == null) return null;
  const parsed = Date.parse(point.startedAt);
  return Number.isNaN(parsed) ? null : parsed;
}

export function pointsInWindow(
  points: RunSeriesPoint[],
  window: TimeWindow,
  now: number,
): RunSeriesPoint[] {
  return points
    .filter((point) => isWithinWindow(point.startedAt, window, now))
    .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
}

export function summarizePoints(
  points: RunSeriesPoint[],
  comparable: boolean,
): SeriesSummary {
  const byRun = new Map<string, RunSeriesPoint>();
  for (const point of points) byRun.set(point.runId, point);
  const distinct = [...byRun.values()].sort((a, b) =>
    (a.startedAt ?? '').localeCompare(b.startedAt ?? ''),
  );
  const values = distinct.map((point) => point.decodeTps);
  const latest = distinct.at(-1) ?? null;
  const mean = values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
  const sampleStandardDeviation =
    mean != null && values.length >= 2
      ? Math.sqrt(
          values.reduce((total, value) => total + (value - mean) ** 2, 0) /
            (values.length - 1),
        )
      : null;
  const coefficientOfVariation =
    mean != null && mean > 0 && sampleStandardDeviation != null
      ? sampleStandardDeviation / mean
      : null;
  const firstTimestamp = distinct.length ? pointTimestamp(distinct[0]) : null;
  const lastTimestamp = latest ? pointTimestamp(latest) : null;
  const spanDays =
    firstTimestamp != null && lastTimestamp != null
      ? (lastTimestamp - firstTimestamp) / (24 * 60 * 60 * 1000)
      : null;

  let status: SeriesSummary['status'] = comparable ? 'Observed' : 'Legacy';
  if (comparable && distinct.length > 0) {
    const newestTen = distinct.slice(-10);
    const tenSummary = summarizeNewestTen(newestTen);
    if (tenSummary.hasLongitudinalEvidence) {
      status = tenSummary.coefficientOfVariation <= 0.1 ? 'Stable' : 'Variable';
    }
  }

  return {
    latestTps: latest?.decodeTps ?? null,
    medianTps: median(values),
    minimumTps: values.length ? Math.min(...values) : null,
    maximumTps: values.length ? Math.max(...values) : null,
    latestTtftS: latest?.ttftS ?? null,
    medianTtftS: median(
      distinct
        .map((point) => point.ttftS)
        .filter((value): value is number => value != null),
    ),
    runCount: distinct.length,
    repetitionCount: distinct.reduce(
      (total, point) => total + point.validRepetitionCount,
      0,
    ),
    meanTps: mean,
    sampleStandardDeviation,
    coefficientOfVariation,
    firstObservedAt: distinct.at(0)?.startedAt ?? null,
    lastObservedAt: latest?.startedAt ?? null,
    spanDays,
    status,
  };
}

function summarizeNewestTen(points: RunSeriesPoint[]): {
  hasLongitudinalEvidence: boolean;
  coefficientOfVariation: number;
} {
  if (points.length < 10) {
    return { hasLongitudinalEvidence: false, coefficientOfVariation: Number.NaN };
  }
  const first = pointTimestamp(points[0]);
  const last = pointTimestamp(points.at(-1) as RunSeriesPoint);
  if (first == null || last == null || last - first < 7 * 24 * 60 * 60 * 1000) {
    return { hasLongitudinalEvidence: false, coefficientOfVariation: Number.NaN };
  }
  const values = points.map((point) => point.decodeTps);
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const standardDeviation = Math.sqrt(
    values.reduce((total, value) => total + (value - mean) ** 2, 0) /
      (values.length - 1),
  );
  return {
    hasLongitudinalEvidence: true,
    coefficientOfVariation: standardDeviation / mean,
  };
}

export function summarizeSeries(
  series: PerformanceSeries,
  window: TimeWindow,
  now: number,
): SeriesSummary {
  return summarizePoints(pointsInWindow(series.points, window, now), series.comparable);
}

/**
 * Choose the latest protocol per suite/test, then choose the context with the
 * widest model-by-exact-hardware coverage. Observation count, recency, and
 * lexical identity break ties in that order.
 */
export function chooseDefaultContext(
  series: PerformanceSeries[],
  window: TimeWindow,
  now: number,
): SeriesContext | null {
  const candidates = series.filter(
    (item) =>
      item.source === 'client_exact' &&
      item.tier === 'foxlight' &&
      item.comparable &&
      item.protocolId != null &&
      pointsInWindow(item.points, window, now).length > 0,
  );
  const latestProtocolByTest = new Map<string, { protocolId: string; newest: string }>();
  for (const item of candidates) {
    const key = `${item.suiteId}\u0000${item.testName}`;
    const newest = pointsInWindow(item.points, window, now).at(-1)?.startedAt ?? '';
    const current = latestProtocolByTest.get(key);
    if (
      current == null ||
      newest > current.newest ||
      (newest === current.newest && (item.protocolId as string) < current.protocolId)
    ) {
      latestProtocolByTest.set(key, {
        protocolId: item.protocolId as string,
        newest,
      });
    }
  }

  const scores = new Map<
    string,
    {
      suiteId: string;
      testName: string;
      protocolId: string;
      coverage: Set<string>;
      observations: number;
      newest: string;
    }
  >();
  for (const item of candidates) {
    const testKey = `${item.suiteId}\u0000${item.testName}`;
    if (latestProtocolByTest.get(testKey)?.protocolId !== item.protocolId) continue;
    const key = `${testKey}\u0000${item.protocolId}`;
    const points = pointsInWindow(item.points, window, now);
    const score = scores.get(key) ?? {
      suiteId: item.suiteId,
      testName: item.testName,
      protocolId: item.protocolId as string,
      coverage: new Set<string>(),
      observations: 0,
      newest: '',
    };
    score.coverage.add(
      `${item.modelId}\u0000${item.hardware.profileId}\u0000${item.resolvedBackends.join(',')}`,
    );
    score.observations += points.length;
    score.newest = [score.newest, ...points.map((point) => point.startedAt ?? '')].sort().at(-1) ?? '';
    scores.set(key, score);
  }

  const winner = [...scores.values()].sort(
    (a, b) =>
      b.coverage.size - a.coverage.size ||
      b.observations - a.observations ||
      b.newest.localeCompare(a.newest) ||
      `${a.suiteId}/${a.testName}`.localeCompare(`${b.suiteId}/${b.testName}`),
  )[0];
  return winner
    ? {
        suiteId: winner.suiteId,
        testName: winner.testName,
        protocolId: winner.protocolId,
        source: 'client_exact',
      }
    : null;
}

export function matchesContext(
  series: PerformanceSeries,
  context: SeriesContext,
): boolean {
  return (
    series.suiteId === context.suiteId &&
    series.testName === context.testName &&
    series.protocolId === context.protocolId &&
    series.source === context.source
  );
}

export interface RunComparisonJoin {
  series: PerformanceSeries;
  baseline: RunSeriesPoint | null;
  candidate: RunSeriesPoint | null;
  percentDelta: number | null;
  comparable: boolean;
  reason: string | null;
}

/** Join two runs only through an identical full series id. */
export function joinRunSeries(
  series: PerformanceSeries[],
  baselineRunId: string,
  candidateRunId: string,
): RunComparisonJoin[] {
  return series.flatMap((item) => {
    const baseline = item.points.find((point) => point.runId === baselineRunId) ?? null;
    const candidate = item.points.find((point) => point.runId === candidateRunId) ?? null;
    if (baseline == null && candidate == null) return [];
    const comparable = item.comparable && baseline != null && candidate != null;
    return [{
      series: item,
      baseline,
      candidate,
      percentDelta:
        comparable && baseline.decodeTps !== 0
          ? ((candidate.decodeTps - baseline.decodeTps) / Math.abs(baseline.decodeTps)) * 100
          : null,
      comparable,
      reason: !item.comparable
        ? 'legacy provenance'
        : baseline == null || candidate == null
          ? 'full series identity absent on one side'
          : null,
    }];
  });
}
