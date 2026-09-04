export async function switchToFlatView(page) {
  await page.locator('#toFlatBtn').click();
  await page.locator('#flatView').waitFor({ state: 'visible' });
}

export function rows(page) {
  return page.locator('#list > li.row');
}

export function firstRow(page) {
  return rows(page).first();
}
