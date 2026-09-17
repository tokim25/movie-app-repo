import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
});

async function openTonightAskEditor(page){
  await page.locator('#tonightChangeBtn').click();
  await expect(page.locator('#tonightEditPanel')).toBeVisible();
}

test('tonight ask starts compact and expands only when opened via Change', async ({ page }) => {
  await expect(page.locator('#homeScreen h1')).toHaveText('What should we watch tonight?');
  await expect(page.locator('#homeScreen')).not.toContainText('Tonight ask');
  await expect(page.locator('#tonightAskSummary')).toContainText('Simon + Nora');
  await expect(page.locator('#tonightAskSummary')).toContainText('About 90 minutes · Calm it down');
  await expect(page.locator('#tonightEditPanel')).toBeHidden();

  await openTonightAskEditor(page);
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Big and silly' }).click();

  await expect(page.locator('#tonightAskSummary')).toContainText('Simon + Nora');
  await expect(page.locator('#tonightAskSummary')).toContainText('About 90 minutes · Big and silly');
  // Issue #56: a mood tap used to close the panel itself. The panel should
  // stay open (matching how a kid-chip tap already behaves) until Done.
  await expect(page.locator('#tonightEditPanel')).toBeVisible();

  await page.locator('#tonightDoneBtn').click();
  await expect(page.locator('#tonightEditPanel')).toBeHidden();
});

test('mood and time taps keep the Change panel open like kid taps do (#56)', async ({ page }) => {
  await openTonightAskEditor(page);

  await page.locator('#tonightTimeChoices .choiceChip').filter({ hasText: 'Up to 2 hours' }).click();
  await expect(page.locator('#tonightEditPanel')).toBeVisible();

  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Something new' }).click();
  await expect(page.locator('#tonightEditPanel')).toBeVisible();

  await page.locator('#tonightKidChoices .choiceChip').filter({ hasText: 'Adults only' }).click();
  await expect(page.locator('#tonightEditPanel')).toBeVisible();

  await page.locator('#tonightDoneBtn').click();
  await expect(page.locator('#tonightEditPanel')).toBeHidden();
});

test('find pick button relabels to skip after a pick shows, and resets when selections change (#57)', async ({ page }) => {
  await expect(page.locator('#findTonightPickBtn')).toHaveText("Find tonight's pick");

  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#findTonightPickBtn')).toHaveText('Skip to next pick');

  await openTonightAskEditor(page);
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Big and silly' }).click();
  await expect(page.locator('#findTonightPickBtn')).toHaveText("Find tonight's pick");
});

test('initial mobile tonight surface fits without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    homeBottom: document.getElementById('homeScreen').getBoundingClientRect().bottom,
    navTop: document.querySelector('.quickBar').getBoundingClientRect().top
  }));

  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
  expect(metrics.homeBottom).toBeLessThanOrEqual(metrics.navTop + 1);
});

test('skip advances to a different tonight pick', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  const firstPick = await page.locator('#tonightPickTitle').textContent();

  await page.locator('#tonightSkipBtn').click();

  await expect(page.locator('#tonightPickTitle')).not.toHaveText(firstPick);
  await expect(page.locator('#toast')).toContainText('Skipped for tonight');
});

test('finding another pick after a result behaves like skip', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  const firstPick = await page.locator('#tonightPickTitle').textContent();

  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).not.toHaveText(firstPick);
});

test('watching tonight pick shows watched visual state', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightWatchBtn')).toHaveText('Mark watched');

  await page.locator('#tonightWatchBtn').click();

  await expect(page.locator('#tonightPickCard')).toHaveClass(/watched/);
  await expect(page.locator('#tonightVerdict')).toHaveText('Watched');
  await expect(page.locator('#tonightWatchBtn')).toHaveText('✓ Watched');
  await expect(page.locator('#tonightWatchBtn')).toHaveClass(/done/);

  await page.locator('#tonightWatchBtn').click();

  await expect(page.locator('#tonightPickCard')).not.toHaveClass(/watched/);
  await expect(page.locator('#tonightVerdict')).not.toHaveText('Watched');
  await expect(page.locator('#tonightWatchBtn')).toHaveText('Mark watched');
  await expect(page.locator('#tonightWatchBtn')).not.toHaveClass(/done/);
});

test('tonight pick card reveals the same full CSM-style detail Shelf shows (#78)', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  const expectedFull = await page.evaluate(() => MOVIES[tonightSelection.currentPickIdx].full);

  await expect(page.locator('#tonightDetailBtn')).toHaveText('Details');
  await expect(page.locator('#tonightDetailBody')).toBeHidden();

  await page.locator('#tonightDetailBtn').click();

  await expect(page.locator('#tonightDetailBtn')).toHaveText('Hide');
  await expect(page.locator('#tonightDetailBody')).toBeVisible();
  await expect(page.locator('#tonightDetailBody')).toHaveText(expectedFull);

  await page.locator('#tonightDetailBtn').click();

  await expect(page.locator('#tonightDetailBtn')).toHaveText('Details');
  await expect(page.locator('#tonightDetailBody')).toBeHidden();
});

