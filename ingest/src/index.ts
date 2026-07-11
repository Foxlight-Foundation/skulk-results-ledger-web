/**
 * Skulk open-ledger ingest Worker (Phase 2: community submissions).
 *
 * Endpoints:
 * - GET  /v1/health                     liveness probe
 * - POST /v1/submissions                submit one slimmed harness report;
 *                                       Authorization: Bearer <GitHub token>,
 *                                       verified server-side for attribution
 *                                       and immediately discarded
 * - GET  /v1/submissions?status=...     list metadata (admin token)
 * - POST /v1/submissions/:runId/review  { action: "approve" | "reject" } (admin token)
 * - GET  /v1/bake-export?since=<iso>    approved submissions for the site bake (bake token)
 *
 * Storage: D1 only for now (slimmed reports are ~3KB; R2 is not yet enabled
 * on the account). storeBlob/loadBlob are the seam to move blobs to R2.
 * Untrusted-input posture end to end: strict gates, size caps, per-submitter
 * quota; nothing stored here is served to browsers unbaked.
 */

import { summarizeSubmission, validateSubmission } from '../../src/data/submission-gates';

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
  BAKE_TOKEN: string;
}

const MAX_BODY_BYTES = 262_144; // 256KB: a slimmed report is ~3KB, so this is generous
const SUBMISSIONS_PER_HOUR = 30; // per submitter

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve the submitter's GitHub login from their token. The token is used
 * for exactly one /user call and never stored or logged. Returns null when
 * the token is missing/invalid.
 */
async function githubLogin(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) return null;
  const resp = await fetch('https://api.github.com/user', {
    headers: {
      authorization: `Bearer ${match[1]}`,
      'user-agent': 'skulk-ledger-ingest',
      accept: 'application/vnd.github+json',
    },
  });
  if (!resp.ok) return null;
  const user = (await resp.json()) as { login?: string };
  return typeof user.login === 'string' && user.login ? user.login : null;
}

function requireToken(request: Request, expected: string): boolean {
  const auth = request.headers.get('authorization') ?? '';
  return expected.length > 0 && auth === `Bearer ${expected}`;
}

