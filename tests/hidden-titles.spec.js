import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

// "Hidden from Tonight" on the Family screen: skipped and Not-interested
// titles are listed with a way to bring each one back.
const TOY_STORY = 4;
const SHREK = 502;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
});

test('shows an empty state when nothing is hidden', async ({ page }) => {
  await expect(page.locator('#hiddenTitlesEmpty')).toBeVisible();
  await expect(page.locator('#hiddenTitlesList li')).toHaveCount(0);
});

test('lists skipped and not-interested titles with their reason and days left', async ({ page }) => {
  await page.evaluate(([a, b]) => {
    markSkipped(MOVIE_INDEX_BY_NUM.get(String(a)));
    markNotInterested(MOVIE_INDEX_BY_NUM.get(String(b)));
    renderHiddenTitles();
  }, [TOY_STORY, SHREK]);
  const rows = page.locator('#hiddenTitlesList li');
  await expect(rows).toHaveCount(2);
  await expect(page.locator('#hiddenTitlesEmpty')).toBeHidden();
  await expect(rows.filter({ hasText: 'Toy Story' }).first()).toContainText('Skipped, back in 30 days');
  await expect(rows.filter({ hasText: 'Shrek' }).first()).toContainText('Not interested, back in 7 days');
});

test('Bring back removes the title from the list, storage, and the Tonight exclusion', async ({ page }) => {
  await page.evaluate(n => {
    const idx = MOVIE_INDEX_BY_NUM.get(String(n));
    markSkipped(idx);
    tonightSelection.skippedMovieNums.add(movieKey(idx));
    renderHiddenTitles();
  }, TOY_STORY);
  await page.getByRole('button', { name: 'Bring back Toy Story' }).click();
  await expect(page.locator('#hiddenTitlesList li')).toHaveCount(0);
  await expect(page.locator('#hiddenTitlesEmpty')).toBeVisible();
  const state = await page.evaluate(n => {
    const idx = MOVIE_INDEX_BY_NUM.get(String(n));
    tonightSelection.time = 999;
    return {
      stored: JSON.parse(localStorage.getItem(SKIPPED_KEY) || '{}'),
      suppressed: isSkipSuppressed(idx),
      sessionSkipped: tonightSelection.skippedMovieNums.has(movieKey(idx)),
      eligible: isTonightEligible(idx, [], false, false),
    };
  }, TOY_STORY);
  expect(Object.keys(state.stored)).toHaveLength(0);
  expect(state.suppressed).toBe(false);
  expect(state.sessionSkipped).toBe(false);
  expect(state.eligible).toBe(true);
});
