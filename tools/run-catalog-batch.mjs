import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readJson, writeAtomic, writeJson } from './catalog-evidence.mjs';

const { positionals: [phase, ...extra], values: options } = parseArgs({ allowPositionals: true, options: {
  manifest: { type: 'string' }, output: { type: 'string' }, 'titles-pr': { type: 'string' },
  apply: { type: 'boolean' }, verify: { type: 'boolean' }, help: { type: 'boolean' },
} });
const titleLink = options['titles-pr'];
if (options.help || extra.length || !['titles', 'flags'].includes(phase) || !options.output || (options.apply && options.verify) ||
    (phase === 'titles' && !options.verify && !options.manifest) || (phase === 'flags' && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/.test(titleLink ?? ''))) {
  console.log('Usage (from the target worktree root):\n  node tools/run-catalog-batch.mjs titles --manifest FILE --output DIR [--apply]\n  node tools/run-catalog-batch.mjs flags --output DIR --titles-pr URL [--apply]\n  Use --verify in place of --apply to repeat checks after changes have been applied.');
  process.exit(options.help ? 0 : 1);
}

const cwd = fs.realpathSync(process.cwd());
const output = path.resolve(options.output);
const reportFile = path.join(output, `${phase}-checks.json`);
const bodyPath = path.join(output, `${phase}-pr.md`);
const report = { phase, worktree: cwd, mode: options.apply ? 'apply' : options.verify ? 'verify' : 'preview', steps: [], applied: false, error: null };
const node = process.execPath;
const logDirectory = path.join(output, 'checks', phase);
fs.mkdirSync(logDirectory, { recursive: true, mode: 0o700 });
const runDirectory = fs.mkdtempSync(path.join(logDirectory, 'run-'));
const catalogChecks = [
  ['Build catalog bundle', 'scripts/bundle-data.mjs'],
  ['Stamp data version', 'scripts/data-version.mjs'],
  ['Validate catalog', 'scripts/validate-data.mjs'],
  ['Validate guidance', 'scripts/validate-guidance.mjs'],
];
let tableReady = false;

function git(...args) {
  const child = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (child.status !== 0) throw new Error(child.stderr?.trim() || child.error?.message || `git ${args[0]} failed.`);
  return child.stdout.trim();
}

function run(label, command, args, { env = process.env, statistics } = {}) {
  const filename = `${String(report.steps.length + 1).padStart(2, '0')}-${label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}.log`;
  const log = path.join(runDirectory, filename);
  const fd = fs.openSync(log, 'w', 0o600);
  const started = Date.now();
  let child;
  try {
    child = spawnSync(command, args, { cwd, env, stdio: ['ignore', fd, fd] });
  } finally {
    fs.closeSync(fd);
  }
  const step = { label, result: child.status === 0 ? 'passed' : 'failed', milliseconds: Date.now() - started, log };
  if (statistics && fs.existsSync(statistics)) {
    try {
      const stats = readJson(statistics).stats;
      if (stats) step.tests = { passed: stats.expected, flaky: stats.flaky, skipped: stats.skipped, failed: stats.unexpected };
    } catch (error) {
      console.error(`Could not summarize browser totals: ${error.message}`);
    }
  }
  report.steps.push(step);
  writeJson(reportFile, report);
  console.log(`${label}: ${step.result}`);
  if (child.status !== 0) {
    const tail = fs.readFileSync(log, 'utf8').trimEnd().split('\n').slice(-22).join('\n').slice(-4500);
    const highlights = tail.split('\n').filter(line => /Error:|error:|^\s*\d+\) \[|timed? ?out|failed/i.test(line));
    step.details = (highlights.length ? highlights : tail.split('\n').slice(-4)).slice(-7).map(line => line.trim().slice(0, 220));
    if (tail) console.error(tail);
    throw new Error(`${label} ${child.error?.message ?? (child.signal ? `ended with ${child.signal}` : `exited ${child.status}`)}. Log: ${log}`);
  }
}

function preflight() {
  if (fs.realpathSync(git('rev-parse', '--show-toplevel')) !== cwd) throw new Error('Run from the target worktree root.');
  report.branch = git('branch', '--show-current');
  if (!report.branch || report.branch === 'master') throw new Error('Apply and verify catalog batches on an isolated feature branch.');
  run('Fetch current master', 'git', ['fetch', 'origin', 'master']);
  report.master = git('rev-parse', '--verify', 'origin/master');
  const base = git('merge-base', report.master, 'HEAD');
  if (base !== report.master) throw new Error('Update the isolated worktree from current master before applying or verifying.');
  if (phase === 'titles' && !options.verify) {
    const manifest = readJson(options.manifest);
    if (manifest.screenedRevision && manifest.screenedRevision !== report.master) throw new Error('Master has moved since screening. Refresh the evidence and reviewed manifest before applying.');
  }
}

