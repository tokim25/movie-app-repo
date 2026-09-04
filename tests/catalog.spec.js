import { test, expect } from '@playwright/test';

test('renders without console errors and shows the full catalog', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Family Feature');

  const movieCount = await page.evaluate(() => MOVIES.length);
  expect(movieCount).toBeGreaterThan(500);
  await expect(page.locator('#statLeft')).toHaveText(String(movieCount));

  // Home is the default landing screen: real catalog-driven studio tiles
  // should render there without navigating anywhere first.
  const studioTileCount = await page.locator('#studioGrid .studioTile').count();
  expect(studioTileCount).toBeGreaterThan(0);

  // The grouped browse-by-studio view (now reached via the "More studios"
  // tile) should still have real content too.
  await page.locator('#studioGrid .moreStudiosTile').click();
  await page.locator('#groupedView').waitFor({ state: 'visible' });
  const studioGroupCount = await page.locator('#groupedView .studioGroup').count();
  expect(studioGroupCount).toBeGreaterThan(0);

  expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
});
