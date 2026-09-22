import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { setupSampleFamily } from './helpers.js';

// Issue #98/#99 regression coverage. Both are the same root cause -- the
// app's actual data-handling behavior drifted away from what privacy.html
// (and terms.html) tell a parent, and nothing caught it. These tests don't
// re-litigate the copy itself (that's a judgment call, not something a test
// should gate); they lock in the two concrete facts that broke last time:
// every external script index.html loads must be named in privacy.html, and
// every field serializeState() actually persists/syncs must already be
// accounted for. Either one drifting again fails the test, forcing a
// conscious disclosure update rather than a silent gap.

// Issue #98: known external script hosts index.html is allowed to load,
// mapped to the plain-language service name a parent would recognize in
// privacy.html's "Third-party services" section. A new host that isn't in
// this map fails loudly below rather than silently shipping undisclosed --
// add it here AND to privacy.html together, never just one.
const KNOWN_THIRD_PARTY_HOSTS = {
  'browser.sentry-cdn.com': 'Sentry',
  'accounts.google.com': 'Google'
};

test('every external script host index.html loads is named in privacy.html (#98)', () => {
  const indexSrc = fs.readFileSync('index.html', 'utf8');
  const privacySrc = fs.readFileSync('privacy.html', 'utf8');

  const hosts = [...indexSrc.matchAll(/<script[^>]+src=["']https?:\/\/([^"'/]+)/g)].map(m => m[1]);
  const uniqueHosts = [...new Set(hosts)];

  // Sanity check that this test is actually exercising something -- if
  // index.html ever stops loading any external script, this should be
  // revisited rather than silently passing on an empty list.
  expect(uniqueHosts.length).toBeGreaterThan(0);

  for (const host of uniqueHosts) {
    const serviceName = KNOWN_THIRD_PARTY_HOSTS[host];
    expect(
      serviceName,
      `Unrecognized external script host "${host}" in index.html -- add it to ` +
      `KNOWN_THIRD_PARTY_HOSTS in this test and disclose it in privacy.html's ` +
      `"Third-party services" section before this can pass.`
    ).toBeTruthy();
    expect(
      privacySrc,
      `privacy.html no longer mentions "${serviceName}" (host "${host}") -- ` +
      `restore its disclosure in the "Third-party services" section.`
    ).toContain(serviceName);
  }
});

// Issue #99: the exact shape serializeState() produces today (and therefore
// what's included in every Google sync and manual sync-code payload).
// Generated via the real app code paths, not hand-built, so a future code
// change that adds/removes a field changes this shape and fails the test --
// exactly the drift that produced #98/#99 in the first place.
const DOCUMENTED_SHAPE = {
  topLevel: ['checked', 'children', 'device', 'events', 'moviesVersion', 'order', 'priority', 'updatedAt', 'v'].sort(),
  order: ['device', 'movieNums', 'updatedAt'].sort(),
  children: ['device', 'list', 'updatedAt'].sort(),
  child: ['age', 'id', 'name', 'sadRemovedNoticePending', 'settings', 'watchCueDismissedAt'].sort(),
  mark: ['device', 'updatedAt', 'value'].sort(),
  event: ['childId', 'createdAt', 'flag', 'id', 'titleId', 'type'].sort()
};

test('serializeState() field shape matches the documented disclosure inventory (#99)', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  const shape = await page.evaluate(() => {
    // Generate one real mark and one real "Watch anyway" override event
    // through the actual app code paths, so their field shape reflects
    // what the app really produces, not an assumption. The checked mark
    // uses a real catalog movie (index 0) rather than a synthetic fixture --
    // normalizeMarkRecord() validates marks against the real catalog's
    // MOVIE_NUMS on save/load and silently drops anything else, which a
    // synthetic num would be.
    toggleCheck(0);
    const idx = MOVIES.push({
      t: 'ZZZ Privacy Regression Fixture', y: '2005', ca: '3+', genre: [],
      num: 9000301, flags: { violence: 1, language: 4, romance: 1, drinking: 1 }
    }) - 1;
    state.children.forEach(child => setChildFlagLimit(child.id, 'language', 1));
    findTonightCandidate = () => ({ idx, source: 'Shelf' });
    showTonightPick();
    logWatchAnywaySignal();

    // Round-trip through save/load so state.children is normalizeChild()'d --
    // a freshly created child (createChild()) doesn't carry every optional
    // field yet, but a real synced payload always reflects the normalized
    // shape, since that's what a receiving device parses it back into.
    saveState();
    loadState();

    const s = serializeState();
    return {
      topLevel: Object.keys(s).sort(),
      order: Object.keys(s.order).sort(),
      children: Object.keys(s.children).sort(),
      child: Object.keys(s.children.list[0]).sort(),
      mark: Object.keys(s.checked[Object.keys(s.checked)[0]]).sort(),
      event: Object.keys(s.events[s.events.length - 1]).sort()
    };
  });

  const mismatchNote = (label) =>
    `serializeState()'s "${label}" fields changed -- update DOCUMENTED_SHAPE here AND ` +
    `privacy.html/terms.html's data inventory to match before updating this allowlist.`;

  expect(shape.topLevel, mismatchNote('top-level')).toEqual(DOCUMENTED_SHAPE.topLevel);
  expect(shape.order, mismatchNote('order')).toEqual(DOCUMENTED_SHAPE.order);
  expect(shape.children, mismatchNote('children')).toEqual(DOCUMENTED_SHAPE.children);
  expect(shape.child, mismatchNote('a child record')).toEqual(DOCUMENTED_SHAPE.child);
  expect(shape.mark, mismatchNote('a checked/priority mark record')).toEqual(DOCUMENTED_SHAPE.mark);
  expect(shape.event, mismatchNote('a Watch-anyway override event')).toEqual(DOCUMENTED_SHAPE.event);
});

test('privacy.html and terms.html both name the actual synced data categories', () => {
  const privacySrc = fs.readFileSync('privacy.html', 'utf8');
  const termsSrc = fs.readFileSync('terms.html', 'utf8');

  // Plain-language terms a parent would look for -- not the raw field
  // names above, which are implementation detail. Both documents must
  // mention the sensitive categories (child data, override history);
  // terms.html can point to privacy.html for the exhaustive list rather
  // than duplicating it in full.
  for (const term of ['name', 'age', 'content-limit']) {
    expect(privacySrc.toLowerCase()).toContain(term);
    expect(termsSrc.toLowerCase()).toContain(term);
  }
  expect(privacySrc).toContain('Sentry');
  expect(termsSrc).toContain('Sentry');
});
