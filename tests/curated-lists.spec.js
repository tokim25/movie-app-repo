import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';
import { expectNoA11yViolations } from './a11y.js';

// Curated lists (data-lists.js) live on their own Lists tab as passport
// cards: the in-season list first with a "Now showing" badge, the rest on
// themed shelves, out-of-season lists as calendar cards under "Coming
// attractions" and tucked-away lists in a box at the bottom. Every in-season list (up to 3) also gets a card on Tonight.
// A list with fewer than 5 titles that fit the selected kids is not shown
// (A small number of intentionally narrow representation lists set a lower
// threshold explicitly while the catalog grows).

async function startOn(page, isoDate) {
  await page.clock.setFixedTime(new Date(isoDate));
  await page.goto('/');
  await setupSampleFamily(page);
}

async function openLists(page) {
  await page.locator('#tabLists').click();
  await page.locator('#listsScreen').waitFor({ state: 'visible' });
}

// Watching as adults only, every film on a list counts.
async function watchAsAdultsOnly(page) {
  await page.locator('#tabHome').click();
  await page.locator('#tonightWhoPill').click();
  for (const name of ['Simon', 'Nora']) {
    await page.locator('#tonightKidChoices .choiceChip', { hasText: name }).click();
  }
  await expect(page.locator('#tonightWhoPill')).toContainText('Adults only');
  await page.keyboard.press('Escape');
}

test('Lists is its own tab, between Shelf and Tonight', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  const labels = await page.locator('#quickBar .qbBtn > span:not(.qbCount):not(.qbDot)').allTextContents();
  expect(labels).toEqual(['Shelf', 'Lists', 'Tonight', "What's new", 'Family']);
  await openLists(page);
  await expect(page.locator('#tabLists')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#listsScreenHeading')).toHaveText('Lists');
});

test('in December, Christmas gets the passport card and opens in list order', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  const hero = page.locator('#listsBody .passport.hero');
  await expect(hero).toContainText('Now showing');
  await expect(hero).toContainText('Christmas movies');
  await expect(hero).toContainText('fit Simon + Nora');
  await expect(page.locator('#listsBody .passport', { hasText: 'Snow day' })).toBeVisible();

  await hero.click();
  await expect(page.locator('#openListName')).toHaveText('Christmas movies');
  await expect(page.locator('#openListName')).toBeFocused();
  await expect(page.locator('#listOpen .coverMeta')).toContainText('Picked by hand');
  await expect(page.locator('#openListRows > li.row').first()).toContainText('Rudolph the Red-Nosed Reindeer');
  await expect(page.locator('#openListRows > li.row').first().locator('.rowNum')).toHaveText('1');
  await expect(page.locator('#openListRows > li.row')).toHaveCount(10);
  await page.locator('#openListShowAllBtn').click();
  expect(await page.locator('#openListRows > li.row').count()).toBeGreaterThan(10);

  await page.locator('#listsBackBtn').click();
  await expect(page.locator('#listsIndex')).toBeVisible();
  await expect(page.locator('#listsBody .passport.hero')).toBeFocused();
});

test('year-round lists sit on themed shelves, and off-season lists use return-date calendars', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  await expect(page.locator('#lists-h-story-time')).toContainText('Story time');
  await expect(page.locator('#lists-h-cheer-them-on')).toContainText('Cheer them on');
  await expect(page.locator('#lists-h-later')).toContainText('Coming attractions');
  await expect(page.locator('#lists-h-later')).toContainText('Browse any list now');
  const later = page.locator('#listsBody .returnCalendar', { hasText: 'Summer break' });
  await expect(later.locator('.calendarMonth')).toHaveText('Jun');
  await expect(later.locator('.calendarDay')).toHaveText('1');
  await expect(later.locator('.calendarReturn')).toHaveText('Returns Jun 1');
  await expect(later).toHaveCSS('display', 'grid');
  await expect(later).toHaveCSS('transform', 'none');
});

test('Not seen hides watched films in an opened list', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  await page.locator('#listsBody .passport.hero').click();
  const first = page.locator('#openListRows > li.row').first();
  await first.locator('.check').click();
  await page.locator('#openListUnseenBtn').click();
  await expect(page.locator('#openListUnseenBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#openListRows > li.row').first()).not.toContainText('Rudolph the Red-Nosed Reindeer');
});

