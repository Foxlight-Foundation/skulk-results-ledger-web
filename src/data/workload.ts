import type { SuiteCategory } from './suite-catalog';
import { suiteCatalogEntry } from './suite-catalog';
import type { WorkloadKind } from './schema';

/** Workloads that produce generated text and belong in the TPS/TTFT Explorer. */
export const TEXT_GENERATION_WORKLOADS: readonly WorkloadKind[] = ['text', 'vision'];

/** Workloads whose useful performance units are not generated tokens per second. */
export const NON_TEXT_WORKLOADS: readonly WorkloadKind[] = ['speech', 'embeddings'];

function workloadFromCategory(category: SuiteCategory | null): WorkloadKind | null {
  if (category === 'speech') return 'speech';
  if (category === 'embeddings') return 'embeddings';
  if (category === 'vision') return 'vision';
  if (category != null) return 'text';
  return null;
}

/**
 * Classify a suite into the metric family its model result belongs to.
 *
 * The catalog is authoritative when populated. Prefix fallbacks cover newly
 * added and historical speech/vision suites before their richer catalog copy
 * lands; all remaining suites exercise generated text (chat, code, tools,
 * reliability, throughput, and concurrency).
 */
export function workloadKindForTestSet(testSet: string): WorkloadKind {
  const catalogKind = workloadFromCategory(suiteCatalogEntry(testSet)?.category ?? null);
  if (catalogKind != null) return catalogKind;
  if (testSet === 'embeddings' || testSet.startsWith('embedding')) return 'embeddings';
  if (
    testSet.startsWith('speech-') ||
    testSet.includes('transcription') ||
    testSet.includes('speech-chain') ||
    testSet === 'conversational-realtime'
  ) {
    return 'speech';
  }
  if (testSet.startsWith('vision')) return 'vision';
  return 'text';
}

/** Return whether a model has at least one generated-text workload. */
export function hasTextGenerationWorkload(workloads: readonly WorkloadKind[]): boolean {
  return workloads.some((workload) => TEXT_GENERATION_WORKLOADS.includes(workload));
}

/** Human label for non-text workload rows. */
export function workloadLabel(workloads: readonly WorkloadKind[]): string {
  const labels = workloads
    .filter((workload) => NON_TEXT_WORKLOADS.includes(workload))
    .map((workload) => (workload === 'speech' ? 'Speech / audio' : 'Embeddings'));
  return [...new Set(labels)].join(' + ') || 'Other';
}
