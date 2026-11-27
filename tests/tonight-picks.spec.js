import { test, expect } from '@playwright/test';
import { blockOptionalGoogleAssets, setupSampleFamily } from './helpers.js';

test.beforeEach(async ({ page }) => {
  // The Tonight behavior can be tested without these optional network assets.
  await blockOptionalGoogleAssets({ page });
  await page.route('https://browser.sentry-cdn.com/**', route => route.abort());
  await page.goto('/');
  await setupSampleFamily(page);
});

// Who / time / mood are three pills; each opens a small popover. These
// helpers open the right one and wait for it.
async function openPill(page, which){
  const pill = page.locator(`#tonight${which}Pill`);
  if(await pill.getAttribute('aria-expanded') !== 'true') await pill.click();
  await expect(page.locator(`#tonight${which}Pop`)).toBeVisible();
}

async function chooseMood(page, label){
  await openPill(page, 'Mood');
  await page.locator('#tonightMoodChoices .choiceChip').filter({ hasText: label }).click();
}

async function chooseTime(page, label){
  await openPill(page, 'Time');
  await page.locator('#tonightTimeChoices .choiceChip').filter({ hasText: label }).click();
}

async function chooseWho(page, label){
  await openPill(page, 'Who');
  await page.locator('#tonightKidChoices .choiceChip').filter({ hasText: label }).click();
}

