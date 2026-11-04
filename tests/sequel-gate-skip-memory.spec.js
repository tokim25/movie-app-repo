import { test, expect } from '@playwright/test';

// Sequel gate (data-series.js) and remembered skips (skippedUntil). These
// drive the eligibility function directly with no kids selected, so the age
// and content-data gates don't interfere with what is under test.
const TOY_STORY = 4;
const TOY_STORY_2 = 493;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { tonightSelection.time = 999; });
});

const eligible = (page, num, includeSkipped = false) => page.evaluate(([n, inc]) => {
  const idx = MOVIE_INDEX_BY_NUM.get(String(n));
  return isTonightEligible(idx, [], inc, false);
}, [num, includeSkipped]);

const setWatched = (page, num, value) => page.evaluate(([n, v]) => {
  const key = movieKey(MOVIE_INDEX_BY_NUM.get(String(n)));
  state.checked[key] = { value: v, updatedAt: Date.now(), device: 'test' };
}, [num, value]);

test('a sequel is not eligible until its predecessor is marked watched', async ({ page }) => {
  expect(await eligible(page, TOY_STORY)).toBe(true);
  expect(await eligible(page, TOY_STORY_2)).toBe(false);

  await setWatched(page, TOY_STORY, true);
  expect(await eligible(page, TOY_STORY_2)).toBe(true);

  await setWatched(page, TOY_STORY, false);
  expect(await eligible(page, TOY_STORY_2)).toBe(false);
});

test('the sequel gate holds even in the last-resort pass that ignores skips', async ({ page }) => {
  expect(await eligible(page, TOY_STORY_2, true)).toBe(false);
});

test('an already-watched sequel stays eligible for Favorites replays', async ({ page }) => {
  await setWatched(page, TOY_STORY_2, true);
  await page.evaluate(() => { tonightSelection.mood = 'favorite'; });
  expect(await eligible(page, TOY_STORY_2)).toBe(true);
});

test('a skipped title stays out of picks after a reload, but not in the last-resort pass', async ({ page }) => {
  expect(await eligible(page, TOY_STORY)).toBe(true);
  await page.evaluate(n => markSkipped(MOVIE_INDEX_BY_NUM.get(String(n))), TOY_STORY);

  await page.reload();
  await page.evaluate(() => { tonightSelection.time = 999; });
  expect(await eligible(page, TOY_STORY)).toBe(false);
  expect(await eligible(page, TOY_STORY, true)).toBe(true);
});

test('a remembered skip expires after the suppression window', async ({ page }) => {
  await page.evaluate(n => {
    localStorage.setItem(SKIPPED_KEY, JSON.stringify({ [movieKey(MOVIE_INDEX_BY_NUM.get(String(n)))]: Date.now() - 1000 }));
  }, TOY_STORY);
  await page.reload();
  await page.evaluate(() => { tonightSelection.time = 999; });
  expect(await eligible(page, TOY_STORY)).toBe(true);
});

test('the Skip button records a remembered skip', async ({ page }) => {
  await page.evaluate(() => { skippedUntil = {}; });
  const idx = await page.evaluate(n => MOVIE_INDEX_BY_NUM.get(String(n)), TOY_STORY);
  await page.evaluate(i => { tonightSelection.currentPickIdx = i; skipCurrentTonightPick(); }, idx);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem(SKIPPED_KEY) || '{}'));
  expect(Object.keys(stored)).toHaveLength(1);
});
