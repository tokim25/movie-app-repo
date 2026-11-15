import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';
import { expectNoA11yViolations } from './a11y.js';

// Curated lists (data-lists.js) live on their own Lists tab: the in-season
// list as a passport card, the rest as stamps on themed shelves, out-of-season
// lists as dashed stamps under "Coming back later" and tucked-away lists in a
// box at the bottom. The first in-season list also gets a card on Tonight.
// A list with fewer than 5 titles that fit the selected kids is not shown
// (Hanukkah needs only 2).

async function startOn(page, isoDate) {
  await page.clock.setFixedTime(new Date(isoDate));
  await page.goto('/');
  await setupSampleFamily(page);
}

async function openLists(page) {
  await page.locator('#tabLists').click();
  await page.locator('#listsScreen').waitFor({ state: 'visible' });
}

// Watching as adults only, every film on a list counts.
async function watchAsAdultsOnly(page) {
  await page.locator('#tabHome').click();
  await page.locator('#tonightWhoPill').click();
  for (const name of ['Simon', 'Nora']) {
    await page.locator('#tonightKidChoices .choiceChip', { hasText: name }).click();
  }
  await expect(page.locator('#tonightWhoPill')).toContainText('Adults only');
  await page.keyboard.press('Escape');
}

test('Lists is its own tab, between Tonight and Shelf', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  const labels = await page.locator('#quickBar .qbBtn > span:not(.qbCount):not(.qbDot)').allTextContents();
  expect(labels).toEqual(['Tonight', 'Lists', 'Shelf', "What's new", 'Family']);
  await openLists(page);
  await expect(page.locator('#tabLists')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#listsScreenHeading')).toHaveText('Lists');
});

test('in December, Christmas gets the passport card and opens in list order', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  const hero = page.locator('#listsBody .passport');
  await expect(hero).toContainText('Now showing');
  await expect(hero).toContainText('Christmas movies');
  await expect(hero).toContainText('Fit Simon + Nora');
  await expect(page.locator('#listsBody .stamp', { hasText: 'Snow day' })).toBeVisible();

  await hero.click();
  await expect(page.locator('#openListName')).toHaveText('Christmas movies');
  await expect(page.locator('#openListName')).toBeFocused();
  await expect(page.locator('#listOpen .coverMeta')).toContainText('Picked by hand');
  await expect(page.locator('#openListRows > li.row').first()).toContainText('Rudolph the Red-Nosed Reindeer');
  await expect(page.locator('#openListRows > li.row').first().locator('.rowNum')).toHaveText('1');
  await expect(page.locator('#openListRows > li.row')).toHaveCount(10);
  await page.locator('#openListShowAllBtn').click();
  expect(await page.locator('#openListRows > li.row').count()).toBeGreaterThan(10);

  await page.locator('#listsBackBtn').click();
  await expect(page.locator('#listsIndex')).toBeVisible();
  await expect(page.locator('#listsBody .passport')).toBeFocused();
});

test('year-round lists sit on themed shelves, and off-season lists say when they come back', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  await expect(page.locator('#lists-h-story-time')).toContainText('Story time');
  await expect(page.locator('#lists-h-cheer-them-on')).toContainText('Cheer them on');
  const later = page.locator('#listsBody .stamp.later', { hasText: 'Summer break' });
  await expect(later).toContainText('Back Jun 1');
});

test('Not seen hides watched films in an opened list', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  await page.locator('#listsBody .passport').click();
  const first = page.locator('#openListRows > li.row').first();
  await first.locator('.check').click();
  await page.locator('#openListUnseenBtn').click();
  await expect(page.locator('#openListUnseenBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#openListRows > li.row').first()).not.toContainText('Rudolph the Red-Nosed Reindeer');
});

test('Tonight shows the in-season list and opens it on the Lists tab', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabHome').click();
  const card = page.locator('#tonightSeasonCard');
  await expect(card).toContainText('Christmas movies');
  await expect(card).toContainText('that fit Simon + Nora');
  await expectNoA11yViolations(page, '#tonightSeasonCard');
  await card.click();
  await expect(page.locator('#listsScreen')).toBeVisible();
  await expect(page.locator('#openListName')).toHaveText('Christmas movies');
});

test('out of every season, Tonight shows no list card', async ({ page }) => {
  await startOn(page, '2026-11-05T19:00:00');
  await page.locator('#tabHome').click();
  await expect(page.locator('#findTonightPickBtn')).toBeVisible();
  await expect(page.locator('#tonightSeasonCard')).toBeHidden();
});

