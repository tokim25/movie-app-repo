import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
});

test('editing a child name and age persists after reload', async ({ page }) => {
  const simonRow = page.locator('#childEditorList .childEditRow')
    .filter({ has: page.locator('#childName-simon') });

  await page.locator('#childName-simon').fill('Simone');
  await page.locator('#childAge-simon').selectOption('8');
  await simonRow.locator('.childSaveBtn').click();
  await expect(page.locator('#toast')).toContainText('Child profile saved');

  await page.reload();
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await expect(page.locator('#childName-simon')).toHaveValue('Simone');
  await expect(page.locator('#childAge-simon')).toHaveValue('8');
  await expect(page.locator('#familySettingsChildName')).toHaveText('Simone');
});

test('adding a child appends a new row and persists after reload', async ({ page }) => {
  const before = await page.locator('#childEditorList .childEditRow').count();

  await page.locator('#addChildBtn').click();
  await page.locator('#newChildName').fill('Wes');
  await page.locator('#newChildAge').selectOption('4');
  await page.locator('#saveNewChildBtn').click();
  await expect(page.locator('#toast')).toContainText('Wes added with age guidance');
  await expect(page.locator('#childOnboardingPanel')).toBeHidden();

  const rows = page.locator('#childEditorList .childEditRow');
  await expect(rows).toHaveCount(before + 1);
  const newNameInput = rows.last().locator('input[type="text"]');
  await expect(newNameInput).toHaveValue('Wes');

  await page.reload();
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await expect(page.locator('#childEditorList .childEditRow')).toHaveCount(before + 1);
  await expect(page.locator('#childEditorList .childEditRow').last().locator('input[type="text"]')).toHaveValue('Wes');
});

test('removing a child asks for confirmation and does not remove on cancel', async ({ page }) => {
  const noraRow = page.locator('#childEditorList .childEditRow')
    .filter({ has: page.locator('#childName-nora') });
  const before = await page.locator('#childEditorList .childEditRow').count();

  page.once('dialog', (dialog) => dialog.dismiss());
  await noraRow.locator('.childRemoveBtn').click();

  await expect(page.locator('#childEditorList .childEditRow')).toHaveCount(before);
  await expect(page.locator('#childName-nora')).toHaveCount(1);
});

test('confirming removal deletes the child and persists after reload', async ({ page }) => {
  const noraRow = page.locator('#childEditorList .childEditRow')
    .filter({ has: page.locator('#childName-nora') });
  const before = await page.locator('#childEditorList .childEditRow').count();

  page.once('dialog', (dialog) => dialog.accept());
  await noraRow.locator('.childRemoveBtn').click();

  await expect(page.locator('#toast')).toContainText('Nora removed');
  await expect(page.locator('#childEditorList .childEditRow')).toHaveCount(before - 1);
  await expect(page.locator('#childName-nora')).toHaveCount(0);

  await page.reload();
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await expect(page.locator('#childEditorList .childEditRow')).toHaveCount(before - 1);
  await expect(page.locator('#childName-nora')).toHaveCount(0);
});
