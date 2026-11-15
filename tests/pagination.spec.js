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

  // Dispatch directly so this specifically exercises the manual fallback;
  // scrolling to the button intentionally triggers the automatic loader.
  await page.locator('#listShowMoreBtn').dispatchEvent('click');
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

test('Compact Shelf rows are shorter and the preference survives reload', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  const comfortableHeight = await page.locator('#list > li.row').first().evaluate(row => row.getBoundingClientRect().height);
  await page.locator('#compactDensityBtn').click();
  const compactHeight = await page.locator('#list > li.row').first().evaluate(row => row.getBoundingClientRect().height);
  expect(compactHeight).toBeLessThanOrEqual(66);
  expect(compactHeight).toBeLessThan(comfortableHeight);

  await page.reload();
  await expect(page.locator('#compactDensityBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#list')).toHaveClass(/shelfCompact/);
});

test('decade headings stick and the jump control loads a distant decade', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  await expect(page.locator('#list .chapterHead').first()).toHaveCSS('position', 'sticky');
  await page.locator('#shelfJumpSelect').selectOption('decade:2020');
  await expect(page.locator('#shelf-decade-2020')).toBeFocused();
  expect(await page.locator('#list > li.row').count()).toBeGreaterThan(50);
});

test('the jump control switches from decades to A-Z when sorted by title', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#filterSheetBtn').click();
  await page.locator('#sortMode').selectOption('title');
  await page.locator('#applyFiltersBtn').click();

  await expect(page.locator('#shelfJumpLabel')).toHaveText('Jump to letter');
  await expect(page.locator('#shelfJumpSelect option[value="letter:A"]')).toHaveCount(1);
});

test('nearing the end automatically loads the next 50 without moving focus', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#search').focus();
  await page.locator('#listPagination').scrollIntoViewIfNeeded();

  await expect(page.locator('#list > li.row')).toHaveCount(100);
  await expect(page.locator('#search')).toBeFocused();
});
