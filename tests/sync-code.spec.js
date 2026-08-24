import { test, expect } from '@playwright/test';
import { switchToFlatView, firstRow } from './helpers.js';

test('manual sync code export/import round-trips watched and priority state', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  const row = firstRow(page);
  const title = await row.locator('.title').textContent();
  await row.locator('.check').click();
  await row.locator('.star').click();
  await expect(page.locator('#statChecked')).toHaveText('1');
  await expect(page.locator('#statPriority')).toHaveText('1');

  await page.locator('#syncToggleBtn').click();
  const code = await page.locator('#syncCodeOut').inputValue();
  expect(code.length).toBeGreaterThan(20);

  // Simulate loading the code on a fresh device.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await switchToFlatView(page);
  await expect(page.locator('#statChecked')).toHaveText('0');

  await page.locator('#syncToggleBtn').click();
  await page.locator('#syncCodeIn').fill(code);
  await page.locator('#syncLoadBtn').click();

  await expect(page.locator('#statChecked')).toHaveText('1');
  await expect(page.locator('#statPriority')).toHaveText('1');

  const reloadedRow = firstRow(page);
  await expect(reloadedRow.locator('.title')).toHaveText(title);
  await expect(reloadedRow.locator('.check')).toHaveClass(/on/);
  await expect(reloadedRow.locator('.star')).toHaveClass(/on/);
});

test('an invalid sync code is rejected without clearing existing state', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  await firstRow(page).locator('.check').click();
  await expect(page.locator('#statChecked')).toHaveText('1');

  await page.locator('#syncToggleBtn').click();
  await page.locator('#syncCodeIn').fill('not-a-valid-code');
  await page.locator('#syncLoadBtn').click();

  await expect(page.locator('#toast')).toHaveText("That code doesn't look right");
  await expect(page.locator('#statChecked')).toHaveText('1');
});
