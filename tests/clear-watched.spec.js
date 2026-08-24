import { test, expect } from '@playwright/test';
import { switchToFlatView, rows } from './helpers.js';

test('clearing watched marks persists and does not resurrect on reload', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  const rowLocator = rows(page);
  const count = await rowLocator.count();
  expect(count).toBeGreaterThan(2);

  for (const i of [0, 1, 2]) {
    await rowLocator.nth(i).locator('.check').click();
  }
  await expect(page.locator('#statChecked')).toHaveText('3');

  await page.locator('#clearAllBtn').click();
  await expect(page.locator('#statChecked')).toHaveText('0');

  // Clearing must write explicit false records (not delete the keys), so a
  // later merge against a stale remote/local copy can't resurrect them.
  const checkedRecords = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('family-movie-watchlist-v1'));
    return Object.values(raw.checked);
  });
  expect(checkedRecords.length).toBeGreaterThanOrEqual(3);
  expect(checkedRecords.every((record) => record.value === false)).toBe(true);
  expect(checkedRecords.every((record) => typeof record.updatedAt === 'number' && record.updatedAt > 0)).toBe(true);

  await page.reload();
  await switchToFlatView(page);

  await expect(page.locator('#statChecked')).toHaveText('0');
  expect(await page.locator('#list > li.row.checked').count()).toBe(0);
});