async function handleSubmit(request: Request, env: Env): Promise<Response> {
  const submitter = await githubLogin(request);
  if (!submitter) {
    return json({ error: 'GitHub authentication required (Authorization: Bearer <token>)' }, 401);
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return json({ error: `body exceeds ${MAX_BODY_BYTES} bytes` }, 413);
  }
  let report: unknown;
  try {
    report = JSON.parse(body);
  } catch {
    return json({ error: 'body is not valid JSON' }, 400);
  }

  const gates = validateSubmission(report);
  if (!gates.ok) return json({ error: 'submission rejected by gates', details: gates.errors }, 422);

  // Per-submitter quota: honest operators submit battery-sized batches, not floods.
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM submissions WHERE submitter = ? AND submitted_at > ?',
  )
    .bind(submitter, hourAgo)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= SUBMISSIONS_PER_HOUR) {
    return json({ error: `quota exceeded (${SUBMISSIONS_PER_HOUR}/hour)` }, 429);
  }

  const runId = (report as { run_id: string }).run_id;
  const hash = await sha256Hex(body);
  const dupe = await env.DB.prepare(
    'SELECT run_id FROM submissions WHERE run_id = ? OR content_hash = ?',
  )
    .bind(runId, hash)
    .first();
  if (dupe) return json({ error: 'duplicate submission (run_id or identical content)' }, 409);

  const { modelCount, resultCount } = summarizeSubmission(report);
  await env.DB.prepare(
    `INSERT INTO submissions
       (run_id, content_hash, submitter, status, submitted_at, gate_warnings, report_json, model_count, result_count)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
  )
    .bind(
      runId,
      hash,
      submitter,
      new Date().toISOString(),
      JSON.stringify(gates.warnings),
      body,
      modelCount,
      resultCount,
    )
    .run();

  return json({ accepted: true, runId, status: 'pending', warnings: gates.warnings }, 201);
}

async function handleList(request: Request, env: Env, url: URL): Promise<Response> {
  if (!requireToken(request, env.ADMIN_TOKEN)) return json({ error: 'admin token required' }, 401);
  const status = url.searchParams.get('status') ?? 'pending';
  const rows = await env.DB.prepare(
    `SELECT run_id, submitter, status, submitted_at, reviewed_at, gate_warnings, model_count, result_count
     FROM submissions WHERE status = ? ORDER BY submitted_at DESC LIMIT 200`,
  )
    .bind(status)
    .all();
  return json({ submissions: rows.results });
}

async function handleReview(request: Request, env: Env, runId: string): Promise<Response> {
  if (!requireToken(request, env.ADMIN_TOKEN)) return json({ error: 'admin token required' }, 401);
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;
  if (action !== 'approve' && action !== 'reject') {
    return json({ error: 'action must be "approve" or "reject"' }, 400);
  }
  const status = action === 'approve' ? 'approved' : 'rejected';
  const result = await env.DB.prepare(
    "UPDATE submissions SET status = ?, reviewed_at = ? WHERE run_id = ? AND status = 'pending'",
  )
    .bind(status, new Date().toISOString(), runId)
    .run();
  if ((result.meta?.changes ?? 0) === 0) {
    return json({ error: 'no pending submission with that run_id' }, 404);
  }
  return json({ runId, status });
}

async function handleBakeExport(request: Request, env: Env, url: URL): Promise<Response> {
  if (!requireToken(request, env.BAKE_TOKEN)) return json({ error: 'bake token required' }, 401);
  const since = url.searchParams.get('since') ?? '1970-01-01T00:00:00Z';
  const rows = await env.DB.prepare(
    `SELECT run_id, submitter, submitted_at, reviewed_at, report_json
     FROM submissions WHERE status = 'approved' AND submitted_at > ?
     ORDER BY submitted_at ASC LIMIT 500`,
  )
    .bind(since)
    .all<{ run_id: string; submitter: string; submitted_at: string; reviewed_at: string; report_json: string }>();
  const submissions = rows.results.map((row) => ({
    runId: row.run_id,
    submitter: row.submitter,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    report: JSON.parse(row.report_json) as unknown,
  }));
  return json({ submissions, count: submissions.length });
}

const TELEMETRY_MAX_SAMPLES_PER_BATCH = 500;
const TELEMETRY_SAMPLES_PER_HOUR = 20_000; // per install: generous for a busy cluster
const INSTALL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HARDWARE_CLASS_RE = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const TELEMETRY_KINDS = new Set(['generation', 'node-death', 'runner-restart']);
const ERROR_CLASSES = new Set([
  'placement-failed',
  'runner-died',
  'timeout',
  'wedge-detected',
  'oom',
  // The API-node stream tap knows "the generation errored" without the
  // underlying class; an honest catch-all beats a guessed specific one.
  'generation-error',
]);
const ENGINES = new Set(['mlx', 'llama_cpp', 'llama_server', 'mlx_audio']);

function finiteOrNull(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function intOrNull(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

/**
 * Validate one telemetry sample against the strict allowlist. Returns the
 * normalized row or a string error. Content-free by construction: every
 * accepted string field is either an enum, a bounded model id, or a
 * taxonomy-shaped hardware class.
 */
function normalizeSample(sample: unknown):
  | { kind: string; at: string; modelId: string | null; engine: string | null; quantization: string | null; hardware: string[]; nodeCount: number | null; ttftS: number | null; decodeTps: number | null; promptTokens: number | null; outputTokens: number | null; mtpAcceptRatio: number | null; errorClass: string | null }
  | string {
  if (typeof sample !== 'object' || sample == null) return 'sample is not an object';
  const s = sample as Record<string, unknown>;
  if (typeof s.kind !== 'string' || !TELEMETRY_KINDS.has(s.kind)) return 'unknown kind';
  // Canonicalize to UTC ISO so TEXT ordering equals instant ordering
  // (an offset timestamp like 01:00:00+02:00 must not sort after 00:30Z).
  if (typeof s.at !== 'string' || Number.isNaN(Date.parse(s.at))) return 'bad timestamp';
  const at = new Date(s.at).toISOString();
  const modelId =
    typeof s.model_id === 'string' && s.model_id.length > 0 && s.model_id.length <= 200
      ? s.model_id
      : null;
  if (s.kind === 'generation' && !modelId) return 'generation sample without model_id';
  const engine = typeof s.engine === 'string' && ENGINES.has(s.engine) ? s.engine : null;
  const quantization =
    typeof s.quantization === 'string' && /^[A-Za-z0-9_.-]{1,32}$/.test(s.quantization)
      ? s.quantization
      : null;
  const hardware = Array.isArray(s.hardware)
    ? s.hardware.filter((h): h is string => typeof h === 'string' && HARDWARE_CLASS_RE.test(h)).slice(0, 32)
    : [];
  const errorClass =
    typeof s.error_class === 'string' && ERROR_CLASSES.has(s.error_class) ? s.error_class : null;
  return {
    kind: s.kind,
    at,
    modelId,
    engine,
    quantization,
    hardware,
    nodeCount: intOrNull(s.node_count, 1, 1024),
    ttftS: finiteOrNull(s.ttft_s, 0, 3600),
    decodeTps: finiteOrNull(s.decode_tps, 0, 100_000),
    promptTokens: intOrNull(s.prompt_tokens, 0, 10_000_000),
    outputTokens: intOrNull(s.output_tokens, 0, 10_000_000),
    mtpAcceptRatio: finiteOrNull(s.mtp_accept_ratio, 0, 1),
    errorClass,
  };
}

async function handleTelemetry(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return json({ error: `body exceeds ${MAX_BODY_BYTES} bytes` }, 413);
  let batch: unknown;
  try {
    batch = JSON.parse(body);
  } catch {
    return json({ error: 'body is not valid JSON' }, 400);
  }
  if (typeof batch !== 'object' || batch == null || Array.isArray(batch)) {
    return json({ error: 'body must be a JSON object' }, 400);
  }
  const b = batch as {
    install_id?: unknown;
    skulk_version?: unknown;
    samples?: unknown[];
  };
  if (typeof b.install_id !== 'string' || !INSTALL_ID_RE.test(b.install_id)) {
    return json({ error: 'install_id must be a lowercase UUID' }, 400);
  }
  const skulkVersion =
    typeof b.skulk_version === 'string' && /^[0-9A-Za-z.+-]{1,40}$/.test(b.skulk_version)
      ? b.skulk_version
      : null;
  if (!Array.isArray(b.samples) || b.samples.length === 0) {
    return json({ error: 'samples missing or empty' }, 400);
  }
  if (b.samples.length > TELEMETRY_MAX_SAMPLES_PER_BATCH) {
    return json({ error: `batch exceeds ${TELEMETRY_MAX_SAMPLES_PER_BATCH} samples` }, 413);
  }

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM telemetry_samples WHERE install_id = ? AND received_at > ?',
  )
    .bind(b.install_id, hourAgo)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) + b.samples.length > TELEMETRY_SAMPLES_PER_HOUR) {
    return json({ error: 'telemetry quota exceeded for this install' }, 429);
  }

  const rows = [];
  let dropped = 0;
  for (const sample of b.samples) {
    const normalized = normalizeSample(sample);
    if (typeof normalized === 'string') {
      dropped += 1;
      continue;
    }
    rows.push(normalized);
  }
  if (rows.length === 0) return json({ error: 'no valid samples', dropped }, 422);

  const receivedAt = new Date().toISOString();
  const statement = env.DB.prepare(
    `INSERT INTO telemetry_samples
       (install_id, skulk_version, kind, at, received_at, model_id, engine, quantization,
        hardware, node_count, ttft_s, decode_tps, prompt_tokens, output_tokens,
        mtp_accept_ratio, error_class)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  await env.DB.batch(
    rows.map((r) =>
      statement.bind(
        b.install_id,
        skulkVersion,
        r.kind,
        r.at,
        receivedAt,
        r.modelId,
        r.engine,
        r.quantization,
        JSON.stringify(r.hardware),
        r.nodeCount,
        r.ttftS,
        r.decodeTps,
        r.promptTokens,
        r.outputTokens,
        r.mtpAcceptRatio,
        r.errorClass,
      ),
    ),
  );
  return json({ accepted: rows.length, dropped }, 201);
}

