import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

// A phone page should never scroll sideways. Two things caused it: the CSM
// badge's no-wrap age label holding the long "Not on CSM; substitute source
// used" placeholder, and What's new rows whose title column was only about
// 70px wide at 320px. This walks every tab and the states that add content
// (open details, a watched pick, the Family editor) at the narrowest common
// phone width.
test.use({ viewport: { width: 320, height: 720 } });

async function expectNoSideScroll(page, where) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${where} scrolls sideways`).toBeLessThanOrEqual(clientWidth);
}

async function openTab(page, tab, screen) {
  await page.locator(tab).evaluate(el => el.click());
  await page.locator(screen).waitFor({ state: 'visible' });
}

test('no screen scrolls sideways at 320px', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  await openTab(page, '#tabBrowse', '#browseScreen');
  await expectNoSideScroll(page, 'Shelf');
  await page.locator('#list .detailLink').first().evaluate(el => el.click());
  await expectNoSideScroll(page, 'Shelf with details open');

  await openTab(page, '#tabWhatsNew', '#whatsNewScreen');
  await expectNoSideScroll(page, "What's new");
  const newDetails = page.locator('#whatsNewList .detailLink').first();
  if (await newDetails.count()) {
    await newDetails.evaluate(el => el.click());
    await expectNoSideScroll(page, "What's new with details open");
  }

  await openTab(page, '#tabHome', '#homeScreen');
  await expectNoSideScroll(page, 'Tonight');
  await page.locator('#findTonightPickBtn').evaluate(el => el.click());
  await expect(page.locator('#tonightPickTitle')).not.toBeEmpty();
  await expectNoSideScroll(page, 'Tonight with a pick');
  await page.locator('#tonightWatchBtn').evaluate(el => el.click());
  await expect(page.locator('#tonightPickCard')).toHaveClass(/watched/);
  await expectNoSideScroll(page, 'Tonight with the ticket stub');

  await openTab(page, '#tabFamily', '#familyScreen');
  await expectNoSideScroll(page, 'Family');
  await page.locator('#familyScreen .familyEditBtn:not(.primary)').first().evaluate(el => el.click());
  await expectNoSideScroll(page, 'Family with the editor open');
});

test('substitute-source titles show "No CSM age" instead of the placeholder sentence', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await openTab(page, '#tabBrowse', '#browseScreen');
  const title = await page.evaluate(() => MOVIES.find(m => m.ca === 'Not on CSM; substitute source used').t);
  await page.locator('#search').fill(title);
  const row = page.locator('#list li.row', { hasText: title }).first();
  await expect(row.locator('.badge.csm')).toContainText('No CSM age');
  await expect(row.locator('.badge.csm')).not.toContainText('substitute source');
});
