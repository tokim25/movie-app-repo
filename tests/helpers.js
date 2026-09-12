export async function setupSampleFamily(page) {
  // On a device with prior Google sync history, boot's decideInitialScreen()
  // waits for the initial Drive sync to settle (or a bounded timeout) before
  // showing setup or home, behind #bootSyncLoading -- so #setupScreen's
  // visibility isn't settled until that gate clears. isVisible() doesn't
  // auto-wait, so checking it while the gate is still up would see neither
  // screen and silently skip setup. Waiting for the (normally already-hidden)
  // loading overlay first is a no-op for every other test and makes this
  // helper race-free for that one.
  await page.locator('#bootSyncLoading').waitFor({ state: 'hidden' });
  if (await page.locator('#setupScreen').isVisible()) {
    await page.locator('#setupSampleFamilyBtn').click();
    await page.locator('#homeScreen').waitFor({ state: 'visible' });
  }
}

export async function switchToFlatView(page) {
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();
  await page.locator('#browseScreen').waitFor({ state: 'visible' });
}

export async function openSyncSettings(page) {
  await setupSampleFamily(page);
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
