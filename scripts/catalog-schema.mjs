// Trusted Contextual Recommendations, Phase 1 (docs/prd-trusted-contextual-recommendations.md,
// docs/trd-trusted-contextual-recommendations.md) -- the versioned catalog
// contract and contentStatus state machine frozen by Gate 0
// (docs/gate0-policy-trusted-recommendations.md, policyVersion: 1).
//
// contentStatus (and the normalized numeric recommendedAge) are deliberately
// NOT stored per-record in the data-*.js files. Both are 100% mechanically
// derivable from fields the catalog already stores (flags, ca/la, audit-script
// membership, csmRecheckVersion/csmRecheckedAt) -- Gate 0 §3 gives an exact,
// judgment-free mapping, so persisting a redundant copy would just be caching
// a derived value with a real staleness risk (the stored copy could drift
// from its inputs) for zero benefit. This mirrors how the app already treats
// other derived-from-stored-flags values (e.g. movieFitForKids()'s verdict)
// as computed, not stored.
//
// recommendedAge() here mirrors index.html's own recommendedAge()/parseAge()
// exactly (same regex, same ca-then-la fallback) -- keep both in sync, same
// convention scripts/audit-content-flags.mjs already uses for its own
// parseAge() mirror.

export const CONTENT_STATUSES = ['certified', 'provisional', 'conflicted', 'stale', 'unknown'];

export const FRESHNESS_WINDOW_MONTHS = 18; // Gate 0 §4

const CONTENT_FLAG_IDS = ['violence', 'language', 'romance', 'drinking'];

export function parseAge(ca) {
  const m = /^~?(\d+)\+/.exec((ca || '').trim());
  return m ? parseInt(m[1], 10) : null;
}

// Gate 0 §1's normalized numeric recommendedAge, kept separate from `ca`'s
// display copy. Falls back to `la` for the 17 catalog entries whose `ca` is
// the substitute-source placeholder string but whose `la` still holds the
// real numeric age they were originally researched at.
export function recommendedAge(movie) {
  const fromCa = parseAge(movie.ca);
  return fromCa !== null ? fromCa : parseAge(movie.la);
}

export function hasCompleteFlags(movie) {
  return !!(movie.flags && typeof movie.flags === 'object' &&
    CONTENT_FLAG_IDS.every(id => Number.isInteger(movie.flags[id])));
}

// Mirrors validate-data.mjs's runtimeMinutes/runtimeSourceId/runtimeVerifiedAt
// co-required check -- all three must be present and well-formed, not just
// runtimeMinutes, so "verified" here can't drift from what the validator
// itself considers verified if this function is ever used somewhere that
// doesn't sit behind validate-data.mjs's exit-1 gate.
//
// Most current runtimeMinutes values (runtimeSourceId:
// "imdb-noncommercial-dataset-2026-09-21") derive from the IMDb Non-Commercial
// Datasets (data-runtimes.json is the retained source-of-record snapshot).
// That dataset is licensed for personal/non-commercial use -- fine for this
// app today, but re-check IMDb's licensing terms before any commercial use of
// the catalog (ads, a paid tier, redistribution of the dataset itself, etc.).
export function hasVerifiedRuntime(movie) {
  return Number.isInteger(movie.runtimeMinutes) && movie.runtimeMinutes > 0 &&
    typeof movie.runtimeSourceId === 'string' && movie.runtimeSourceId.trim() !== '' &&
    typeof movie.runtimeVerifiedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(movie.runtimeVerifiedAt);
}

// Gate 0 §4: current iff csmRecheckVersion matches the live
// CONTENT_MODEL_VERSION *and* csmRecheckedAt is within the freshness window.
// A title that was never recheck-stamped (no csmRecheckedAt at all) fails
// this the same way an aged-out stamp does -- there's no evidence to call
// current either way.
export function passesFreshnessCheck(movie, contentModelVersion, now = new Date()) {
  if (movie.csmRecheckVersion !== contentModelVersion) return false;
  if (!movie.csmRecheckedAt) return false;
  const recheckedAt = new Date(`${movie.csmRecheckedAt}T00:00:00Z`);
  if (Number.isNaN(recheckedAt.getTime())) return false;
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - FRESHNESS_WINDOW_MONTHS);
  return recheckedAt >= cutoff;
}

/**
 * Gate 0 §3's state-machine mapping, applied in the priority order the
 * policy text specifies:
 *   1. open unresolved audit finding (§4)              -> conflicted
 *   2. missing structured flags OR non-normalizable age -> unknown
 *   3. csmRecheckVersion/csmRecheckedAt fail freshness   -> stale
 *   4. meets every requirement, including verified
 *      runtimeMinutes                                   -> certified
 *   5. meets every requirement except runtime            -> provisional
 *
 * `auditCandidateNums` is the Set of movie `num`s scripts/audit-content-flags.mjs
 * currently flags for manual re-research (its "open, unresolved audit
 * finding" set -- there's no separate adjudication/resolution tracking yet,
 * so "currently flagged" is "currently unresolved").
 */
export function computeContentStatus(movie, { auditCandidateNums, contentModelVersion, now = new Date() }) {
  if (auditCandidateNums.has(movie.num)) return 'conflicted';
  if (!hasCompleteFlags(movie) || recommendedAge(movie) === null) return 'unknown';
  if (!passesFreshnessCheck(movie, contentModelVersion, now)) return 'stale';
  return hasVerifiedRuntime(movie) ? 'certified' : 'provisional';
}

/**
 * Gate 0 §6's initial "Verified for Family Fit" combined filter: real
 * structured flags (all four dimensions) AND not an open audit candidate AND
 * a normalizable age. This is the filter to certify once runtimeMinutes is
 * backfilled for the titles it selects -- it does NOT itself require runtime
 * (that's applied separately, since runtime coverage is currently zero and
 * tracked independently; see computeContentStatus's `certified` vs
 * `provisional` split for the runtime-gated version of this same idea).
 * Gate 0 explicitly says to re-run this exact check before cutover since the
 * underlying data keeps changing as backfill work lands -- don't treat its
 * recorded count (989 as of 2026-09-21) as a fixed target.
 */
export function isInVerifiedForFamilyFitSubset(movie, auditCandidateNums) {
  return hasCompleteFlags(movie) && !auditCandidateNums.has(movie.num) && recommendedAge(movie) !== null;
}
