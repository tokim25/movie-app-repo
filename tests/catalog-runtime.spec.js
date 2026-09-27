import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('every catalog movie has a verified runtime and displays it on Shelf', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  const missing = await page.evaluate(() => MOVIES
    .filter(movie => !Number.isInteger(movie.runtimeMinutes) || movie.runtimeMinutes <= 0 ||
      !movie.runtimeSourceId || !/^\d{4}-\d{2}-\d{2}$/.test(movie.runtimeVerifiedAt || ''))
    .map(movie => ({ num: movie.num, title: movie.t })));

  expect(missing).toEqual([]);
  await page.locator('#tabBrowse').click();
  await page.locator('#studioGrid .moreStudiosTile').click();
  await expect(page.locator('#list .badge.runtime').first()).toBeVisible();
});
