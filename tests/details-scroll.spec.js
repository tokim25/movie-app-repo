import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 } });

test('opening a movie\'s details keeps that row in place when another open one above closes', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });

  const row = i => page.locator('#list li.row').nth(i);
  await row(10).locator('.detailLink').click();
  await expect(page.locator('#list .detail.open')).toHaveCount(1);

  const target = row(12).locator('.detailLink');
  await target.scrollIntoViewIfNeeded();
  const before = (await row(12).boundingBox()).y;
  await target.click();

  await expect(page.locator('#list .detail.open')).toHaveCount(1);
  const after = (await row(12).boundingBox()).y;
  expect(Math.abs(after - before)).toBeLessThan(2);
});
