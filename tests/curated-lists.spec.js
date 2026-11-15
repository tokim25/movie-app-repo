import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';
import { expectNoA11yViolations } from './a11y.js';

// Curated lists (data-lists.js). Shelf shows them under "Browse by", with
// in-season lists first; the first in-season list gets a card on Tonight;
// "Not for us" hides a list on this device; a list with fewer than 5 titles
// that fit the selected kids is not shown at all.

async function startOn(page, isoDate) {
  await page.clock.setFixedTime(new Date(isoDate));
  await page.goto('/');
  await setupSampleFamily(page);
}

async function openShelf(page) {
  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });
}

test('in December, Christmas comes first on Shelf and opens in list order', async ({ page }) => {
  await startOn(page, '2026-12-10T19:00:00');
  await openShelf(page);
  const first = page.locator('#listGrid .listTile').first();
  await expect(first).toContainText('Christmas movies');
  await expect(first).toContainText('In season');
  await expect(first).toContainText('that fit');

  await first.click();
  await expect(page.locator('#listHeader')).toBeVisible();
  await expect(page.locator('#listHeaderName')).toHaveText('Christmas movies');
  await expect(page.locator('#listHeaderName')).toBeFocused();
  await expect(page.locator('#listHeaderNote')).toContainText('fit Simon + Nora');
  await expect(page.locator('#browseBySection')).toBeHidden();
  await expect(page.locator('#sortMode')).toHaveValue('list');
  await expect(page.locator('#list li.row').first()).toContainText('Rudolph the Red-Nosed Reindeer');

  await page.locator('#listBackBtn').click();
  await expect(page.locator('#listHeader')).toBeHidden();
  await expect(page.locator('#browseBySection')).toBeVisible();
  await expect(page.locator('#sortMode option[value="list"]')).toHaveCount(0);
});

test('Tonight shows the in-season list and opens it on Shelf', async ({ page }) => {
  await startOn(page, '2026-12-10T19:00:00');
  await page.locator('#tabHome').click();
  const card = page.locator('#tonightSeasonCard');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Christmas movies');
  await expect(card).toContainText('that fit Simon + Nora');
  await expectNoA11yViolations(page, '#tonightSeasonCard');
  await card.click();
  await expect(page.locator('#browseScreen')).toBeVisible();
  await expect(page.locator('#listHeaderName')).toHaveText('Christmas movies');
});

test('out of every season, Tonight shows no list card', async ({ page }) => {
  await startOn(page, '2026-11-05T19:00:00');
  await page.locator('#tabHome').click();
  await expect(page.locator('#findTonightPickBtn')).toBeVisible();
  await expect(page.locator('#tonightSeasonCard')).toBeHidden();
});

test('the season card steps aside while a pick is showing', async ({ page }) => {
  await startOn(page, '2026-12-10T19:00:00');
  await page.locator('#tabHome').click();
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).not.toBeEmpty();
  await expect(page.locator('#tonightSeasonCard')).toBeHidden();
});

test('Not for us hides a list on this device until it is brought back', async ({ page }) => {
  await startOn(page, '2026-12-10T19:00:00');
  await openShelf(page);
  await page.locator('#listGrid .listTile', { hasText: 'Christmas movies' }).click();
  await page.locator('#listHideBtn').click();
  await expect(page.locator('#listHeader')).toBeHidden();
  await expect(page.locator('#listGrid .listTile', { hasText: 'Christmas movies' })).toHaveCount(0);

  await page.reload();
  await openShelf(page);
  await expect(page.locator('#listGrid .listTile', { hasText: 'Christmas movies' })).toHaveCount(0);
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightSeasonCard')).not.toContainText('Christmas movies');

  await openShelf(page);
  await page.locator('#allListsBtn').click();
  await page.locator('#allListsBtn').click();
  await expect(page.locator('#listGrid .listTile', { hasText: 'Christmas movies' })).toHaveCount(1);
});

test('a list with fewer than 5 titles that fit is not shown', async ({ page }) => {
  await startOn(page, '2026-12-10T19:00:00');
  await page.evaluate(() => {
    const realLists = curatedLists();
    const nums = MOVIES.slice(0, 4).map(m => m.num);
    window.curatedLists = () => realLists.concat([{ id: 'tiny', name: 'Tiny list', blurb: 'Only four.', pins: nums }]);
    renderCurrentView();
  });
  await openShelf(page);
  await page.locator('#allListsBtn').click();
  await expect(page.locator('#listGrid .listTile', { hasText: 'Tiny list' })).toHaveCount(0);
  await expect(page.locator('#listGrid .listTile', { hasText: 'Good teammates' })).toHaveCount(1);
});

test('opening a studio after a list clears the list', async ({ page }) => {
  await startOn(page, '2026-12-10T19:00:00');
  await openShelf(page);
  await page.locator('#listGrid .listTile').first().click();
  await page.evaluate(() => browseStudio('Pixar'));
  await expect(page.locator('#listHeader')).toBeHidden();
  await expect(page.locator('#sortMode')).toHaveValue('year');
  await expect(page.locator('#sortMode option[value="list"]')).toHaveCount(0);
});

test('Lists row and list page pass axe', async ({ page }) => {
  await startOn(page, '2026-12-10T19:00:00');
  await openShelf(page);
  await expectNoA11yViolations(page, '#browseBySection');
  await page.locator('#listGrid .listTile').first().click();
  await expectNoA11yViolations(page, '#listHeader');
});

test.describe('in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('Lists row, list page and season card pass axe', async ({ page }) => {
    await startOn(page, '2026-12-10T19:00:00');
    await page.locator('#tabHome').click();
    await expectNoA11yViolations(page, '#tonightSeasonCard');
    await openShelf(page);
    await expectNoA11yViolations(page, '#browseBySection');
    await page.locator('#listGrid .listTile').first().click();
    await expectNoA11yViolations(page, '#listHeader');
  });
});
