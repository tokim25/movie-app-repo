import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('shelf rows show fit against selected child content settings', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });

  await expect(page.locator('#list .fitSignal').first()).toBeVisible();
  await expect(page.locator('#list .fitSignal').first()).toContainText(/Fits|Review|Above/);
});
