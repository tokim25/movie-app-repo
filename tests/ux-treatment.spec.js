import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('blank onboarding name is reported inline and focused', async ({ page }) => {
  await page.goto('/');
  await page.locator('#bootSyncLoading').waitFor({ state: 'hidden' });
  await page.locator('#setupSaveChildBtn').click();

  const name = page.locator('#setupChildName');
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAttribute('aria-describedby', 'setupChildNameError');
  await expect(page.locator('#setupChildNameError')).toBeVisible();
  await expect(page.locator('#assertiveStatus')).toHaveText('Enter a child name to continue.');
});

test('stateful choices expose pressed state', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tonightChangeBtn').click();

  const anyLength = page.locator('[data-time="999"]');
  await anyLength.click();
  await expect(anyLength).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-time="90"]')).toHaveAttribute('aria-pressed', 'false');

  await page.locator('#tabFamily').click();
  const dark = page.locator('[data-theme-choice="dark"]');
  await dark.click();
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-theme-choice="system"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#tabFamily')).toHaveAttribute('aria-current', 'page');
});

test('adults-only recommendations explain limits and expose evidence', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tonightChangeBtn').click();
  await page.getByRole('button', { name: 'Adults only' }).click();
  await page.locator('#tonightDoneBtn').click();
  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightVerdict')).toHaveText("Tonight's pick");
  await expect(page.locator('#tonightPickReasons')).toContainText("No children watching—child content limits won't apply.");
  await expect(page.locator('#tonightEvidence')).toBeVisible();
  await expect(page.locator('#tonightEvidence strong')).toHaveText(/Common Sense Media review available|Content guidance with source|Limited guidance/);

  const currentPick = await page.locator('#tonightPickTitle').textContent();
  await page.locator('#tonightAlternativesBtn').click();
  const alternativeButtons = page.locator('#tonightAlternatives .choiceChip');
  await expect(alternativeButtons).toHaveCount(2);
  await expect(page.locator('#tonightAlternativesBtn')).toHaveAttribute('aria-expanded', 'true');
  const alternativeTitles = await alternativeButtons.allTextContents();
  expect(new Set(alternativeTitles).size).toBe(2);
  expect(alternativeTitles).not.toContain(currentPick);
  await alternativeButtons.first().click();
  await expect(page.locator('#tonightPickTitle')).toHaveText(alternativeTitles[0]);
  await expect(page.locator('#tonightAlternatives')).toBeHidden();
  await expect(page.locator('#tonightAlternativesBtn')).toHaveAttribute('aria-expanded', 'false');

  await page.locator('#tonightSkipBtn').click();
  const reason = page.locator('[data-skip-reason="Wrong mood"]');
  await expect(page.locator('#tonightSkipPrompt')).toContainText(alternativeTitles[0].replace(/ \(\d{4}\)$/, ''));
  await expect(reason).toBeFocused();
  await expect(page.locator('#tonightSkipBtn')).toHaveAttribute('aria-expanded', 'true');
  await reason.click();
  await expect(reason).toHaveAttribute('aria-pressed', 'true');
  await reason.click();
  await expect(reason).toHaveAttribute('aria-pressed', 'false');
});

// Regression test for issue #144: alternative-pick chips reuse .choiceChip's fully
// rounded (border-radius:999px) pill shape, built for the short single-line labels
// it's used for elsewhere (time/mood/theme). A movie title + year is often long
// enough to wrap onto two lines, and the pill radius isn't scoped down for that case
// -- confirmed visually via a real repro (a long title wrapping inside the chip).
// This checks the scoped-down override rather than pixel overlap, which isn't
// reliably assertable across environments.
test('alternative-pick chips are not styled as fully-rounded single-line pills', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tonightChangeBtn').click();
  await page.getByRole('button', { name: 'Adults only' }).click();
  await page.locator('#tonightDoneBtn').click();
  await page.locator('#findTonightPickBtn').click();
  await page.locator('#tonightAlternativesBtn').click();

  const alternativeButtons = page.locator('#tonightAlternatives .choiceChip');
  await expect(alternativeButtons.first()).toBeVisible();
  const borderRadius = await alternativeButtons.first().evaluate((el) => getComputedStyle(el).borderRadius);
  expect(borderRadius).not.toBe('999px');
});

test('active and empty search states support recovery', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  const search = page.locator('#search');
  await search.fill('Wizard of Oz');
  await expect(page.locator('#searchStatusRow')).toBeVisible();
  await expect(page.locator('#searchResultCount')).toContainText('movie');
  await expect(page.locator('#browseBySection')).toBeHidden();

  await search.fill('No Such Film 987654');
  await expect(page.locator('#emptyMsg')).toContainText('No movies match “No Such Film 987654”.');
  await expect(page.locator('#requestMovieInput')).toHaveValue('No Such Film 987654');

  await page.locator('#clearSearchBtn').click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(page.locator('#browseBySection')).toBeVisible();
});

test('Family keeps one inline member editor open at a time', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();

  await expect(page.locator('#familyScreen')).not.toContainText('Personalization');
  await expect(page.locator('#familyChildrenList .familyChild')).toHaveCount(2);
  await expect(page.locator('#childEditorList .childEditRow:visible')).toHaveCount(0);

  await page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Simon' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#childEditorList .childEditRow:visible')).toHaveCount(1);
  await page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Nora' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#childEditorList .childEditRow:visible')).toHaveCount(1);
  await expect(page.locator('#childName-nora')).toBeFocused();
});

test('filter sheet manages focus on compact screens and becomes a desktop popover', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#filterSheetBtn').click();

  await expect(page.locator('#filterSheet')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#decadeFilter')).toBeFocused();
  await page.locator('#priorityToggleBtn').click();
  await expect(page.locator('#filterSeg [data-filter="priority"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#filterSeg [data-filter="all"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#clearFiltersBtn').click();
  await expect(page.locator('#filterSeg [data-filter="priority"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#filterSeg [data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#filterSheet')).toBeHidden();
  await expect(page.locator('#filterSheetBtn')).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#search').focus();
  const focusedNav = await page.locator('#quickBar').boundingBox();
  expect(focusedNav.x).toBeGreaterThanOrEqual(0);
  expect(focusedNav.y).toBeGreaterThanOrEqual(0);
  await page.locator('#filterSheetBtn').click();
  await expect(page.locator('#filterSheet')).not.toHaveAttribute('aria-modal', 'true');
  const nav = await page.locator('#quickBar').boundingBox();
  const sheet = await page.locator('#filterSheet').boundingBox();
  expect(nav.width).toBeLessThan(220);
  expect(nav.height).toBeGreaterThan(600);
  expect(sheet.x).toBeGreaterThan(700);
  await page.locator('#filterSheetBtn').click();
  await expect(page.locator('#filterSheet')).toBeHidden();
  await expect(page.locator('#filterSheetBtn')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#filterSheetBtn').click();
  await page.locator('#browseScreen h1').click();
  await expect(page.locator('#filterSheet')).toBeHidden();
});
