import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

// Regression test for issue #143: advancing the catalog list's pagination left the
// page scrolled wherever the user had scrolled to reach the "Next" button, instead of
// returning to the top of the results -- easy to miss on a page tall enough that the
// pagination controls sit far below the fold.
test('changing list pagination scrolls the results back into view', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#studioGrid .moreStudiosTile').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });

  await expect(page.locator('#listPageNextBtn')).toBeEnabled();
  await page.locator('#listPageNextBtn').scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  expect(scrollBefore).toBeGreaterThan(0);

  await page.locator('#listPageNextBtn').click();
  await expect(page.locator('#listPageStatus')).toContainText('Page 2');
  await expect.poll(() => page.evaluate(() => document.getElementById('list').getBoundingClientRect().top)).toBeLessThan(200);

  await page.locator('#listPagePrevBtn').scrollIntoViewIfNeeded();
  await page.locator('#listPagePrevBtn').click();
  await expect(page.locator('#listPageStatus')).toContainText('Page 1');
  await expect.poll(() => page.evaluate(() => document.getElementById('list').getBoundingClientRect().top)).toBeLessThan(200);
});
