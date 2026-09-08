import { test, expect } from '@playwright/test';

function seedState(children) {
  return {
    v: 3,
    updatedAt: Date.now(),
    device: 'legacy-test',
    checked: {},
    priority: {},
    children: {
      list: children,
      updatedAt: Date.now(),
      device: 'legacy-test'
    },
    events: []
  };
}

async function seedAndOpenFamilySettings(page, children, childName) {
  // Guarded so a later page.reload() (also a navigation, so this script
  // re-runs) doesn't clobber state the test has since mutated (e.g. a
  // dismissed notice) back to the original seed.
  await page.addInitScript((state) => {
    if (!localStorage.getItem('family-movie-watchlist-v1')) {
      localStorage.setItem('family-movie-watchlist-v1', JSON.stringify(state));
    }
  }, seedState(children));

  await page.goto('/');
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await page.locator('#familySettingsChildPicker .settingsChildChip').filter({ hasText: childName }).click();
}

test('Content Settings UI renders 4 rows, not 6', async ({ page }) => {
  await seedAndOpenFamilySettings(page, [
    { id: 'kid-a', name: 'Ada', age: 6, settings: {} }
  ], 'Ada');

  await expect(page.locator('#familySettingsRows .familySettingRow')).toHaveCount(4);
  await expect(page.locator('#familySettingsRows .familySettingRow[data-flag="scary"]')).toHaveCount(0);
  await expect(page.locator('#familySettingsRows .familySettingRow[data-flag="sad"]')).toHaveCount(0);
});

test('a child with only legacy scary customized migrates to violence', async ({ page }) => {
  await seedAndOpenFamilySettings(page, [
    {
      id: 'kid-b',
      name: 'Ben',
      age: 6,
      settings: {
        scary: { source: 'parent', value: 3 }
      }
    }
  ], 'Ben');

  const violenceRow = page.locator('#familySettingsRows .familySettingRow[data-flag="violence"]');
  await expect(violenceRow.locator('.settingBadge')).toHaveText('Parent-set');
  await expect(violenceRow.locator('.limitControl button.selected')).toHaveText('3');
});

test('a child with both scary and violence customized keeps the stricter (lower) value', async ({ page }) => {
  await seedAndOpenFamilySettings(page, [
    {
      id: 'kid-c',
      name: 'Cara',
      age: 6,
      settings: {
        scary: { source: 'parent', value: 2 },
        violence: { source: 'parent', value: 4 }
      }
    }
  ], 'Cara');

  const violenceRow = page.locator('#familySettingsRows .familySettingRow[data-flag="violence"]');
  await expect(violenceRow.locator('.settingBadge')).toHaveText('Parent-set');
  await expect(violenceRow.locator('.limitControl button.selected')).toHaveText('2');
});

test('a child with neither scary nor violence customized is untouched', async ({ page }) => {
  await seedAndOpenFamilySettings(page, [
    {
      id: 'kid-d',
      name: 'Dev',
      age: 6,
      settings: {
        language: { source: 'parent', value: 2 }
      }
    }
  ], 'Dev');

  const violenceRow = page.locator('#familySettingsRows .familySettingRow[data-flag="violence"]');
  await expect(violenceRow.locator('.settingBadge')).toHaveText('Starter');

  const languageRow = page.locator('#familySettingsRows .familySettingRow[data-flag="language"]');
  await expect(languageRow.locator('.settingBadge')).toHaveText('Parent-set');
  await expect(languageRow.locator('.limitControl button.selected')).toHaveText('2');
});

test('sad settings are gone after migration, and the one-time notice can be dismissed and does not reappear', async ({ page }) => {
  await seedAndOpenFamilySettings(page, [
    {
      id: 'kid-e',
      name: 'Eve',
      age: 6,
      settings: {
        sad: { source: 'parent', value: 3 }
      }
    }
  ], 'Eve');

  await expect(page.locator('#familySettingsRows .familySettingRow[data-flag="sad"]')).toHaveCount(0);
  await expect(page.locator('.sadRemovedNotice')).toContainText("Sad moments is no longer a separate setting for Eve");
  await expect(page.locator('.sadRemovedNotice')).toContainText("We'll call that out in each movie's written review instead.");

  await page.locator('.sadRemovedNotice button').click();
  await expect(page.locator('.sadRemovedNotice')).toHaveCount(0);

  await page.reload();
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await page.locator('#familySettingsChildPicker .settingsChildChip').filter({ hasText: 'Eve' }).click();
  await expect(page.locator('.sadRemovedNotice')).toHaveCount(0);
});