test('Tonight shows the in-season list and opens it on the Lists tab', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabHome').click();
  const card = page.locator('#tonightSeasonCards .seasonCard', { hasText: 'Christmas movies' });
  await expect(card).toContainText('that fit Simon + Nora');
  await expectNoA11yViolations(page, '#tonightSeasonCards');
  await card.click();
  await expect(page.locator('#listsScreen')).toBeVisible();
  await expect(page.locator('#openListName')).toHaveText('Christmas movies');
});

test('out of every season, Tonight shows no list card', async ({ page }) => {
  // Mid-March 2027 falls after Ramadan and before Easter.
  await startOn(page, '2027-03-12T19:00:00');
  await page.locator('#tabHome').click();
  await expect(page.locator('#findTonightPickBtn')).toBeVisible();
  await expect(page.locator('#tonightSeasonCards')).toBeHidden();
});

// Holidays that move each year (Hanukkah, Ramadan, Passover, Easter,
// Thanksgiving) use real date ranges; earlier entries come first on Tonight.
for (const [when, name] of [
  ['2026-11-01T19:00:00', 'Día de los Muertos'],
  ['2026-11-22T19:00:00', 'Thanksgiving movies'],
  ['2027-03-20T19:00:00', 'Easter movies'],
  ['2027-04-20T19:00:00', 'Passover movies'],
]) {
  test(`on ${when.slice(0, 10)}, Tonight and Lists lead with ${name}`, async ({ page }) => {
    await startOn(page, when);
    await watchAsAdultsOnly(page);
    await expect(page.locator('#tonightSeasonCards .seasonCard').first()).toContainText(name);
    await openLists(page);
    await expect(page.locator('#listsBody .passport.hero')).toContainText(name);
  });
}

test('Tonight shows every in-season list, in list order', async ({ page }) => {
  await startOn(page, '2026-12-05T19:00:00');
  await watchAsAdultsOnly(page);
  const names = await page.locator('#tonightSeasonCards .seasonCardName').allTextContents();
  expect(names).toEqual(['Hanukkah movies', 'Christmas movies', 'Snow day']);
});

test('with three lists in season, Tonight still fits a phone screen without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startOn(page, '2026-12-05T19:00:00');
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightSeasonCards .seasonCard')).toHaveCount(3);
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

test('in late November, Thanksgiving and Christmas both show on Tonight', async ({ page }) => {
  await startOn(page, '2026-11-22T19:00:00');
  await watchAsAdultsOnly(page);
  const names = await page.locator('#tonightSeasonCards .seasonCardName').allTextContents();
  expect(names).toEqual(['Thanksgiving movies', 'Christmas movies']);
});

test('the season card steps aside while a pick is showing', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabHome').click();
  await page.locator('#findTonightPickBtn').click();
  await expect(page.locator('#tonightPickTitle')).not.toBeEmpty();
  await expect(page.locator('#tonightSeasonCards')).toBeHidden();
});

test('Tuck it away hides a list on this device until it is put back', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  await page.locator('#listsBody .passport', { hasText: 'Dog movies' }).click();
  await page.locator('#listHideBtn').click();
  await expect(page.locator('#listsIndex')).toBeVisible();
  await expect(page.locator('#listsBody .passport', { hasText: 'Dog movies' })).toHaveCount(0);

  await page.reload();
  await openLists(page);
  await expect(page.locator('#listsBody .passport', { hasText: 'Dog movies' })).toHaveCount(0);
  const tucked = page.locator('#listsBody .tuckedRow', { hasText: 'Dog movies' });
  await expect(tucked).toBeVisible();
  await tucked.getByRole('button', { name: 'Put back Dog movies' }).click();
  await expect(page.locator('#listsBody .passport', { hasText: 'Dog movies' })).toHaveCount(1);
});

test('a list with fewer than 5 titles that fit rests until more do', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.evaluate(() => {
    const realLists = curatedLists();
    const nums = MOVIES.slice(0, 4).map(m => m.num);
    window.curatedLists = () => realLists.concat([{ id: 'tiny', name: 'Tiny list', blurb: 'Only four.', copy: 'Small.', pins: nums }]);
  });
  await openLists(page);
  await expect(page.locator('#listsBody .listCover', { hasText: 'Tiny list' })).toHaveCount(0);
  await expect(page.locator('#listsBody .tucked')).toContainText('resting');
  await expect(page.locator('#listsBody .passport', { hasText: 'Good teammates' })).toHaveCount(1);
});

