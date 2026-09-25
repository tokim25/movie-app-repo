import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
});

test('editing a child name and age persists after reload', async ({ page }) => {
  const simonRow = page.locator('#childEditorList .childEditRow')
    .filter({ has: page.locator('#childName-simon') });

  await page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Simon' }).getByRole('button', { name: 'Edit' }).click();
  await page.locator('#childName-simon').fill('Simone');
  await page.locator('#childAge-simon').selectOption('8');
  await simonRow.locator('.childSaveBtn').click();
  await expect(page.locator('#toast')).toContainText('Child profile saved');

  await page.reload();
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await expect(page.locator('#childName-simon')).toHaveValue('Simone');
  await expect(page.locator('#childAge-simon')).toHaveValue('8');
  await expect(page.locator('#familySettingsChildName')).toHaveText("Simone's content settings");
});

test('adding a child appends a new row and persists after reload', async ({ page }) => {
  const before = await page.locator('#childEditorList .childEditRow').count();

  await page.locator('#addChildBtn').click();
  await page.locator('#newChildName').fill('Wes');
  await page.locator('#newChildAge').selectOption('4');
  await page.locator('#saveNewChildBtn').click();
  await expect(page.locator('#toast')).toContainText('Wes added with age-based defaults');
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

test('new child gets selectable adjustable content settings', async ({ page }) => {
  await page.locator('#addChildBtn').click();
  await page.locator('#newChildName').fill('Theo');
  await page.locator('#newChildAge').selectOption('4');
  await page.locator('#saveNewChildBtn').click();

  await expect(page.locator('#familySettingsChildName')).toHaveText("Theo's content settings");
  await expect(page.locator('#familySettingsIntro')).toContainText('Age 4 defaults');
  await expect(page.locator('#familySettingsChildPicker .settingsChildChip.selected')).toHaveText('Theo');
  await expect(page.locator('#familySettingsRows .familySettingRow')).toHaveCount(4);
  // Example title for violence level 1 changed from 'Cars' to 'A Charlie Brown
  // Christmas' by issue #71's fix (de-duplicating CONTENT_FLAGS' repeated
  // example strings across categories/levels).
  await expect(page.locator('#familySettingsRows .familySettingRow').first()).toContainText('Example: A Charlie Brown Christmas');

  const violenceRow = page.locator('#familySettingsRows .familySettingRow[data-flag="violence"]');
  await expect(violenceRow.locator('.limitControl button.selected')).toHaveText('1');
  await violenceRow.locator('.scaleCard').filter({ hasText: '3. Moderate scares' }).click();
  await expect(violenceRow.locator('.settingBadge')).toHaveText('Parent-set');
  await expect(violenceRow).toContainText('Parent-set to 3. Age 4 default is 1.');
  await expect(violenceRow.locator('.limitControl button.selected')).toHaveText('3');

  await page.reload();
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await page.locator('#familySettingsChildPicker .settingsChildChip').filter({ hasText: 'Theo' }).click();
  const reloadedViolenceRow = page.locator('#familySettingsRows .familySettingRow[data-flag="violence"]');
  await expect(reloadedViolenceRow.locator('.limitControl button.selected')).toHaveText('3');

  await reloadedViolenceRow.locator('.ageDefault input').check();
  await expect(reloadedViolenceRow.locator('.settingBadge')).toHaveText('Default');
  await expect(reloadedViolenceRow.locator('.limitControl button.selected')).toHaveText('1');
});

test('removing a child asks for confirmation and does not remove on cancel', async ({ page }) => {
  const noraRow = page.locator('#childEditorList .childEditRow')
    .filter({ has: page.locator('#childName-nora') });
  const before = await page.locator('#childEditorList .childEditRow').count();

  await page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Nora' }).getByRole('button', { name: 'Edit' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await noraRow.locator('.childRemoveBtn').click();

  await expect(page.locator('#childEditorList .childEditRow')).toHaveCount(before);
  await expect(page.locator('#childName-nora')).toHaveCount(1);
});

test('confirming removal deletes the child and persists after reload', async ({ page }) => {
  const noraRow = page.locator('#childEditorList .childEditRow')
    .filter({ has: page.locator('#childName-nora') });
  const before = await page.locator('#childEditorList .childEditRow').count();

  await page.locator('#familyChildrenList .familyChild').filter({ hasText: 'Nora' }).getByRole('button', { name: 'Edit' }).click();
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

test('a 10+ child can be registered and their age is not clamped down to 9', async ({ page }) => {
  // Regression test for issue #51: the age select and both clamp paths
  // (clampChildAge(), normalizeChild()) used to cap at 9, silently rewriting
  // any higher age a parent tried to enter -- and persistence went through
  // normalizeChild() on load, so even bypassing the UI clamp via
  // selectOption() wouldn't have been enough to prove the real fix; it has
  // to survive a reload.
  await page.locator('#addChildBtn').click();
  await page.locator('#newChildName').fill('Priya');
  await page.locator('#newChildAge').selectOption('12');
  await page.locator('#saveNewChildBtn').click();
  await expect(page.locator('#toast')).toContainText('Priya added with age-based defaults');

  await page.reload();
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });

  // Find the row whose name input has value 'Priya' and check its age
  // select -- ids are randomly generated (makeChildId()), not name-derived,
  // so there's no '#childAge-priya' shortcut the way the sample family's
  // fixed ids ('simon', 'nora') allow elsewhere in this file.
  const rows = page.locator('#childEditorList .childEditRow');
  const count = await rows.count();
  let found = false;
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const nameInput = row.locator('input[type="text"]');
    if ((await nameInput.inputValue()) === 'Priya') {
      await expect(row.locator('select')).toHaveValue('12');
      found = true;
      break;
    }
  }
  expect(found, 'Priya\'s row was not found after reload').toBe(true);
});

test('every age select offers options through at least age 12', async ({ page }) => {
  // Covers all three places issue #51 named: first-run setup, the "Add
  // child" onboarding select, and a per-child edit row's select.
  await page.goto('/');
  const setupOptions = await page.locator('#setupChildAge option').allTextContents();
  expect(setupOptions).toContain('12');

  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });

  await page.locator('#addChildBtn').click();
  const newChildOptions = await page.locator('#newChildAge option').allTextContents();
  expect(newChildOptions).toContain('12');

  const editOptions = await page.locator('#childAge-simon option').allTextContents();
  expect(editOptions).toContain('12');
});

