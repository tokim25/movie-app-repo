import { test, expect } from '@playwright/test';
import { setupSampleFamily, switchToFlatView } from './helpers.js';
import { expectNoA11yViolations } from './a11y.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// Issue #77: --accent used as text (.detailLink / .sourceLink in the Shelf
// list, and the active .qbBtn.on nav tab label) measured 4.21:1 against
// light mode's --bg, short of WCAG AA's 4.5:1 threshold for normal text.
// axe-core's color-contrast rule computes the same sRGB relative-luminance
// ratio, so scoping a scan to exactly these selectors is a direct,
// low-noise regression test for the fix (a new --accent-text token).
test('Shelf list detail/source links meet AA text contrast in light mode (#77)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await switchToFlatView(page);
  await expect(page.locator('#list .detailLink').first()).toBeVisible();

  await expectNoA11yViolations(
    page,
    ['.detailLink', '.sourceLink'],
    { runOnly: { type: 'rule', values: ['color-contrast'] } }
  );
});

test('the active bottom-nav tab label meets AA text contrast in light mode (#77)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await expect(page.locator('#tabFamily')).toHaveClass(/on/);

  await expectNoA11yViolations(
    page,
    ['.qbBtn.on'],
    { runOnly: { type: 'rule', values: ['color-contrast'] } }
  );
});

// Issue #74 part 1: toggleCheck()/togglePriority() call renderCurrentView(),
// which rebuilds the whole list's DOM. Without restoring focus to the
// equivalent control afterward, the activated button is destroyed and
// keyboard focus silently falls back to <body>.
test('marking a Shelf row watched keeps keyboard focus on its check button, not <body> (#74)', async ({ page }) => {
  await switchToFlatView(page);

  const firstCheck = page.locator('#list > li.row').first().locator('.check');
  await firstCheck.focus();
  await expect(firstCheck).toBeFocused();
  await page.keyboard.press('Enter');

  // The row just re-rendered (it's now marked watched, reordering /
  // restyling the list) -- focus must have followed onto the *new* check
  // button for the same movie, not dropped to <body>.
  await expect(page.locator(':focus')).toHaveClass(/\bcheck\b/);
  const focusedTag = await page.evaluate(() => document.activeElement.tagName);
  expect(focusedTag).not.toBe('BODY');
});

test('starring a Shelf row keeps keyboard focus on its star button, not <body> (#74)', async ({ page }) => {
  await switchToFlatView(page);

  const firstStar = page.locator('#list > li.row').first().locator('.star');
  await firstStar.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator(':focus')).toHaveClass(/\bstar\b/);
  const focusedTag = await page.evaluate(() => document.activeElement.tagName);
  expect(focusedTag).not.toBe('BODY');
});

// Issue #74 part 2: the child "Settings" button in Family reveals
// #familySettingsPanel but never moved focus into it, leaving a sighted
// keyboard/screen-reader user with no indication anything happened (focus
// stayed on the button that's now scrolled out of view, or off in space if
// the button itself was reflowed away).
test('opening a child\'s content settings from Family moves focus into the panel (#74)', async ({ page }) => {
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });

  await page.locator('#familyChildrenList .familyEditBtn.primary').filter({ hasText: 'Settings' }).first().click();

  await expect(page.locator('#familySettingsChildName')).toBeFocused({ timeout: 2000 });
});

// Issue #76: the reorder ▲▼ buttons and the content-level 1-4 quick-select
// buttons carry only a glyph/digit as visible content, with no accessible
// name describing what activating them does.
test('reorder buttons and content-level buttons expose a descriptive accessible name (#76)', async ({ page }) => {
  await switchToFlatView(page);
  await page.locator('#filterSheetBtn').click();
  await page.locator('#filterSheet').waitFor({ state: 'visible' });
  await page.locator('#sortMode').selectOption('custom');

  const up = page.locator('#list > li.row').first().locator('.moveUp');
  await expect(up).toHaveAttribute('aria-label', new RegExp(`up$`, 'i'));
  const upLabel = await up.getAttribute('aria-label');
  expect(upLabel.length).toBeGreaterThan('Move up'.length); // includes the movie title, not just the direction

  await page.locator('#applyFiltersBtn').click();
  await page.locator('#filterSheet').waitFor({ state: 'hidden' });
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  const levelBtn = page.locator('#familySettingsRows .limitControl button').first();
  const levelAriaLabel = await levelBtn.getAttribute('aria-label');
  expect(levelAriaLabel).toMatch(/^Level \d+: .+/);
});
