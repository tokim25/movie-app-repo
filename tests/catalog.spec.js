import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('renders without console errors and shows the full catalog', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('#homeScreen')).toBeVisible();
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await expect(page.locator('#browseScreen h1')).toHaveText('Shelf');

  const movieCount = await page.evaluate(() => MOVIES.length);
  expect(movieCount).toBeGreaterThan(500);
  await expect(page.locator('#statLeftMore')).toHaveText(String(movieCount));

  // Shelf points to the Lists tab for browsing ideas.
  await expect(page.locator('#listsTeaser')).toBeVisible();
  const rowCount = await page.locator('#list > li.row').count();
  expect(rowCount).toBeGreaterThan(0);

  expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
});