test('Shelf points to the Lists tab', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabBrowse').click();
  await page.locator('#listsTeaser').click();
  await expect(page.locator('#listsScreen')).toBeVisible();
  await expect(page.locator('#listsScreenHeading')).toBeFocused();
});

test('passport cards show poster fans while compact seasonal contexts keep decorative icons', async ({ page }) => {
  await stubPosters(page);
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightSeasonCards .seasonCard')).toHaveCount(2);
  await expect(page.locator('#tonightSeasonCards .seasonCard .listIcon[aria-hidden="true"] svg')).toHaveCount(2);
  await openLists(page);
  const passports = page.locator('#listsBody .passport');
  const passportCount = await passports.count();
  expect(passportCount).toBeGreaterThan(10);
  await expect(page.locator('#listsBody .passport .ppFan[aria-hidden="true"]')).toHaveCount(passportCount);
  const fanSizes = await page.locator('#listsBody .passport .ppFan').evaluateAll(fans => fans.map(fan => fan.querySelectorAll('.ppFanPoster').length));
  expect(fanSizes.every(size => size === 2 || size === 3)).toBe(true);
  const frameCount = fanSizes.reduce((sum, size) => sum + size, 0);
  await expect(page.locator('#listsBody .passport .ppFanPoster img')).toHaveCount(frameCount);
  const returnCards = page.locator('#listsBody .returnCalendar');
  const returnCount = await returnCards.count();
  await expect(page.locator('#listsBody .returnCalendar .medal[aria-hidden="true"] svg')).toHaveCount(returnCount);
});

test('a poster fan follows the collection lead-title order', async ({ page }) => {
  await stubPosters(page);
  await startOn(page, '2026-11-16T19:00:00');
  await watchAsAdultsOnly(page);
  await openLists(page);
  const card = page.locator('#listsBody .passport', { hasText: 'Black joy, family and big dreams' });
  const actual = await card.locator('.ppFanPoster img').evaluateAll(images => images.map(image => image.getAttribute('src')));
  const expected = await page.evaluate(() => {
    const list = listById('black-joy-family-big-dreams');
    return list.pins.filter(num => MOVIE_POSTERS[num]?.u).slice(0, 3).map(num => MOVIE_POSTERS[num].u);
  });
  expect(actual).toEqual(expected);
  expect(await card.locator('.ppFanPoster img').evaluateAll(images => images.map(image => image.getAttribute('alt')))).toEqual(['', '', '']);
});

const posterPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// Serve every Wikimedia poster as a 1x1 PNG so poster behaviour can be
// checked without the network, and record which poster URLs were asked for.
async function stubPosters(page){
  const requested = [];
  await page.route('https://upload.wikimedia.org/**', route => {
    requested.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: posterPixel });
  });
  return requested;
}

test('collections show themed artwork when posters are unmapped or all requests fail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://upload.wikimedia.org/**', route => route.abort('failed'));
  await startOn(page, '2026-11-26T19:00:00');
  await openLists(page);

  const thanksgiving = page.locator('#listsBody .passport[data-list="thanksgiving"]');
  await expect(thanksgiving.locator('.ppCollectionArt [data-list-icon="thanksgiving"] svg')).toBeVisible();
  await expect(thanksgiving.locator('.ppBadge')).toHaveText('Now showing');
  await expect(thanksgiving.locator('.ppFanPoster').first()).toHaveCSS('opacity', '0');

  const christmas = page.locator('#listsBody .passport[data-list="christmas"]');
  await expect(christmas.locator('.ppFan img')).toHaveCount(0);
  await expect(christmas.locator('.ppCollectionArt [data-list-icon="christmas"] svg')).toBeVisible();

  await thanksgiving.click();
  await expect(page.locator('#listOpen .ppCollectionArt [data-list-icon="thanksgiving"] svg')).toBeVisible();
});

