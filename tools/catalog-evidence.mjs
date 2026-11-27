import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../', import.meta.url));
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const stages = ['review', 'screen', 'wikipedia', 'decision'];

export function git(...args) {
  const child = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (child.status !== 0) throw new Error(child.stderr?.trim() || child.error?.message || `git ${args[0]} failed.`);
  return child.stdout.trimEnd();
}

export function mainWorktree() {
  return path.dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir'));
}

export function catalogCacheDirectory(directory) {
  return path.resolve(directory ?? path.join(mainWorktree(), '.scratch-csm-cache'));
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeAtomic(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, data, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function evidenceDirectory(cacheDir, slug) {
  if (typeof slug !== 'string' || !slugPattern.test(slug)) throw new Error(`Invalid catalog slug: ${slug}`);
  return path.join(cacheDir, 'evidence', slug);
}

export function readEvidence(cacheDir, slug) {
  const directory = evidenceDirectory(cacheDir, slug);
  const record = { slug };
  for (const stage of stages) {
    try {
      const value = readJson(path.join(directory, `${stage}.json`));
      if (value.version !== 1 || value.slug !== slug || value.stage !== stage) throw new Error(`Invalid ${stage} evidence for ${slug}.`);
      record[stage] = value.evidence;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return Object.keys(record).length > 1 ? record : null;
}

// Each stage has one producer. Independent stages commit atomically and never
// rewrite one another, even when screening and editorial work overlap.
export function writeEvidence(cacheDir, slug, stage, evidence) {
  if (!stages.includes(stage)) throw new Error(`Unknown evidence stage: ${stage}`);
  writeJson(path.join(evidenceDirectory(cacheDir, slug), `${stage}.json`), { version: 1, slug, stage, evidence });
}

export function pendingQueue(queue) {
  const resolved = new Set([...queue.done, ...queue.skipped.map(row => row.slug)]);
  const unchecked = new Map();
  for (const row of [...queue.read, ...queue.candidates]) {
    if (!resolved.has(row.slug) && !unchecked.has(row.slug)) unchecked.set(row.slug, row);
  }
  return { resolved, unchecked };
}
