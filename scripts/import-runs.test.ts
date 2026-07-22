import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRunDetail, buildSeries } from './import-runs.ts';
import type { RawReport } from './import-runs.ts';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'qwen2.5-legacy-observations.json',
);

function reports(): RawReport[] {
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as RawReport[];
}

test('Qwen2.5 migration reconstructs exact per-test TPS and removes model-wide artifacts', () => {
  const details = reports().map((report) => buildRunDetail(report, true));
  const series = buildSeries(details);
  const ordered = series.find(
    (item) =>
      item.testName === 'ordered-integers-coherence' &&
      item.source === 'client_exact',
  );
  const harmony = series.find(
    (item) =>
      item.testName === 'harmony-marker-leak-guard' &&
      item.source === 'client_exact',
  );

  assert.ok(ordered);
  assert.ok(harmony);
  assert.deepEqual(
    ordered.points.map((point) => Number(point.decodeTps.toFixed(2))),
    [46.57, 47.92, 48.24],
  );
  assert.deepEqual(
    harmony.points.map((point) => Number(point.decodeTps.toFixed(2))),
    [46.97],
  );
  assert.equal(ordered.summary.status, 'Legacy');
  assert.equal(series.some((item) => item.testName === 'tool-call-path'), false);
  assert.equal(
    series
      .filter((item) => item.source === 'client_exact')
      .flatMap((item) => item.points)
      .some((point) => [203, 28, 20].includes(Math.round(point.decodeTps))),
    false,
  );
  const toolAudit = details.flatMap((detail) => detail.observations).filter((item) => item.testName === 'tool-call-path');
  assert.ok(toolAudit.length > 0);
  assert.ok(toolAudit.every((item) => item.exclusionReasons.includes('non_text_workload')));
});

function currentReport(overrides: Partial<RawReport> = {}): RawReport {
  return {
    report_schema_version: '1.0',
    run_id: 'current-run',
    started_at: '2026-07-21T12:00:00Z',
    spec: { model_set: 'm', test_set: 'suite', mode: 'execute' },
    placements: [{
      model_id: 'org/model',
      node_ids: ['node-a'],
      resolved_backends: ['mlx-metal'],
      shard_types: ['PipelineShardMetadata'],
      sharding: 'Pipeline',
      instance_meta: 'MlxRingInstance',
    }],
    results: [{
      model_id: 'org/model',
      test_name: 'ordered',
      kind: 'chat',
      protocol_id: 'p'.repeat(64),
      protocol_family_id: 'f'.repeat(64),
      repetition: 1,
      passed: true,
      metrics: {
        elapsed_s: 0.61,
        ttft_s: 0.1,
        decode_elapsed_s: 0.01,
        chunks: 2,
        approx_output_tokens: 25,
        wall_tps: 90,
        skulk_generation_tps: 1999,
        skulk_generation_tokens: 20,
      },
    }],
    fingerprint: {
      runtime: { skulk_version: '2.0.0', skulk_commit: 'abc' },
      cluster: {
        node_count: 1,
        nodes: [{
          node_id: 'node-a',
          ram_total_bytes: 64 * 2 ** 30,
          accelerator_vendor: 'apple',
          accelerator_name: 'M4 Max',
        }],
      },
    },
    ...overrides,
  };
}

test('current reports separate sources, accept structurally valid unusual TPS, and become Observed', () => {
  const detail = buildRunDetail(currentReport(), true);
  const series = buildSeries([detail]);
  assert.equal(series.length, 3);
  assert.deepEqual(new Set(series.map((item) => item.source)), new Set(['client_exact', 'engine_reported', 'client_approx']));
  const exact = series.find((item) => item.source === 'client_exact');
  assert.equal(exact?.points[0].decodeTps, 2000);
  assert.equal(exact?.summary.status, 'Observed');
  assert.equal(exact?.comparable, true);
});

test('failed and short decode results remain audit-only while TTFT is independent', () => {
  const raw = currentReport();
  const base = raw.results?.[0];
  assert.ok(base);
  raw.results = [
    { ...base, repetition: 1, passed: false },
    {
      ...base,
      repetition: 2,
      metrics: { ...base.metrics, skulk_generation_tokens: 3 },
    },
  ];
  const detail = buildRunDetail(raw, true);
  const series = buildSeries([detail]);
  assert.equal(series.some((item) => item.source === 'client_exact'), false);
  assert.equal(series.some((item) => item.source === 'engine_reported'), false);
  assert.equal(series.some((item) => item.source === 'client_approx'), true);
  const shortExact = detail.observations.find(
    (item) => item.repetition === 2 && item.source === 'client_exact',
  );
  assert.equal(shortExact?.validDecode, false);
  assert.equal(shortExact?.validTtft, true);
  assert.ok(shortExact?.exclusionReasons.includes('short_exact_output'));
});