test('the first successful poster replaces themed artwork and failed slots keep their titles', async ({ page }) => {
  await page.route('https://upload.wikimedia.org/**', route => route.abort('failed'));
  const { promise: releasePoster, resolve } = Promise.withResolvers();
  await page.route('https://upload.wikimedia.org/**/Charlie_Brown_Christmas.jpg', async route => {
    await releasePoster;
    await route.fulfill({ status: 200, contentType: 'image/png', body: posterPixel });
  });
  try {
    await page.clock.setFixedTime(new Date('2026-11-26T19:00:00'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await setupSampleFamily(page);
    await openLists(page);
    const christmas = page.locator('#listsBody .passport[data-list="christmas"]');
    await expect(christmas.locator('.ppCollectionArt')).toBeVisible();
    resolve();

    await expect(christmas.locator('.ppFanPoster.hasLoadedPoster img')).toBeVisible();
    await expect(christmas.locator('.ppCollectionArt')).toBeHidden();
    await expect(christmas.locator('.ppFan img')).toHaveCount(1);
    await expect(christmas.locator('.ppFan .posterFallbackTitle')).toHaveCount(2);
  } finally {
    resolve();
  }
});

test('the Now showing badge sits outside the poster fan, so the fan keeps all three posters in place', async ({ page }) => {
  await stubPosters(page);
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  const hero = page.locator('#listsBody .passport.hero');
  await expect(hero.locator('.ppArt > .ppBadge')).toHaveText('Now showing');
  await expect(hero.locator('.ppFan .ppBadge')).toHaveCount(0);
  const posters = hero.locator('.ppFan .ppFanPoster');
  await expect(posters).toHaveCount(3);
  const lefts = await posters.evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).left)));
  expect(lefts[2]).toBeGreaterThan(lefts[1]);
  const badgeZ = await hero.locator('.ppBadge').evaluate(el => Number(getComputedStyle(el).zIndex));
  expect(badgeZ).toBeGreaterThan(2);
});

test('the top two list cards load their posters first, and the rest wait until scrolled to', async ({ page }) => {
  await stubPosters(page);
  await startOn(page, '2026-12-18T19:00:00');
  await openLists(page);
  const fans = page.locator('#listsBody .passport .ppFan');
  for (const i of [0, 1]) {
    const attrs = await fans.nth(i).locator('img').evaluateAll(imgs => imgs.map(img => [img.loading, img.getAttribute('fetchpriority')]));
    expect(attrs.length).toBeGreaterThan(0);
    expect(attrs.every(([loading, priority]) => loading === 'eager' && priority === 'high')).toBe(true);
  }
  const later = await fans.nth(4).locator('img').evaluateAll(imgs => imgs.map(img => img.loading));
  expect(later.every(loading => loading === 'lazy')).toBe(true);
});

test('after load, the app warms the top list posters before Lists is opened', async ({ page }) => {
  const requested = await stubPosters(page);
  await startOn(page, '2026-12-18T19:00:00');
  const expected = await page.evaluate(() => topListsForWarmup().flatMap(list => listFanMovies(list)).map(movie => MOVIE_POSTERS[movie.num]?.u).filter(Boolean));
  expect(expected.length).toBeGreaterThan(0);
  await page.evaluate(() => warmListPosters());
  await expect.poll(() => expected.every(url => requested.includes(url))).toBe(true);
  await expect(page.locator('#listsScreen')).toBeHidden();
});

test('during Hanukkah, Tonight offers the Hanukkah list, and Christmas comes back after', async ({ page }) => {
  await startOn(page, '2026-12-05T19:00:00');
  await watchAsAdultsOnly(page);
  await expect(page.locator('#tonightSeasonCards')).toContainText('Hanukkah movies');
  await page.locator('#tonightSeasonCards .seasonCard', { hasText: 'Hanukkah movies' }).click();
  await expect(page.locator('#openListName')).toHaveText('Hanukkah movies');
  await expect(page.locator('#openListRows > li.row').first()).toContainText('Lights');
});

test('after Hanukkah ends, its card leaves and Christmas leads', async ({ page }) => {
  await startOn(page, '2026-12-14T19:00:00');
  await watchAsAdultsOnly(page);
  await expect(page.locator('#tonightSeasonCards')).not.toContainText('Hanukkah');
  await expect(page.locator('#tonightSeasonCards .seasonCard').first()).toContainText('Christmas movies');
});

