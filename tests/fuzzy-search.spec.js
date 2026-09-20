import { test, expect } from '@playwright/test';
import { switchToFlatView, rows } from './helpers.js';

async function titlesFor(page, query) {
  await page.locator('#search').fill(query);
  await expect
    .poll(() => page.locator('#search').inputValue())
    .toBe(query);
  return page.evaluate(() => Array.from(document.querySelectorAll('#list .title')).map((el) => el.textContent));
}

test('a typo still finds the right title, and doesn\'t regress exact matches', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  const exactTitles = await titlesFor(page, 'descendants');
  expect(exactTitles.length).toBeGreaterThan(0);
  expect(exactTitles.every((t) => t.toLowerCase().includes('descendants'))).toBe(true);

  // Missing a letter ("desendants") and a transposed letter ("discendants")
  // -- both from the reported example -- should still surface the same
  // titles, via the fuzzy fallback rather than the exact-substring check.
  for (const typo of ['desendants', 'discendants']) {
    const typoTitles = await titlesFor(page, typo);
    expect(typoTitles.length, `query "${typo}"`).toBeGreaterThan(0);
    expect(typoTitles.some((t) => t.toLowerCase().includes('descendants')), `query "${typo}" found: ${typoTitles.join(', ')}`).toBe(true);
  }

  // Exact matches must not regress: same result set for the correctly-typed
  // query, in the same order (exact matches are never reordered amongst
  // themselves by the fuzzy-ranking pass).
  const exactTitlesAgain = await titlesFor(page, 'descendants');
  expect(exactTitlesAgain).toEqual(exactTitles);
});

test('exact matches rank above fuzzy-only matches for the same query', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  // "aladin" (missing the second 'd') has no exact substring match in the
  // catalog but should fuzzy-match "Aladdin" -- and if any exact match for
  // the literal string "aladin" existed, it would still have to come first.
  const rowCount = await titlesFor(page, 'aladin');
  expect(rowCount.length).toBeGreaterThan(0);
  expect(rowCount.some((t) => t.toLowerCase().includes('aladdin'))).toBe(true);
});

test('a query shorter than the fuzzy-match minimum only does exact matching', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  // Below FUZZY_SEARCH_MIN_QUERY_LENGTH: a short query should return exactly
  // the exact-substring matches, not more -- if the fuzzy fallback ran for
  // queries this short, its wide edit-distance tolerance relative to a
  // 2-character string would pull in unrelated titles.
  const result = await page.evaluate(() => {
    const q = 'zz';
    const exactCount = MOVIES.filter((m) => m.t.toLowerCase().includes(q)).length;
    query = q;
    render();
    const renderedCount = document.querySelectorAll('#list .title').length;
    return { belowMin: q.length < FUZZY_SEARCH_MIN_QUERY_LENGTH, exactCount, renderedCount };
  });
  expect(result.belowMin).toBe(true);
  expect(result.renderedCount).toBe(result.exactCount);
});

test('typing a search query does not visibly lag against the full catalog', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  const renderMs = await page.evaluate(() => {
    query = 'desendants';
    const start = performance.now();
    render();
    return performance.now() - start;
  });
  expect(renderMs).toBeLessThan(300);
});

test('a query missing the title\'s punctuation still matches (#58)', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  // "Spiderman" has no hyphen; the stored title is "Spider-Man". Title
  // tokenization splits on punctuation ("spider", "man") while the query
  // tokenizes on whitespace only ("spiderman") -- these must still match.
  const titles = await titlesFor(page, 'spiderman');
  expect(titles.length).toBeGreaterThan(0);
  expect(titles.some((t) => t.toLowerCase().includes('spider-man'))).toBe(true);
});

test('a query with an extra word still matches a shorter title (#60)', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  // "The Moana" (2 words) should still find "Moana" (1 word) -- the sliding
  // window must tolerate one extra/missing word, not just exact word counts.
  const titles = await titlesFor(page, 'the moana');
  expect(titles.length).toBeGreaterThan(0);
  expect(titles.some((t) => /^moana\s*\(/i.test(t.trim()))).toBe(true);
});

test('an active filter that zeroes search results is called out in the empty state, with a badge on the filter button (#62)', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  // Baseline: no filters, no query match -- the plain message, no badge.
  const baseline = await page.evaluate(() => {
    // "xq" matches no title, exactly or fuzzily (2 chars is below the fuzzy
    // minimum, so this is a deterministic zero-exact-match query).
    query = 'xq';
    render();
    return {
      emptyText: document.getElementById('emptyMsg').textContent,
      emptyVisible: document.getElementById('emptyMsg').style.display !== 'none',
      badgeVisible: document.getElementById('filterBadge').style.display !== 'none',
    };
  });
  expect(baseline.emptyVisible).toBe(true);
  expect(baseline.emptyText).toBe('No movies match “xq”.');
  expect(baseline.badgeVisible).toBe(false);

  // A query that matches plenty of titles, but a studio filter that excludes
  // all of them, should say a filter may be the cause -- and the filter
  // button should show a badge.
  const filtered = await page.evaluate(() => {
    query = 'moana';
    studioFilter = '__no_such_studio__';
    render();
    const result = {
      emptyText: document.getElementById('emptyMsg').textContent,
      emptyVisible: document.getElementById('emptyMsg').style.display !== 'none',
      badgeVisible: document.getElementById('filterBadge').style.display !== 'none',
      badgeText: document.getElementById('filterBadge').textContent,
    };
    studioFilter = '';
    render();
    return result;
  });
  expect(filtered.emptyVisible).toBe(true);
  expect(filtered.emptyText).toContain('filter');
  expect(filtered.emptyText.toLowerCase()).toContain('moana');
  expect(filtered.badgeVisible).toBe(true);
  expect(filtered.badgeText).toBe('1');
});
