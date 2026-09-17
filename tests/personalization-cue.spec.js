import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

// Regression coverage for the combined #70/#72 fix: the Family tab's
// "Watch anyway" personalization cue.
//
// #70: the cue (and the event logging behind it) used to hardcode the
// Violence & Scariness flag no matter which content category actually
// produced the amber/red verdict being overridden.
// #72: the cue was pure static text with no way to act on it or dismiss it,
// so it nagged forever once a child crossed the 3-signal threshold.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
});

test('#70: three repeated Language overrides surface a Language cue, not a hardcoded Violence & Scariness one', async ({ page }) => {
  await page.evaluate(() => {
    state.events = (state.events || []).concat([
      { id: 'evt-lang-1', type: 'watch_anyway', childId: 'simon', titleId: 1, flag: 'language', createdAt: Date.now() - 3000 },
      { id: 'evt-lang-2', type: 'watch_anyway', childId: 'simon', titleId: 2, flag: 'language', createdAt: Date.now() - 2000 },
      { id: 'evt-lang-3', type: 'watch_anyway', childId: 'simon', titleId: 3, flag: 'language', createdAt: Date.now() - 1000 }
    ]);
    saveState();
    renderChildren();
  });

  await page.locator('#tabFamily').click();
  const simonCard = page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Simon' });
  await expect(simonCard.locator('.familyCue strong')).toHaveText("Review Simon's Language setting.");
  await expect(simonCard.locator('.familyCue')).not.toContainText('Violence & Scariness');
});

test('#70: logWatchAnywaySignal logs the flag actually responsible for the amber verdict, not a hardcoded violence', async ({ page }) => {
  const result = await page.evaluate(() => {
    // Amber purely on language: level 3 vs a parent-set limit of 2.
    const idx = MOVIES.push({
      t: 'FFF Regression Language Fixture', y: '2005', ca: '6+', genre: [], num: 9000301,
      flags: { violence: 1, language: 3, romance: 1, drinking: 1 }
    }) - 1;
    state.children.forEach(child => setChildFlagLimit(child.id, 'language', 2));
    findTonightCandidate = () => ({ idx, source: 'Shelf' });
    showTonightPick();
    const before = (state.events || []).length;
    logWatchAnywaySignal();
    const logged = (state.events || []).slice(before);
    return {
      count: logged.length,
      flags: logged.map(event => event.flag)
    };
  });

  expect(result.count).toBeGreaterThan(0);
  expect(result.flags.every(flag => flag === 'language')).toBe(true);
  expect(result.flags).not.toContain('violence');
});

test('#72: the cue has a working Review action that opens and focuses the flagged settings row', async ({ page }) => {
  await page.evaluate(() => {
    state.events = (state.events || []).concat([
      { id: 'evt-rom-1', type: 'watch_anyway', childId: 'nora', titleId: 1, flag: 'romance', createdAt: Date.now() - 3000 },
      { id: 'evt-rom-2', type: 'watch_anyway', childId: 'nora', titleId: 2, flag: 'romance', createdAt: Date.now() - 2000 },
      { id: 'evt-rom-3', type: 'watch_anyway', childId: 'nora', titleId: 3, flag: 'romance', createdAt: Date.now() - 1000 }
    ]);
    saveState();
    renderChildren();
  });

  await page.locator('#tabFamily').click();
  const noraCard = page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Nora' });
  await noraCard.getByRole('button', { name: 'Review Romance setting' }).click();

  await expect(page.locator('#familySettingsChildName')).toHaveText("Nora's content settings");
  const romanceRow = page.locator('#familySettingsRows .familySettingRow[data-flag="romance"]');
  await expect(romanceRow).toBeFocused();
});

test('#72: "Not now" dismisses the cue, persists across reload, and a fresh run of overrides surfaces a new cue', async ({ page }) => {
  await page.evaluate(() => {
    state.events = (state.events || []).concat([
      { id: 'evt-drink-1', type: 'watch_anyway', childId: 'simon', titleId: 1, flag: 'drinking', createdAt: Date.now() - 5000 },
      { id: 'evt-drink-2', type: 'watch_anyway', childId: 'simon', titleId: 2, flag: 'drinking', createdAt: Date.now() - 4000 },
      { id: 'evt-drink-3', type: 'watch_anyway', childId: 'simon', titleId: 3, flag: 'drinking', createdAt: Date.now() - 3000 }
    ]);
    saveState();
    renderChildren();
  });

  await page.locator('#tabFamily').click();
  let simonCard = page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Simon' });
  await expect(simonCard.locator('.familyCue')).toBeVisible();

  await simonCard.getByRole('button', { name: 'Not now' }).click();
  await expect(simonCard.locator('.familyCue')).toHaveCount(0);

  // Persisted, not just an in-memory re-render: reload and it stays quiet.
  await page.reload();
  await page.locator('#tabFamily').click();
  simonCard = page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Simon' });
  await expect(simonCard.locator('.familyCue')).toHaveCount(0);

  // A fresh run of 3 new overrides logged after the dismissal surfaces a new
  // suggestion rather than being suppressed forever.
  await page.evaluate(() => {
    state.events = (state.events || []).concat([
      { id: 'evt-drink-4', type: 'watch_anyway', childId: 'simon', titleId: 4, flag: 'drinking', createdAt: Date.now() + 1000 },
      { id: 'evt-drink-5', type: 'watch_anyway', childId: 'simon', titleId: 5, flag: 'drinking', createdAt: Date.now() + 2000 },
      { id: 'evt-drink-6', type: 'watch_anyway', childId: 'simon', titleId: 6, flag: 'drinking', createdAt: Date.now() + 3000 }
    ]);
    saveState();
    renderChildren();
  });
  simonCard = page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Simon' });
  await expect(simonCard.locator('.familyCue')).toBeVisible();
  await expect(simonCard.locator('.familyCue strong')).toHaveText("Review Simon's Drinking setting.");
});