test('who, time and mood show as pills, each opening its own popover', async ({ page }) => {
  await expect(page.locator('#homeScreen h1')).toHaveText('What should we watch tonight?');
  await expect(page.locator('#tonightWhoPill')).toContainText('Simon + Nora');
  await expect(page.locator('#tonightTimePill')).toContainText('90 min');
  await expect(page.locator('#tonightMoodPill')).toContainText('Calm');
  for(const which of ['Who', 'Time', 'Mood']) await expect(page.locator(`#tonight${which}Pop`)).toBeHidden();

  await openPill(page, 'Mood');
  await expect(page.locator('#tonightMoodPill')).toHaveAttribute('aria-expanded', 'true');
  // Only one popover open at a time.
  await openPill(page, 'Time');
  await expect(page.locator('#tonightMoodPop')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tonightTimePop')).toBeHidden();
  await expect(page.locator('#tonightTimePill')).toBeFocused();

  await chooseMood(page, 'Big and silly');
  await expect(page.locator('#tonightMoodPill')).toContainText('Big and silly');
  // A mood or time choice closes its popover; kid toggles keep the Who popover
  // open so several kids can be changed in a row.
  await expect(page.locator('#tonightMoodPop')).toBeHidden();
  await chooseWho(page, 'Nora');
  await expect(page.locator('#tonightWhoPop')).toBeVisible();
  await expect(page.locator('#tonightWhoPill')).toContainText('Simon');
  await expect(page.locator('#tonightWhoPill')).not.toContainText('Nora');
});

test('who, time and mood are remembered for the next visit', async ({ page }) => {
  await chooseTime(page, 'Up to 2 hours');
  await chooseMood(page, 'Something new');
  await chooseWho(page, 'Nora');
  await page.reload();
  await page.locator('#bootSyncLoading').waitFor({ state: 'hidden' });
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightTimePill')).toContainText('Up to 2 hours');
  await expect(page.locator('#tonightMoodPill')).toContainText('Something new');
  await expect(page.locator('#tonightWhoPill')).toContainText('Simon');
  await expect(page.locator('#tonightWhoPill')).not.toContainText('Nora');
});

test('the card\'s Skip is the only skip once a pick shows, and changing a setting updates the pick in place', async ({ page }) => {
  await expect(page.locator('#findTonightPickBtn')).toHaveText("Find tonight's pick");

  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#findTonightPickBtn')).toBeHidden();
  await expect(page.locator('#tonightPickCard').getByRole('button', { name: /skip/i })).toHaveCount(1);

  await chooseMood(page, 'Big and silly');
  // No trip back to "Find tonight's pick": a new pick is already showing.
  await expect(page.locator('#findTonightPickBtn')).toBeHidden();
  await expect(page.locator('#tonightPickCard')).toBeVisible();
  await expect(page.locator('#tonightPickChange')).toContainText('big and silly');
});

test('the fit verdict reads before the Pre-Show notes', async ({ page }) => {
  await page.locator('#findTonightPickBtn').click();
  const order = await page.evaluate(() => {
    const reasons = document.getElementById('tonightPickReasons');
    const preShow = document.getElementById('tonightPreShow');
    return Boolean(reasons.compareDocumentPosition(preShow) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
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

// Issue #92: the sample family's real ages (Simon 6, Nora 3) now gate
// strictly per child with no oldest-sibling tolerance, which shrinks the
// real-catalog eligible pool to only a handful of titles -- not enough to
// reliably exercise "skip lands on something different" on its own. These
// two tests loosen both kids' ages and content limits first, same isolation
// pattern already used elsewhere in this file, since neither test is
// actually about age or content-fit policy.
async function loosenSampleFamilyForBroadEligibility(page){
  await page.evaluate(() => {
    state.children.forEach(child => {
      child.age = 12;
      CONTENT_FLAG_IDS.forEach(flagId => setChildFlagLimit(child.id, flagId, 4));
    });
    tonightSelection.time = 999;
  });
}

test('skip advances to a different tonight pick', async ({ page }) => {
  await loosenSampleFamilyForBroadEligibility(page);
  await page.locator('#findTonightPickBtn').click();
  const firstPick = await page.locator('#tonightPickTitle').textContent();

  await page.locator('#tonightSkipBtn').click();

  await expect(page.locator('#tonightPickTitle')).not.toHaveText(firstPick);
  await expect(page.locator('#toast')).toContainText('Skipped.');
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
    tonightSelection.time = 999;
    // Issue #49 makes findTonightCandidate() prefer a green pick globally,
    // ahead of tier order -- both of these are amber for Nora (age 3) under
    // her strict starter settings, which would otherwise make the fix (not
    // this test's actual subject, mood-based sorting) the reason a Want to
    // watch pick loses out. Loosen both kids' limits so both fixtures are
    // green, isolating the mood-scoring behavior this test is really about.
    // Issue #92: The Incredibles is ca 8+, above Nora's real age (3) -- the
    // old oldest-child-plus-2 tolerance used to let it through regardless;
    // the strict per-child gate correctly no longer does, so age is bumped
    // here too for the same isolation reason as the flag limits above.
    state.children.forEach(child => {
      child.age = 12;
      CONTENT_FLAG_IDS.forEach(flagId => setChildFlagLimit(child.id, flagId, 4));
    });
    const gentleIdx = MOVIES.findIndex(movie => movie.t === 'The Many Adventures of Winnie the Pooh');
    const actionIdx = MOVIES.findIndex(movie => movie.t === 'The Incredibles');
    if(gentleIdx < 0 || actionIdx < 0) throw new Error('Test movies missing');
    togglePriority(gentleIdx);
    togglePriority(actionIdx);
    toggleCheck(actionIdx);
    // Issue #97: candidate selection now ranks by mood score across the
    // whole flattened pool, not tier-by-tier -- so without this isolation, a
    // real catalog title with an even better mood-score match than either
    // fixture could win and mask the mood-based sorting this test is
    // actually about. Restricting the pool to just these two keeps the test
    // about mood scoring, same reasoning as the #49/#92 isolation above.
    tonightSourceTiers = () => [{ source: 'Want to watch', indices: [gentleIdx, actionIdx] }];
  });

  await chooseMood(page, 'Calm it down');
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).toContainText('Winnie the Pooh');

  await chooseMood(page, 'Old favourite');
  await expect(page.locator('#tonightPickTitle')).toContainText('The Incredibles');
});

test('a Want to watch pick renders the Want to watch source label', async ({ page }) => {
  // Issue #97 note: this used to be titled "...before new and general
  // shelf" and relied on tier order alone always surfacing a Want to watch
  // pick ahead of every other tier -- that's exactly the bug #97 fixes
  // (mood ranking now crosses tier boundaries), so this test is narrowed to
  // an isolated single-tier fixture and now only covers what it should:
  // that a pick sourced from Want to watch renders the right source label.
  // See "mood ranking crosses tier boundaries..." below for #97 itself.
  const title = await page.evaluate(() => {
    state.children.forEach(child => {
      child.age = 12;
      CONTENT_FLAG_IDS.forEach(flagId => setChildFlagLimit(child.id, flagId, 4));
    });
    const idx = MOVIES.findIndex(movie => movie.t === 'The Greatest Showman');
    if(idx < 0) throw new Error('Test movie missing');
    togglePriority(idx);
    tonightSelection.time = 120;
    resetTonightSkips();
    tonightSourceTiers = () => [{ source: 'Want to watch', indices: [idx] }];
    return `${MOVIES[idx].t} (${MOVIES[idx].y})`;
  });

  await page.locator('#findTonightPickBtn').click();

  await expect(page.locator('#tonightPickTitle')).toHaveText(title);
  await expect(page.locator('#tonightPickReasons')).toContainText('Someone in your family starred this one.');
});

test('mood ranking crosses tier boundaries instead of exhausting Want to watch first (#97)', async ({ page }) => {
  const result = await page.evaluate(() => {
    state.children.forEach(child => {
      child.age = 12;
      CONTENT_FLAG_IDS.forEach(flagId => setChildFlagLimit(child.id, flagId, 4));
    });
    const base = { y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26' };
    // Want to watch fixture engineered to score badly under calm mood (high
    // violence -> high intensity -> high calm score); Shelf fixture
    // engineered to score well (low violence). Before #97, tier order alone
    // meant the Want to watch tier was exhausted first regardless of mood
    // fit, so this fixture would always win even though it's a worse match.
    const wantIdx = MOVIES.push({ ...base, t: 'FFF Regression WantToWatch Fixture', num: 9000104, flags: { violence: 4, language: 1, romance: 1, drinking: 1 } }) - 1;
    const shelfIdx = MOVIES.push({ ...base, t: 'GGG Regression Shelf Fixture', num: 9000105, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
    resetTonightSkips();
    tonightSourceTiers = () => [
      { source: 'Want to watch', indices: [wantIdx] },
      { source: 'Shelf', indices: [shelfIdx] }
    ];
    tonightSelection.mood = 'calm';
    const candidate = findTonightCandidate();
    return { title: MOVIES[candidate.idx].t, source: candidate.source };
  });

  expect(result.title).toBe('GGG Regression Shelf Fixture');
  expect(result.source).toBe('Shelf');
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

  await chooseWho(page, 'Adults only');
  await chooseMood(page, 'Something new');
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
    // Issue #92: ca must clear the strict per-child age gate for both
    // sample-family kids (Nora is 3) -- 3+ does, 6+ no longer would, since
    // there's no oldest-child tolerance to lean on. Age isn't this test's
    // subject, so it's set low enough to be a non-factor for either kid.
    const base = { y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26' };
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
    const greenIdx = MOVIES.push({ t: 'CCC Regression Green Fixture', y: '2005', ca: '6+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000101, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
    findTonightCandidate = () => ({ idx: greenIdx, source: 'Shelf' });
    showTonightPick();
    return {
      verdictText: document.getElementById('tonightVerdict').textContent,
      reasons: Array.from(document.querySelectorAll('#tonightPickReasons li')).map(li => li.textContent),
      watchAnywayDisplay: (document.getElementById('tonightWatchAnywayBtn').hidden ? 'none' : 'inline-block')
    };
  });

  expect(result.verdictText).toBe("Tonight's pick");
  // Both selected kids (Simon and Nora), not just the first, per #59.
  // "current content limits" per #94 -- neutral regardless of whether a
  // limit is the age-based starter default or an explicit parent override.
  expect(result.reasons[0]).toBe("Within Simon and Nora's current content limits.");
  expect(result.watchAnywayDisplay).toBe('none');
});

test('a red top pick is labeled Above settings and Watch anyway works for it (#49)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const redIdx = MOVIES.push({ t: 'DDD Regression Red Fixture', y: '2005', ca: '6+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000102, flags: { violence: 1, language: 4, romance: 1, drinking: 1 } }) - 1;
    state.children.forEach(child => setChildFlagLimit(child.id, 'language', 1));
    findTonightCandidate = () => ({ idx: redIdx, source: 'Shelf' });
    showTonightPick();
    const eventsBefore = (state.events || []).length;
    logWatchAnywaySignal();
    const loggedForRed = (state.events || []).length > eventsBefore;
    return {
      verdictText: document.getElementById('tonightVerdict').textContent,
      reasons: Array.from(document.querySelectorAll('#tonightPickReasons li')).map(li => li.textContent),
      watchAnywayDisplay: (document.getElementById('tonightWatchAnywayBtn').hidden ? 'none' : 'inline-block'),
      loggedForRed
    };
  });

  expect(result.verdictText).toBe('Above settings');
  expect(result.reasons[0]).toBe('Above Simon: language and Nora: language.');
  // "Watch anyway" is the same override-a-caution workflow for red as it is
  // for amber, so it should show (and log) for a red pick too.
  expect(result.watchAnywayDisplay).toBe('inline-block');
  expect(result.loggedForRed).toBe(true);
});

test('an amber top pick is labeled Review fit, distinct from red and green (#49)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const amberIdx = MOVIES.push({ t: 'EEE Regression Amber Fixture', y: '2005', ca: '6+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000103, flags: { violence: 1, language: 3, romance: 1, drinking: 1 } }) - 1;
    state.children.forEach(child => setChildFlagLimit(child.id, 'language', 2));
    findTonightCandidate = () => ({ idx: amberIdx, source: 'Shelf' });
    showTonightPick();
    return {
      verdictText: document.getElementById('tonightVerdict').textContent,
      watchAnywayDisplay: (document.getElementById('tonightWatchAnywayBtn').hidden ? 'none' : 'inline-block')
    };
  });

  expect(result.verdictText).toBe('Review fit');
  expect(result.watchAnywayDisplay).toBe('inline-block');
  // Watch anyway takes Mark watched's place as the main button, and the
  // action bar repeats the reason next to it.
  await expect(page.locator('#tonightWatchBtn')).toBeHidden();
  await expect(page.locator('#tonightBarWarning')).toContainText('Over');
});

