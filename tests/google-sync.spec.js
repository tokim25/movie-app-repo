import { test, expect } from '@playwright/test';
import { switchToFlatView, openSyncSettings, firstRow, setupSampleFamily } from './helpers.js';

// The Google sign-in flow itself needs a real Google account and can't be
// driven headlessly, so these tests skip it entirely: they set the app's own
// `googleAccessToken` global directly (a plain top-level `let` in index.html,
// reachable from page.evaluate) and mock the Drive REST calls with
// page.route. That exercises the real save/retry/backoff code paths in
// index.html without touching Google's servers.

test.beforeEach(async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `
        window.google = {
          accounts: {
            oauth2: {
              initCodeClient: () => ({ requestCode: () => {} }),
              revoke: () => {}
            }
          }
        };
      `,
    });
  });

  await page.addInitScript(() => {
    localStorage.removeItem('family-feature-google-sync-v3-enabled');
    localStorage.removeItem('family-feature-google-sync-v3-meta');
  });
});

async function mockDrive(page, mode) {
  // modifiedTime starts stable (same value on every check) so existing
  // tests -- which know nothing about the optimistic-concurrency retry --
  // see no drift and every merge-and-write succeeds on its first attempt,
  // same as before that protection existed. Tests that want to exercise a
  // real multi-device conflict change state.modifiedTime themselves,
  // between mock setup and the action that triggers a sync (see "a
  // concurrent remote write...").
  const state = { writeCount: 0, mode, modifiedTime: '2026-01-01T00:00:00.000Z', modifiedTimeCheckCount: 0 };
  await page.route('https://www.googleapis.com/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/upload/drive/v3/files')) {
      state.writeCount++;
      if (state.mode === '401') {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Invalid Credentials' } }),
        });
      }
      if (state.mode === '500') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Backend Error' } }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-file-id' }),
      });
    }

    if (url.includes('/drive/v3/files?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: [] }),
      });
    }

    // getDriveFileModifiedTime()'s GET .../files/<id>?fields=modifiedTime --
    // checked once right after readDriveFile() and once again immediately
    // before the write, to detect a concurrent write from another device.
    // Must be matched before the alt=media case below: both URLs share the
    // ".../drive/v3/files/<id>?" prefix, and this one is the more specific
    // match (the query string here is "fields=modifiedTime", never
    // "alt=media").
    if (url.includes('/drive/v3/files/') && url.includes('fields=modifiedTime')) {
      state.modifiedTimeCheckCount++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ modifiedTime: state.modifiedTime }),
      });
    }

    // readDriveFile()'s GET .../files/<id>?alt=media — needed for tests that
    // call syncFromGoogleDrive() more than once, since after the first write
    // googleDriveFileId is set and the second call reads it back before
    // merging and re-uploading.
    if (url.includes('/drive/v3/files/') && url.includes('alt=media')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ checked: {}, priority: {}, order: [] }),
      });
    }

    return route.continue();
  });
  return state;
}

test('local state saves first, and the UI shows a waiting status while offline', async ({ page, context }) => {
  await page.goto('/');
  await switchToFlatView(page);

  await context.setOffline(true);
  await page.evaluate(() => {
    googleAccessToken = 'fake-token';
  });

  await firstRow(page).locator('.check').click();

  // The local write happens synchronously in saveState(), before any
  // network concern, regardless of connectivity.
  const savedLocally = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('family-movie-watchlist-v1'))
  );
  expect(Object.values(savedLocally.checked).some((r) => r.value === true)).toBe(true);

  await page.evaluate(() => pushToGoogleDrive());
  await expect(page.locator('#googleSyncStatus')).toHaveText('Saved here — waiting for connection');

  await context.setOffline(false);
});

test('a 401 response disconnects sync and stops retrying', async ({ page }) => {
  const mock = await mockDrive(page, '401');
  await page.goto('/');
  await setupSampleFamily(page);
  await page.evaluate(() => {
    googleAccessToken = 'fake-token';
    googleSyncIntent = true;
  });

  await page.evaluate(() => pushToGoogleDrive());

  const tokenAfter = await page.evaluate(() => googleAccessToken);
  expect(tokenAfter).toBeNull();
  expect(mock.writeCount).toBe(1);

  // setGoogleSyncError() clears the pending flag too, so scheduleGoogleSyncRetry
  // is a no-op and the sign-in button is back in its "disconnected" state.
  const pending = await page.evaluate(() => googleSyncPending);
  expect(pending).toBe(false);
  const signInDisplay = await page.evaluate(() => document.getElementById('googleSignInBtn').style.display);
  expect(signInDisplay).toBe('inline-block');
  await expect(page.locator('#googleSyncStatus')).toHaveText('Google sync paused — sign in again');
  await expect(page.locator('#googleSyncStatus')).toHaveClass(/syncError/);
  await expect(page.locator('#familySyncBtn')).toHaveText('Sync needs reconnect');
  await expect(page.locator('#familySyncBtn')).toHaveClass(/syncWarning/);
  await expect(page.locator('#googleSyncAlert')).toBeVisible();
  await expect(page.locator('#googleSyncAlertMessage')).toHaveText('Google sync paused — sign in again');
  const syncMeta = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('family-feature-google-sync-v3-meta'))
  );
  expect(syncMeta.enabled).toBe(true);
  expect(syncMeta.lastError).toBe('Google authorization expired');
});

