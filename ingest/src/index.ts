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
      return json({ error: 'not found' }, 404);
    } catch (error) {
      // Never leak internals; D1/network failures read as a retryable 500.
      console.error('ingest error', error);
      return json({ error: 'internal error' }, 500);
    }
  },
};
