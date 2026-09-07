#!/usr/bin/env node
// Real, enforced rate-limit coordination for the movie-watchlist-updater
// backfill (see .claude/skills/movie-watchlist-updater/SKILL.md). Multiple
// concurrent research subagents share ONE state file so the limits below
// apply to the *wave* as a whole, not per-agent -- a subagent that only
// throttles itself does nothing to stop 3 siblings from still hammering
// CSM at the same time.
//
// Usage (each subagent runs this immediately before an actual CSM/fallback
// fetch, and only proceeds with the fetch if it exits 0):
//
//   node scripts/csm-rate-guard.mjs acquire
//     Blocks (sleeps) if the wave is at the per-minute cap, then records
//     this request and exits 0 -- go ahead and fetch.
//     Exits 2 immediately (does NOT sleep-and-retry) if the shared nightly
//     cap is reached, or if another subagent already signaled a block.
//     This is deliberate: per the team's decision, a rate-limit signal
//     means "stop for the night," not "retry harder" -- the per-title
//     csmRecheckedAt/csmRecheckVersion tracking (elsewhere) means next
//     run's batch selection naturally resumes wherever this one stopped.
//
//   node scripts/csm-rate-guard.mjs signal-block "reason"
//     Call this the moment any subagent sees a 429, CAPTCHA, or other
//     block-shaped response from CSM/Wikipedia/IMDb. Every other
//     concurrent subagent's next `acquire` call will see it and abort too
//     -- one agent hitting a wall stops the whole wave, not just itself.
//
//   node scripts/csm-rate-guard.mjs status
//     Prints current counts without mutating state. For visibility/debug.
//
//   node scripts/csm-rate-guard.mjs reset
//     Clears state (new night, or manual re-run). Not called automatically
//     mid-run -- date rollover (see below) handles the normal nightly case.
//
// Config (env vars, all optional):
//   CSM_RATE_PER_MINUTE   requests allowed per rolling 60s window (default 10)
//   CSM_RATE_NIGHTLY_CAP  hard total requests/night before abort (default 220)
//   CSM_RATE_STATE_FILE   state file path (default: repo-root .csm-rate-state.json)
//
// State is local, not committed (gitignored) -- it's per-checkout run
// bookkeeping, not application data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const PER_MINUTE_CAP = parseInt(process.env.CSM_RATE_PER_MINUTE, 10) || 10;
const NIGHTLY_CAP = parseInt(process.env.CSM_RATE_NIGHTLY_CAP, 10) || 220;
const STATE_FILE = process.env.CSM_RATE_STATE_FILE || path.join(REPO_ROOT, '.csm-rate-state.json');
const LOCK_FILE = `${STATE_FILE}.lock`;
const WINDOW_MS = 60 * 1000;

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function defaultState() {
  return { date: todayUTC(), nightlyCount: 0, recentTimestamps: [], blocked: null };
}

function readState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.recentTimestamps)) return defaultState();
    if (raw.date !== todayUTC()) return defaultState(); // new night: fresh budget
    return raw;
  } catch {
    return defaultState(); // missing or corrupt -- start clean rather than fail closed forever
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exclusive-create is atomic on POSIX filesystems: only one process can
// succeed when several race to create the same file with 'wx'. That's the
// actual mutex here, not a convention -- everything else is best-effort.
async function withLock(fn) {
  const deadline = Date.now() + 15000;
  for (;;) {
    try {
      fs.closeSync(fs.openSync(LOCK_FILE, 'wx'));
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() > deadline) {
        // A crashed process could in principle leave a stale lock behind.
        // Breaking a 15s-old lock is safer than blocking every subagent
        // forever over one dead one -- the critical sections below are
        // all sub-millisecond file I/O, never legitimately held that long.
        try {
          const age = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
          if (age > 15000) { fs.unlinkSync(LOCK_FILE); continue; }
        } catch { /* lock vanished between the stat and here -- fine, loop */ }
      }
      await sleep(50 + Math.random() * 100);
    }
  }
  try {
    return await fn();
  } finally {
    try { fs.unlinkSync(LOCK_FILE); } catch { /* already gone -- fine */ }
  }
}

async function acquire() {
  for (;;) {
    const outcome = await withLock(() => {
      const state = readState();

      if (state.blocked) {
        writeState(state);
        return { type: 'abort', reason: `CSM block previously signaled: ${state.blocked.reason} (at ${state.blocked.at})` };
      }

      if (state.nightlyCount >= NIGHTLY_CAP) {
        writeState(state);
        return { type: 'abort', reason: `nightly cap reached (${state.nightlyCount}/${NIGHTLY_CAP})` };
      }

      const now = Date.now();
      state.recentTimestamps = state.recentTimestamps.filter(t => now - t < WINDOW_MS);

      if (state.recentTimestamps.length >= PER_MINUTE_CAP) {
        const oldest = Math.min(...state.recentTimestamps);
        const waitMs = Math.max(250, WINDOW_MS - (now - oldest) + 250);
        writeState(state); // persist the prune even though we're not proceeding yet
        return { type: 'wait', waitMs };
      }

      state.recentTimestamps.push(now);
      state.nightlyCount += 1;
      writeState(state);
      return { type: 'proceed', nightlyCount: state.nightlyCount };
    });

    if (outcome.type === 'proceed') {
      console.log(`OK: proceed (request ${outcome.nightlyCount}/${NIGHTLY_CAP} tonight)`);
      return 0;
    }
    if (outcome.type === 'abort') {
      console.error(`ABORT: ${outcome.reason}`);
      console.error('Do not retry. Stop this run -- csmRecheckedAt/csmRecheckVersion tracking means the next run resumes from here.');
      return 2;
    }
    // type === 'wait': sleep OUTSIDE the lock so other subagents aren't
    // blocked from checking/recording while this one waits its turn.
    await sleep(outcome.waitMs);
  }
}

function signalBlock(reason) {
  return withLock(() => {
    const state = readState();
    state.blocked = { reason: reason || 'unspecified', at: new Date().toISOString() };
    writeState(state);
    console.error(`Signaled block to all subagents sharing this state file: ${state.blocked.reason}`);
    return 0;
  });
}

function status() {
  const state = readState();
  const now = Date.now();
  const recentCount = state.recentTimestamps.filter(t => now - t < WINDOW_MS).length;
  console.log(JSON.stringify({
    date: state.date,
    nightlyCount: state.nightlyCount,
    nightlyCap: NIGHTLY_CAP,
    requestsInLastMinute: recentCount,
    perMinuteCap: PER_MINUTE_CAP,
    blocked: state.blocked
  }, null, 2));
  return 0;
}

function reset() {
  try { fs.unlinkSync(STATE_FILE); } catch { /* already gone */ }
  console.log('Rate-limit state reset.');
  return 0;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  let code;
  switch (cmd) {
    case 'acquire': code = await acquire(); break;
    case 'signal-block': code = await signalBlock(rest.join(' ')); break;
    case 'status': code = status(); break;
    case 'reset': code = reset(); break;
    default:
      console.error('Usage: csm-rate-guard.mjs <acquire|signal-block "reason"|status|reset>');
      code = 1;
  }
  process.exit(code);
}

main();