test('tonight detail collapses again once a new pick shows (#78)', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  await page.locator('#tonightDetailBtn').click();
  await expect(page.locator('#tonightDetailBody')).toBeVisible();

  await page.locator('#tonightSkipBtn').click();

  await expect(page.locator('#tonightDetailBtn')).toHaveText('Details');
  await expect(page.locator('#tonightDetailBody')).toBeHidden();
});

test('night mood changes the selected movie', async ({ page }) => {
  await page.evaluate(() => {
    // Issue #49 makes findTonightCandidate() prefer a green pick globally,
    // ahead of tier order -- both of these are amber for Nora (age 3) under
    // her strict starter settings, which would otherwise make the fix (not
    // this test's actual subject, mood-based sorting) the reason a Want to
    // watch pick loses out. Loosen both kids' limits so both fixtures are
    // green, isolating the mood-scoring behavior this test is really about.
    state.children.forEach(child => {
      CONTENT_FLAG_IDS.forEach(flagId => setChildFlagLimit(child.id, flagId, 4));
    });
    const gentleIdx = MOVIES.findIndex(movie => movie.t === 'The Many Adventures of Winnie the Pooh');
    const actionIdx = MOVIES.findIndex(movie => movie.t === 'The Incredibles');
    if(gentleIdx < 0 || actionIdx < 0) throw new Error('Test movies missing');
    togglePriority(gentleIdx);
    togglePriority(actionIdx);
    toggleCheck(actionIdx);
  });

  await openTonightAskEditor(page);
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Calm it down' }).click();
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).toContainText('Winnie the Pooh');

  await openTonightAskEditor(page);
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Old favourite' }).click();
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).toContainText('The Incredibles');
});

test('tonight picks from want to watch before new and general shelf', async ({ page }) => {
  const title = await page.evaluate(() => {
    // Same reasoning as the mood test above: The Greatest Showman is amber
    // for this sample family under starter settings, which would otherwise
    // make issue #49's green-first fix (not tier ordering, this test's real
    // subject) the reason it loses out to some other tier's green pick.
    state.children.forEach(child => {
      CONTENT_FLAG_IDS.forEach(flagId => setChildFlagLimit(child.id, flagId, 4));
    });
    const idx = MOVIES.findIndex(movie => movie.t === 'The Greatest Showman');
    if(idx < 0) throw new Error('Test movie missing');
    togglePriority(idx);
    return `${MOVIES[idx].t} (${MOVIES[idx].y})`;
  });

  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).toHaveText(title);
  await expect(page.locator('#tonightPickReasons')).toContainText('Pulled from Want to watch.');
});

test('adults-only new picks use recent releases instead of recently added titles', async ({ page }) => {
  const expected = await page.evaluate(() => {
    const newest = MOVIES
      .map((movie, idx) => ({ movie, idx }))
      .filter(({ movie }) => isRecentRelease(movie))
      .sort((a, b) => movieYear(b.idx) - movieYear(a.idx) || movieAge(a.idx) - movieAge(b.idx) || MOVIES[a.idx].t.localeCompare(MOVIES[b.idx].t))[0];
    if(!newest) throw new Error('No recent release movies available');
    return `${newest.movie.t} (${newest.movie.y})`;
  });

  await openTonightAskEditor(page);
  await page.locator('#tonightKidChoices .choiceChip').filter({ hasText: 'Adults only' }).click();
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: 'Something new' }).click();
  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).toHaveText(expected);
  await expect(page.locator('#tonightPickTitle')).not.toContainText('Winnie the Pooh');
  await expect(page.locator('#tonightPickReasons')).toContainText('Pulled from recent releases.');
});

test('movie experience profile exposes scoring signals for moods', async ({ page }) => {
  const profile = await page.evaluate(() => {
    const idx = MOVIES.findIndex(movie => movie.t === 'The Incredibles');
    if(idx < 0) throw new Error('Test movie missing');
    return movieExperienceProfile(idx);
  });

  expect(profile.energy).toBeGreaterThan(1);
  expect(profile.intensity).toBeGreaterThanOrEqual(2);
  expect(profile.tone.adventurous).toBe(true);
  expect(profile).toHaveProperty('recentRelease');
});