test('remembered Google sync shows reconnect when the server-side refresh fails', async ({ page }) => {
  // The silent-reconnect path no longer goes through GIS at all — it calls
  // api/google-refresh.js directly, which 404s against the plain static test
  // server (no refresh cookie, no real endpoint). This mock only needs to
  // exist so initGoogleSync()'s unconditional initCodeClient() call doesn't
  // throw; nothing in this scenario ever calls requestCode().
  await page.route('https://accounts.google.com/gsi/client', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `
        window.google = {
          accounts: {
            oauth2: {
              initCodeClient: () => ({ requestCode: () => {} }),
              revoke: () => {}
            }
          }
        };
      `,
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('family-feature-google-sync-v3-enabled', '1');
  });

  await page.goto('/');
  await setupSampleFamily(page);

  await expect(page.locator('#googleSyncAlert')).toBeVisible();
  await expect(page.locator('#googleSyncAlertMessage')).toHaveText('Google sync paused — sign in again');
  await expect(page.locator('#googleSyncStatus')).toHaveText('Google sync paused — sign in again');
  await expect(page.locator('#googleSyncStatus')).toHaveClass(/syncError/);
  await expect(page.locator('#familySyncBtn')).toHaveText('Sync needs reconnect');
  await expect(page.locator('#familySyncBtn')).toHaveClass(/syncWarning/);
  const signInDisplay = await page.evaluate(() => document.getElementById('googleSignInBtn').style.display);
  expect(signInDisplay).toBe('inline-block');
  const signOutDisplay = await page.evaluate(() => document.getElementById('googleSignOutBtn').style.display);
  expect(signOutDisplay).toBe('none');
  const syncFlag = await page.evaluate(() => localStorage.getItem('family-feature-google-sync-v3-enabled'));
  expect(syncFlag).toBe('1');
});

test('unfinished Google sign-in shows a reconnect warning and toast', async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `
        window.google = {
          accounts: {
            oauth2: {
              initCodeClient: () => ({
                requestCode: () => {}
              }),
              revoke: () => {}
            }
          }
        };
      `,
    });
  });

  await page.goto('/');
  await switchToFlatView(page);
  await page.clock.install();
  await openSyncSettings(page);
  await page.locator('#googleSignInBtn').click();
  await expect(page.locator('#googleSyncStatus')).toHaveText('Connecting to Google…');

  await page.clock.fastForward(7100);

  await expect(page.locator('#googleSyncStatus')).toHaveText('Google sync paused — sign in again');
  await expect(page.locator('#familySyncBtn')).toHaveText('Sync needs reconnect');
  await expect(page.locator('#googleSyncAlert')).toBeVisible();
  await expect(page.locator('#googleSyncAlertMessage')).toHaveText('Google sync paused — sign in again');
  await expect(page.locator('#toast')).toHaveText('Google sign-in did not finish — try again');
});

test('failed writes back off instead of retrying aggressively, and a later success clears the warning', async ({ page }) => {
  await page.goto('/');
  const mock = await mockDrive(page, '500');
  await page.clock.install();

  await page.evaluate(() => {
    googleAccessToken = 'fake-token';
    googleSyncRetryDelay = 1600;
  });

  await page.evaluate(() => pushToGoogleDrive());
  await expect(page.locator('#googleSyncStatus')).toHaveText('Saved here — Google sync needs retry');
  await expect(page.locator('#googleSyncStatus')).toHaveClass(/syncError/);
  expect(mock.writeCount).toBe(1);

  // Well under the ~1.6s backoff: no retry yet.
  await page.clock.fastForward(1000);
  expect(mock.writeCount).toBe(1);

  // Past the first backoff delay: exactly one retry fires, which also fails
  // and doubles the delay for next time. fastForward() resolves once the
  // in-page timer fires; the resulting fetch still has to round-trip through
  // route interception, so poll rather than asserting immediately.
  await page.clock.fastForward(1000);
  await expect.poll(() => mock.writeCount).toBe(2);

  // Immediately after that failed retry, the *next* delay should already be
  // longer than the first — proof this is backing off, not looping.
  const secondDelay = await page.evaluate(() => googleSyncRetryDelay);
  expect(secondDelay).toBeGreaterThan(1600);

  // Let the following retry succeed and confirm the warning clears.
  mock.mode = 'ok';
  await page.clock.fastForward(secondDelay + 500);
  await expect.poll(() => mock.writeCount).toBe(3);
  await expect(page.locator('#googleSyncStatus')).not.toHaveClass(/syncError/);
  await expect(page.locator('#googleSyncStatus')).toHaveText('Synced with Google');

  const pending = await page.evaluate(() => googleSyncPending);
  expect(pending).toBe(false);
});

