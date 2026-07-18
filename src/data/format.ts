/** Presentation helpers + the caveat vocabulary shared across the UI. */

import type { Caveat, EngineFamily } from './schema';

/** Human metadata for each caveat, so a chip explains itself on hover. */
export const CAVEAT_META: Record<Caveat, { label: string; tone: 'warn' | 'fail' | 'neutral'; description: string }> = {
  low_sample: {
    label: 'low n',
    tone: 'warn',
    description: 'Fewer than 3 timed samples. Treat the number as indicative, not measured.',
  },
  single_rep: {
    label: 'single rep',
    tone: 'neutral',
    description: 'Only one repetition of each test. No within-run variance is captured.',
  },
  short_output_dominant: {
    label: 'short outputs',
    tone: 'warn',
    description:
      'Most outputs were too short to time throughput honestly (a 5-token answer yields a meaningless tok/s). Excluded from the median but flagged here.',
  },
  issue_marked: {
    label: 'has issues',
    tone: 'warn',
    description: 'One or more results recorded a harness issue (warning or error).',
  },
  missing_fingerprint: {
    label: 'no fingerprint',
    tone: 'neutral',
    description:
      'This run predates runtime fingerprints, so its exact Skulk version, node set, and cache state are not recorded.',
  },
  decode_tps_estimated: {
    label: 'throughput estimate',
    tone: 'neutral',
    description:
      "This run couldn't measure a decode window (output tokens over wall minus TTFT) for at least one result -- missing output tokens, a missing or unusable TTFT, or no wall throughput -- so its decode rate falls back to raw whole-request throughput, which folds in prompt/TTFT time.",
  },
  has_failures: {
    label: 'failures',
    tone: 'fail',
    description: 'At least one result in this set failed its assertion.',
  },
};

export const FAMILY_META: Record<EngineFamily, { label: string; color: keyof FamilyColors }> = {
  mlx: { label: 'MLX', color: 'cyan' },
  llama_cpp: { label: 'llama.cpp', color: 'amber' },
  llama_server: { label: 'llama-server', color: 'amber' },
  unknown: { label: 'unknown', color: 'neutral' },
};

interface FamilyColors {
  cyan: string;
  amber: string;
  neutral: string;
}

export function formatTps(value: number | null | undefined): string {
  if (value == null) return '—';
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

export function formatSeconds(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value < 1) return `${(value * 1000).toFixed(0)} ms`;
  return `${value.toFixed(2)} s`;
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  const gib = bytes / 1024 ** 3;
  return `${gib.toFixed(gib >= 100 ? 0 : 1)} GB`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
