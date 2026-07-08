/**
 * Watch the harness runs directories and regenerate `public/data/` whenever a
 * run appears or changes. Because every harness test run writes a fresh
 * `report.json`, this keeps the ledger current without a manual re-import and
 * without a backend: the site stays static, the data just refreshes itself.
 *
 * Run alongside the dev server (`npm run dev`), which full-reloads when the
 * files under `public/` change. Combined convenience: `npm run dev:live`.
 *
 * Usage: tsx scripts/watch-runs.ts [--runs <dir> ...] [--out <dir>] [--redact]
 */

import { existsSync, watch } from 'node:fs';

import { parseArgs, runImport } from './import-runs.ts';

const DEBOUNCE_MS = 400;

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  // Initial build so the site has data immediately.
  process.stdout.write(runImport(opts) + '\n');

  let timer: NodeJS.Timeout | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    // Debounce: a single harness run writes report.json + events.jsonl +
    // summary.md, and a battery writes many in a burst. Coalesce into one
    // regeneration once the writes settle.
    timer = setTimeout(() => {
      try {
        process.stdout.write(`[${new Date().toLocaleTimeString()}] ${runImport(opts)}\n`);
      } catch (err) {
        process.stderr.write(`import failed: ${err instanceof Error ? err.message : String(err)}\n`);
      }
    }, DEBOUNCE_MS);
  };

  for (const dir of opts.runs) {
    if (!existsSync(dir)) {
      process.stderr.write(`watch: runs dir does not exist yet, skipping: ${dir}\n`);
      continue;
    }
    // Recursive watch catches new run subdirectories and their report.json.
    watch(dir, { recursive: true }, (_event, filename) => {
      if (filename == null || filename.endsWith('report.json')) schedule();
    });
    process.stdout.write(`Watching ${dir}\n`);
  }

  process.stdout.write('Watching for new harness runs. Ctrl-C to stop.\n');
}

main();
