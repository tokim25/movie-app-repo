import { test, expect } from '@playwright/test';
import { switchToFlatView, firstRow } from './helpers.js';

test('priority star persists after reload', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  const row = firstRow(page);
  const title = await row.locator('.title').textContent();

  await row.locator('.star').click();
  await expect(row.locator('.star')).toHaveClass(/on/);
  await expect(page.locator('#statPriority')).toHaveText('1');

  await page.reload();
  await switchToFlatView(page);

  const reloadedRow = firstRow(page);
  await expect(reloadedRow.locator('.title')).toHaveText(title);
  await expect(reloadedRow.locator('.star')).toHaveClass(/on/);
  await expect(page.locator('#statPriority')).toHaveText('1');
});