// Issue #108: the existing red/amber tests above both land exactly at
// reasons.length === 2 (two children, one category each), so neither ever
// exercises showTonightPick()'s summarized-copy branch (reasons.length > 2)
// where affectedChildCount actually matters -- the one place the #108 bug
// lived. These three cover the acceptance criteria's three scenarios
// directly: one child/multiple categories, multiple children/one category
// each, and a mixed case that proves affectedChildCount (distinct children)
// is used instead of reasons.length (category-issue count).
test.describe('summarized red copy counts distinct children, not category-issues (#108)', () => {
  test('one child over multiple categories reports a single child', async ({ page }) => {
    const result = await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'SSS OneChild ThreeCategory Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000214, flags: { violence: 4, language: 4, romance: 4, drinking: 1 } }) - 1;
      state.children = [{ id: 'kid-solo', name: 'Solo', age: 12, settings: {} }];
      tonightSelection.excludedChildIds = new Set();
      ['violence', 'language', 'romance'].forEach(flagId => setChildFlagLimit('kid-solo', flagId, 1));
      findTonightCandidate = () => ({ idx, source: 'Shelf' });
      showTonightPick();
      return {
        verdictText: document.getElementById('tonightVerdict').textContent,
        summary: document.querySelector('#tonightPickReasons li').textContent
      };
    });

    expect(result.verdictText).toBe('Above settings');
    expect(result.summary).toBe('Above settings for 1 child watching.');
  });

  test('three children with one category each report all three', async ({ page }) => {
    const result = await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'TTT ThreeChild OneCategory Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000215, flags: { violence: 1, language: 4, romance: 1, drinking: 1 } }) - 1;
      state.children = [
        { id: 'kid-a', name: 'Ava', age: 12, settings: {} },
        { id: 'kid-b', name: 'Ben', age: 12, settings: {} },
        { id: 'kid-c', name: 'Cora', age: 12, settings: {} }
      ];
      tonightSelection.excludedChildIds = new Set();
      state.children.forEach(child => setChildFlagLimit(child.id, 'language', 1));
      findTonightCandidate = () => ({ idx, source: 'Shelf' });
      showTonightPick();
      return {
        verdictText: document.getElementById('tonightVerdict').textContent,
        summary: document.querySelector('#tonightPickReasons li').textContent
      };
    });

    expect(result.verdictText).toBe('Above settings');
    expect(result.summary).toBe('Above settings for 3 of the kids watching.');
  });

  test('mixed categories-per-child counts distinct children, not the category tally', async ({ page }) => {
    const result = await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'UUU Mixed Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000216, flags: { violence: 4, language: 4, romance: 1, drinking: 1 } }) - 1;
      state.children = [
        { id: 'kid-x', name: 'Xena', age: 12, settings: {} },
        { id: 'kid-y', name: 'Yara', age: 12, settings: {} }
      ];
      tonightSelection.excludedChildIds = new Set();
      setChildFlagLimit('kid-x', 'violence', 1);
      setChildFlagLimit('kid-x', 'language', 1);
      setChildFlagLimit('kid-y', 'violence', 1);
      findTonightCandidate = () => ({ idx, source: 'Shelf' });
      showTonightPick();
      return {
        verdictText: document.getElementById('tonightVerdict').textContent,
        summary: document.querySelector('#tonightPickReasons li').textContent
      };
    });

    expect(result.verdictText).toBe('Above settings');
    // 3 category-level reasons (Xena: violence, Xena: language, Yara:
    // violence) but only 2 distinct children -- pre-#108 this would have
    // read "for 3 of the kids watching," counting reasons instead of kids.
    expect(result.summary).toBe('Above settings for 2 of the kids watching.');
  });
});