test('the Hanukkah list still shows for young kids when only 2 of its films fit', async ({ page }) => {
  await startOn(page, '2026-12-05T19:00:00');
  expect(await page.evaluate(() => listFitCount(listById('hanukkah')))).toBe(2);
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightSeasonCards')).toContainText('Hanukkah movies');
  await expect(page.locator('#tonightSeasonCards')).toContainText('2 that fit Simon + Nora');
});

test('the season card count follows who is watching', async ({ page }) => {
  await startOn(page, '2026-12-18T19:00:00');
  await page.locator('#tabHome').click();
  await expect(page.locator('#tonightSeasonCards')).toContainText('fit Simon + Nora');
  await watchAsAdultsOnly(page);
  await expect(page.locator('#tonightSeasonCards')).not.toContainText('Simon');
  await expect(page.locator('#tonightSeasonCards')).toContainText('films');
});

test('the seven new community, family and curiosity lists are available', async ({ page }) => {
  await startOn(page, '2026-11-16T19:00:00');
  await watchAsAdultsOnly(page);
  await openLists(page);

  for (const name of [
    'Muslim kids at the center',
    'Sibling teams',
    'Girls lead the way',
    'Food, family and the table',
    'Inventors and problem-solvers',
    'Around the world'
  ]) {
    await expect(page.locator('#listsBody .passport', { hasText: name })).toHaveCount(1);
  }
  await expect(page.locator('#listsBody .returnCalendar', { hasText: 'Ramadan & Eid' })).toHaveCount(1);
});

test('sports and family-representation collections are all available', async ({ page }) => {
  await startOn(page, '2026-11-16T19:00:00');
  await watchAsAdultsOnly(page);
  await openLists(page);

  for (const name of [
    'Nothing but net',
    'The beautiful game',
    'Friday night football',
    'Ice, snow and underdogs',
    'Wheels and waves',
    'Girls in the game',
    'Black joy, family and big dreams',
    'Latino families, many stories',
    'Asian families, many stories',
    'More than one culture at home',
    'Families with pride'
  ]) {
    await expect(page.locator('#listsBody .passport', { hasText: name })).toHaveCount(1);
  }
});

test('representation collections open with a deliberate lead title', async ({ page }) => {
  await startOn(page, '2026-11-16T19:00:00');
  await watchAsAdultsOnly(page);
  await openLists(page);

  for (const [listName, firstTitle] of [
    ['Black joy, family and big dreams', 'The Princess and the Frog'],
    ['Latino families, many stories', 'Encanto'],
    ['Asian families, many stories', 'Over the Moon'],
    ['More than one culture at home', 'Yes Day'],
    ['Families with pride', 'Strange World']
  ]) {
    await page.locator('#listsBody .passport', { hasText: listName }).click();
    await expect(page.locator('#openListRows > li.row').first()).toContainText(firstTitle);
    await page.locator('#listsBackBtn').click();
  }
});

test('during Ramadan, Tonight opens Ramadan nights and Eid mornings with American Eid first', async ({ page }) => {
  await startOn(page, '2027-02-08T19:00:00');
  await watchAsAdultsOnly(page);
  await expect(page.locator('#tonightSeasonCards')).toContainText('Ramadan nights and Eid mornings');
  await page.locator('#tonightSeasonCards .seasonCard', { hasText: 'Ramadan' }).click();
  await expect(page.locator('#openListName')).toHaveText('Ramadan nights and Eid mornings');
  await expect(page.locator('#openListRows > li.row').first()).toContainText('American Eid');
});

for (const scheme of ['light', 'dark']) {
  test.describe(`with a ${scheme} OS preference`, () => {
    test.use({ colorScheme: scheme });

    test('the Lists tab, an opened list and Shelf pass axe', async ({ page }) => {
      await startOn(page, '2026-12-05T19:00:00');
      await openLists(page);
      await expectNoA11yViolations(page, '#listsScreen');
      await page.locator('#listsBody .passport').first().click();
      await expectNoA11yViolations(page, '#listsScreen');
      await page.locator('#tabBrowse').click();
      await expectNoA11yViolations(page, '#browseScreen');
    });
  });
}
