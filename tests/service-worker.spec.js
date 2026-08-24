import { test, expect } from '@playwright/test';

test('sw.js is reachable and registers in the browser', async ({ page, request }) => {
  const res = await request.get('/sw.js');
  expect(res.ok()).toBeTruthy();
  expect(res.headers()['content-type']).toContain('javascript');

  await page.goto('/');
  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, hasActive: !!reg.active };
  });

  expect(registration.hasActive).toBe(true);
  expect(registration.scope).toContain('/');
});
