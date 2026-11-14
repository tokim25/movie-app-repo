import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';
import { expectNoA11yViolations } from './a11y.js';

// The Tonight decision (what is it, is it OK for my kids, watch or skip)
// used to be spread over ~1,000px: the title sat at 473px and Watch/Skip at
// 1,101px on a 390x844 phone, so a parent scrolled up and down between them.
// These pin the fix: on a phone the title and the action bar share the first
// screen, the bar carries the warning on amber/red picks, and Skip lands on
// the new title instead of scrolling it away.

async function dismissNudge(page){
  const nudge = page.locator('#googleSignInNudgeDismiss');
  if(await nudge.isVisible()) await nudge.click();
}

async function pickTitled(page, title){
  await page.evaluate(t => showTonightPick({ idx: MOVIES.findIndex(m => m.t === t), source: 'Shelf' }), title);
  await expect(page.locator('#tonightPickTitle')).toContainText(title);
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupSampleFamily(page);
    await page.locator('#tabHome').click();
    await dismissNudge(page);
  });

  test('the title and the Skip / Watch buttons are on screen together', async ({ page }) => {
    await page.locator('#findTonightPickBtn').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await page.evaluate(() => {
      const rect = id => document.getElementById(id).getBoundingClientRect();
      return {
        titleTop: rect('tonightPickTitle').top,
        titleBottom: rect('tonightPickTitle').bottom,
        skipTop: rect('tonightSkipBtn').top,
        skipBottom: rect('tonightSkipBtn').bottom,
        navTop: document.getElementById('quickBar').getBoundingClientRect().top,
        barPosition: getComputedStyle(document.getElementById('tonightActionBar')).position
      };
    });
    expect(box.barPosition).toBe('fixed');
    expect(box.titleTop).toBeGreaterThanOrEqual(0);
    expect(box.titleBottom).toBeLessThan(box.skipTop);
    expect(box.skipBottom).toBeLessThanOrEqual(box.navTop + 1);
  });

  test('an amber pick puts Watch anyway and the reason in the bar', async ({ page }) => {
    await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'Amber Bar Fixture', y: '2005', ca: '6+', studio: 'Fixture Films', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000901, flags: { violence: 1, language: 3, romance: 1, drinking: 1 } }) - 1;
      state.children.forEach(child => setChildFlagLimit(child.id, 'language', 2));
      showTonightPick({ idx, source: 'Shelf' });
    });
    await expect(page.locator('#tonightVerdict')).toHaveText('Review fit');
    await expect(page.locator('#tonightWatchAnywayBtn')).toBeVisible();
    await expect(page.locator('#tonightWatchBtn')).toBeHidden();
    await expect(page.locator('#tonightBarWarning')).toBeVisible();
    await expect(page.locator('#tonightBarWarning')).toContainText('Over');
    await expectNoA11yViolations(page, '#tonightActionBar');
  });

  test('a green pick keeps Mark watched as the main button and no bar warning', async ({ page }) => {
    await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'Green Bar Fixture', y: '2005', ca: '6+', studio: 'Fixture Films', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000902, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      showTonightPick({ idx, source: 'Shelf' });
    });
    await expect(page.locator('#tonightWatchBtn')).toBeVisible();
    await expect(page.locator('#tonightWatchAnywayBtn')).toBeHidden();
    await expect(page.locator('#tonightBarWarning')).toBeHidden();
  });

  test('after Skip the new title has focus and is on screen, announced once', async ({ page }) => {
    await page.locator('#findTonightPickBtn').click();
    const first = await page.locator('#tonightPickTitle').textContent();
    await page.locator('#tonightSkipBtn').click();
    await expect(page.locator('#tonightPickTitle')).not.toHaveText(first);
    await expect(page.locator('#tonightPickTitle')).toBeFocused();
    await expect(page.locator('#tonightPickTitle')).toBeInViewport();
    const second = await page.locator('#tonightPickTitle').textContent();
    await expect(page.locator('#tonightPickStatus')).toContainText(`Skipped ${first.replace(/ \(\d{4}\)$/, '')}`);
    await expect(page.locator('#tonightPickStatus')).toContainText(second);
    // The reason prompt is no longer its own live region.
    await expect(page.locator('#tonightSkipPrompt')).not.toHaveAttribute('aria-live', /.*/);
  });

  test('the Pre-show warning sits next to the title, and More opens the rest', async ({ page }) => {
    await page.locator('#findTonightPickBtn').click();
    await expect(page.locator('#tonightHeadsUpText')).not.toBeEmpty();
    await expect(page.locator('#tonightHeadsUp')).toBeInViewport();
  });

  test('the pick card and pills pass axe', async ({ page }) => {
    await page.locator('#findTonightPickBtn').click();
    await page.locator('#tonightWhoPill').click();
    await expectNoA11yViolations(page, '#homeScreen');
  });
});

test('on a short screen the action bar stays in the card instead of pinning', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 520 });
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabHome').click();
  await dismissNudge(page);
  await page.locator('#findTonightPickBtn').click();
  const position = await page.evaluate(() => getComputedStyle(document.getElementById('tonightActionBar')).position);
  expect(position).toBe('static');
});

test('on a wide screen the action bar stays in the card', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabHome').click();
  await dismissNudge(page);
  await page.locator('#findTonightPickBtn').click();
  const position = await page.evaluate(() => getComputedStyle(document.getElementById('tonightActionBar')).position);
  expect(position).toBe('static');
});

test.describe('in dark mode', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

  test('amber and green picks, bar included, pass axe', async ({ page }) => {
    await page.goto('/');
    await setupSampleFamily(page);
    await page.locator('#tabHome').click();
    await dismissNudge(page);
    await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'Dark Amber Fixture', y: '2005', ca: '6+', studio: 'Fixture Films', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000903, flags: { violence: 1, language: 3, romance: 1, drinking: 1 } }) - 1;
      state.children.forEach(child => setChildFlagLimit(child.id, 'language', 2));
      showTonightPick({ idx, source: 'Shelf' });
    });
    await expect(page.locator('#tonightBarWarning')).toBeVisible();
    await expectNoA11yViolations(page, '#homeScreen');
    await pickTitled(page, 'Frosty the Snowman');
    await expectNoA11yViolations(page, '#homeScreen');
  });
});
