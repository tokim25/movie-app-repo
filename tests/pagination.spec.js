import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

// Shelf grows in place: "Show 50 more" adds the next 50 below the ones
// already shown (replacing the old Previous / Next pages, issue #143), and
// focus moves to the first newly shown title so a keyboard or screen-reader
// user carries on reading from there.
test('Show 50 more adds the next 50 in place and focuses the first new one', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });

  const total = await page.evaluate(() => MOVIES.length);
  await expect(page.locator('#list > li.row')).toHaveCount(50);
  await expect(page.locator('#listPageStatus')).toHaveText(`Showing 50 of ${total.toLocaleString('en-US')}`);

  await page.locator('#listShowMoreBtn').click();
  await expect(page.locator('#list > li.row')).toHaveCount(100);
  await expect(page.locator('#listPageStatus')).toHaveText(`Showing 100 of ${total.toLocaleString('en-US')}`);
  await expect(page.locator('#list > li.row').nth(50).locator('.rowMain')).toBeFocused();
});

test('a short result list has no Show more button', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#search').fill('Toy Story');
  await expect(page.locator('#listPagination')).toBeHidden();
});

test('sorted by year, Shelf reads in decade chapters', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await expect(page.locator('#list .chapterHead').first()).toContainText(/The \d{4}s/);
  await page.locator('#search').fill('Toy Story');
  await expect(page.locator('#list .chapterHead')).toHaveCount(0);
});
