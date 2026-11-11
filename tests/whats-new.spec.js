import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupSampleFamily, latestCatalogAddedAt } from './helpers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test.use({ timezoneId: 'UTC' });

function utcKey(date) {
  return date.toISOString().slice(0, 10);
}

// Mirrors the app's Monday-start "this week" / "last week" ranges, in UTC.
function expectedWeekCounts(now) {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const lastMonday = new Date(monday.getTime() - 7 * 86400000);
  const lastSunday = new Date(monday.getTime() - 86400000);
  const ranges = [[utcKey(monday), utcKey(now)], [utcKey(lastMonday), utcKey(lastSunday)]];
  const counts = [0, 0];
  const text = fs.readFileSync(path.join(ROOT, 'data-bundle.js'), 'utf8');
  for (const match of text.matchAll(/"addedAt":"(\d{4}-\d{2}-\d{2})"/g)) {
    ranges.forEach(([from, to], i) => { if (match[1] >= from && match[1] <= to) counts[i]++; });
  }
  return counts;
}

test('What\'s new lists this week and last week, opened from the Shelf teaser', async ({ page }) => {
  const pinnedNow = new Date(`${latestCatalogAddedAt()}T12:00:00Z`);
  const [thisWeek, lastWeek] = expectedWeekCounts(pinnedNow);
  await page.clock.install({ time: pinnedNow });
  await page.clock.pauseAt(pinnedNow);
  await page.goto('/');
  await setupSampleFamily(page);

  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });

  const total = thisWeek + lastWeek;
  await expect(page.locator('#newSection .newHeader')).toHaveText(`What's new (${total})`);
  await page.locator('#newSection .newSeeAll').click();

  await expect(page.locator('#whatsNewScreen')).toBeVisible();
  await expect(page.locator('#browseScreen')).toBeHidden();
  await expect(page.locator('#whatsNewScreenHeading')).toBeFocused();

  const weeks = page.locator('#whatsNewList .whatsNewWeek');
  await expect(weeks).toHaveCount(2);
  await expect(weeks.nth(0).locator('h2')).toContainText(`This week`);
  await expect(weeks.nth(0).locator('h2')).toContainText(`(${thisWeek})`);
  await expect(weeks.nth(1).locator('h2')).toContainText(`Last week`);
  await expect(weeks.nth(1).locator('h2')).toContainText(`(${lastWeek})`);
  await expect(weeks.nth(0).locator('.newRow')).toHaveCount(thisWeek);
  await expect(weeks.nth(1).locator('.newRow')).toHaveCount(lastWeek);

  // Marking a title watched re-renders this screen, not the Shelf.
  const firstCheck = weeks.nth(0).locator('.newRow .check').first();
  await firstCheck.click();
  await expect(page.locator('#whatsNewScreen')).toBeVisible();
  await expect(weeks.nth(0).locator('.newRow .check').first()).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#whatsNewBackBtn').click();
  await expect(page.locator('#browseScreen')).toBeVisible();
  await expect(page.locator('#whatsNewScreen')).toBeHidden();
});
