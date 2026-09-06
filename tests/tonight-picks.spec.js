import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
});

test('skip advances to a different tonight pick', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  const firstPick = await page.locator('#tonightPickTitle').textContent();

  await page.locator('#tonightSkipBtn').click();

  await expect(page.locator('#tonightPickTitle')).not.toHaveText(firstPick);
  await expect(page.locator('#toast')).toContainText('Skipped for tonight');
});

test('finding another pick after a result behaves like skip', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  const firstPick = await page.locator('#tonightPickTitle').textContent();

  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).not.toHaveText(firstPick);
});

test('watching tonight pick shows watched visual state', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  await page.locator('#tonightWatchBtn').click();

  await expect(page.locator('#tonightPickCard')).toHaveClass(/watched/);
  await expect(page.locator('#tonightVerdict')).toHaveText('Watched');
});

test('night mood changes the selected movie', async ({ page }) => {
  await page.evaluate(() => {
    const gentleIdx = MOVIES.findIndex(movie => movie.t === 'The Many Adventures of Winnie the Pooh');
    const actionIdx = MOVIES.findIndex(movie => movie.t === 'The Incredibles');
    if(gentleIdx < 0 || actionIdx < 0) throw new Error('Test movies missing');
    togglePriority(gentleIdx);
    togglePriority(actionIdx);
    toggleCheck(actionIdx);
  });

  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Calm it down' }).click();
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).toContainText('Winnie the Pooh');

  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Old favourite' }).click();
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).toContainText('The Incredibles');
});

test('tonight picks from want to watch before new and general shelf', async ({ page }) => {
  const title = await page.evaluate(() => {
    const idx = MOVIES.findIndex(movie => movie.t === 'The Greatest Showman');
    if(idx < 0) throw new Error('Test movie missing');
    togglePriority(idx);
    return `${MOVIES[idx].t} (${MOVIES[idx].y})`;
  });

  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).toHaveText(title);
  await expect(page.locator('#tonightPickReasons')).toContainText('Pulled from Want to watch.');
});

test('adults-only new picks use newest additions instead of youngest title', async ({ page }) => {
  const expected = await page.evaluate(() => {
    const newest = MOVIES
      .map((movie, idx) => ({ movie, idx }))
      .filter(({ movie }) => isRecent(movie))
      .sort((a, b) => (b.movie.addedAt || '').localeCompare(a.movie.addedAt || '') || Number(b.movie.y) - Number(a.movie.y) || MOVIES[a.idx].t.localeCompare(MOVIES[b.idx].t))[0];
    if(!newest) throw new Error('No recent movies available');
    return `${newest.movie.t} (${newest.movie.y})`;
  });

  await page.locator('#tonightKidChoices .choiceChip').filter({ hasText: 'Adults only' }).click();
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Something new' }).click();
  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).toHaveText(expected);
  await expect(page.locator('#tonightPickTitle')).not.toContainText('Winnie the Pooh');
  await expect(page.locator('#tonightPickReasons')).toContainText('Pulled from new additions.');
});
