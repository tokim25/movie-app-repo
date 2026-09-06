import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('renders without console errors and shows the full catalog', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('#setupScreen')).toBeVisible();
  await setupSampleFamily(page);
  await expect(page.locator('#homeScreen h1')).toHaveText('Tonight');

  const movieCount = await page.evaluate(() => MOVIES.length);
  expect(movieCount).toBeGreaterThan(500);
  await expect(page.locator('#statLeft')).toHaveText(String(movieCount));

  await page.locator('#tabBrowse').click();

  // Shelf owns browsing and catalog facets.
  const studioTileCount = await page.locator('#studioGrid .studioTile').count();
  expect(studioTileCount).toBeGreaterThan(0);

  await page.locator('#studioGrid .moreStudiosTile').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });
  const rowCount = await page.locator('#list > li.row').count();
  expect(rowCount).toBeGreaterThan(0);

  expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
});
