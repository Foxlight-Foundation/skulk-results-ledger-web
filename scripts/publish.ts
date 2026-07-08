/**
 * Publish harness runs into the durable results store (results-ledger Phase 3
 * publish step). Slims each local `report.json` (drops the heavy generated text
 * the ledger never uses) and writes it into a checkout of the private
 * `skulk-results-data` repo as `reports/<run_id>.json`, then optionally commits,
 * pushes, and prunes the local copies.
 *
 * This is what lets the local `runs/` directory be disposable: once a run is in
 * the store, its permanent record is safe and the local copy can be deleted.
 *
 * Usage:
 *   tsx scripts/publish.ts --data <path-to-skulk-results-data> \
 *       [--runs <dir> ...] [--push] [--prune]
 *
 * The store keeps richer fields than the public site (node names, versions);
 * public redaction happens later at site-build time (`import --redact`). The
 * store is still slimmed of prompt/output text so it stays compact in git.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { collectReportFiles } from './import-runs.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

interface PublishOptions {
  runs: string[];
  data: string;
  push: boolean;
  prune: boolean;
}

function parse(argv: string[]): PublishOptions {
  const runs: string[] = [];
  let data = '';
  let push = false;
  let prune = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--runs') runs.push(resolve(argv[++i]));
    else if (argv[i] === '--data') data = resolve(argv[++i]);
    else if (argv[i] === '--push') push = true;
    else if (argv[i] === '--prune') prune = true;
  }
  if (runs.length === 0) runs.push(resolve(REPO, '../skulk-test-harness/runs'));
  return { runs, data, push, prune };
}

interface RawReport {
  run_id: string;
  suite?: string;
  results?: {
    output_text?: string;
    reasoning_text?: string;
    tool_calls?: { arguments_text?: string; arguments?: unknown }[];
  }[];
}

/**
 * Strip the generated text the ledger never reads (prompt/output/reasoning and
 * tool-call argument bodies), keeping metrics, pass/fail, placements, and the
 * fingerprint. Shrinks a report to a few KB and removes the bulk of any
 * sensitive content even before public redaction.
 */
function slim(report: RawReport): RawReport {
  const results = (report.results ?? []).map((r) => ({
    ...r,
    output_text: '',
    reasoning_text: '',
    tool_calls: (r.tool_calls ?? []).map((t) => ({ ...t, arguments_text: '', arguments: null })),
  }));
  return { ...report, results };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

function main(): void {
  const opts = parse(process.argv.slice(2));
  if (!opts.data) {
    process.stderr.write('error: --data <path-to-skulk-results-data checkout> is required\n');
    process.exit(2);
  }
  if (!existsSync(opts.data)) {
    process.stderr.write(`error: data checkout not found: ${opts.data}\n`);
    process.exit(2);
  }
  const reportsDir = join(opts.data, 'reports');
  mkdirSync(reportsDir, { recursive: true });

  let published = 0;
  const prunable = new Set<string>();

  for (const runsDir of opts.runs) {
    for (const file of collectReportFiles(runsDir)) {
      let report: RawReport;
      try {
        report = JSON.parse(readFileSync(file, 'utf8')) as RawReport;
      } catch {
        continue;
      }
      if (report.suite != null || report.results == null) continue; // skip stability
      const dest = join(reportsDir, `${report.run_id}.json`);
      writeFileSync(dest, JSON.stringify(slim(report)));
      published += 1;
      // The local run dir is the parent of report.json (subdir layout only).
      if (file.endsWith('/report.json')) prunable.add(dirname(file));
    }
  }

  process.stdout.write(`Published ${published} run(s) -> ${reportsDir}\n`);

  if (opts.push && published > 0) {
    git(opts.data, 'add', 'reports');
    const status = git(opts.data, 'status', '--porcelain');
    if (status.trim()) {
      git(opts.data, 'commit', '-m', `publish ${published} run(s)`);
      git(opts.data, 'push');
      process.stdout.write('Committed + pushed to results-data.\n');
    } else {
      process.stdout.write('No changes to push (store already current).\n');
    }
  }

  if (opts.prune) {
    for (const dir of prunable) rmSync(dir, { recursive: true, force: true });
    process.stdout.write(`Pruned ${prunable.size} local run dir(s).\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
