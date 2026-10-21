import { test, expect } from '@playwright/test';

// tools/certification-desk.html is a curator-only local page (see the
// movie-watchlist-updater skill). It renders tools/desk-batch.oui with the
// same self-hosted OpenUI bundle Pre-show uses, and only records choices.
test('Certification Desk renders the batch and builds a copyable summary', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/tools/certification-desk.html');
  const batch = page.locator('#deskBatch');
  await expect(batch).toContainText('ILLUSTRATIVE EXAMPLE');
  await expect(batch.locator('table')).toContainText('Return of the Jedi (1983)');
  await expect(batch).toContainText('Rogue One: above the 5 to 8 band');
  await expect(page.locator('#deskStatus')).toHaveText('');

  await batch.getByText('The Lost World: Jurassic Park').click();
  await batch.getByRole('button', { name: 'Approve 2 certified' }).click();
  await batch.getByRole('button', { name: 'Send 1 to re-research' }).click();

  await expect(page.locator('#deskChoices li')).toHaveCount(2);
  const summary = await page.locator('#deskSummary').inputValue();
  expect(summary).toContain('1. Approve: Return of the Jedi (1983), Rogue One (2016)');
  expect(summary).toContain('lostworld = 1997');
  expect(summary).toContain('2. Re-research: The Phantom Menace (1999)');
  expect(errors).toEqual([]);
});

test('the service worker never caches tools/ or lets it replace the app shell', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  await page.goto('/tools/certification-desk.html');
  await expect(page.locator('#deskBatch')).toContainText('ILLUSTRATIVE EXAMPLE');
  const result = await page.evaluate(async () => {
    const keys = [];
    for(const name of await caches.keys()){
      for(const req of await (await caches.open(name)).keys()) keys.push(new URL(req.url).pathname);
    }
    const shell = await caches.match('/index.html');
    return { keys, shellIsApp: shell ? (await shell.text()).includes('tonightPickCard') : null };
  });
  expect(result.keys.filter(k => k.startsWith('/tools/'))).toEqual([]);
  expect(result.shellIsApp).toBe(true);
});
