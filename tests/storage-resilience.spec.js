import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
});

// Issue #124: readGoogleSyncMeta() used to read localStorage.getItem() for
// the `enabled` flag *before* entering its own try block, so a SecurityError
// thrown by that read (a privacy/security context that denies storage) went
// uncaught -- decideInitialScreen() calls it with no outer guard, so that
// exception used to abort the rest of app startup.
test('readGoogleSyncMeta() and decideInitialScreen() survive a throwing storage read (#124)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(){ throw new DOMException('blocked', 'SecurityError'); };
    try {
      const meta = readGoogleSyncMeta();
      let decideThrew = false;
      try { decideInitialScreen(); } catch(e){ decideThrew = true; }
      return { meta, decideThrew };
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  expect(result.meta).toEqual({ enabled: false });
  expect(result.decideThrew).toBe(false);
});

// Issue #125: persistLocalState() used to catch QuotaExceededError/
// SecurityError, log it, and return -- the caller (saveState()) had no way
// to know the write failed, so the UI kept behaving as though the change
// was saved. A throwing setItem should now surface a persistent, visible
// warning instead.
test('a storage write failure shows a persistent warning instead of silently discarding the change (#125)', async ({ page }) => {
  await expect(page.locator('#localStorageAlert')).toBeHidden();

  await page.evaluate(() => {
    window.__originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(){ throw new DOMException('quota exceeded', 'QuotaExceededError'); };
  });

  await page.evaluate(() => toggleCheck(0));
  await expect(page.locator('#localStorageAlert')).toBeVisible();
  await expect(page.locator('#localStorageAlert')).toContainText("aren't saving on this device");

  // Once storage works again, the very next save clears the warning --
  // it's tied to the most recent write's result, not sticky forever.
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__originalSetItem;
  });
  await page.evaluate(() => toggleCheck(0));
  await expect(page.locator('#localStorageAlert')).toBeHidden();
});

// Issue #116: two tabs marking different movies watched/wanted used to
// silently lose whichever change wasn't in the last tab to save, since
// persistLocalState() wrote the full in-memory state with no awareness of
// what another tab had written in the meantime. A live `storage` listener
// now merges incoming changes in, per mark, instead of one tab's full save
// blindly overwriting another's.
test('two tabs marking different movies survive without losing either change (#116)', async ({ context, page }) => {
  const pageB = await context.newPage();
  await pageB.goto('/');

  await page.evaluate(() => toggleCheck(0));
  await pageB.evaluate(() => togglePriority(1));

  await page.reload();
  const resultA = await page.evaluate(() => ({
    checked0: markValue(state.checked, 0),
    priority1: markValue(state.priority, 1)
  }));
  expect(resultA).toEqual({ checked0: true, priority1: true });

  await pageB.reload();
  const resultB = await pageB.evaluate(() => ({
    checked0: markValue(state.checked, 0),
    priority1: markValue(state.priority, 1)
  }));
  expect(resultB).toEqual({ checked0: true, priority1: true });

  await pageB.close();
});

// Issue #116, extended to children/content-limit data specifically (not just
// watched/priority marks) -- a stale tab's own unrelated save must not erase
// a newer content-limit change made in another tab.
test('a second tab\'s save does not erase a newer content-limit change from the first (#116)', async ({ context, page }) => {
  const pageB = await context.newPage();
  await pageB.goto('/');

  await page.evaluate(() => setChildFlagLimit(state.children[0].id, 'language', 4));
  await pageB.evaluate(() => toggleCheck(0));

  await page.reload();
  const result = await page.evaluate(() => ({
    limit: settingForChildFlag(state.children[0], 'language').value,
    checked0: markValue(state.checked, 0)
  }));
  expect(result).toEqual({ limit: 4, checked0: true });

  await pageB.close();
});

// Issue #116: the deterministic tie-break rule itself (newest updatedAt
// wins), tested directly against mergeState()/newestMark() rather than
// through two-tab timing, since real wall-clock races are hard to control
// precisely in a test.
test('mergeState resolves same-field conflicts by updatedAt, not by merge order (#116)', async ({ page }) => {
  const result = await page.evaluate(() => {
    // remote goes through normalizeState()/normalizeMarks() inside
    // mergeState(), which reads schema version from `v` -- omitting it
    // defaults to the legacy version-1 path, which recomputes updatedAt
    // itself and coerces `value` from record truthiness instead of reading
    // the supplied fields. `v: 3` (STATE_SCHEMA) is required for a synthetic
    // fixture to actually exercise the modern structured-record merge path.
    const local = { order: { movieNums: [], updatedAt: 0, device: '' }, checked: { '1': { value: true, updatedAt: 1000, device: 'device-a' } }, priority: {}, children: { list: [], updatedAt: 0, device: '' }, events: [] };
    const remoteOlder = { v: 3, order: { movieNums: [], updatedAt: 0, device: '' }, checked: { '1': { value: false, updatedAt: 500, device: 'device-b' } }, priority: {}, children: { list: [], updatedAt: 0, device: '' }, events: [] };
    const remoteNewer = { v: 3, order: { movieNums: [], updatedAt: 0, device: '' }, checked: { '1': { value: false, updatedAt: 2000, device: 'device-b' } }, priority: {}, children: { list: [], updatedAt: 0, device: '' }, events: [] };
    return {
      keepsLocalWhenRemoteOlder: mergeState(local, remoteOlder).checked['1'].value,
      takesRemoteWhenRemoteNewer: mergeState(local, remoteNewer).checked['1'].value
    };
  });

  expect(result.keepsLocalWhenRemoteOlder).toBe(true);
  expect(result.takesRemoteWhenRemoteNewer).toBe(false);
});

// Issue #116: mergeState()'s events concat used to duplicate entries if the
// same two states were ever merged more than once (a real risk once merges
// happen live on every storage event, not just a one-time Drive sync).
test('mergeState de-duplicates events by id across repeated merges (#116)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const base = { order: { movieNums: [], updatedAt: 0, device: '' }, checked: {}, priority: {}, children: { list: [], updatedAt: 0, device: '' }, events: [{ id: 'evt-1', type: 'watch_anyway', titleId: 1, childId: 'c1', flag: 'violence', createdAt: 1 }] };
    const remote = { order: { movieNums: [], updatedAt: 0, device: '' }, checked: {}, priority: {}, children: { list: [], updatedAt: 0, device: '' }, events: [{ id: 'evt-1', type: 'watch_anyway', titleId: 1, childId: 'c1', flag: 'violence', createdAt: 1 }] };
    const merged = mergeState(base, remote);
    const mergedAgain = mergeState(merged, remote);
    return { firstMergeCount: merged.events.length, secondMergeCount: mergedAgain.events.length };
  });

  expect(result.firstMergeCount).toBe(1);
  expect(result.secondMergeCount).toBe(1);
});
