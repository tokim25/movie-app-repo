import { test, expect } from '@playwright/test';

test('primary nav switches between Tonight, Shelf, and Family surfaces', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#catalogSurface')).toBeVisible();
  await expect(page.locator('#familySurface')).toBeHidden();
  await expect(page.locator('#qbTonight')).toHaveClass(/on/);

  await page.locator('#qbFamily').click();
  await expect(page.locator('#familySurface')).toBeVisible();
  await expect(page.locator('#catalogSurface')).toHaveClass(/isHidden/);
  await expect(page.locator('#qbFamily')).toHaveClass(/on/);
  await expect(page.locator('#familyTitle')).toHaveText('How Family understands each kid right now.');
  await expect(page.locator('#familySettingsPanel')).toContainText('Settings');
  await expect(page.locator('#familySettingsPanel .limitControl')).toHaveCount(6);

  await page.locator('#familySyncBtn').click();
  await expect(page.locator('#familySurface')).toBeVisible();
  await expect(page.locator('#catalogSurface')).toHaveClass(/isHidden/);
  await expect(page.locator('#syncPanel')).toBeVisible();
  await expect(page.locator('#qbFamily')).toHaveClass(/on/);

  await page.locator('#qbShelf').click();
  await expect(page.locator('#catalogSurface')).toBeVisible();
  await expect(page.locator('#familySurface')).toBeHidden();
  await expect(page.locator('#flatView')).toBeVisible();
  await expect(page.locator('#requestMoviePanel')).toBeVisible();
  await expect(page.locator('#qbShelf')).toHaveClass(/on/);

  await page.locator('#qbTonight').click();
  await expect(page.locator('#groupedView')).toBeVisible();
  await expect(page.locator('#qbTonight')).toHaveClass(/on/);
});
