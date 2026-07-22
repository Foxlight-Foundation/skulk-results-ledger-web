/** URL/session-backed dashboard time windows. */

export type TimeWindow = 7 | 14 | 30 | 90 | null;
export const DEFAULT_WINDOW: TimeWindow = 30;
export const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: null, label: 'All' },
];

export function windowToParam(window: TimeWindow): string {
  return window == null ? 'all' : String(window);
}

export function windowFromParam(raw: string | null | undefined): TimeWindow {
  if (raw === 'all') return null;
  const parsed = Number(raw);
  return parsed === 7 || parsed === 14 || parsed === 30 || parsed === 90
    ? parsed
    : DEFAULT_WINDOW;
}

export function isWithinWindow(
  startedAt: string | null,
  window: TimeWindow,
  now: number,
): boolean {
  if (window == null || startedAt == null) return true;
  const timestamp = Date.parse(startedAt);
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp <= window * 24 * 60 * 60 * 1000;
}
