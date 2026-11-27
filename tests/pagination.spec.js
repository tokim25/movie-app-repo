import { test, expect } from '@playwright/test';
import { blockOptionalGoogleAssets, setupSampleFamily } from './helpers.js';

test.beforeEach(blockOptionalGoogleAssets);

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

test('the permanent decade rail stays fixed and loads a distant decade', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  await expect(page.locator('#list .chapterHead').first()).toHaveCSS('position', 'sticky');
  await expect(page.locator('#shelfJumpRail')).toHaveCSS('position', 'fixed');
  await expect(page.locator('#shelfJumpRail')).toHaveCSS('box-shadow', 'none');
  expect((await page.locator('#shelfJumpRail').boundingBox()).width).toBeLessThanOrEqual(26);
  await page.getByRole('button', { name: 'Jump to the 2020s' }).click();
  await expect(page.locator('#shelf-decade-2020')).toBeFocused();
  expect(await page.locator('#list > li.row').count()).toBeGreaterThan(50);
});

// A finger dragged down the rail jumps to whichever decade is under it, the
// way a phone's A-Z contacts index works, so a tap one label off is fixed by
// sliding instead of needing a 44px target on a 26px-wide strip.
test('dragging a finger along the decade rail jumps to the decade under it', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  const from = await page.getByRole('button', { name: 'Jump to the 1950s' }).boundingBox();
  const to = await page.getByRole('button', { name: 'Jump to the 1990s' }).boundingBox();
  await page.locator('#shelfJumpItems').evaluate((rail, [a, b]) => {
    const fire = (type, y) => rail.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 7, pointerType: 'touch', clientX: a.x + a.width / 2, clientY: y
    }));
    fire('pointerdown', a.y + a.height / 2);
    fire('pointermove', (a.y + b.y) / 2);
    fire('pointermove', b.y + b.height / 2);
    fire('pointerup', b.y + b.height / 2);
  }, [from, to]);
  await expect(page.locator('#shelf-decade-1990')).toBeFocused();
  await expect(page.locator('#shelfJumpItems .scrubbing')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Jump to the 1990s' })).toHaveCSS('font-size', '12px');
});

test('the permanent rail switches from decades to A-Z when sorted by title', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#filterSheetBtn').click();
  await page.locator('#sortMode').selectOption('title');
  await page.locator('#applyFiltersBtn').click();

  await expect(page.locator('#shelfJumpLabel')).toHaveText('Jump to letter');
  await expect(page.getByRole('button', { name: 'Jump to A', exact: true })).toBeVisible();
  await expect(page.locator('#shelfJumpRail')).toBeVisible();
});

// Tabbing to Show 50 more scrolls it into view, which can trigger the
// automatic loader before the key press. The press must then focus the first
// title auto-load added, not load another 50 and skip past them.
test('a keyboard press on Show 50 more after an auto-load focuses that batch instead of skipping it', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await expect(page.locator('#list > li.row')).toHaveCount(50);
  await page.locator('#listShowMoreBtn').focus();
  await expect(page.locator('#list > li.row')).toHaveCount(100);
  await page.keyboard.press('Enter');
  await expect(page.locator('#list > li.row').nth(50).locator('.rowMain')).toBeFocused();
  await expect(page.locator('#list > li.row')).toHaveCount(100);
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
