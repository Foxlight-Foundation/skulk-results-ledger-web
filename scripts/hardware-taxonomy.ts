/**
 * Hardware taxonomy (skulk-open-ledger Phase 1).
 *
 * Maps raw per-node fingerprint facts (accelerator vendor, RAM bytes, and,
 * once the harness records it, accelerator name) to canonical hardware
 * classes and cluster/placement profiles. Lives in the ledger, NOT the
 * harness: the harness captures raw facts, and classification happens at
 * import so a taxonomy fix reclassifies all history on the next bake.
 *
 * Class shapes: `<vendor>-<memoryTier>gb` (e.g. `apple-16gb`, `amd-64gb`) for
 * unified-memory nodes where host RAM IS the accelerator memory, and
 * `<vendor>-<chip>-<vramGb>gb` (e.g. `nvidia-a40-48gb`) for discrete-GPU
 * nodes, where tiering by host RAM would be misleading (a rented A40 box can
 * report 500GB of host RAM around a 48GB GPU). Classes are opaque strings to
 * the site, so new shapes extend this file without a schema change.
 */

import type { HardwareProfile } from '../src/data/schema.ts';

/**
 * Standard memory tiers in GB. Raw readings land near-but-not-on marketing
 * sizes (an APU's unified capacity comes out at e.g. ~125GiB for a 128GB
 * Strix after adding the carve back, and Apple nodes report binary GiB), so
 * nodes snap to the nearest tier. Tiers double as an anonymity coarsener for
 * the future field-telemetry tier.
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

/**
 * Vendors whose accelerator memory is separate from host RAM. For these,
 * RAM-based tiers are wrong (host RAM says nothing about the GPU), so nodes
 * classify via the known-chip table below or fall back to vendor-only. Apple
 * and AMD stay on RAM tiers: every AMD node in the fleet today is a
 * unified-memory APU (Strix Halo); if discrete Radeons ever appear they get
 * entries in the chip table and this set.
 */
const DISCRETE_GPU_VENDORS = new Set(['nvidia', 'intel']);

/**
 * Known discrete GPUs by normalized fingerprint `accelerator_name`
 * (lowercased, collapsed whitespace). VRAM is the marketing size; extend this
 * table as new GPUs show up in fingerprints. Classification happens at
 * import, so adding an entry reclassifies all history on the next bake.
 */
const KNOWN_DISCRETE_GPUS: Record<string, { chip: string; vramGb: number }> = {
  'nvidia a40': { chip: 'a40', vramGb: 48 },
  'nvidia a100 80gb pcie': { chip: 'a100', vramGb: 80 },
  'nvidia a100-sxm4-80gb': { chip: 'a100', vramGb: 80 },
  'nvidia h100 80gb hbm3': { chip: 'h100', vramGb: 80 },
  'nvidia h100 pcie': { chip: 'h100', vramGb: 80 },
  'nvidia h100 nvl': { chip: 'h100', vramGb: 94 },
};

/** Coerce a raw byte field to a positive finite number, or null. Community
 *  submissions are only structurally gated (node_id), so a byte field can
 *  arrive as a numeric STRING; without this, `ram + carve` would concatenate
 *  strings ("64..." + "64...") and mis-tier the node as a giant. */
function positiveFiniteBytes(value: number | null | undefined): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Per-node memory signals used to resolve a unified APU's true capacity. */
interface NodeMemorySignals {
  vramTotalBytes?: number | null;
  gttTotalBytes?: number | null;
  /**
   * Whether to trust the fleet-calibrated carve estimate for an AMD node that
   * carries no positive APU signal. True only for our own (foxlight) reports,
   * where every AMD node is a known Strix APU; false for untrusted community
   * submissions, where an AMD host could be a discrete-GPU box whose host RAM is
   * not accelerator memory and must not be doubled.
   */
  trustApuFallback?: boolean;
}

