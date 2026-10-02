import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The real catalog's most recent `addedAt` across every data-*.js file (plus
// the base data.js), as an ISO "YYYY-MM-DD" string. Used to pin a test clock
// inside the app's NEW_WINDOW_DAYS window instead of depending on real
// wall-clock time vs. whenever titles were last added -- see
// shelf-fit.spec.js's "New this week" test for the failure this guards.
export function latestCatalogAddedAt() {
  const dataFiles = fs.readdirSync(ROOT).filter(f => /^data.*\.js$/.test(f));
  let latest = null;
  for (const file of dataFiles) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of text.matchAll(/"addedAt":"(\d{4}-\d{2}-\d{2})"/g)) {
      if (!latest || match[1] > latest) latest = match[1];
    }
  }
  if (!latest) throw new Error('latestCatalogAddedAt(): no addedAt found in any data-*.js file');
  return latest;
}

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
  if (await page.locator('#browseScreen').isVisible() && await page.locator('#firstRunShelfIntro').isVisible()) {
    await page.locator('#firstRunFamilySetupBtn').click();
  }
  if (await page.locator('#setupScreen').isVisible()) {
    await page.locator('#setupSampleFamilyBtn').click();
    await page.locator('#browseScreen').waitFor({ state: 'visible' });
  }
  // Most suites exercise established-user behavior, not the one-time nudge.
  // Keep that prompt scoped to first-run-onboarding.spec.js so it cannot
  // intercept unrelated controls after this helper creates its sample family.
  await page.evaluate(() => {
    localStorage.setItem('family-feature-google-sign-in-nudge-v1-seen', '1');
  });
  // Preserve this long-standing helper's established-user semantics for
  // suites that exercise Tonight. First-run landing behavior is tested
  // directly, without this helper, in first-run-onboarding.spec.js.
  if (await page.locator('#browseScreen').isVisible()) {
    await page.locator('#tabHome').click();
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
