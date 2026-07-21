import assert from 'node:assert/strict';
import test from 'node:test';

import type { ModelRollup, WindowPoint, WorkloadKind } from '../src/data/schema.ts';
import {
  NON_TEXT_WORKLOADS,
  TEXT_GENERATION_WORKLOADS,
  workloadKindForTestSet,
} from '../src/data/workload.ts';
import { windowRollup } from '../src/data/window.ts';

const NOW = Date.parse('2026-07-21T12:00:00Z');

function point(
  startedAt: string,
  workload: WorkloadKind,
  decodeTpsMedian: number | null,
  ttftMedian: number | null,
  confidence: 'credible' | 'indicative' | 'excluded',
): WindowPoint {
  return {
    startedAt,
    decodeTpsMedian,
    ttftMedian,
    credible: confidence === 'credible',
    indicative: confidence === 'indicative',
    workload,
    tier: 'foxlight',
    hardwareLabel: 'Apple 24GB',
    hardwareClasses: ['apple-24gb'],
    clusterAttributed: false,
    passCount: 1,
    failCount: 0,
    nodeCount: 1,
  };
}

function model(windowPoints: WindowPoint[]): ModelRollup {
  return {
    modelId: 'test/model',
    slug: 'test-model',
    displayName: 'Test Model',
    family: 'mlx',
    workloads: ['text', 'speech'],
    runCount: windowPoints.length,
    totalResults: windowPoints.length,
    passRate: 1,
    decodeTpsTypical: null,
    decodeTpsIndicative: null,
    decodeTpsLatest: null,
    decodeTpsLatestIndicative: null,
    ttftLatestMedian: null,
    credibleRunCount: 0,
    indicativeRunCount: 0,
    nodeCountsObserved: [1],
    lastRunAt: windowPoints.at(-1)?.startedAt ?? null,
    caveats: [],
    hardwareCells: [],
    windowPoints,
    communityRunCount: 0,
  };
}

test('classifies suites into task-appropriate metric families', () => {
  assert.equal(workloadKindForTestSet('chat-tests'), 'text');
  assert.equal(workloadKindForTestSet('tool-served-check'), 'text');
  assert.equal(workloadKindForTestSet('vision-data-plane'), 'vision');
  assert.equal(workloadKindForTestSet('speech-synthesis-semantic'), 'speech');
  assert.equal(workloadKindForTestSet('embeddings'), 'embeddings');
});

test('keeps indicative throughput separate and computes TTFT independently', () => {
  const rollup = model([
    point('2026-07-17T12:00:00Z', 'text', 10, 1, 'indicative'),
    point('2026-07-18T12:00:00Z', 'text', 20, 2, 'indicative'),
    point('2026-07-19T12:00:00Z', 'text', null, 3, 'excluded'),
    point('2026-07-20T12:00:00Z', 'speech', null, 9, 'excluded'),
  ]);

  const text = windowRollup(rollup, 30, NOW, undefined, TEXT_GENERATION_WORKLOADS);
  assert.equal(text.runCountInWindow, 3);
  assert.equal(text.decodeTpsTypical, null);
  assert.equal(text.decodeTpsIndicative, 15);
  assert.equal(text.decodeTpsLatestIndicative, 20);
  assert.equal(text.indicativeRunCount, 2);
  assert.equal(text.ttftLatestMedian, 3);
  assert.equal(text.hardwareCells[0].decodeTpsIndicative, 15);
  assert.equal(text.hardwareCells[0].indicativeRunCount, 2);

  const nonText = windowRollup(rollup, 30, NOW, undefined, NON_TEXT_WORKLOADS);
  assert.equal(nonText.runCountInWindow, 1);
  assert.equal(nonText.decodeTpsIndicative, null);
  assert.equal(nonText.ttftLatestMedian, 9);
});

test('never blends indicative points into a credible headline', () => {
  const rollup = model([
    point('2026-07-17T12:00:00Z', 'text', 10, 1, 'indicative'),
    point('2026-07-18T12:00:00Z', 'text', 20, 2, 'indicative'),
    point('2026-07-19T12:00:00Z', 'text', 50, 3, 'credible'),
  ]);

  const text = windowRollup(rollup, 30, NOW, undefined, TEXT_GENERATION_WORKLOADS);
  assert.equal(text.decodeTpsTypical, 50);
  assert.equal(text.credibleRunCount, 1);
  assert.equal(text.decodeTpsIndicative, 15);
  assert.equal(text.indicativeRunCount, 2);
});