/**
 * True unified-memory capacity in bytes for a node that snaps to a RAM tier.
 *
 * On an AMD APU (Strix Halo) the OS-visible RAM is only the slice left after the
 * BIOS carves a VRAM region out of the SAME physical DIMMs, so `ram_total` alone
 * understates the machine: a 128GB box with a 64GB carve reports ~61GiB. The GPU
 * addresses the carve PLUS system RAM, so the honest capacity is `ram + carve`.
 *
 * A node is treated as a unified APU when `gtt_total >= ram_total` (the GPU can
 * map system RAM -- the same test Skulk's placement uses); that holds for any
 * provenance tier, so a community Strix classifies correctly and a community
 * discrete-GPU host (small GTT) does not. When the fingerprint predates the
 * vram/gtt fields there is no signal, so the carve estimate (carve ~= system
 * RAM, i.e. total ~= 2x) is applied ONLY for trusted foxlight reports; untrusted
 * AMD nodes fall through to the plain RAM reading rather than a doubled guess.
 * Apple is already full unified RAM with no carve; discrete GPUs never reach here.
 */
export function unifiedCapacityBytes(
  vendor: string | null,
  ramTotalBytes: number | null | undefined,
  mem: NodeMemorySignals,
): number | null {
  const ram = positiveFiniteBytes(ramTotalBytes);
  if (ram == null) return null;
  if (vendor !== 'amd') return ram;
  const vram = positiveFiniteBytes(mem.vramTotalBytes);
  const gtt = positiveFiniteBytes(mem.gttTotalBytes);
  const isUnifiedApu = gtt != null && gtt >= ram;
  if (isUnifiedApu) return ram + (vram ?? ram);
  if (mem.trustApuFallback) return ram + (vram ?? ram);
  return ram;
}

/** Canonical class for one node, e.g. `apple-16gb` or `nvidia-a40-48gb`. */
export function classifyNode(
  acceleratorVendor: string | null | undefined,
  ramTotalBytes: number | null | undefined,
  acceleratorName?: string | null,
  mem: NodeMemorySignals = {},
): string {
  const vendor = acceleratorVendor?.toLowerCase().trim() || null;
  if (vendor && DISCRETE_GPU_VENDORS.has(vendor)) {
    const normalized = acceleratorName?.toLowerCase().trim().replace(/\s+/g, ' ') || null;
    const known = normalized ? KNOWN_DISCRETE_GPUS[normalized] : undefined;
    if (known) return `${vendor}-${known.chip}-${known.vramGb}gb`;
    // Unknown chip: vendor-only beats a host-RAM tier that misstates the GPU.
    return vendor;
  }
  const tier = memoryTierGb(unifiedCapacityBytes(vendor, ramTotalBytes, mem));
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

/** Human label for one class: `apple-16gb` -> `Apple 16GB`, `nvidia-a40-48gb` -> `NVIDIA A40 48GB`. */
export function classLabel(hardwareClass: string): string {
  if (hardwareClass === 'unknown') return 'unknown';
  const chipMatch = /^([a-z]+)-([a-z0-9]+)-(\d+)gb$/.exec(hardwareClass);
  if (chipMatch) {
    const vendor = VENDOR_LABELS[chipMatch[1]] ?? chipMatch[1].charAt(0).toUpperCase() + chipMatch[1].slice(1);
    return `${vendor} ${chipMatch[2].toUpperCase()} ${chipMatch[3]}GB`;
  }
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
  nodes: {
    acceleratorVendor: string | null;
    ramTotalBytes: number | null;
    acceleratorName?: string | null;
    vramTotalBytes?: number | null;
    gttTotalBytes?: number | null;
  }[],
  // Trust the fleet-calibrated carve estimate for AMD nodes lacking a positive
  // APU signal. Set only for our own (foxlight) reports; never for untrusted
  // community submissions, where an AMD host could be a discrete-GPU box.
  trustApuFallback = false,
): HardwareProfile {
  if (nodes.length === 0) return UNKNOWN_HARDWARE;
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const cls = classifyNode(n.acceleratorVendor, n.ramTotalBytes, n.acceleratorName, {
      vramTotalBytes: n.vramTotalBytes,
      gttTotalBytes: n.gttTotalBytes,
      trustApuFallback,
    });
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
