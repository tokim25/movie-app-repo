import { test, expect } from '@playwright/test';
import { setupSampleFamily, latestCatalogAddedAt } from './helpers.js';

test('shelf rows show fit against selected child content settings', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });

  await expect(page.locator('#list .fitSignal').first()).toBeVisible();
  await expect(page.locator('#list .fitSignal').first()).toContainText(/Fits|Review|Above/);
});

test('a child added via the Family tab after the first one is included in fit badges', async ({ page }) => {
  // Regression test for issue #48: addChild() only added a newly-created
  // child to tonightSelection.childIds when that set was still empty, so
  // every child added after the first one was silently excluded from
  // selectedKids() -- which createFitSignals() (and Tonight's candidate
  // selection) reads from. setupSampleFamily() seeds Simon and Nora via
  // completeSetupWithChildren(), which sets tonightSelection.childIds
  // unconditionally and so doesn't exercise this bug; a third child must be
  // registered through the Family tab's "Add child" UI to reproduce it.
  //
  // (Issue #79 later inverted tonightSelection from an opt-in `childIds`
  // allowlist to an opt-out `excludedChildIds` set, closing this whole bug
  // class -- a newly added child is now included by default with no
  // per-mutation-path bookkeeping. This test's scenario and assertions still
  // hold unchanged under that model; only the underlying mechanism they're
  // guarding against regressing is different now.)
  await page.goto('/');
  await setupSampleFamily(page);

  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });

  await page.locator('#addChildBtn').click();
  await page.locator('#newChildName').fill('Wes');
  await page.locator('#newChildAge').selectOption('6');
  await page.locator('#saveNewChildBtn').click();
  await expect(page.locator('#toast')).toContainText('Wes added with age-based defaults');

  // The Tonight kid-choice chips on Home directly reflect selectedKids()
  // (derived from tonightSelection.excludedChildIds since #79) -- Wes's chip
  // must be selected.
  await page.locator('#tabHome').click();
  await page.locator('#homeScreen').waitFor({ state: 'visible' });
  const wesChip = page.locator('#tonightKidChoices .choiceChip', { hasText: 'Wes' });
  await expect(wesChip).toHaveClass(/selected/);

  // And since all three kids (Simon, Nora, Wes) are now selected, the fit
  // badge on Shelf should describe the whole family ("selected kids"), not
  // list only a subset of names.
  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });
  await expect(page.locator('#list .fitSignal').first()).toContainText('selected kids');
});

test('Shelf has no What\'s new block now that What\'s new is its own tab', async ({ page }) => {
  // The clock is pinned inside the "added this week or last" window, so
  // recent titles exist and a leftover teaser would have something to show.
  const pinnedNow = new Date(`${latestCatalogAddedAt()}T12:00:00Z`);
  await page.clock.install({ time: pinnedNow });
  await page.clock.pauseAt(pinnedNow);
  await page.goto('/');
  await setupSampleFamily(page);

  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });

  await expect(page.locator('#browseScreen .newRow')).toHaveCount(0);
  await expect(page.locator('#browseScreen')).not.toContainText("What's new");
});