test('the "Synced with Google" toast only fires on the first successful sync of a session', async ({ page }) => {
  const mock = await mockDrive(page, 'ok');
  await page.goto('/');

  // Spy on showToast rather than reading #toast's text/class, since a second,
  // silent sync should leave the toast element completely untouched -- not
  // just re-show the same text.
  await page.evaluate(() => {
    window.__syncToasts = [];
    const realShowToast = showToast;
    showToast = (msg) => {
      window.__syncToasts.push(msg);
      realShowToast(msg);
    };
    googleAccessToken = 'fake-token';
  });

  await page.evaluate(() => syncFromGoogleDrive());
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).toHaveText('Synced with Google');
  expect(mock.writeCount).toBe(1);
  expect(await page.evaluate(() => window.__syncToasts)).toEqual(['Synced with Google']);

  // A second, routine background sync in the same session (e.g. from an
  // edit, a retry, or a reconnect) succeeds but must not toast again.
  await page.evaluate(() => syncFromGoogleDrive());
  await expect.poll(() => mock.writeCount).toBe(2);
  expect(await page.evaluate(() => window.__syncToasts)).toEqual(['Synced with Google']);

  // Signing out and back in starts a new sync session, so the next sync
  // should toast again.
  await page.evaluate(() => {
    hasShownInitialSyncToast = false;
    sessionStorage.removeItem('family-feature-google-initial-toast-shown');
  });
  await page.evaluate(() => syncFromGoogleDrive());
  await expect.poll(() => mock.writeCount).toBe(3);
  expect(await page.evaluate(() => window.__syncToasts)).toEqual(['Synced with Google', 'Synced with Google']);
});

test('signing out resets the initial-sync-toast flag for the next connect', async ({ page }) => {
  await mockDrive(page, 'ok');
  // The sign-out handler calls google.accounts.oauth2.revoke(); mock the GIS
  // script the same way the sign-in-timeout test does so that call is a no-op
  // instead of throwing on an undefined `google`.
  await page.route('https://accounts.google.com/gsi/client', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `
        window.google = {
          accounts: {
            oauth2: {
              initCodeClient: () => ({ requestCode: () => {} }),
              revoke: () => {}
            }
          }
        };
      `,
    });
  });
  await page.goto('/');

  await page.evaluate(() => {
    googleAccessToken = 'fake-token';
    hasShownInitialSyncToast = true;
  });

  // Click via the DOM rather than a Playwright locator: the page's own
  // tryInitGoogleSync() polling (unrelated to this fix) races with test setup
  // and can leave #googleSignOutBtn hidden depending on timing, which isn't
  // what this test is checking — it just needs the click handler to run.
  await page.evaluate(() => document.getElementById('googleSignOutBtn').click());
  expect(await page.evaluate(() => hasShownInitialSyncToast)).toBe(false);
});

