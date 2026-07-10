/**
 * Hardware taxonomy (skulk-open-ledger Phase 1).
 *
 * Maps raw per-node fingerprint facts (accelerator vendor, RAM bytes, and,
 * once the harness records it, accelerator name) to canonical hardware
 * classes and cluster/placement profiles. Lives in the ledger, NOT the
 * harness: the harness captures raw facts, and classification happens at
 * import so a taxonomy fix reclassifies all history on the next bake.
 *
 * Class shape today: `<vendor>-<memoryTier>gb` (e.g. `apple-16gb`,
 * `amd-64gb`). When fingerprints start carrying accelerator names, chip
 * classes (`apple-m4-16gb`, `amd-strix-halo-128gb`) extend this file without
 * a schema change: classes are opaque strings to the site.
 */

import type { HardwareProfile } from '../src/data/schema.ts';

/**
 * Standard memory tiers in GB. Raw readings land near-but-not-on marketing
 * sizes (a 32GB Strix reports ~30GiB usable, a 64GB box ~61GiB), so nodes
 * snap to the nearest tier. Tiers double as an anonymity coarsener for the
 * future field-telemetry tier.
 */
const MEMORY_TIERS_GB = [8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 512];

/** Snap a raw RAM reading to the nearest standard tier (null when unknown). */
export function memoryTierGb(ramTotalBytes: number | null | undefined): number | null {
  if (ramTotalBytes == null || ramTotalBytes <= 0) return null;
  const gb = ramTotalBytes / 2 ** 30;
  let best = MEMORY_TIERS_GB[0];
  for (const tier of MEMORY_TIERS_GB) {
    if (Math.abs(tier - gb) < Math.abs(best - gb)) best = tier;
  }
  return best;
}

/** Canonical class for one node, e.g. `apple-16gb`. `unknown` when unclassifiable. */
export function classifyNode(
  acceleratorVendor: string | null | undefined,
  ramTotalBytes: number | null | undefined,
): string {
  const vendor = acceleratorVendor?.toLowerCase().trim() || null;
  const tier = memoryTierGb(ramTotalBytes);
  if (!vendor && tier == null) return 'unknown';
  if (!vendor) return `unknown-${tier}gb`;
  if (tier == null) return vendor;
  return `${vendor}-${tier}gb`;
}

const VENDOR_LABELS: Record<string, string> = {
  apple: 'Apple',
  amd: 'AMD',
  nvidia: 'NVIDIA',
  intel: 'Intel',
};

/** Human label for one class: `apple-16gb` -> `Apple 16GB`. */
export function classLabel(hardwareClass: string): string {
  if (hardwareClass === 'unknown') return 'unknown';
  const match = /^([a-z]+)(?:-(\d+)gb)?$/.exec(hardwareClass);
  if (!match) return hardwareClass;
  const vendor = VENDOR_LABELS[match[1]] ?? match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return match[2] ? `${vendor} ${match[2]}GB` : vendor;
}

/** The profile used when a run's fingerprint carries no node data. */
export const UNKNOWN_HARDWARE: HardwareProfile = {
  classes: [],
  label: 'unknown hardware',
  nodeCount: 0,
  homogeneous: false,
  known: false,
};

/**
 * Profile for a set of nodes (a cluster, or one placement's node subset).
 * Label counts per class in a stable order, e.g. `2x Apple 16GB + 1x AMD 64GB`.
 */
export function profileOf(
  nodes: { acceleratorVendor: string | null; ramTotalBytes: number | null }[],
): HardwareProfile {
  if (nodes.length === 0) return UNKNOWN_HARDWARE;
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const cls = classifyNode(n.acceleratorVendor, n.ramTotalBytes);
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }
  const classes = [...counts.keys()].sort();
  const label = classes
    .map((cls) => {
      const count = counts.get(cls) ?? 0;
      const base = classLabel(cls);
      return count > 1 ? `${count}x ${base}` : base;
    })
    .join(' + ');
  return {
    classes,
    label,
    nodeCount: nodes.length,
    homogeneous: classes.length === 1,
    known: classes.some((c) => c !== 'unknown'),
  };
}
