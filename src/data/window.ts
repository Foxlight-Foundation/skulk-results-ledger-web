/**
 * Client-side time-window re-aggregation (open-ledger time filter).
 *
 * The baked index carries all-time headline medians plus a compact
 * `windowPoints` array per model (see schema.ts `WindowPoint`). To show
 * numbers for a selected window (last 7/14/30/90 days, or all time), the site
 * re-aggregates those points here using the SAME rules the importer uses so a
 * windowed number is directly comparable to the baked all-time one:
 *
 *   - headline throughput = median across CREDIBLE per-run medians;
 *   - only tier `foxlight` points feed headline/cell numbers (tiers never
 *     blend); community points are counted separately;
 *   - a null timestamp is treated as always-in-window (pre-timestamp history is
 *     never hidden by a filter).
 *
 * The window bounds throughput honesty: a stale run on old code or a degraded
 * fleet cannot drag the "current" median once the window moves past it.
 */

import type {
  HardwareCell,
  ModelRollup,
  WindowPoint,
} from './schema';

/** A selected window in days, or `null` for all-time. */
export type TimeWindow = 7 | 14 | 30 | 90 | null;

/** The default window: recent enough to reflect current code/fleet, wide
 * enough that most model cells still have samples. */
export const DEFAULT_WINDOW: TimeWindow = 30;

/** Segmented-control options in display order. */
export const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: null, label: 'All' },
];

/** Serialize/parse a window for URL/localStorage persistence. */
export function windowToParam(w: TimeWindow): string {
  return w == null ? 'all' : String(w);
}
export function windowFromParam(raw: string | null | undefined): TimeWindow {
  if (raw === 'all') return null;
  const n = Number(raw);
  return n === 7 || n === 14 || n === 30 || n === 90 ? n : DEFAULT_WINDOW;
}

/** True when a point's timestamp falls in the window (null = always in). */
export function isWithinWindow(
  startedAt: string | null,
  window: TimeWindow,
  now: number,
): boolean {
  if (window == null || startedAt == null) return true;
  const t = Date.parse(startedAt);
  if (Number.isNaN(t)) return true; // unparseable timestamp: never hide it
  return now - t <= window * 24 * 60 * 60 * 1000;
}

/** Median of a numeric list (importer parity), or null when empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** A model rollup's headline numbers recomputed for one window. */
export interface WindowedRollup {
  /** Points that fell inside the window. */
  runCountInWindow: number;
  /** Credible foxlight points in the window (headline sample base). */
  credibleRunCount: number;
  /** Median across credible foxlight per-run medians in the window. */
  decodeTpsTypical: number | null;
  /** Most-recent credible foxlight point's decode median in the window. */
  decodeTpsLatest: number | null;
  /** Most-recent credible foxlight point's TTFT median in the window. */
  ttftLatestMedian: number | null;
  /** Community points in the window (kept separate from headline). */
  communityRunCount: number;
  /** Pass rate across all results in the window (importer parity: every point,
   * both tiers), 0 when the window has no results. */
  passRate: number;
  /** True when any run in the window had a failed result. Lets a windowed view
   * recompute the `has_failures` caveat instead of carrying the all-time one,
   * which would otherwise contradict a windowed 100% pass rate. */
  hasFailuresInWindow: boolean;
  /** Per-hardware cells recomputed for the window (foxlight, credible). */
  hardwareCells: HardwareCell[];
  /** False when NO points fell in the window: the row should be hidden, and
   * the absence is bound to the selected period (not "never tested"). */
  hasWindowData: boolean;
}

function foxlightCredible(points: WindowPoint[]): WindowPoint[] {
  return points.filter(
    (p) => p.tier === 'foxlight' && p.credible && p.decodeTpsMedian != null,
  );
}

/** Recompute one model rollup's headline + hardware cells for a window. */
export function windowRollup(
  rollup: ModelRollup,
  window: TimeWindow,
  now: number,
): WindowedRollup {
  const inWindow = rollup.windowPoints.filter((p) =>
    isWithinWindow(p.startedAt, window, now),
  );
  const foxlight = foxlightCredible(inWindow);
  const typical = median(foxlight.map((p) => p.decodeTpsMedian as number));
  const latest = foxlight.at(-1);

  const byHardware = new Map<string, WindowPoint[]>();
  for (const p of inWindow) {
    if (p.tier !== 'foxlight') continue;
    const arr = byHardware.get(p.hardwareLabel) ?? [];
    arr.push(p);
    byHardware.set(p.hardwareLabel, arr);
  }
  const hardwareCells: HardwareCell[] = [...byHardware.entries()]
    .map(([label, cells]): HardwareCell => {
      const credible = cells.filter((c) => c.credible && c.decodeTpsMedian != null);
      const lastRunAt =
        cells
          .map((c) => c.startedAt)
          .filter((v): v is string => v != null)
          .sort()
          .at(-1) ?? null;
      const cellResults = cells.reduce((n, c) => n + c.passCount + c.failCount, 0);
      const cellPass = cells.reduce((n, c) => n + c.passCount, 0);
      return {
        label,
        classes: cells[0].hardwareClasses,
        runCount: cells.length,
        credibleRunCount: credible.length,
        decodeTpsTypical: median(credible.map((c) => c.decodeTpsMedian as number)),
        passRate: cellResults ? cellPass / cellResults : 0,
        lastRunAt,
        clusterAttributedRunCount: cells.filter((c) => c.clusterAttributed).length,
      };
    })
    .sort((a, b) => b.runCount - a.runCount);

  // Model-level pass rate mirrors the importer: summed across every point in
  // the window (both tiers), not just the credible foxlight headline base.
  const totalResults = inWindow.reduce((n, p) => n + p.passCount + p.failCount, 0);
  const totalPass = inWindow.reduce((n, p) => n + p.passCount, 0);

  return {
    runCountInWindow: inWindow.length,
    credibleRunCount: foxlight.length,
    decodeTpsTypical: typical,
    decodeTpsLatest: latest?.decodeTpsMedian ?? null,
    ttftLatestMedian: latest?.ttftMedian ?? null,
    communityRunCount: inWindow.filter((p) => p.tier === 'community').length,
    passRate: totalResults ? totalPass / totalResults : 0,
    hasFailuresInWindow: totalResults - totalPass > 0,
    hardwareCells,
    hasWindowData: inWindow.length > 0,
  };
}
