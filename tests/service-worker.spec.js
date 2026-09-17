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

test("sw.js's DATA_VERSION matches the data files it's meant to cache-bust (#63)", async ({ request }) => {
  // Before issue #63's fix, CACHE_VERSION was a hand-maintained constant
  // never bumped by content-only commits -- browsers detect a service
  // worker update by byte-diffing sw.js, so an unchanged sw.js never
  // reinstalled, and a returning visitor kept seeing the previously cached
  // catalog for a full extra page load. DATA_VERSION folds a content hash
  // of the data files into sw.js's own bytes so it can't go stale silently
  // -- this test just confirms the currently-served sw.js actually reflects
  // the currently-served data files, i.e. `node scripts/data-version.mjs`
  // was run and committed for whatever's live right now.
  const [swSource, ...dataResponses] = await Promise.all([
    request.get('/sw.js').then(res => res.text()),
    ...[
      'data.js', 'data-rt.js', 'data-dcom.js', 'data-disney.js', 'data-pixar.js',
      'data-dreamworks.js', 'data-nickelodeon.js', 'data-extra.js', 'data-csm.js',
      'data-mcudc.js', 'data-ghibli.js', 'data-posters.js'
    ].map(file => request.get(`/${file}`).then(res => res.body()))
  ]);

  const match = swSource.match(/const DATA_VERSION = '([0-9a-f]*)';/);
  expect(match, "sw.js is missing a `const DATA_VERSION = '...';` line").not.toBeNull();

  const crypto = await import('node:crypto');
  const hash = crypto.createHash('sha256');
  for (const body of dataResponses) hash.update(body);
  const expected = hash.digest('hex').slice(0, 10);

  expect(match[1], `sw.js's DATA_VERSION (${match[1]}) doesn't match what the served data-*.js files hash to (${expected})`).toBe(expected);
});
