import { test, expect } from '@playwright/test';
import { switchToFlatView, rows } from './helpers.js';

test('every movie\'s Pre-Show notes can be read as plain before/after text', async ({ page }) => {
  await page.goto('/');
  const counts = await page.evaluate(() => {
    const result = { movies: 0, before: 0, gentle: 0, askAfter: 0, callouts: 0, askAfterInCode: 0, gentleInCode: 0 };
    for (const movie of MOVIES) {
      const code = (movieGuidanceFor(movie.num) || {}).preShow || '';
      result.movies += 1;
      if (/Callout\("warning"/.test(code)) result.callouts += 1;
      if (/"Ask after:/.test(code)) result.askAfterInCode += 1;
      if (/"Gentle\./.test(code)) result.gentleInCode += 1;
      const notes = preShowNotes(movie);
      if (notes.before) result.before += 1;
      if (notes.gentle) result.gentle += 1;
      if (notes.askAfter) result.askAfter += 1;
    }
    return result;
  });
  expect(counts.movies).toBeGreaterThan(0);
  expect(counts.before).toBe(counts.callouts);
  expect(counts.askAfter).toBe(counts.askAfterInCode);
  expect(counts.gentle).toBe(counts.gentleInCode);
  expect(counts.before + counts.gentle).toBeGreaterThan(0);
});

test('a Shelf movie\'s details show what to prep for and a question to ask after', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);
  await page.locator('#search').fill('Missing Link');

  const row = rows(page).filter({ hasText: 'Missing Link (2019)' });
  await row.locator('.detailLink').click();

  const guide = page.locator('#shelf-list-detail-1145 .detailGuide');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Before you watch: A terrifying villain threat.');
  await expect(guide).toContainText('Ask after: What did Sir Lionel learn about friendship from his Bigfoot companion?');
});