// Issues #92/#93/#96 regression coverage. All three land in the same
// isTonightEligible()/findTonightCandidate() pass, so they're covered
// together here rather than split across files.

test.describe('strict per-child age eligibility, no oldest-sibling tolerance (#92)', () => {
  test('an older sibling cannot make a title eligible for a younger child', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Issue #92's own reproduction: a 3-year-old and a 13-year-old
      // together used to let a 14+ title through for both under the old
      // oldest-child-plus-2 rule (13 + 2 = 15 >= 14).
      const idx = MOVIES.push({ t: 'FFF Mixed-Age Fixture', y: '2005', ca: '14+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000201, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      state.children = [
        { id: 'kid-young', name: 'Young', age: 3, settings: {} },
        { id: 'kid-old', name: 'Old', age: 13, settings: {} }
      ];
      tonightSelection.excludedChildIds = new Set();
      const bothSelected = isTonightEligible(idx, selectedKids(), false, false);
      tonightSelection.excludedChildIds = new Set(['kid-old']);
      const youngAlone = isTonightEligible(idx, selectedKids(), false, false);
      return { bothSelected, youngAlone };
    });

    expect(result.bothSelected).toBe(false);
    expect(result.youngAlone).toBe(false);
  });

  test('the gate is exact at the boundary, no tolerance past it', async ({ page }) => {
    const result = await page.evaluate(() => {
      const atBoundaryIdx = MOVIES.push({ t: 'GGG At-Boundary Fixture', y: '2005', ca: '8+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000202, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      const overBoundaryIdx = MOVIES.push({ t: 'HHH Over-Boundary Fixture', y: '2005', ca: '9+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000203, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      state.children = [{ id: 'kid-8', name: 'Eight', age: 8, settings: {} }];
      tonightSelection.excludedChildIds = new Set();
      const kids = selectedKids();
      return {
        atBoundary: isTonightEligible(atBoundaryIdx, kids, false, false),
        overBoundary: isTonightEligible(overBoundaryIdx, kids, false, false)
      };
    });

    expect(result.atBoundary).toBe(true);
    expect(result.overBoundary).toBe(false);
  });
});