function checkFlagTargets() {
  const rawFlags = fs.readFileSync(path.join(output, 'flags.json'), 'utf8');
  const flags = JSON.parse(rawFlags);
  const { titles: matched, flagsSha256 } = readJson(path.join(output, 'batch-identities.json'));
  if (createHash('sha256').update(rawFlags).digest('hex') !== flagsSha256) throw new Error('Flags differ from the generated plan. Regenerate the titles artifacts.');
  const data = /^const MOVIES_EXTRA = (\[[\s\S]*\]);\s*$/.exec(fs.readFileSync('data-extra.js', 'utf8'));
  if (!data || !Array.isArray(flags) || !Array.isArray(matched) || !matched.length || matched.length !== flags.length) throw new Error('The flags input or titles identities are missing or inconsistent.');
  const movies = new Map(JSON.parse(data[1]).map(movie => [movie.num, movie]));
  for (const [index, expected] of matched.entries()) {
    const movie = movies.get(expected.num);
    if (expected.num !== flags[index].num || !movie || movie.srcUrl !== expected.srcUrl || movie.t !== expected.t ||
        movie.y !== expected.y || movie.full !== expected.full || movie.ca !== `${flags[index].csm.age}+`) {
      throw new Error(`Titles and flags disagree about catalog number ${expected.num}. Regenerate artifacts from the intended titles branch.`);
    }
  }
}

function applyPhase() {
  if (phase === 'titles') {
    report.releaseScan = readJson(options.manifest).releaseScan;
    const builder = fileURLToPath(new URL('./prepare-catalog-batch.mjs', import.meta.url));
    const args = [builder, '--manifest', path.resolve(options.manifest), '--output', output];
    run('Prepare titles and PR tables', node, options.apply ? [...args, '--apply'] : args);
  } else {
    checkFlagTargets();
    const args = ['scripts/derive-flags.mjs', path.join(output, 'flags.json')];
    run('Preview flag derivation', node, args);
    tableReady = true;
    if (options.apply) run('Apply flag derivation', node, [...args, '--apply']);
  }
  tableReady = true;
  report.applied = Boolean(options.apply);
}

function verifyPhase() {
  for (const [label, script] of catalogChecks) run(label, node, [script]);
  const tests = fs.readdirSync('tests-unit').filter(file => file.endsWith('.test.mjs')).sort().map(file => path.join('tests-unit', file));
  if (!tests.length) throw new Error('No unit test files found.');
  run('Unit tests', node, ['--test', ...tests]);
  const statistics = path.join(runDirectory, 'playwright.json');
  run('Playwright', 'npx', ['playwright', 'test', '--reporter=list,json'], { env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: statistics }, statistics });
}

function prBody() {
  const table = tableReady ? fs.readFileSync(path.join(output, `${phase}-table.md`), 'utf8').trim() : '';
  const header = phase === 'flags' ? `Built on the [titles PR](${titleLink}). Merge titles before flags.\n\n` : '';
  const checks = report.steps.map(({ label, result, tests }) => {
    const counts = tests ? ` (${tests.passed} first-pass, ${tests.flaky} passed on retry, ${tests.skipped} skipped, ${tests.failed} failed)` : '';
    return `- ${label} ${result}${counts}.`;
  });
  if (report.error) {
    const failed = report.steps.at(-1);
    if (failed?.result === 'failed') {
      checks.push(`- Stopped at ${failed.label}.`, ...failed.details.filter(Boolean).map(line => `  - ${line.replace(/[`<>]/g, '')}`));
    } else checks.push(`- Stopped in preflight. ${report.error}`);
  }
  else if (report.mode === 'preview') checks.push('- Preview only. Full build and validation are pending.');
  const scan = report.releaseScan ? `New-release scan used ${report.releaseScan.requestsUsed} requests. ${report.releaseScan.note}\n\n` : '';
  return `${header}${scan}${table ? `${table}\n\n` : ''}## Checks\n\n${checks.join('\n')}\n\nCo-authored with ChatGPT.\n`;
}

try {
  if (options.apply || options.verify) preflight();
  if (options.verify) {
    const previous = readJson(path.join(output, `${phase}-last-apply.json`));
    if (!previous.applied || previous.worktree !== cwd || previous.branch !== report.branch) throw new Error('Verify in the same branch and worktree that applied this phase.');
    if (phase === 'flags') checkFlagTargets();
    report.releaseScan = previous.releaseScan;
    tableReady = true;
    report.applied = true;
  } else applyPhase();
  if (options.apply) writeJson(path.join(output, `${phase}-last-apply.json`), report);
  if (report.applied) verifyPhase();
} catch (error) {
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  writeJson(reportFile, report);
  writeAtomic(bodyPath, prBody());
  console.log(`Checks: ${reportFile}\nPR body: ${bodyPath}`);
}
