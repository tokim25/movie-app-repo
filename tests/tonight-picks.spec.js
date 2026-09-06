import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
});

async function openTonightAskEditor(page){
  await page.locator('#tonightChangeBtn').click();
  await expect(page.locator('#tonightEditPanel')).toBeVisible();
}

test('tonight ask starts compact and expands only when changing choices', async ({ page }) => {
  await expect(page.locator('#homeScreen h1')).toHaveText('What should we watch tonight?');
  await expect(page.locator('#homeScreen')).not.toContainText('Tonight ask');
  await expect(page.locator('#tonightAskSummary')).toContainText('Simon + Nora');
  await expect(page.locator('#tonightAskSummary')).toContainText('About 90 minutes · Calm it down');
  await expect(page.locator('#tonightEditPanel')).toBeHidden();

  await openTonightAskEditor(page);
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Big and silly' }).click();

  await expect(page.locator('#tonightAskSummary')).toContainText('Simon + Nora');
  await expect(page.locator('#tonightAskSummary')).toContainText('About 90 minutes · Big and silly');
  await expect(page.locator('#tonightEditPanel')).toBeHidden();
});

test('initial mobile tonight surface fits without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    homeBottom: document.getElementById('homeScreen').getBoundingClientRect().bottom,
    navTop: document.querySelector('.quickBar').getBoundingClientRect().top
  }));

  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
  expect(metrics.homeBottom).toBeLessThanOrEqual(metrics.navTop + 1);
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
  await expect(page.locator('#tonightWatchBtn')).toHaveText('Mark watched');

  await page.locator('#tonightWatchBtn').click();

  await expect(page.locator('#tonightPickCard')).toHaveClass(/watched/);
  await expect(page.locator('#tonightVerdict')).toHaveText('Watched');
  await expect(page.locator('#tonightWatchBtn')).toHaveText('✓ Watched');
  await expect(page.locator('#tonightWatchBtn')).toHaveClass(/done/);

  await page.locator('#tonightWatchBtn').click();

  await expect(page.locator('#tonightPickCard')).not.toHaveClass(/watched/);
  await expect(page.locator('#tonightVerdict')).not.toHaveText('Watched');
  await expect(page.locator('#tonightWatchBtn')).toHaveText('Mark watched');
  await expect(page.locator('#tonightWatchBtn')).not.toHaveClass(/done/);
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

  await openTonightAskEditor(page);
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Calm it down' }).click();
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).toContainText('Winnie the Pooh');

  await openTonightAskEditor(page);
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

test('adults-only new picks use recent releases instead of recently added titles', async ({ page }) => {
  const expected = await page.evaluate(() => {
    const newest = MOVIES
      .map((movie, idx) => ({ movie, idx }))
      .filter(({ movie }) => isRecentRelease(movie))
      .sort((a, b) => movieYear(b.idx) - movieYear(a.idx) || movieAge(a.idx) - movieAge(b.idx) || MOVIES[a.idx].t.localeCompare(MOVIES[b.idx].t))[0];
    if(!newest) throw new Error('No recent release movies available');
    return `${newest.movie.t} (${newest.movie.y})`;
  });

  await openTonightAskEditor(page);
  await page.locator('#tonightKidChoices .choiceChip').filter({ hasText: 'Adults only' }).click();
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Something new' }).click();
  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).toHaveText(expected);
  await expect(page.locator('#tonightPickTitle')).not.toContainText('Winnie the Pooh');
  await expect(page.locator('#tonightPickReasons')).toContainText('Pulled from recent releases.');
});

test('movie experience profile exposes scoring signals for moods', async ({ page }) => {
  const profile = await page.evaluate(() => {
    const idx = MOVIES.findIndex(movie => movie.t === 'The Incredibles');
    if(idx < 0) throw new Error('Test movie missing');
    return movieExperienceProfile(idx);
  });

  expect(profile.energy).toBeGreaterThan(1);
  expect(profile.intensity).toBeGreaterThanOrEqual(2);
  expect(profile.tone.adventurous).toBe(true);
  expect(profile).toHaveProperty('recentRelease');
});
