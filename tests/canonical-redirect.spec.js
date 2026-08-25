import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('vercel redirects the original app domain to the canonical movies domain', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  expect(config.redirects).toContainEqual({
    source: '/:path*',
    has: [
      {
        type: 'host',
        value: 'family-movie-watchlist-kim-family-projects.vercel.app',
      },
    ],
    destination: 'https://movies.tonykim.io/:path*',
    permanent: true,
  });
});

test('client fallback redirects vercel.app hosts to the canonical movies domain', async ({ page }) => {
  await page.goto('/');

  const redirected = await page.evaluate(() =>
    canonicalRedirectUrl(
      'family-movie-watchlist-kim-family-projects.vercel.app',
      '/privacy.html',
      '?from=old',
      '#policy'
    )
  );

  expect(redirected).toBe('https://movies.tonykim.io/privacy.html?from=old#policy');
});
