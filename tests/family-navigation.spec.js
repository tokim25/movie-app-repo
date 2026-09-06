import { test, expect } from '@playwright/test';

test('primary nav exposes Browse, request, and Family settings surfaces', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#homeScreen')).toBeVisible();
  await expect(page.locator('#familyScreen')).toBeHidden();
  await expect(page.locator('#tabHome')).toHaveClass(/on/);

  await page.locator('#tabFamily').click();
  await expect(page.locator('#familyScreen')).toBeVisible();
  await expect(page.locator('#homeScreen')).toBeHidden();
  await expect(page.locator('#tabFamily')).toHaveClass(/on/);
  await expect(page.locator('#familyScreen')).toContainText('How Family understands each kid right now.');
  await expect(page.locator('#childrenSettingsPanel')).toContainText('Add a child or update their name and age');
  await expect(page.locator('#childrenSettingsPanel > .childEditor input[type="text"]')).toHaveCount(2);
  await expect(page.locator('#childrenSettingsPanel > .childEditor select')).toHaveCount(2);
  await expect(page.locator('[data-edit-child="childNameSimon"]')).toBeVisible();
  await page.locator('[data-edit-child="childNameSimon"]').click();
  await expect(page.locator('#childNameSimon')).toBeFocused();
  await page.locator('#addChildBtn').click();
  await expect(page.locator('#childOnboardingPanel')).toBeVisible();
  await expect(page.locator('#newChildName')).toBeFocused();
  await expect(page.locator('#childOnboardingPanel')).toContainText('Use age-based starter settings');
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
