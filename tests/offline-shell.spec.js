import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('app shell reloads offline once the service worker is installed', async ({ page, context }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  // clients.claim() in sw.js means the current page becomes controlled
  // without a second navigation, once install/activate finish.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('#homeScreen h1')).toHaveText('What should we watch tonight?');
    expect(await page.evaluate(() => MOVIES.length)).toBeGreaterThan(500);
  } finally {
    await context.setOffline(false);
  }
});

// Issue #118: sw.js's navigation handler used to treat every same-origin
// navigation as the app route -- caching whatever loaded under '/index.html'
// unconditionally. Visiting a policy page while online could silently
// overwrite the cached app shell, so a later offline launch of '/' rendered
// the policy page instead of the app.
test('an online visit to a policy page does not overwrite the cached app shell (#118)', async ({ page, context }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });

  await page.goto('/privacy.html');
  await expect(page.locator('h1')).toHaveText('Privacy Policy');

  await context.setOffline(true);
  try {
    await page.goto('/');
    await expect(page.locator('#homeScreen h1')).toHaveText('What should we watch tonight?');
  } finally {
    await context.setOffline(false);
  }
});

// Issue #118: navigating directly to a policy page while offline used to
// always fall back to the cached app shell instead of the policy document
// itself, even though the document was already precached under its own URL.
test('offline direct navigation to a policy page serves the actual precached document, not the app shell (#118)', async ({ page, context }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });

  await context.setOffline(true);
  try {
    await page.goto('/privacy.html');
    await expect(page.locator('h1')).toHaveText('Privacy Policy');

    await page.goto('/terms.html');
    await expect(page.locator('h1')).toHaveText('Terms');
  } finally {
    await context.setOffline(false);
  }
});
