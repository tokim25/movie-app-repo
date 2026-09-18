import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('first-run setup leads to Tonight, Shelf, and Family', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#setupScreen')).toBeVisible();
  await expect(page.locator('#quickBar')).toBeHidden();
  await setupSampleFamily(page);
  await expect(page.locator('#homeScreen')).toBeVisible();
  await expect(page.locator('#familyScreen')).toBeHidden();
  await expect(page.locator('#tabHome')).toHaveClass(/on/);
  await expect(page.locator('#tabHome')).toContainText('Tonight');
  await expect(page.locator('#tabBrowse')).toContainText('Shelf');

  await page.locator('#tabFamily').click();
  await expect(page.locator('#familyScreen')).toBeVisible();
  await expect(page.locator('#homeScreen')).toBeHidden();
  await expect(page.locator('#tabFamily')).toHaveClass(/on/);
  await expect(page.locator('#familyScreen')).toContainText('How Family Feature understands each kid right now');
  await expect(page.locator('#childrenSettingsPanel')).toContainText('Add a child or update their name and age');
  await expect(page.locator('#childrenSettingsPanel > .childEditor input[type="text"]')).toHaveCount(2);
  await expect(page.locator('#childrenSettingsPanel > .childEditor select')).toHaveCount(2);
  await expect(page.locator('#familyChildrenList .familyEditBtn').filter({ hasText: 'Edit' }).first()).toBeVisible();
  await page.locator('#familyChildrenList .familyEditBtn').filter({ hasText: 'Edit' }).first().click();
  await expect(page.locator('#childName-simon')).toBeFocused();
  await page.locator('#addChildBtn').click();
  await expect(page.locator('#childOnboardingPanel')).toBeVisible();
  await expect(page.locator('#newChildName')).toBeFocused();
  await expect(page.locator('#childOnboardingPanel')).toContainText('Starts with age-based starter settings');
  await expect(page.locator('#familySettingsPanel')).toContainText('Adjust content limits');
  await expect(page.locator('#familySettingsPanel .limitControl')).toHaveCount(4);
  await expect(page.locator('#familyScreen')).not.toContainText('Clear all watched marks');
  await expect(page.locator('#reportBugBtn')).toHaveText('Report a bug');
  await expect(page.locator('#familyScreen')).toContainText('Recommendations pull from Want to watch first');
  await expect(page.locator('#familyScreen')).toContainText('Starter settings are age-based defaults');

  await page.locator('#familySyncBtn').click();
  await expect(page.locator('#familyScreen')).toBeVisible();
  await expect(page.locator('#syncPanel')).toBeVisible();
  await expect(page.locator('#tabFamily')).toHaveClass(/on/);

  // Google Drive sync is the promoted default path (product decision after
  // #80): the "Recommended" badge sits on the Google row, which comes before
  // the demoted manual-code group in DOM/visual order, and the manual group
  // is framed as the no-account fallback rather than a peer option.
  await expect(page.locator('#googleSyncRow .syncRecommendedBadge')).toHaveText('Recommended');
  const syncPanelHtml = await page.locator('#syncPanel').innerHTML();
  expect(syncPanelHtml.indexOf('id="googleSyncRow"')).toBeLessThan(syncPanelHtml.indexOf('syncManualGroup'));
  await expect(page.locator('.syncManualIntro')).toContainText('Or, without a Google account');
  await expect(page.locator('.syncManualGroup #syncCodeOut')).toBeVisible();
  await expect(page.locator('.syncManualGroup #syncCodeIn')).toBeVisible();

  await page.locator('#tabBrowse').click();
  await expect(page.locator('#browseScreen')).toBeVisible();
  await expect(page.locator('#familyScreen')).toBeHidden();
  await expect(page.locator('#requestMoviePanel')).toBeVisible();
  await expect(page.locator('#tabBrowse')).toHaveClass(/on/);

  await page.locator('#tabHome').click();
  await expect(page.locator('#homeScreen')).toBeVisible();
  await expect(page.locator('#tabHome')).toHaveClass(/on/);
});

test('mobile tab bar stays horizontal after setup', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await setupSampleFamily(page);

  const navBox = await page.locator('#quickBar').boundingBox();
  const tabs = await Promise.all([
    page.locator('#tabHome').boundingBox(),
    page.locator('#tabBrowse').boundingBox(),
    page.locator('#tabFamily').boundingBox(),
  ]);

  expect(navBox).not.toBeNull();
  for (const tab of tabs) expect(tab).not.toBeNull();

  const centers = tabs.map((tab) => tab.x + tab.width / 2);
  expect(centers[0]).toBeLessThan(centers[1]);
  expect(centers[1]).toBeLessThan(centers[2]);
  expect(Math.max(...tabs.map((tab) => tab.y)) - Math.min(...tabs.map((tab) => tab.y))).toBeLessThan(8);
  expect(navBox.height).toBeLessThan(96);
});

test('first-run setup copy is parent-facing, and the sample-family option is clearly a shortcut (#50)', async ({ page }) => {
  await page.goto('/');

  const setupText = await page.locator('#setupScreen').textContent();
  expect(setupText).not.toContain('product-owned');
  expect(setupText).not.toContain('required system state');

  await expect(page.locator('#setupScreen')).toContainText("We'll set starting content limits based on their age");
  await expect(page.locator('#setupScreen')).toContainText("your changes always come first");

  // The sample-family button used to sit directly under Continue with no
  // hint it's a shortcut rather than a second real setup option -- it now
  // has its own label and an explanatory caption.
  await expect(page.locator('#setupSampleFamilyBtn')).toHaveText('Explore with a sample family instead');
  await expect(page.locator('.setupDemoNote')).toContainText('Adds two example kids');

  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  const familyText = await page.locator('#familyScreen').textContent();
  expect(familyText).not.toContain('product-owned');
  expect(familyText).not.toContain('required system state');
});
