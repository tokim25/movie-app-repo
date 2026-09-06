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
  await expect(page.locator('#familyScreen')).toContainText('How Family understands each kid right now');
  await expect(page.locator('#childrenSettingsPanel')).toContainText('Add a child or update their name and age');
  await expect(page.locator('#childrenSettingsPanel > .childEditor input[type="text"]')).toHaveCount(2);
  await expect(page.locator('#childrenSettingsPanel > .childEditor select')).toHaveCount(2);
  await expect(page.locator('#familyChildrenList .familyEditBtn').first()).toBeVisible();
  await page.locator('#familyChildrenList .familyEditBtn').first().click();
  await expect(page.locator('#childName-simon')).toBeFocused();
  await page.locator('#addChildBtn').click();
  await expect(page.locator('#childOnboardingPanel')).toBeVisible();
  await expect(page.locator('#newChildName')).toBeFocused();
  await expect(page.locator('#childOnboardingPanel')).toContainText('Starts with product-owned starter settings');
  await expect(page.locator('#familySettingsPanel')).toContainText('Adjust content limits');
  await expect(page.locator('#familySettingsPanel .limitControl')).toHaveCount(6);

  await page.locator('#familySyncBtn').click();
  await expect(page.locator('#familyScreen')).toBeVisible();
  await expect(page.locator('#syncPanel')).toBeVisible();
  await expect(page.locator('#tabFamily')).toHaveClass(/on/);

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
