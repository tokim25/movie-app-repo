import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { mainWorktree, repoRoot, writeAtomic } from './catalog-evidence.mjs';

export function catalogSourceRequests() {
  const state = path.resolve(process.env.CSM_RATE_STATE_FILE || path.join(mainWorktree(), '.csm-rate-state.json'));
  const env = { ...process.env, CSM_RATE_STATE_FILE: state };
  const lock = `${state}.screen.lock`;
  let locked = false;

  function guard(verb, ...args) {
    const child = spawnSync(process.execPath, ['scripts/csm-rate-guard.mjs', verb, ...args], { cwd: repoRoot, env, encoding: 'utf8' });
    if (child.status !== 0) throw new Error((child.stderr || child.error?.message || `Cannot ${verb} rate guard`).trim());
  }

  function enter() {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = Number(fs.readFileSync(lock, 'utf8'));
      if (!Number.isInteger(owner) || owner <= 0) throw error;
      try { process.kill(owner, 0); }
      catch (probe) {
        if (probe.code !== 'ESRCH') throw probe;
        fs.unlinkSync(lock);
        fs.writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
        locked = true;
        return;
      }
      throw new Error(`A catalog source worker already holds the shared lock (PID ${owner}).`);
    }
    locked = true;
  }

  function close() {
    if (locked) fs.rmSync(lock, { force: true });
    locked = false;
  }

  function block(message) {
    guard('signal-block', message);
    throw new Error(message);
  }

  async function request(url, { body, headers, head, kind, interrupted = () => false, started = () => {} }) {
    if (!locked) throw new Error('Acquire the shared catalog source worker lock before fetching.');
    const { origin, username, password } = new URL(url);
    const expectedOrigin = { csm: 'https://www.commonsensemedia.org', wikipedia: 'https://en.wikipedia.org', poster: 'https://upload.wikimedia.org' }[kind];
    if (!expectedOrigin || origin !== expectedOrigin || username || password) throw new Error(`Unsupported ${kind} source URL: ${url}`);
    // Keep the original shared CSM timestamp. Wikimedia and Wikipedia use an
    // independent timestamp and the same worker lock and aggregate guard.
    const suffix = kind === 'csm' ? '' : '-wiki';
    const timestamp = path.join(path.dirname(state), `.scratch-${path.basename(state)}-last-request${suffix}`);
    const previous = fs.existsSync(timestamp) ? Number(fs.readFileSync(timestamp, 'utf8')) : 0;
    await setTimeout(Math.max(0, (kind === 'csm' ? 7100 : 1500) + previous - Date.now()));
    if (interrupted()) throw new Error('Interrupted before the next source request.');
    guard('acquire');
    if (interrupted()) throw new Error('Interrupted before the next source request.');
    writeAtomic(timestamp, String(Date.now()));
    started();
    const output = headers ? ['--dump-header', headers] : [];
    if (head) output.push('--head');
    const child = spawnSync('curl', ['-q', '--silent', '--show-error', '--compressed', '--proto', '=https', '--connect-timeout', '12', '--max-time', '28',
      '--user-agent', 'movie-catalog-research/1.0', ...output, '--output', body, '--write-out', '%{http_code}\n%{redirect_url}', url], { encoding: 'utf8' });
    if (child.status !== 0) block(`${kind} transport error: ${child.stderr?.trim() || child.error?.message || 'request failed'}`);
    const [status, redirect] = child.stdout.trim().split('\n');
    if (status === '429' && kind !== 'csm') {
      // Record the stop before resting so every other guard participant sees it.
      guard('signal-block', `${kind} HTTP 429 for ${url}`);
      await setTimeout(6000);
      throw new Error(`${kind} HTTP 429 for ${url}`);
    }
    return { status, redirect };
  }

  return { enter, close, block, request, checkpoint: message => guard('checkpoint', message) };
}