test('a 12-year-old\'s age-based defaults can reach the highest content tier', async ({ page }) => {
  // Before issue #51's fix, starterLimitForFlagAge()'s matrix only covered
  // ages 3-9 and never reached level 4 -- an age this old couldn't even be
  // registered, so this scenario was unreachable at all.
  await page.locator('#addChildBtn').click();
  await page.locator('#newChildName').fill('Marcus');
  await page.locator('#newChildAge').selectOption('12');
  await page.locator('#saveNewChildBtn').click();

  await expect(page.locator('#familySettingsChildName')).toHaveText("Marcus's content settings");
  const violenceRow = page.locator('#familySettingsRows .familySettingRow[data-flag="violence"]');
  await expect(violenceRow.locator('.limitControl button.selected')).toHaveText('4');
});

test('a toddler under 3 can be registered and their age is not clamped up to 3', async ({ page }) => {
  // Regression test for issue #61: the mirror of #51 above, but for the
  // floor instead of the ceiling. Same reload-survival requirement --
  // normalizeChild() re-clamps on load, so the fix has to hold past a reload,
  // not just bypass the UI select.
  await page.locator('#addChildBtn').click();
  await page.locator('#newChildName').fill('Nova');
  await page.locator('#newChildAge').selectOption('2');
  await page.locator('#saveNewChildBtn').click();
  await expect(page.locator('#toast')).toContainText('Nova added with age-based defaults');

  await page.reload();
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });

  const rows = page.locator('#childEditorList .childEditRow');
  const count = await rows.count();
  let found = false;
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const nameInput = row.locator('input[type="text"]');
    if ((await nameInput.inputValue()) === 'Nova') {
      await expect(row.locator('select')).toHaveValue('2');
      found = true;
      break;
    }
  }
  expect(found, 'Nova\'s row was not found after reload').toBe(true);
});

test('every age select offers age 1', async ({ page }) => {
  // Covers the same three places as issue #51's "at least age 12" test
  // above, but for the new floor.
  await page.goto('/');
  const setupOptions = await page.locator('#setupChildAge option').allTextContents();
  expect(setupOptions).toContain('1');

  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });

  await page.locator('#addChildBtn').click();
  const newChildOptions = await page.locator('#newChildAge option').allTextContents();
  expect(newChildOptions).toContain('1');

  const editOptions = await page.locator('#childAge-simon option').allTextContents();
  expect(editOptions).toContain('1');
});

test('a 1-year-old gets the most cautious age-based defaults in every category', async ({ page }) => {
  // Before issue #61's fix, age 1-2 couldn't be registered at all -- this
  // scenario was unreachable, and starterLimitForFlagAge()'s matrix had no
  // entries below age 3.
  await page.locator('#addChildBtn').click();
  await page.locator('#newChildName').fill('Nova');
  await page.locator('#newChildAge').selectOption('1');
  await page.locator('#saveNewChildBtn').click();

  await expect(page.locator('#familySettingsChildName')).toHaveText("Nova's content settings");
  for (const flag of ['violence', 'language', 'romance', 'drinking']) {
    const row = page.locator(`#familySettingsRows .familySettingRow[data-flag="${flag}"]`);
    await expect(row.locator('.limitControl button.selected')).toHaveText('1');
  }
});