test('a concurrent remote write between read and write is detected, re-merged, and not silently overwritten', async ({ page }) => {
  // This test intentionally does NOT reuse mockDrive(): it needs precise
  // control over exactly what each individual read/check/write call sees,
  // not just an aggregate writeCount, to actually distinguish "the retry
  // logic ran and used fresh data" from "it happened to write once anyway"
  // (an earlier version of this test only asserted writeCount === 1, which
  // passed identically whether or not the retry/re-merge logic existed at
  // all -- a write count alone can't tell a real conflict-safe write apart
  // from an old blind overwrite that also only writes once).
  let uploadedBody = null;
  await page.route('https://www.googleapis.com/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/upload/drive/v3/files')) {
      // The write body is multipart: a metadata part, then the real payload
      // part, split by "--familyfeatureboundary" (writeDriveFile()'s own
      // boundary string). Each part is "Content-Type: ...\r\n\r\n<json>\r\n".
      const postData = route.request().postData() || '';
      const parts = postData.split('--familyfeatureboundary').map((part) => {
        const jsonStart = part.indexOf('\r\n\r\n');
        return jsonStart === -1 ? null : part.slice(jsonStart + 4).trim();
      }).filter(Boolean);
      uploadedBody = parts.length > 1 ? JSON.parse(parts[1]) : null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'mock-file-id' }) });
    }

    if (url.includes('/drive/v3/files/') && url.includes('fields=modifiedTime')) {
      // Drifts once (another device wrote in between), then stabilizes --
      // forcing exactly one retry.
      const sequence = ['v1', 'v2', 'v2', 'v2'];
      modifiedTimeCallCount++;
      const value = sequence[Math.min(modifiedTimeCallCount - 1, sequence.length - 1)];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ modifiedTime: value }) });
    }

    if (url.includes('/drive/v3/files/') && url.includes('alt=media')) {
      readCallCount++;
      // The first read (attempt 1, before the conflict is detected) sees
      // old/empty remote content (v3, so it takes the same normalizeMarks
      // path real remote content would). The second read (attempt 2, after
      // re-fetching post-conflict) sees a mark another device supposedly
      // just wrote -- v3's mark-record shape ({value, updatedAt, device})
      // keyed by the movie's real `num` (normalizeMarks() remaps any other
      // key format), with an updatedAt far in the future so mergeState()'s
      // newest-wins logic keeps it as-is rather than re-stamping it with
      // this device's own clock/ID. If the final write includes this exact
      // mark, the retry genuinely re-read and re-merged; if the app had
      // written on attempt 1 (no retry logic, or a retry that doesn't
      // actually re-fetch), this mark could never appear in what gets
      // uploaded.
      const remote = readCallCount === 1
        ? { v: 3, checked: {}, priority: {}, order: [] }
        : { v: 3, checked: {}, priority: { [otherDeviceMovieNum]: { value: true, updatedAt: 9999999999999, device: 'other-device' } }, order: [] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remote) });
    }

    if (url.includes('/drive/v3/files?')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) });
    }

    return route.continue();
  });

  let modifiedTimeCallCount = 0;
  let readCallCount = 0;
  let otherDeviceMovieNum = null;

  await page.goto('/');
  await setupSampleFamily(page);
  otherDeviceMovieNum = String(await page.evaluate(() => MOVIES[0].num));
  await page.evaluate(() => {
    googleAccessToken = 'fake-token';
    googleDriveFileId = 'mock-file-id';
  });

  await page.evaluate(() => pushToGoogleDrive());
  await expect(page.locator('#googleSyncStatus')).not.toHaveClass(/syncError/);

  // The conflict was genuinely detected and retried: both checks ran twice
  // (once per attempt), and the retry's re-read actually reached the
  // second, richer remote payload.
  expect(modifiedTimeCallCount).toBe(4);
  expect(readCallCount).toBe(2);

  // The proof that matters: the "other device"'s mark from the retry's
  // re-read made it into what actually got uploaded, not just that some
  // write happened.
  expect(uploadedBody).toBeTruthy();
  expect(uploadedBody.priority && uploadedBody.priority[otherDeviceMovieNum]).toEqual({
    value: true,
    updatedAt: 9999999999999,
    device: 'other-device',
  });

  const pending = await page.evaluate(() => googleSyncPending);
  expect(pending).toBe(false);
});

test('sustained conflicting writes exhaust retries and fail the same way any other push failure does', async ({ page }) => {
  // modifiedTime never stabilizes -- every check sees a fresh value, as if
  // another device were writing continuously. mergeAndWriteToDrive() must
  // give up after DRIVE_WRITE_MAX_ATTEMPTS rather than retry forever, and
  // surface it through the exact same failure path a network error would.
  let modifiedTimeCallCount = 0;
  let writeCount = 0;
  await page.route('https://www.googleapis.com/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/upload/drive/v3/files')) {
      writeCount++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'mock-file-id' }) });
    }

    if (url.includes('/drive/v3/files/') && url.includes('fields=modifiedTime')) {
      modifiedTimeCallCount++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ modifiedTime: `always-different-${modifiedTimeCallCount}` }),
      });
    }

    if (url.includes('/drive/v3/files/') && url.includes('alt=media')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: 3, checked: {}, priority: {}, order: [] }) });
    }

    if (url.includes('/drive/v3/files?')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [] }) });
    }

    return route.continue();
  });

  await page.goto('/');
  await setupSampleFamily(page);
  await page.evaluate(() => {
    googleAccessToken = 'fake-token';
    googleDriveFileId = 'mock-file-id';
  });

  await page.evaluate(() => pushToGoogleDrive());

  // No write ever went through -- every attempt detected drift before
  // reaching writeDriveFile().
  await expect(page.locator('#googleSyncStatus')).toHaveClass(/syncError/);
  expect(writeCount).toBe(0);
  // 2 checks (readAt + beforeWrite) per attempt, 3 attempts -- bounded, not
  // an infinite retry loop.
  expect(modifiedTimeCallCount).toBe(6);

  const pending = await page.evaluate(() => googleSyncPending);
  expect(pending).toBe(true);
});
