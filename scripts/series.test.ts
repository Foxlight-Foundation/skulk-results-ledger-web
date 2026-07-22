import assert from 'node:assert/strict';
import test from 'node:test';

import type { PerformanceSeries, RunSeriesPoint } from '../src/data/schema.ts';
import {
  chooseDefaultContext,
  contextFromSearch,
  joinRunSeries,
  summarizePoints,
} from '../src/data/series.ts';
import { windowFromParam } from '../src/data/window.ts';

function point(run: number, value: number, day = run): RunSeriesPoint {
  return {
    runId: `run-${run}`,
    startedAt: new Date(Date.UTC(2026, 6, day)).toISOString(),
    decodeTps: value,
    ttftS: 0.2,
    repetitionCount: 2,
    validRepetitionCount: 2,
    skulkVersion: '2.0.0',
    skulkCommit: `commit-${run}`,
  };
}

function series(overrides: Partial<PerformanceSeries> = {}): PerformanceSeries {
  const points = overrides.points ?? [point(1, 50)];
  const comparable = overrides.comparable ?? true;
  return {
    seriesId: 'series-a',
    modelId: 'org/model-a',
    slug: 'org-model-a',
    displayName: 'model-a',
    family: 'mlx',
    tier: 'foxlight',
    suiteId: 'suite-a',
    testName: 'ordered',
    testKind: 'chat',
    testDescription: '',
    protocolId: 'protocol-a',
    protocolFamilyId: 'family-a',
    source: 'client_exact',
    hardware: {
      classes: ['apple-64gb'],
      label: 'Apple 64GB',
      nodeCount: 1,
      homogeneous: true,
      known: true,
      profileId: 'hardware-a',
    },
    hardwareAttribution: 'placement',
    resolvedBackends: ['mlx-metal'],
    instanceType: 'MlxRingInstance',
    sharding: 'Pipeline',
    shardTypes: ['PipelineShardMetadata'],
    comparable,
    points,
    summary: summarizePoints(points, comparable),
    ...overrides,
  };
}

test('stability uses newest ten distinct runs, seven days, sample CV at most ten percent', () => {
  const stable = summarizePoints(
    Array.from({ length: 11 }, (_, index) => point(index + 1, 50 + (index % 2), index + 1)),
    true,
  );
  assert.equal(stable.status, 'Stable');
  assert.equal(stable.runCount, 11);

  const variable = summarizePoints(
    Array.from({ length: 10 }, (_, index) => point(index + 1, index % 2 ? 80 : 20, index + 1)),
    true,
  );
  assert.equal(variable.status, 'Variable');

  const exactlySevenDays = Array.from({ length: 10 }, (_, index) =>
    point(index + 1, 50, index === 9 ? 8 : 1),
  );
  assert.equal(summarizePoints(exactlySevenDays, true).status, 'Stable');

  const tooShort = summarizePoints(
    Array.from({ length: 10 }, (_, index) => point(index + 1, 50, 1 + index / 20)),
    true,
  );
  assert.equal(tooShort.status, 'Observed');
  assert.equal(
    summarizePoints([point(1, 50), { ...point(2, 80), runId: 'run-1' }], true).runCount,
    1,
  );
  assert.equal(summarizePoints([point(1, 50)], false).status, 'Legacy');
});

test('default context maximizes model-by-exact-hardware coverage after choosing latest protocol', () => {
  const candidates = [
    series(),
    series({ seriesId: 'series-b', modelId: 'org/model-b', slug: 'org-model-b' }),
    series({
      seriesId: 'series-old',
      protocolId: 'protocol-old',
      points: [point(20, 55, 0)],
    }),
    series({
      seriesId: 'series-other',
      suiteId: 'suite-b',
      testName: 'different',
      protocolId: 'protocol-b',
      points: [point(30, 60, 20)],
    }),
  ];
  const context = chooseDefaultContext(
    candidates,
    null,
    Date.UTC(2026, 6, 30),
  );
  assert.deepEqual(context, {
    suiteId: 'suite-a',
    testName: 'ordered',
    protocolId: 'protocol-a',
    source: 'client_exact',
  });
});

test('comparison joins only identical full series identities', () => {
  const matching = series({ points: [point(1, 40), point(2, 44)] });
  const mismatchedHardware = series({
    seriesId: 'series-hardware-b',
    hardware: {
      classes: ['apple-32gb'],
      label: 'Apple 32GB',
      nodeCount: 1,
      homogeneous: true,
      known: true,
      profileId: 'hardware-b',
    },
    points: [point(1, 60)],
  });
  const rows = joinRunSeries([matching, mismatchedHardware], 'run-1', 'run-2');
  assert.equal(rows[0].comparable, true);
  assert.equal(rows[0].percentDelta, 10);
  assert.equal(rows[1].comparable, false);
  assert.equal(rows[1].reason, 'full series identity absent on one side');
});

test('window URL parsing restores supported values and defaults safely', () => {
  assert.equal(windowFromParam('7'), 7);
  assert.equal(windowFromParam('all'), null);
  assert.equal(windowFromParam('bogus'), 30);
});

test('benchmark context restoration gives URL state precedence over session state', () => {
  const restored = contextFromSearch(
    new globalThis.URLSearchParams('suite=url-suite&test=url-test&protocol=url-protocol&source=engine_reported'),
    {
      suiteId: 'default-suite',
      testName: 'default-test',
      protocolId: 'default-protocol',
      source: 'client_exact',
    },
    {
      suiteId: 'session-suite',
      testName: 'session-test',
      protocolId: 'session-protocol',
      source: 'client_approx',
    },
  );
  assert.deepEqual(restored, {
    suiteId: 'url-suite',
    testName: 'url-test',
    protocolId: 'url-protocol',
    source: 'engine_reported',
  });
});
