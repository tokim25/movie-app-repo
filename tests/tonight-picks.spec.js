import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
});

test('skip advances to a different tonight pick', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  const firstPick = await page.locator('#tonightPickTitle').textContent();

  await page.locator('#tonightSkipBtn').click();

  await expect(page.locator('#tonightPickTitle')).not.toHaveText(firstPick);
  await expect(page.locator('#toast')).toContainText('Skipped for tonight');
});

test('tonight picks from want to watch before new and general shelf', async ({ page }) => {
  const title = await page.evaluate(() => {
    const idx = MOVIES.findIndex(movie => movie.t === 'The Greatest Showman');
    if(idx < 0) throw new Error('Test movie missing');
    togglePriority(idx);
    return `${MOVIES[idx].t} (${MOVIES[idx].y})`;
  });

  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).toHaveText(title);
  await expect(page.locator('#tonightPickReasons')).toContainText('Pulled from Want to watch.');
});
