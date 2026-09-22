import { test, expect } from '@playwright/test';
import {
  parseAge,
  recommendedAge,
  hasCompleteFlags,
  hasVerifiedRuntime,
  passesFreshnessCheck,
  computeContentStatus,
  isInVerifiedForFamilyFitSubset
} from '../scripts/catalog-schema.mjs';

// Plain Node-level assertions against scripts/catalog-schema.mjs -- no
// browser page needed. Covers Gate 0 §1/§3's normalized recommendedAge and
// contentStatus state-machine mapping (docs/gate0-policy-trusted-recommendations.md),
// since neither has a natural Playwright/DOM-level test otherwise.

const fullFlags = { violence: 2, language: 1, romance: 2, drinking: 1 };

function baseMovie(overrides = {}) {
  return {
    num: 1,
    t: 'Test Movie',
    ca: '7+',
    la: '7+',
    flags: { ...fullFlags },
    csmRecheckedAt: '2026-09-01',
    csmRecheckVersion: 2,
    ...overrides
  };
}

test.describe('recommendedAge (Gate 0 §1)', () => {
  test('parses a normal ca string', () => {
    expect(recommendedAge(baseMovie({ ca: '9+', la: '9+' }))).toBe(9);
  });

  test('falls back to la when ca is the substitute-source placeholder', () => {
    const movie = baseMovie({ ca: 'Not on CSM; substitute source used', la: '8+' });
    expect(recommendedAge(movie)).toBe(8);
  });

  test('returns null when neither ca nor la parses', () => {
    const movie = baseMovie({ ca: 'Not on CSM; substitute source used', la: 'DCOM' });
    expect(recommendedAge(movie)).toBeNull();
  });

  test('parseAge alone does not fall back (recommendedAge is the normalizing wrapper)', () => {
    expect(parseAge('Not on CSM; substitute source used')).toBeNull();
  });
});

test.describe('hasCompleteFlags / hasVerifiedRuntime', () => {
  test('true only when all four flag dimensions are present', () => {
    expect(hasCompleteFlags(baseMovie())).toBe(true);
    expect(hasCompleteFlags(baseMovie({ flags: { violence: 2, language: 1, romance: 2 } }))).toBe(false);
    expect(hasCompleteFlags(baseMovie({ flags: undefined }))).toBe(false);
  });

  test('true only when runtimeMinutes, runtimeSourceId, and runtimeVerifiedAt are all present and well-formed', () => {
    const full = { runtimeMinutes: 94, runtimeSourceId: 'wikipedia', runtimeVerifiedAt: '2026-09-01' };
    expect(hasVerifiedRuntime(baseMovie(full))).toBe(true);
    expect(hasVerifiedRuntime(baseMovie({ ...full, runtimeMinutes: 0 }))).toBe(false);
    expect(hasVerifiedRuntime(baseMovie({ ...full, runtimeSourceId: '' }))).toBe(false);
    expect(hasVerifiedRuntime(baseMovie({ ...full, runtimeVerifiedAt: 'not-a-date' }))).toBe(false);
    expect(hasVerifiedRuntime(baseMovie({ runtimeMinutes: 94 }))).toBe(false);
    expect(hasVerifiedRuntime(baseMovie())).toBe(false);
  });
});

test.describe('passesFreshnessCheck (Gate 0 §4)', () => {
  const now = new Date('2026-09-21T00:00:00Z');

  test('passes when version matches and recheck is within 18 months', () => {
    const movie = baseMovie({ csmRecheckVersion: 2, csmRecheckedAt: '2026-01-01' });
    expect(passesFreshnessCheck(movie, 2, now)).toBe(true);
  });

  test('fails when csmRecheckVersion does not match the live content model version', () => {
    const movie = baseMovie({ csmRecheckVersion: 1, csmRecheckedAt: '2026-09-01' });
    expect(passesFreshnessCheck(movie, 2, now)).toBe(false);
  });

  test('fails when csmRecheckedAt is older than 18 months', () => {
    const movie = baseMovie({ csmRecheckVersion: 2, csmRecheckedAt: '2024-01-01' });
    expect(passesFreshnessCheck(movie, 2, now)).toBe(false);
  });

  test('fails when csmRecheckedAt is missing entirely', () => {
    const movie = baseMovie({ csmRecheckVersion: 2, csmRecheckedAt: undefined });
    expect(passesFreshnessCheck(movie, 2, now)).toBe(false);
  });
});

test.describe('computeContentStatus (Gate 0 §3 state-machine mapping)', () => {
  const now = new Date('2026-09-21T00:00:00Z');
  const opts = (auditNums) => ({ auditCandidateNums: new Set(auditNums), contentModelVersion: 2, now });

  test('an open audit candidate is conflicted, regardless of otherwise-complete data', () => {
    const movie = baseMovie({ num: 42, runtimeMinutes: 90, runtimeSourceId: 'x', runtimeVerifiedAt: '2026-09-01' });
    expect(computeContentStatus(movie, opts([42]))).toBe('conflicted');
  });

  test('missing flags is unknown', () => {
    const movie = baseMovie({ flags: undefined });
    expect(computeContentStatus(movie, opts([]))).toBe('unknown');
  });

  test('a non-normalizable age is unknown', () => {
    const movie = baseMovie({ ca: 'Not on CSM; substitute source used', la: 'DCOM' });
    expect(computeContentStatus(movie, opts([]))).toBe('unknown');
  });

  test('complete flags and age but a stale recheck is stale', () => {
    const movie = baseMovie({ csmRecheckVersion: 1 });
    expect(computeContentStatus(movie, opts([]))).toBe('stale');
  });

  test('current and complete but no verified runtime is provisional', () => {
    const movie = baseMovie();
    expect(computeContentStatus(movie, opts([]))).toBe('provisional');
  });

  test('current, complete, and a verified runtime is certified', () => {
    const movie = baseMovie({ runtimeMinutes: 94, runtimeSourceId: 'wikipedia', runtimeVerifiedAt: '2026-09-01' });
    expect(computeContentStatus(movie, opts([]))).toBe('certified');
  });

  test('priority order: an audit candidate is conflicted even if flags are also missing', () => {
    const movie = baseMovie({ num: 7, flags: undefined });
    expect(computeContentStatus(movie, opts([7]))).toBe('conflicted');
  });
});

test.describe('isInVerifiedForFamilyFitSubset (Gate 0 §6)', () => {
  test('true when flags are complete, age normalizes, and it is not an audit candidate', () => {
    expect(isInVerifiedForFamilyFitSubset(baseMovie({ num: 5 }), new Set())).toBe(true);
  });

  test('false when it is an open audit candidate', () => {
    expect(isInVerifiedForFamilyFitSubset(baseMovie({ num: 5 }), new Set([5]))).toBe(false);
  });

  test('false when flags are incomplete', () => {
    expect(isInVerifiedForFamilyFitSubset(baseMovie({ flags: undefined }), new Set())).toBe(false);
  });

  test('does not require runtimeMinutes (that is the certified/provisional split, not this filter)', () => {
    const movie = baseMovie({ runtimeMinutes: undefined });
    expect(isInVerifiedForFamilyFitSubset(movie, new Set())).toBe(true);
  });
});
