import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// These optional assets can delay the window load event even when the app UI
// is ready. Keep the real load event for service-worker registration and leave
// dedicated Google sync and typography tests in control of their own requests.
export async function blockOptionalGoogleAssets({ page }) {
  await page.route('https://accounts.google.com/gsi/client', route => route.abort());
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
}

// The real catalog's most recent `addedAt` across every data-*.js file (plus
// the base data.js), as an ISO "YYYY-MM-DD" string. Used to pin a test clock
// inside the app's "this week or last week" window instead of depending on real
// wall-clock time vs. whenever titles were last added -- see
// shelf-fit.spec.js's "New this week" test for the failure this guards.
export function latestCatalogAddedAt() {
  const dataFiles = fs.readdirSync(ROOT).filter(f => /^data.*\.js$/.test(f));
  let latest = null;
  for (const file of dataFiles) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of text.matchAll(/"?addedAt"?\s*:\s*"(\d{4}-\d{2}-\d{2})"/g)) {
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
  const needsSetup = await page.evaluate(() => state.children.length === 0);
  if (needsSetup && !await page.locator('#browseScreen').isVisible() && !await page.locator('#setupScreen').isVisible()) {
    await page.locator('#tabBrowse').click();
    await page.locator('#browseScreen').waitFor({ state: 'visible' });
  }
  if (await page.locator('#browseScreen').isVisible() && await page.locator('#firstRunShelfIntro').isVisible()) {
    await page.locator('#firstRunFamilySetupBtn').click();
  }
  if (await page.locator('#setupScreen').isVisible()) {
    await page.locator('#setupSampleFamilyBtn').click();
    await page.locator('#homeScreen').waitFor({ state: 'visible' });
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
  if (!await page.locator('#homeScreen').isVisible()) {
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

export async function omitMappedPosters(page, movieNums) {
  await page.route('**/data-bundle.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace(
      /(const MOVIE_POSTERS = Object\.freeze\(\{\n)([\s\S]*?)(\n\}\);)/,
      (_match, opening, entries, closing) => {
        const retained = entries.split('\n').filter(line => {
          const num = Number(/^\s*(\d+):/.exec(line)?.[1]);
          return !movieNums.includes(num);
        });
        return opening + retained.join('\n') + closing;
      },
    );
    if (body === source) throw new Error('The unmapped-poster fixture removed no mapped posters.');
    await route.fulfill({ response, body });
  });
}

export function rows(page) {
  return page.locator('#list > li.row');
}

export function firstRow(page) {
  return rows(page).first();
}
