import { test, expect } from '@playwright/test';

test('app shell reloads offline once the service worker is installed', async ({ page, context }) => {
  await page.goto('/');

  // clients.claim() in sw.js means the current page becomes controlled
  // without a second navigation, once install/activate finish.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Family Feature');
    expect(await page.evaluate(() => MOVIES.length)).toBeGreaterThan(500);
  } finally {
    await context.setOffline(false);
  }
});
