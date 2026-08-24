import { test, expect } from '@playwright/test';
import { switchToFlatView, firstRow } from './helpers.js';

test('watched checkbox persists after reload', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  const row = firstRow(page);
  const title = await row.locator('.title').textContent();

  await row.locator('.check').click();
  await expect(row.locator('.check')).toHaveClass(/on/);
  await expect(page.locator('#statChecked')).toHaveText('1');

  await page.reload();
  await switchToFlatView(page);

  const reloadedRow = firstRow(page);
  await expect(reloadedRow.locator('.title')).toHaveText(title);
  await expect(reloadedRow.locator('.check')).toHaveClass(/on/);
  await expect(page.locator('#statChecked')).toHaveText('1');
});