// Issue #49 + #59 regression coverage. setupSampleFamily's sample family
// (Simon age 6, Nora age 3) goes through completeSetupWithChildren, which
// correctly selects every kid from the start -- unlike real-world multi-child
// registration today (issue #48, fixed separately), so these exercise the
// genuine multi-kid code path in selectedKids()/movieVerdictForKids().

test('findTonightCandidate prefers a green pick over a red one when both are eligible (#49)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const base = { y: '2005', ca: '6+', genre: [] };
    const redIdx = MOVIES.push({ ...base, t: 'AAA Regression Fixture Movie', num: 9000001, flags: { violence: 1, language: 4, romance: 1, drinking: 1 } }) - 1;
    const greenIdx = MOVIES.push({ ...base, t: 'BBB Regression Fixture Movie', num: 9000002, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
    // Strict language limit for both sample-family kids: level 4 is
    // guaranteed red, level 1 is always green, regardless of age defaults.
    state.children.forEach(child => setChildFlagLimit(child.id, 'language', 1));
    resetTonightSkips();
    // Isolate candidate selection to just these two fixtures so real catalog
    // movies sitting in an earlier/better tier can't mask the bug -- the
    // strict/relaxed two-pass behavior inside findTonightCandidate() is
    // exactly what's under test here.
    tonightSourceTiers = () => [{ source: 'Shelf', indices: [redIdx, greenIdx] }];
    const candidate = findTonightCandidate();
    return {
      title: MOVIES[candidate.idx].t,
      verdict: movieFitForKids(MOVIES[candidate.idx], selectedKids()).verdict
    };
  });

  expect(result.title).toBe('BBB Regression Fixture Movie');
  expect(result.verdict).toBe('green');
});

test('a green top pick with multiple kids selected cites every kid in its reason (#59)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const greenIdx = MOVIES.push({ t: 'CCC Regression Green Fixture', y: '2005', ca: '6+', genre: [], num: 9000101, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
    findTonightCandidate = () => ({ idx: greenIdx, source: 'Shelf' });
    showTonightPick();
    return {
      verdictText: document.getElementById('tonightVerdict').textContent,
      reasons: Array.from(document.querySelectorAll('#tonightPickReasons li')).map(li => li.textContent),
      watchAnywayDisplay: document.getElementById('tonightWatchAnywayBtn').style.display
    };
  });

  expect(result.verdictText).toBe('Green Light');
  // Both selected kids (Simon and Nora), not just the first, per #59.
  expect(result.reasons[0]).toBe("Within Simon and Nora's starter settings.");
  expect(result.watchAnywayDisplay).toBe('none');
});

test('a red top pick is labeled Red (not Green Light) and Watch anyway works for it (#49)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const redIdx = MOVIES.push({ t: 'DDD Regression Red Fixture', y: '2005', ca: '6+', genre: [], num: 9000102, flags: { violence: 1, language: 4, romance: 1, drinking: 1 } }) - 1;
    state.children.forEach(child => setChildFlagLimit(child.id, 'language', 1));
    findTonightCandidate = () => ({ idx: redIdx, source: 'Shelf' });
    showTonightPick();
    const eventsBefore = (state.events || []).length;
    logWatchAnywaySignal();
    const loggedForRed = (state.events || []).length > eventsBefore;
    return {
      verdictText: document.getElementById('tonightVerdict').textContent,
      reasons: Array.from(document.querySelectorAll('#tonightPickReasons li')).map(li => li.textContent),
      watchAnywayDisplay: document.getElementById('tonightWatchAnywayBtn').style.display,
      loggedForRed
    };
  });

  expect(result.verdictText).toBe('Red: above settings');
  expect(result.reasons[0]).toBe('Above Simon: language and Nora: language.');
  // "Watch anyway" is the same override-a-caution workflow for red as it is
  // for amber, so it should show (and log) for a red pick too.
  expect(result.watchAnywayDisplay).toBe('inline-block');
  expect(result.loggedForRed).toBe(true);
});

test('an amber top pick is still labeled Amber, distinct from red and green (#49)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const amberIdx = MOVIES.push({ t: 'EEE Regression Amber Fixture', y: '2005', ca: '6+', genre: [], num: 9000103, flags: { violence: 1, language: 3, romance: 1, drinking: 1 } }) - 1;
    state.children.forEach(child => setChildFlagLimit(child.id, 'language', 2));
    findTonightCandidate = () => ({ idx: amberIdx, source: 'Shelf' });
    showTonightPick();
    return {
      verdictText: document.getElementById('tonightVerdict').textContent,
      watchAnywayDisplay: document.getElementById('tonightWatchAnywayBtn').style.display
    };
  });

  expect(result.verdictText).toBe('Amber: worth a quick look');
  expect(result.watchAnywayDisplay).toBe('inline-block');
});
