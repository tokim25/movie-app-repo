import { test, expect } from '@playwright/test';

test('a new visitor lands on Shelf without being forced through family setup', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#browseScreen')).toBeVisible();
  await expect(page.locator('#setupScreen')).toBeHidden();
  await expect(page.locator('#quickBar')).toBeVisible();
  await expect(page.locator('#tabBrowse')).toHaveClass(/on/);
  await expect(page.locator('#firstRunShelfIntro')).toContainText('Start with the shelf');
});

test('the first watched or Want to watch action offers Google backup once', async ({ page }) => {
  await page.goto('/');

  await page.locator('#list .star').first().click();
  await expect(page.locator('#googleSignInNudge')).toBeVisible();
  await expect(page.locator('#googleSignInNudge')).toContainText('Keep your shelf with you');
  await expect(page.locator('#googleSignInNudgeConfirm')).toHaveText('Sign in with Google');
  await page.locator('#googleSignInNudgeDismiss').click();
  await expect(page.locator('#googleSignInNudge')).toBeHidden();

  await page.reload();
  await page.locator('#list .check').first().click();
  await expect(page.locator('#googleSignInNudge')).toBeHidden();
});

test('exploring another tab offers sign-in but preserves access when dismissed', async ({ page }) => {
  await page.goto('/');

  await page.locator('#tabFamily').click();
  await expect(page.locator('#familyScreen')).toBeVisible();
  await expect(page.locator('#googleSignInNudge')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#googleSignInNudge')).toBeHidden();
  await expect(page.locator('#familyScreen')).toBeVisible();
});

test('user-facing copy never calls customized limits starter settings (#164)', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('body')).not.toContainText(/starter settings/i);
  await page.locator('#firstRunFamilySetupBtn').click();
  await expect(page.locator('#setupScreen')).toContainText('age-based content limits');
  await expect(page.locator('#setupScreen')).not.toContainText(/starter settings/i);
});