test.describe('Tonight runtime limits (#89)', () => {
  test('90- and 120-minute choices are hard maximums while Any length is unrestricted', async ({ page }) => {
    const result = await page.evaluate(() => {
      const movie = { t: 'Runtime Boundary Fixture', y: '2005', ca: '3+', genre: [], num: 9000301, flags: { violence: 1, language: 1, romance: 1, drinking: 1 }, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26' };
      const idx = MOVIES.push(movie) - 1;
      const kids = selectedKids();
      const eligibleAt = (time, runtimeMinutes) => {
        tonightSelection.time = time;
        movie.runtimeMinutes = runtimeMinutes;
        return isTonightEligible(idx, kids, false, false);
      };
      return {
        at90: eligibleAt(90, 90),
        over90: eligibleAt(90, 91),
        at120: eligibleAt(120, 120),
        over120: eligibleAt(120, 121),
        anyLength: eligibleAt(999, 240)
      };
    });

    expect(result).toEqual({ at90: true, over90: false, at120: true, over120: false, anyLength: true });
  });

  test('missing runtime is excluded from constrained picks and cannot produce a fit claim', async ({ page }) => {
    const result = await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'Missing Runtime Fixture', y: '2005', ca: '3+', genre: [], num: 9000302, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      tonightSelection.time = 90;
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      const candidate = findTonightCandidate();
      return { eligible: isTonightEligible(idx, selectedKids(), false, false), noMatch: !!candidate.noMatch };
    });

    expect(result).toEqual({ eligible: false, noMatch: true });
    await expect(page.locator('#tonightPickReasons')).not.toContainText('Fits your');
  });

  test('the recommendation shows the film runtime next to the time pill', async ({ page }) => {
    await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'Runtime Copy Fixture', y: '2005', ca: '3+', studio: 'Fixture Films', genre: [], num: 9000303, flags: { violence: 1, language: 1, romance: 1, drinking: 1 }, runtimeMinutes: 88, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26' }) - 1;
      tonightSelection.time = 90;
      showTonightPick({ idx, source: 'Shelf' });
    });

    // The runtime sits under the title; the window it has to fit is the
    // time pill above it.
    await expect(page.locator('#tonightPickFacts')).toHaveText('Fixture Films · 1h 28m · CSM 3+');
    await expect(page.locator('#tonightTimePill')).toContainText('90 min');
  });
});

test.describe('no automatic green verdict without confirmed content data (#96)', () => {
  test('a title with no flags at all is never auto-recommended to a child-inclusive session', async ({ page }) => {
    const result = await page.evaluate(() => {
      // No `flags` property at all -- the exact shape of the 36 real
      // catalog titles issue #96 describes (e.g. Home Alone 2).
      const idx = MOVIES.push({ t: 'III No-Flags Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000204 }) - 1;
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      const candidate = findTonightCandidate();
      return { hasConfirmed: hasConfirmedContentData(MOVIES[idx]), noMatch: !!candidate.noMatch };
    });

    expect(result.hasConfirmed).toBe(false);
    expect(result.noMatch).toBe(true);
  });

  test('a title with confirmed content data remains eligible', async ({ page }) => {
    const result = await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'JJJ Confirmed Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000205, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      const candidate = findTonightCandidate();
      return { noMatch: !!candidate.noMatch, title: candidate.idx !== null ? MOVIES[candidate.idx].t : null };
    });

    expect(result.noMatch).toBe(false);
    expect(result.title).toBe('JJJ Confirmed Fixture');
  });
});

