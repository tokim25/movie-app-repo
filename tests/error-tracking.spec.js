import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

// This sandbox's network policy blocks the real Sentry CDN and ingest endpoint (same
// class of restriction documented for CSM/poster fetches elsewhere in this repo), so
// these tests can't verify the real SDK loads or that an event actually reaches the
// Sentry dashboard. What they CAN and do verify is that this app's own integration
// code is wired correctly: Sentry.init is called with the right config shape, all
// four capture-and-report call sites actually call Sentry.captureException, and the
// beforeSend redaction really strips a child's name out of an event before it would
// be sent. A stub SDK is served in place of the real CDN script so the app's own code
// runs unmodified against a fake `Sentry` global that records what it's called with.

const SENTRY_STUB = `
window.Sentry = (function(){
  window.__sentryInitConfig = null;
  window.__sentryCaptured = [];
  return {
    init(cfg){ window.__sentryInitConfig = cfg; },
    captureException(err){ window.__sentryCaptured.push(String(err && err.message || err)); },
    dedupeIntegration(){ return { name: 'Dedupe' }; },
    globalHandlersIntegration(){ return { name: 'GlobalHandlers' }; },
    linkedErrorsIntegration(){ return { name: 'LinkedErrors' }; },
    httpContextIntegration(){ return { name: 'HttpContext' }; },
    breadcrumbsIntegration(opts){ window.__sentryBreadcrumbsOpts = opts; return { name: 'Breadcrumbs' }; }
  };
})();
`;

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/@sentry/browser@8/build/bundle.min.js', (route) => {
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: SENTRY_STUB });
  });
});

test('Sentry.init is called with PII off, DOM breadcrumbs off, and a beforeSend hook', async ({ page }) => {
  await page.goto('/');
  // page.evaluate structured-clones its return value, which silently drops functions --
  // check dsn/sendDefaultPii and the beforeSend type separately so a dropped function
  // doesn't masquerade as a real "undefined" bug in the app's own config.
  const config = await page.evaluate(() => ({
    dsn: window.__sentryInitConfig && window.__sentryInitConfig.dsn,
    sendDefaultPii: window.__sentryInitConfig && window.__sentryInitConfig.sendDefaultPii,
  }));
  expect(config.dsn).toContain('ingest.us.sentry.io');
  expect(config.sendDefaultPii).toBe(false);

  const hasBeforeSend = await page.evaluate(() => typeof window.__sentryInitConfig.beforeSend === 'function');
  expect(hasBeforeSend).toBe(true);

  const breadcrumbsOpts = await page.evaluate(() => window.__sentryBreadcrumbsOpts);
  expect(breadcrumbsOpts).toBeTruthy();
  expect(breadcrumbsOpts.dom).toBe(false);
});

test('no Replay or BrowserTracing integration is ever referenced', async ({ page }) => {
  await page.goto('/');
  const source = await page.content();
  expect(source).not.toContain('replayIntegration');
  expect(source).not.toContain('browserTracingIntegration');
});

test('a localStorage save failure is captured', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(...args) {
      if (args[0] && args[0].includes('family-movie-watchlist')) {
        throw new Error('quota exceeded (test)');
      }
      return original.apply(this, args);
    };
  });

  await page.evaluate(() => persistLocalState());

  const captured = await page.evaluate(() => window.__sentryCaptured);
  expect(captured.some((m) => m.includes('quota exceeded'))).toBe(true);
});

test('a Google sync failure is captured', async ({ page }) => {
  await page.route('https://www.googleapis.com/**', (route) => {
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Invalid Credentials' } }),
    });
  });
  await page.goto('/');
  await setupSampleFamily(page);

  await page.evaluate(() => {
    googleAccessToken = 'fake-token';
  });
  await page.evaluate(() => pushToGoogleDrive());

  const captured = await page.evaluate(() => window.__sentryCaptured);
  expect(captured.length).toBeGreaterThan(0);
});

test('a service worker registration failure is captured', async ({ page }) => {
  await page.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.register = () => Promise.reject(new Error('sw registration blocked (test)'));
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => Array.isArray(window.__sentryCaptured));
  await expect.poll(() => page.evaluate(() => window.__sentryCaptured)).toContainEqual(
    expect.stringContaining('sw registration blocked')
  );
});

test('beforeSend redacts a current child name out of the event payload', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  const result = await page.evaluate(() => {
    const fakeEvent = {
      message: 'Something went wrong for Simon',
      extra: { note: 'Simon and Nora were both selected' },
    };
    return window.__sentryInitConfig.beforeSend(fakeEvent);
  });

  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain('Simon');
  expect(serialized).not.toContain('Nora');
  expect(serialized).toContain('[redacted]');
});
