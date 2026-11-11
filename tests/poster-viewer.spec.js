import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

const pixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test.beforeEach(async ({ page }) => {
  await page.route('https://upload.wikimedia.org/**', route => route.fulfill({
    status: 200, contentType: 'image/png', body: pixelPng,
  }));
  await page.goto('/');
  await setupSampleFamily(page);
});

test('Tonight shows the pick immediately, with no title shuffle', async ({ page }) => {
  await page.locator('#tabHome').click();
  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickCard')).toBeVisible();
  await expect(page.locator('#tonightPickCard .pickShuffle')).toHaveCount(0);
  await expect(page.locator('#tonightPickTitle')).toBeVisible();
});

test('tapping a Shelf poster opens a larger view that closes on tap or Escape', async ({ page }) => {
  await page.locator('#tabBrowse').click();
  const zoom = page.locator('#list .posterZoom').first();
  const label = await zoom.getAttribute('aria-label');
  const title = label.replace('View larger poster for ', '');

  await zoom.click();
  const viewer = page.locator('#posterViewer');
  await expect(viewer).toBeVisible();
  await expect(page.locator('#posterViewerTitle')).toContainText(title);
  await expect(page.locator('#posterViewerImg')).toHaveAttribute('alt', `Poster for ${title}`);

  await page.locator('#posterViewerImg').click();
  await expect(viewer).toBeHidden();
  await expect(zoom).toBeFocused();

  await zoom.click();
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('the Tonight pick poster can be enlarged too', async ({ page }) => {
  await page.locator('#tabHome').click();
  await page.locator('#findTonightPickBtn').click();
  const zoom = page.locator('#tonightPickCard .posterZoom');
  if (await zoom.count() === 0) test.skip(true, 'this pick has no poster art');

  await zoom.click();
  await expect(page.locator('#posterViewer')).toBeVisible();
  await page.locator('#posterViewerClose').click();
  await expect(page.locator('#posterViewer')).toBeHidden();
});