test.describe('typed no-match state instead of an unvalidated fallback pick (#93)', () => {
  test('findTonightCandidate returns a typed no-match result, never an unvalidated index', async ({ page }) => {
    const result = await page.evaluate(() => {
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [] }];
      resetTonightSkips();
      return findTonightCandidate();
    });

    expect(result.noMatch).toBe(true);
    expect(result.idx).toBeNull();
  });

  test('no-match when every candidate is watched', async ({ page }) => {
    const result = await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'KKK Watched Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000206, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      toggleCheck(idx);
      tonightSelection.mood = 'calm';
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      return findTonightCandidate();
    });

    expect(result.noMatch).toBe(true);
  });

  test('no-match when every candidate fails the age gate', async ({ page }) => {
    const result = await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'LLL Too-Old Fixture', y: '2005', ca: '14+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000207, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      return findTonightCandidate();
    });

    expect(result.noMatch).toBe(true);
  });

  test('no-match when the catalog is empty', async ({ page }) => {
    const result = await page.evaluate(() => {
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [] }];
      resetTonightSkips();
      return findTonightCandidate();
    });

    expect(result.noMatch).toBe(true);
    expect(result.idx).toBeNull();
  });

  test('the UI shows a dedicated no-match state with recovery actions, and clears once a real pick is found', async ({ page }) => {
    await page.evaluate(() => {
      window.__originalTonightSourceTiers = tonightSourceTiers;
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [] }];
      resetTonightSkips();
    });

    await page.locator('#findTonightPickBtn').click();

    await expect(page.locator('#tonightNoMatchCard')).toBeVisible();
    await expect(page.locator('#tonightPickCard')).toBeHidden();
    await expect(page.locator('#tonightNoMatchCard')).toContainText('No confident match');
    await expect(page.locator('#tonightNoMatchChangeBtn')).toBeVisible();
    await expect(page.locator('#tonightNoMatchFamilyBtn')).toBeVisible();
    await expect(page.locator('#tonightNoMatchShelfBtn')).toBeVisible();

    await page.evaluate(() => {
      tonightSourceTiers = window.__originalTonightSourceTiers;
      resetTonightSkips();
    });
    await page.locator('#findTonightPickBtn').click();

    await expect(page.locator('#tonightNoMatchCard')).toBeHidden();
    await expect(page.locator('#tonightPickCard')).toBeVisible();
  });

  for (const { name, durations, reason } of [
    { name: 'longer movies', durations: [105], reason: 'The remaining movies run longer than 90 minutes.' },
    { name: 'unknown runtimes', durations: [null], reason: 'The remaining movies have no recorded runtime, so we can’t tell if they fit in 90 minutes.' },
    { name: 'longer movies and unknown runtimes', durations: [105, null], reason: 'The remaining movies run longer than 90 minutes or have no recorded runtime.' },
    { name: 'no movies that pass the other checks', durations: [], reason: 'No movie on the Shelf passed Tonight’s checks for these choices and the information available.' },
  ]) {
    test(`no-match explains the time limit accurately for ${name}`, async ({ page }) => {
      await page.evaluate((runtimes) => {
        const indices = [];
        const addMovie = (title, age, runtime, num) => {
          const movie = { t: title, y: '2005', ca: age, genre: [], num, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } };
          if (runtime !== null) movie.runtimeMinutes = runtime;
          indices.push(MOVIES.push(movie) - 1);
        };
        addMovie('Too Old for Tonight', '14+', 110, 9000300);
        runtimes.forEach((runtime, i) => addMovie(`Otherwise Eligible Film ${i}`, '3+', runtime, 9000301 + i));
        tonightSourceTiers = () => [{ source: 'Shelf', indices }];
        resetTonightSkips();
      }, durations);

      await page.locator('#findTonightPickBtn').click();

      const card = page.locator('#tonightNoMatchCard');
      await expect(card).toBeVisible();
      await expect(page.locator('#tonightNoMatchReason')).toHaveText(reason);
      await expect(page.locator('#tonightPickStatus')).toHaveText(`No confident match. ${reason}`);
      await expect(page.locator('#tonightPickCard')).toBeHidden();
      const change = card.getByRole('button', { name: durations.length ? 'Change time limit' : "Change who's watching" });
      await expect(change).toBeVisible();

      if (name === 'longer movies') {
        await expect(change).toHaveAttribute('aria-controls', 'tonightTimePop');
        await expect(card.getByRole('button', { name: 'Review content settings' })).toBeHidden();
        await change.focus();
        await page.keyboard.press('Enter');
        const timePop = page.locator('#tonightTimePop');
        await expect(timePop).toBeVisible();
        await expect(timePop.getByRole('button', { name: 'About 90 minutes' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.locator('#tonightTimePill')).toBeFocused();
        await change.click();
        await expect(timePop).toBeVisible();
        await chooseTime(page, 'Up to 2 hours');
        await expect(card).toBeHidden();
        await expect(page.locator('#tonightPickTitle')).toHaveText(/Otherwise Eligible Film 0/);
      }
    });
  }

  test('no-match recovery actions open the Who popover and Browse', async ({ page }) => {
    await page.evaluate(() => {
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [] }];
      resetTonightSkips();
    });
    await page.locator('#findTonightPickBtn').click();
    await expect(page.locator('#tonightNoMatchCard')).toBeVisible();

    await page.locator('#tonightNoMatchChangeBtn').click();
    await expect(page.locator('#tonightWhoPop')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('#tonightNoMatchShelfBtn').click();
    await expect(page.locator('#browseScreen')).toBeVisible();
  });
});

