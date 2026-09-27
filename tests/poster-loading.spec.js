import { test, expect } from '@playwright/test';
import { switchToFlatView, rows } from './helpers.js';

const pixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('visible poster images are requested eagerly', async ({ page }) => {
  let posterRequests = 0;
  await page.route('https://upload.wikimedia.org/**', async (route) => {
    posterRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: pixelPng,
    });
  });

  await page.goto('/');
  await switchToFlatView(page);

  await expect(rows(page).first().locator('.poster img')).toHaveAttribute('loading', 'eager');
  await expect.poll(() => posterRequests).toBeGreaterThan(0);
});

test('movies without mapped artwork render a generic title-year fallback', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);
  await page.locator('#search').fill('Jett Jackson: The Movie');

  const row = rows(page).filter({ hasText: 'Jett Jackson: The Movie' });
  await expect(row.locator('.posterFallback')).toContainText('Movie');
  await expect(row.locator('.posterFallbackYear')).toHaveText('2001');
});

test('a failed remote poster request keeps the poster slot and shows the fallback', async ({ page }) => {
  await page.route('https://upload.wikimedia.org/**', route => route.abort('failed'));
  await page.goto('/');
  await switchToFlatView(page);

  const first = rows(page).first();
  await expect(first.locator('.poster')).toBeVisible();
  await expect(first.locator('.posterFallback')).toBeVisible();
});

test('verified runtime appears in shelf metadata across the catalog', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  await page.locator('#search').fill('Peter Pan (Broadway Musical)');
  await expect(rows(page).filter({ hasText: 'Peter Pan (Broadway Musical)' }).locator('.runtime')).toHaveText('1h 44m');

  await page.locator('#search').fill('Toy Story');
  await expect(rows(page).filter({ hasText: 'Toy Story (1995)' }).locator('.runtime')).toHaveText('1h 21m');
});
