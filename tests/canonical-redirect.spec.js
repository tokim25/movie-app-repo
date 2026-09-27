import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const LEGACY_HOSTS = [
  'family-movie-watchlist.vercel.app',
  'family-movie-watchlist-kim-family-projects.vercel.app',
  'family-movie-watchlist-git-master-kim-family-projects.vercel.app',
];

test('vercel redirects every known legacy domain to the canonical movies domain', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  for (const host of LEGACY_HOSTS) {
    expect(config.redirects).toContainEqual({
      source: '/:path*',
      has: [{ type: 'host', value: host }],
      destination: 'https://movies.tonykim.io/:path*',
      permanent: true,
    });
  }
});

test('client fallback preserves path, query, and fragment for every legacy host', async ({ page }) => {
  await page.goto('/');

  const redirected = await page.evaluate((hosts) => hosts.map(host => canonicalRedirectUrl(
    host,
    '/privacy.html',
    '?from=old',
    '#policy'
  )), LEGACY_HOSTS);

  expect(redirected).toEqual(LEGACY_HOSTS.map(() => 'https://movies.tonykim.io/privacy.html?from=old#policy'));
});
