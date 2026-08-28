import { test, expect } from '@playwright/test';
import { switchToFlatView, firstRow } from './helpers.js';

// The Google sign-in flow itself needs a real Google account and can't be
// driven headlessly, so these tests skip it entirely: they set the app's own
// `googleAccessToken` global directly (a plain top-level `let` in index.html,
// reachable from page.evaluate) and mock the Drive REST calls with
// page.route. That exercises the real save/retry/backoff code paths in
// index.html without touching Google's servers.

async function mockDrive(page, mode) {
  const state = { writeCount: 0, mode };
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
  await expect(page.locator('#syncToggleBtn')).toHaveText('Sync needs reconnect');
  await expect(page.locator('#syncToggleBtn')).toHaveClass(/syncWarning/);
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

  await expect(page.locator('#googleSyncAlert')).toBeVisible();
  await expect(page.locator('#googleSyncAlertMessage')).toHaveText('Google sync paused — sign in again');
  await expect(page.locator('#googleSyncStatus')).toHaveText('Google sync paused — sign in again');
  await expect(page.locator('#googleSyncStatus')).toHaveClass(/syncError/);
  await expect(page.locator('#syncToggleBtn')).toHaveText('Sync needs reconnect');
  await expect(page.locator('#syncToggleBtn')).toHaveClass(/syncWarning/);
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
  await page.locator('#syncToggleBtn').click();
  await page.locator('#googleSignInBtn').click();
  await expect(page.locator('#googleSyncStatus')).toHaveText('Connecting to Google…');

  await page.clock.fastForward(7100);

  await expect(page.locator('#googleSyncStatus')).toHaveText('Google sync paused — sign in again');
  await expect(page.locator('#syncToggleBtn')).toHaveText('Sync needs reconnect');
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
  expect(await page.evaluate(() => hasShownInitialSyncToast)).toBe(true);

  // A second, routine background sync in the same session (e.g. from an
  // edit, a retry, or a reconnect) succeeds but must not toast again.
  await page.evaluate(() => syncFromGoogleDrive());
  await expect.poll(() => mock.writeCount).toBe(2);
  expect(await page.evaluate(() => window.__syncToasts)).toEqual(['Synced with Google']);

  // Signing out and back in starts a new sync session, so the next sync
  // should toast again.
  await page.evaluate(() => {
    hasShownInitialSyncToast = false;
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
