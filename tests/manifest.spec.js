import { test, expect } from '@playwright/test';

test('web app manifest is valid and points at expected icons/start_url/scope', async ({ page, request }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/site.webmanifest');

  const res = await request.get(href);
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();

  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);

  for (const icon of manifest.icons) {
    const iconRes = await request.get(icon.src);
    expect(iconRes.ok(), `icon ${icon.src} should be reachable`).toBeTruthy();
  }

  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
});