test.describe('per-skip session-scoped feedback, not a single global reason (#103)', () => {
  test('two consecutive skips record distinct events and never inherit the previous reason', async ({ page }) => {
    const firstTitle = await page.evaluate(() => {
      const idxA = MOVIES.push({ t: 'MMM Skip Fixture A', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000208, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      const idxB = MOVIES.push({ t: 'NNN Skip Fixture B', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000209, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idxA, idxB] }];
      resetTonightSkips();
      showTonightPick();
      return MOVIES[tonightSelection.currentPickIdx].t;
    });
    expect(firstTitle).toBe('MMM Skip Fixture A');

    await page.locator('#tonightSkipBtn').click();
    await expect(page.locator('#tonightSkipFeedback')).toBeVisible();
    await page.locator('[data-skip-reason="Wrong mood"]').click();
    await expect(page.locator('[data-skip-reason="Wrong mood"]')).toHaveClass(/selected/);

    const secondTitle = await page.evaluate(() => MOVIES[tonightSelection.currentPickIdx].t);
    expect(secondTitle).toBe('NNN Skip Fixture B');

    await page.locator('#tonightSkipBtn').click();
    // The crux of #103: a fresh skip's feedback prompt must start unselected,
    // never carrying over the previous skipped movie's chosen reason.
    await expect(page.locator('[data-skip-reason="Wrong mood"]')).not.toHaveClass(/selected/);
    await page.locator('[data-skip-reason="Not interested"]').click();

    const events = await page.evaluate(() => tonightSkipEvents.map(e => ({ titleId: e.titleId, reason: e.reason })));
    expect(events).toEqual([
      { titleId: 9000208, reason: 'Wrong mood' },
      { titleId: 9000209, reason: 'Not interested' }
    ]);
  });

  test('an unanswered skip still records a session-scoped event with no reason', async ({ page }) => {
    await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'OOO Unanswered Skip Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000210, flags: { violence: 1, language: 1, romance: 1, drinking: 1 } }) - 1;
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      showTonightPick();
    });

    await page.locator('#tonightSkipBtn').click();
    await page.locator('#tonightSkipContinueBtn').click();

    const events = await page.evaluate(() => tonightSkipEvents.map(e => ({ titleId: e.titleId, reason: e.reason })));
    expect(events).toEqual([{ titleId: 9000210, reason: null }]);
  });
});

