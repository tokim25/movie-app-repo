// The rule that turns Common Sense Media (CSM) category scores into the app's
// content flags, for titles added from 2026-11-05 on. Written down after a
// calibration against 108 already-flagged titles (96% exact agreement, every
// miss exactly one level HIGHER than this table, none lower) and a review by
// a mathematician, a data architect and a dissenting safety reviewer. See
// PENDING_REQUESTS.md (11/5/2026) and the movie-watchlist-updater skill.
//
// The rule, in full:
//   1. Base map, the same for violence, language, romance and drinking:
//        CSM 0 -> 1, 1 -> 2, 2 -> 2, 3 -> 3, 4 -> 4, 5 -> 4.
//      CSM's "sex" score feeds romance and "drugs" feeds drinking.
//   2. Never below the base map. A flag may go ONE level above it (cap 4) only
//      when CSM's own text shows the content depicted on screen, and each such
//      bump records a verbatim quote from the entry's `full` and a reason.
//      Text is mandatory for violence 2, drinking 3, and language or romance 0
//      where the text mentions any (that is where the bumps cluster).
//   3. Hold-outs: if ANY CSM score is 4 or higher, or the CSM age is 10 or
//      higher, derive nothing. The title stays unflagged (never an automatic
//      Tonight pick) until a human reads it. Numbers cannot express what a
//      film like Wildwood does.
//   4. A title with no CSM review, or a snippet-only read, is never derived.
//
// Bump FLAG_RULE_VERSION only when the base map or the hold-outs change.
// csmRecheckVersion is NOT this number: it is the content-model version
// (CONTENT_MODEL_VERSION in index.html).

export const FLAG_RULE_VERSION = 1;

// app flag id -> CSM score key
export const CATEGORY_SOURCES = {
  violence: 'v',
  language: 'l',
  romance: 's',
  drinking: 'd'
};

const BASE = { 0: 1, 1: 2, 2: 2, 3: 3, 4: 4, 5: 4 };

export function baseLevel(score) {
  if (!Number.isInteger(score) || score < 0 || score > 5) {
    throw new Error(`CSM score must be an integer 0-5, got ${score}`);
  }
  return BASE[score];
}

// Returns a reason string when the title must NOT be derived, else null.
export function holdReason(csm) {
  const scores = ['v', 's', 'l', 'd'].map(k => csm[k]);
  if (scores.some(s => s >= 4)) return 'a CSM category score of 4 or higher';
  if (csm.age >= 10) return 'a CSM age of 10 or higher';
  return null;
}

// adj: { violence: { kind: 'depicted', quote, why }, ... }
export function deriveFlags(csm, adj = {}) {
  const flags = {};
  for (const [id, key] of Object.entries(CATEGORY_SOURCES)) {
    const base = baseLevel(csm[key]);
    flags[id] = adj[id] ? Math.min(4, base + 1) : base;
  }
  return flags;
}
