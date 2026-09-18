import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

// beforeinstallprompt is Chromium-only -- Safari on iOS/iPadOS (and Firefox)
// never fire it, so #installAppBtn stayed hidden forever there with no way
// to install the app at all. These tests can't launch real Safari, so they
// drive the same detection logic (isIOSDevice() / isStandaloneDisplay()) that
// ships in index.html through emulated browser contexts that present as
// those environments, and assert the static fallback copy (#iosInstallHint)
// renders instead.

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID_TOUCH_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// #installAppBtn and #iosInstallHint both live in the "App" section of the
// Family tab (#familyScreen), not the home tab -- get there via the same
// setup + tab-click path the app's own navigation uses.
async function goToFamilyScreen(page) {
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  await page.locator('#familyScreen').waitFor({ state: 'visible' });
}

test('iOS Safari (no beforeinstallprompt ever fires) gets the static Add to Home Screen instructions immediately', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: IPHONE_UA });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await goToFamilyScreen(page);
    // No delay needed -- iOS is detected from the UA alone and shown right away.
    await expect(page.locator('#iosInstallHint')).toBeVisible();
    await expect(page.locator('#iosInstallHint')).toContainText('Add to Home Screen');
    // The native install button never becomes visible on iOS (its class is
    // only ever added by the beforeinstallprompt handler, which iOS never fires).
    await expect(page.locator('#installAppBtn')).toBeHidden();
  } finally {
    await context.close();
  }
});

test('a non-iOS touch browser that never fires beforeinstallprompt falls back to the same static instructions after a grace period', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: ANDROID_TOUCH_UA, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await goToFamilyScreen(page);
    const touchPoints = await page.evaluate(() => navigator.maxTouchPoints);
    expect(touchPoints).toBeGreaterThan(0);

    // Immediately after load, the grace period hasn't elapsed yet -- no hint.
    await expect(page.locator('#iosInstallHint')).toBeHidden();

    // Once INSTALL_FALLBACK_DELAY_MS has passed with no beforeinstallprompt
    // (this test environment never fires it), the fallback copy appears.
    await expect(page.locator('#iosInstallHint')).toBeVisible({ timeout: 5000 });
  } finally {
    await context.close();
  }
});

test('a non-touch desktop browser does not show the install fallback copy', async ({ page }) => {
  await page.goto('/');
  await goToFamilyScreen(page);
  const touchPoints = await page.evaluate(() => navigator.maxTouchPoints);
  expect(touchPoints).toBe(0);

  // Neither iOS-detected nor touch-capable, so no fallback should ever appear.
  await page.waitForTimeout(3000);
  await expect(page.locator('#iosInstallHint')).toBeHidden();
});

test('when beforeinstallprompt does fire, the fallback hint is hidden (or never shown) and the real button takes over', async ({ page }) => {
  await page.goto('/');
  await goToFamilyScreen(page);
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });

  await expect(page.locator('#installAppBtn')).toBeVisible();
  await expect(page.locator('#iosInstallHint')).toBeHidden();
});

test('an already-installed (standalone) app shows neither the install button nor the fallback hint', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: IPHONE_UA });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    });
    await page.goto('/');
    await goToFamilyScreen(page);
    await page.waitForTimeout(500);
    await expect(page.locator('#iosInstallHint')).toBeHidden();
    await expect(page.locator('#installAppBtn')).toBeHidden();
  } finally {
    await context.close();
  }
});