test.describe('Watch anyway is idempotent per recommendation, not per tap (#104)', () => {
  test('repeated taps on the same pick log once, then reverse -- never appending duplicates', async ({ page }) => {
    await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'PPP WatchAnyway Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000211, flags: { violence: 1, language: 4, romance: 1, drinking: 1 } }) - 1;
      state.children.forEach(child => setChildFlagLimit(child.id, 'language', 1));
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      showTonightPick();
    });

    await page.locator('#tonightWatchAnywayBtn').click();
    const afterFirst = await page.evaluate(() => (state.events || []).filter(e => e.type === 'watch_anyway').length);
    expect(afterFirst).toBeGreaterThan(0);

    // A repeated tap before anything else changes is a deliberate reversal,
    // not more evidence -- it removes what the first tap logged.
    await page.locator('#tonightWatchAnywayBtn').click();
    const afterSecond = await page.evaluate(() => (state.events || []).filter(e => e.type === 'watch_anyway').length);
    expect(afterSecond).toBe(0);
  });

  test('the button visibly acknowledges a saved decision', async ({ page }) => {
    await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'QQQ WatchAnyway Ack Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000212, flags: { violence: 1, language: 4, romance: 1, drinking: 1 } }) - 1;
      state.children.forEach(child => setChildFlagLimit(child.id, 'language', 1));
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      showTonightPick();
    });

    await expect(page.locator('#tonightWatchAnywayBtn')).toHaveText('Watch anyway');
    await page.locator('#tonightWatchAnywayBtn').click();
    // Watch anyway is the main button on this pick, so it marks the movie
    // watched and logs the review signal together; a second tap undoes both.
    await expect(page.locator('#tonightWatchAnywayBtn')).toHaveText('✓ Watched');
    await expect(page.locator('#tonightWatchAnywayBtn')).toHaveAttribute('aria-pressed', 'true');
    const after = await page.evaluate(() => ({
      watched: !!markValue(state.checked, tonightSelection.currentPickIdx),
      signals: (state.events || []).filter(e => e.type === 'watch_anyway').length
    }));
    expect(after.watched).toBe(true);
    expect(after.signals).toBeGreaterThan(0);

    await page.locator('#tonightWatchAnywayBtn').click();
    await expect(page.locator('#tonightWatchAnywayBtn')).toHaveText('Watch anyway');
    const undone = await page.evaluate(() => ({
      watched: !!markValue(state.checked, tonightSelection.currentPickIdx),
      signals: (state.events || []).filter(e => e.type === 'watch_anyway').length
    }));
    expect(undone).toEqual({ watched: false, signals: 0 });
  });

  test('one decision cannot satisfy the three-distinct-choice Family cue threshold', async ({ page }) => {
    const count = await page.evaluate(() => {
      const idx = MOVIES.push({ t: 'RRR ThreeTap Fixture', y: '2005', ca: '3+', genre: [], runtimeMinutes: 90, runtimeSourceId: 'fixture', runtimeVerifiedAt: '2026-09-26', num: 9000213, flags: { violence: 1, language: 4, romance: 1, drinking: 1 } }) - 1;
      state.children.forEach(child => setChildFlagLimit(child.id, 'language', 1));
      tonightSourceTiers = () => [{ source: 'Shelf', indices: [idx] }];
      resetTonightSkips();
      showTonightPick();
      // Three taps on one displayed recommendation: log, undo, log again --
      // still at most one active event per child+flag out of this.
      logWatchAnywaySignal();
      logWatchAnywaySignal();
      logWatchAnywaySignal();
      return (state.events || []).filter(e => e.type === 'watch_anyway' && e.childId === 'simon' && e.flag === 'language').length;
    });

    expect(count).toBeLessThan(3);
  });
});

test.describe('changing viewers, mood, or duration never leaves a stale recommendation (#105)', () => {
  test('switching mood shows a new pick right away', async ({ page }) => {
    await page.locator('#findTonightPickBtn').click();
    const before = await page.locator('#tonightPickTitle').textContent();

    await chooseMood(page, 'Big and silly');

    await expect(page.locator('#tonightPickCard')).toBeVisible();
    await expect(page.locator('#tonightPickTitle')).not.toHaveText(before);
    await expect(page.locator('#tonightPickChange')).toContainText('New pick for big and silly');
  });

  test('switching to Adults only re-judges the pick without any child limits', async ({ page }) => {
    await page.locator('#findTonightPickBtn').click();
    await expect(page.locator('#tonightPickCard')).toBeVisible();

    await chooseWho(page, 'Adults only');

    const shown = await page.evaluate(() => ({
      verdict: tonightSelection.verdict,
      kids: selectedKids().length,
      idx: tonightSelection.currentPickIdx
    }));
    expect(shown.kids).toBe(0);
    expect(shown.idx).not.toBeNull();
    expect(shown.verdict).toBe('green');
    await expect(page.locator('#tonightPickReasons')).not.toContainText('Simon');
    await expect(page.locator('#tonightPickReasons')).not.toContainText('Nora');
  });

  test('changing duration keeps a pick only if it still fits the new window', async ({ page }) => {
    await page.locator('#findTonightPickBtn').click();
    await chooseTime(page, 'Up to 2 hours');
    const fits = await page.evaluate(() => {
      const m = MOVIES[tonightSelection.currentPickIdx];
      return m.runtimeMinutes <= 120;
    });
    expect(fits).toBe(true);
    await expect(page.locator('#tonightPickChange')).toContainText(/Still a good fit|New pick/);
  });

  test('skipped titles stay skipped when a setting changes', async ({ page }) => {
    await page.locator('#findTonightPickBtn').click();
    const skipped = await page.locator('#tonightPickTitle').textContent();
    await page.locator('#tonightSkipBtn').click();
    await chooseTime(page, 'Any length');
    await chooseTime(page, 'About 90 minutes');
    await expect(page.locator('#tonightPickTitle')).not.toHaveText(skipped);
    const stillSkipped = await page.evaluate(() => tonightSelection.skippedMovieNums.size);
    expect(stillSkipped).toBeGreaterThan(0);
  });
});