/**
 * Delete every sample for an install id (the public deletion story). The
 * random install id is itself the bearer capability: it never appears on the
 * public site, so presenting it proves ownership.
 */
async function handleTelemetryDelete(env: Env, installId: string): Promise<Response> {
  if (!INSTALL_ID_RE.test(installId)) return json({ error: 'install_id must be a lowercase UUID' }, 400);
  // Paged: a busy install can hold hundreds of thousands of rows, and a
  // single unbounded DELETE can exceed D1 execution limits. When the page
  // budget runs out, `remaining: true` tells the client to call again.
  let deleted = 0;
  let remaining = false;
  for (let page = 0; page < 20; page += 1) {
    const result = await env.DB.prepare(
      'DELETE FROM telemetry_samples WHERE id IN (SELECT id FROM telemetry_samples WHERE install_id = ? LIMIT 10000)',
    )
      .bind(installId)
      .run();
    const changes = result.meta?.changes ?? 0;
    deleted += changes;
    if (changes < 10000) break;
    if (page === 19) remaining = true;
  }
  return json({ deleted, remaining });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    try {
      if (request.method === 'GET' && path === '/v1/health') return json({ ok: true });
      if (request.method === 'POST' && path === '/v1/submissions') return await handleSubmit(request, env);
      if (request.method === 'GET' && path === '/v1/submissions') return await handleList(request, env, url);
      const review = /^\/v1\/submissions\/([^/]+)\/review$/.exec(path);
      if (request.method === 'POST' && review) return await handleReview(request, env, review[1]);
      if (request.method === 'GET' && path === '/v1/bake-export') return await handleBakeExport(request, env, url);
      if (request.method === 'POST' && path === '/v1/telemetry') return await handleTelemetry(request, env);
      const del = /^\/v1\/telemetry\/([^/]+)$/.exec(path);
      if (request.method === 'DELETE' && del) return await handleTelemetryDelete(env, del[1]);
      return json({ error: 'not found' }, 404);
    } catch (error) {
      // Never leak internals; D1/network failures read as a retryable 500.
      console.error('ingest error', error);
      return json({ error: 'internal error' }, 500);
    }
  },
};
