import { test, expect } from '@playwright/test';

// Regression coverage for movieFitForKids()'s red/amber/green thresholds.
// Exercised directly via page.evaluate() rather than through the UI: it's a
// pure function of (movie content level, child's limit) and the interesting
// cases are about the scoring math itself, not rendering.

async function verdictFor(page, level, limit) {
  return page.evaluate(
    ({ level, limit }) => {
      const fit = movieFitForKids(
        { t: 'Test Movie', ca: '10+', genre: [], flags: { violence: level, language: 1, romance: 1, drinking: 1 } },
        [{ age: 10, settings: { violence: { source: 'parent', value: limit } } }]
      );
      const violenceIssue = fit.issues.find((i) => i.flag.id === 'violence');
      return violenceIssue ? violenceIssue.severity : 'green';
    },
    { level, limit }
  );
}

// Bug (fixed here): on this fixed 4-level scale, `level - limit >= 2` can
// never be true once limit reaches 3 (max level 4 - limit 3 = 1), so red
// became permanently unreachable in a category the moment a parent set that
// category's limit to 3 or 4 -- no matter how extreme a title's content in
// that category turned out to be. Fix: level 4 (the top of the scale) is
// always at least red unless the parent has explicitly set limit=4 too.
//
// This table is the full 4x4 matrix (every limit 1-4 against every level
// 1-4) so a future change to this formula gets caught here, not just for
// the one title that originally surfaced the bug.
const EXPECTED = {
  1: { 1: 'green', 2: 'amber', 3: 'red', 4: 'red' },
  2: { 1: 'green', 2: 'green', 3: 'amber', 4: 'red' },
  3: { 1: 'green', 2: 'green', 3: 'green', 4: 'red' },
  4: { 1: 'green', 2: 'green', 3: 'green', 4: 'green' }
};

test('red/amber/green reachability holds across the full limit x level matrix', async ({ page }) => {
  await page.goto('/');
  for (const limit of [1, 2, 3, 4]) {
    for (const level of [1, 2, 3, 4]) {
      const verdict = await verdictFor(page, level, limit);
      expect(verdict, `level=${level}, limit=${limit}`).toBe(EXPECTED[limit][level]);
    }
  }
});

test('a limit of 3 or 4 can still reach red for level-4 content (the original bug)', async ({ page }) => {
  await page.goto('/');
  expect(await verdictFor(page, 4, 3)).toBe('red');
  // A parent who has explicitly opted into the top tier sees green, not red,
  // for top-tier content -- that's intentional, not a regression of this fix.
  expect(await verdictFor(page, 4, 4)).toBe('green');
});

test('Romeo and Juliet (violence:3, romance:3) is green for a limit-3 parent, matching the reported non-bug', async ({ page }) => {
  await page.goto('/');
  const verdict = await page.evaluate(() => {
    const movie = { t: 'Romeo and Juliet', ca: '14+', genre: [], flags: { violence: 3, language: 1, romance: 3, drinking: 1 } };
    const child = {
      age: 12,
      settings: {
        violence: { source: 'parent', value: 3 },
        romance: { source: 'parent', value: 3 }
      }
    };
    return movieFitForKids(movie, [child]).verdict;
  });
  expect(verdict).toBe('green');
});
