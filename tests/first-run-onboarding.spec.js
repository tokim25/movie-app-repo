import { test, expect } from '@playwright/test';

test('a new visitor lands on Shelf without being forced through family setup', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#browseScreen')).toBeVisible();
  await expect(page.locator('#setupScreen')).toBeHidden();
  await expect(page.locator('#quickBar')).toBeVisible();
  await expect(page.locator('#tabBrowse')).toHaveClass(/on/);
  await expect(page.locator('#firstRunShelfIntro')).toContainText('Start with the shelf');
});

test('the initial Tonight markup never exposes example or user-like child names', async ({ request }) => {
  const response = await request.get('/');
  const source = await response.text();
  const initialSummary = source.match(/id="tonightWatchingSummary">([^<]+)</);

  expect(initialSummary && initialSummary[1]).toBe('Adults only');
});

test('Google backup is offered once, after a few marks rather than on the first tap', async ({ page }) => {
  await page.goto('/');

  await page.locator('#list .star').first().click();
  await expect(page.locator('#googleSignInNudge')).toBeHidden();
  await page.locator('#list .star').nth(1).click();
  await expect(page.locator('#googleSignInNudge')).toBeHidden();
  await page.locator('#list .star').nth(2).click();
  await expect(page.locator('#googleSignInNudge')).toBeVisible();
  await expect(page.locator('#googleSignInNudge')).toContainText('Keep your shelf with you');
  await expect(page.locator('#googleSignInNudgeConfirm')).toHaveText('Sign in with Google');
  const colors = await page.locator('#googleSignInNudge').evaluate((nudge) => ({
    nudge: getComputedStyle(nudge).backgroundColor,
    page: getComputedStyle(document.body).backgroundColor,
  }));
  expect(colors.nudge).not.toBe(colors.page);
  await page.locator('#googleSignInNudgeDismiss').click();
  await expect(page.locator('#googleSignInNudge')).toBeHidden();

  await page.reload();
  for (let i = 0; i < 3; i++) await page.locator('#list .check').nth(i).click();
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
