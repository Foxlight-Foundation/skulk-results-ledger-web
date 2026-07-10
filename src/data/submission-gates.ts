/**
 * Community-submission validation gates (skulk-open-ledger Phase 2).
 *
 * ONE shared module used by both the ingest Worker (rejects structurally
 * invalid submissions at the edge) and the site importer/bake (so the bar
 * cannot drift between ingest and render). Pure TypeScript, no Node or
 * Worker APIs.
 *
 * Philosophy: structural problems REJECT (no run id, no results, no
 * fingerprint nodes: the ledger cannot say anything honest about such a
 * run); plausibility problems only WARN (the ledger's job is to show
 * suspicious numbers with their asterisks, and moderation sees the warnings
 * before approving).
 */

/** Physical-plausibility ceiling shared with the importer's credibility bar. */
export const IMPLAUSIBLE_TPS = 1000;

/** Hard cap on results per submission (a battery cell is tens, not thousands). */
export const MAX_RESULTS = 2000;

export interface GateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

interface LooseReport {
  run_id?: unknown;
  spec?: { model_set?: unknown; test_set?: unknown; mode?: unknown } | null;
  results?: unknown[] | null;
  fingerprint?: {
    schema_version?: unknown;
    cluster?: { nodes?: unknown[] | null } | null;
  } | null;
  suite?: unknown;
}

/** Validate one slimmed harness report for community ingest. */
export function validateSubmission(report: unknown): GateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (typeof report !== 'object' || report == null) {
    return { ok: false, errors: ['body is not a JSON object'], warnings };
  }
  const r = report as LooseReport;

  if (typeof r.run_id !== 'string' || !/^[0-9]{8}-[0-9]{6}-[a-z0-9-]{1,120}$/.test(r.run_id)) {
    errors.push('run_id missing or not a harness run id');
  }
  if (r.suite != null) errors.push('stability-suite reports are not accepted');
  if (!r.spec || typeof r.spec.model_set !== 'string' || typeof r.spec.test_set !== 'string') {
    errors.push('spec.model_set / spec.test_set missing');
  }
  const results = Array.isArray(r.results) ? r.results : null;
  if (!results || results.length === 0) {
    errors.push('results missing or empty');
  } else if (results.length > MAX_RESULTS) {
    errors.push(`results exceed cap (${results.length} > ${MAX_RESULTS})`);
  }

  // Fingerprint completeness: community runs without node data would all
  // land in "unknown hardware", which defeats the point of submitting.
  const schemaVersion = r.fingerprint?.schema_version;
  if (typeof schemaVersion !== 'string' || !schemaVersion.startsWith('2.')) {
    errors.push('fingerprint missing or schema_version not 2.x');
  }
  const nodes = r.fingerprint?.cluster?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('fingerprint.cluster.nodes missing or empty');
  } else {
    // Each node needs a string node_id: the bake hashes node ids during
    // redaction, so a malformed node in one approved submission would
    // otherwise throw and block every site rebuild.
    const bad = nodes.filter(
      (n) => typeof (n as { node_id?: unknown }).node_id !== 'string' ||
        !(n as { node_id: string }).node_id,
    ).length;
    if (bad > 0) errors.push(`${bad} node entr(ies) missing a string node_id`);
  }

  // Plausibility: warn, never reject; moderation and the site's caveat
  // machinery are the honest home for suspicious numbers.
  if (results) {
    let implausible = 0;
    for (const item of results) {
      const metrics = (item as { metrics?: Record<string, unknown> }).metrics;
      const tps = metrics?.skulk_generation_tps ?? metrics?.wall_tps;
      if (typeof tps === 'number' && tps > IMPLAUSIBLE_TPS) implausible += 1;
    }
    if (implausible > 0) {
      warnings.push(`${implausible} result(s) above the ${IMPLAUSIBLE_TPS} tok/s plausibility ceiling`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Count models/results for the metadata row (loose, never throws). */
export function summarizeSubmission(report: unknown): { modelCount: number; resultCount: number } {
  const r = report as LooseReport;
  const results = Array.isArray(r.results) ? r.results : [];
  const models = new Set(
    results.map((x) => (x as { model_id?: unknown }).model_id).filter((m) => typeof m === 'string'),
  );
  return { modelCount: models.size, resultCount: results.length };
}
