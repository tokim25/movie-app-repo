export async function switchToFlatView(page) {
  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });
}

export async function openSyncSettings(page) {
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
  await page.locator('#familySyncBtn').click();
  await page.locator('#syncPanel').waitFor({ state: 'visible' });
}

export function rows(page) {
  return page.locator('#list > li.row');
}

export function firstRow(page) {
  return rows(page).first();
}
