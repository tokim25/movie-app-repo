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