test('source, suite, test, protocol, backend, hardware, tier, and placement changes split series', () => {
  const base = buildRunDetail(currentReport(), true, 'foxlight');
  const protocol = currentReport({ run_id: 'protocol' });
  if (protocol.results) protocol.results[0].protocol_id = 'q'.repeat(64);
  const backend = currentReport({ run_id: 'backend' });
  if (backend.placements) backend.placements[0].resolved_backends = ['mlx'];
  const hardware = currentReport({ run_id: 'hardware' });
  if (hardware.fingerprint?.cluster?.nodes) {
    hardware.fingerprint.cluster.nodes[0].accelerator_name = 'M3 Max';
  }
  const placement = currentReport({ run_id: 'placement' });
  if (placement.placements) placement.placements[0].instance_meta = 'DifferentInstance';
  const testCase = currentReport({ run_id: 'test-case' });
  if (testCase.results) testCase.results[0].test_name = 'different-test';
  const suite = currentReport({ run_id: 'suite' });
  suite.spec = { ...suite.spec, test_set: 'different-suite' };
  const description = currentReport({ run_id: 'description' });
  if (description.results) description.results[0].description = 'Updated explanatory copy';
  const tier = buildRunDetail(currentReport({ run_id: 'community' }), true, 'community', 'user');
  const all = buildSeries([
    base,
    buildRunDetail(protocol, true),
    buildRunDetail(backend, true),
    buildRunDetail(hardware, true),
    buildRunDetail(placement, true),
    buildRunDetail(testCase, true),
    buildRunDetail(suite, true),
    buildRunDetail(description, true),
    tier,
  ]);
  assert.equal(all.length, 24);
  assert.equal(new Set(all.map((item) => item.seriesId)).size, 24);
  assert.equal(
    all.find(
      (item) =>
        item.source === 'client_exact' &&
        item.suiteId === 'suite' &&
        item.testName === 'ordered' &&
        item.protocolId === 'p'.repeat(64) &&
        item.resolvedBackends[0] === 'mlx-metal' &&
        item.tier === 'foxlight',
    )?.points.length,
    2,
  );
});

test('diagnostic and approximate sources require their own token basis', () => {
  const raw = currentReport();
  const result = raw.results?.[0];
  assert.ok(result);
  result.metrics.skulk_generation_tokens = null;
  result.metrics.approx_output_tokens = null;
  const observations = buildRunDetail(raw, true).observations;
  assert.ok(
    observations
      .find((item) => item.source === 'engine_reported')
      ?.exclusionReasons.includes('missing_exact_output'),
  );
  assert.ok(
    observations
      .find((item) => item.source === 'client_approx')
      ?.exclusionReasons.includes('missing_approximate_output'),
  );
  assert.equal(buildSeries([buildRunDetail(raw, true)]).length, 0);
});

test('unknown or partially known hardware emits no dashboard observations', () => {
  const raw = currentReport();
  if (raw.fingerprint?.cluster?.nodes) raw.fingerprint.cluster.nodes[0].accelerator_name = null;
  const detail = buildRunDetail(raw, true);
  assert.equal(detail.hardware.known, false);
  assert.equal(detail.observations.length, 0);
});

test('missing protocol, backend, or placement attribution remains Legacy', () => {
  const missingProtocol = currentReport({ run_id: 'missing-protocol' });
  if (missingProtocol.results) missingProtocol.results[0].protocol_id = null;
  const missingBackend = currentReport({ run_id: 'missing-backend' });
  if (missingBackend.placements) missingBackend.placements[0].resolved_backends = [];
  const clusterAttributed = currentReport({ run_id: 'cluster-attributed' });
  if (clusterAttributed.placements) clusterAttributed.placements[0].node_ids = [];
  const series = buildSeries([
    buildRunDetail(missingProtocol, true),
    buildRunDetail(missingBackend, true),
    buildRunDetail(clusterAttributed, true),
  ]);
  assert.equal(series.length, 9);
  assert.ok(series.every((item) => !item.comparable && item.summary.status === 'Legacy'));
});

test('a blocking non-stream result cannot become exact decode throughput', () => {
  const raw = currentReport();
  const result = raw.results?.[0];
  assert.ok(result);
  result.metrics.chunks = 1;
  result.metrics.decode_elapsed_s = null;
  result.metrics.elapsed_s = null;
  const exact = buildRunDetail(raw, true).observations.find(
    (item) => item.source === 'client_exact',
  );
  assert.equal(exact?.validDecode, false);
  assert.ok(exact?.exclusionReasons.includes('missing_stream_interval'));
  assert.ok(exact?.exclusionReasons.includes('insufficient_stream_chunks'));
});

test('concurrency levels group only inside one protocol-family execution profile', () => {
  const raw = currentReport();
  const base = raw.results?.[0];
  assert.ok(base);
  raw.results = [1, 8].map((concurrency) => ({
    ...base,
    test_name: 'concurrency',
    kind: 'concurrent',
    protocol_id: String(concurrency).repeat(64).slice(0, 64),
    metrics: {
      ...base.metrics,
      concurrency,
      aggregate_generation_tps: 40 * concurrency,
      per_request_generation_tps_p50: 40,
    },
  }));
  const detail = buildRunDetail(raw, true);
  assert.equal(detail.concurrencyCurves.length, 1);
  assert.deepEqual(detail.concurrencyCurves[0].points.map((item) => item.concurrency), [1, 8]);
  assert.equal(buildSeries([detail]).length, 0);
});