test('the season card steps aside while a pick is showing', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabHome').click();
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).not.toBeEmpty();
  await expect(page.locator('#tonightSeasonCard')).toBeHidden();
});

test('Tuck it away hides a list on this device until it is put back', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  await page.locator('#listsBody .stamp', { hasText: 'Dog movies' }).click();
  await page.locator('#listHideBtn').click();
  await expect(page.locator('#listsIndex')).toBeVisible();
  await expect(page.locator('#listsBody .stamp', { hasText: 'Dog movies' })).toHaveCount(0);

  await page.reload();
  await openLists(page);
  await expect(page.locator('#listsBody .stamp', { hasText: 'Dog movies' })).toHaveCount(0);
  const tucked = page.locator('#listsBody .tuckedRow', { hasText: 'Dog movies' });
  await expect(tucked).toBeVisible();
  await tucked.getByRole('button', { name: 'Put back Dog movies' }).click();
  await expect(page.locator('#listsBody .stamp', { hasText: 'Dog movies' })).toHaveCount(1);
});

test('a list with fewer than 5 titles that fit rests until more do', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.evaluate(() => {
    const realLists = curatedLists();
    const nums = MOVIES.slice(0, 4).map(m => m.num);
    window.curatedLists = () => realLists.concat([{ id: 'tiny', name: 'Tiny list', blurb: 'Only four.', copy: 'Small.', hue: 10, pins: nums }]);
  });
  await openLists(page);
  await expect(page.locator('#listsBody .listCover', { hasText: 'Tiny list' })).toHaveCount(0);
  await expect(page.locator('#listsBody .tucked')).toContainText('resting');
  await expect(page.locator('#listsBody .stamp', { hasText: 'Good teammates' })).toHaveCount(1);
});

test('Shelf points to the Lists tab', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabBrowse').click();
  await page.locator('#listsTeaser').click();
  await expect(page.locator('#listsScreen')).toBeVisible();
  await expect(page.locator('#listsScreenHeading')).toBeFocused();
});

test('the passport card, every stamp and the season card show a decorative icon', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightSeasonCard .listIcon[aria-hidden="true"] svg')).toHaveCount(1);
  await openLists(page);
  const covers = page.locator('#listsBody .listCover');
  const count = await covers.count();
  expect(count).toBeGreaterThan(10);
  await expect(page.locator('#listsBody .listCover .medal svg')).toHaveCount(count);
  await expect(page.locator('#listsBody .stamp .stampFace[aria-hidden="true"] .medal svg')).toHaveCount(count - 1);
});

test('during Hanukkah, Tonight offers the Hanukkah list, and Christmas comes back after', async ({ page }) => {
  await startOn(page, '2026-12-05T19:00:00');
  await watchAsAdultsOnly(page);
  await expect(page.locator('#tonightSeasonCard')).toContainText('Hanukkah movies');
  await page.locator('#tonightSeasonCard').click();
  await expect(page.locator('#openListName')).toHaveText('Hanukkah movies');
  await expect(page.locator('#openListRows > li.row').first()).toContainText('Lights');
});

test('after Hanukkah ends, the card goes back to Christmas', async ({ page }) => {
  await startOn(page, '2026-12-14T19:00:00');
  await watchAsAdultsOnly(page);
  await expect(page.locator('#tonightSeasonCard')).toContainText('Christmas movies');
});

test('the Hanukkah list still shows for young kids when only 2 of its films fit', async ({ page }) => {
  await startOn(page, '2026-12-05T19:00:00');
  expect(await page.evaluate(() => listFitCount(listById('hanukkah')))).toBe(2);
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightSeasonCard')).toContainText('Hanukkah movies');
  await expect(page.locator('#tonightSeasonCard')).toContainText('2 that fit Simon + Nora');
});

test('the season card count follows who is watching', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightSeasonCard')).toContainText('fit Simon + Nora');
  await watchAsAdultsOnly(page);
  await expect(page.locator('#tonightSeasonCard')).not.toContainText('Simon');
  await expect(page.locator('#tonightSeasonCard')).toContainText('films');
});

for (const scheme of ['light', 'dark']) {
  test.describe(`in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('the Lists tab, an opened list and Shelf pass axe', async ({ page }) => {
      await startOn(page, '2026-12-05T19:00:00');
      await openLists(page);
      await expectNoA11yViolations(page, '#listsScreen');
      await page.locator('#listsBody .stamp').first().click();
      await expectNoA11yViolations(page, '#listsScreen');
      await page.locator('#tabBrowse').click();
      await expectNoA11yViolations(page, '#browseScreen');
    });
  });
}
