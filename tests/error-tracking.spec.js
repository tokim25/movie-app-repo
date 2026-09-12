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
  window.__sentryFeedbackOpts = null;
  window.__sentryFeedbackFormCalls = [];
  return {
    init(cfg){ window.__sentryInitConfig = cfg; },
    captureException(err){ window.__sentryCaptured.push(String(err && err.message || err)); },
    dedupeIntegration(){ return { name: 'Dedupe' }; },
    globalHandlersIntegration(){ return { name: 'GlobalHandlers' }; },
    linkedErrorsIntegration(){ return { name: 'LinkedErrors' }; },
    httpContextIntegration(){ return { name: 'HttpContext' }; },
    breadcrumbsIntegration(opts){ window.__sentryBreadcrumbsOpts = opts; return { name: 'Breadcrumbs' }; },
    feedbackIntegration(opts){ window.__sentryFeedbackOpts = opts; return { name: 'Feedback' }; },
    getFeedback(){
      return {
        createForm(){
          return Promise.resolve({
            appendToDom(){ window.__sentryFeedbackFormCalls.push('appendToDom'); },
            open(){ window.__sentryFeedbackFormCalls.push('open'); }
          });
        }
      };
    }
  };
})();
`;

// Must match index.html's actual <script src> exactly -- an earlier version of this
// file stubbed the old, broken jsDelivr URL. Since page.route matches by URL, once the
// real script tag pointed somewhere else (or 404s), that stub silently stopped being
// served at all -- Sentry.init's own guard is what avoided a hard failure, so an
// intercept mismatch here would fail exactly like a real missing/renamed script tag,
// which is precisely the regression this whole file needs to catch.
const SENTRY_SDK_URL = 'https://browser.sentry-cdn.com/8.55.2/bundle.feedback.min.js';

test.beforeEach(async ({ page }) => {
  await page.route(SENTRY_SDK_URL, (route) => {
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: SENTRY_STUB });
  });
});

test('the SDK script tag points at a URL matching Sentry\'s own CDN, not a guessed npm/jsDelivr path', async ({ page }) => {
  // Regression test for a real, live-verified bug: an earlier version pointed at
  // cdn.jsdelivr.net/npm/@sentry/browser@8/build/bundle.min.js, which 404s -- that npm
  // package ships no UMD bundle at that path. The failure was silent: Sentry.init's own
  // "if (typeof Sentry === 'undefined') return" guard swallowed it, so nothing in the
  // console or this test suite (which stubs the URL and never exercises a real 404)
  // caught it until tokim25 ran it in a real browser with real network access. This
  // test can't verify the URL actually 200s (no network from this sandbox either), but
  // it does pin the exact URL in index.html to Sentry's official CDN host and a
  // pinned-version bundle path, so a future edit that silently drifts back to a guessed
  // or unpinned URL fails loud, here, instead of failing silent in production.
  await page.goto('/');
  const source = await page.content();
  const match = source.match(/<script src="([^"]+bundle\.feedback\.min\.js)"/);
  expect(match, 'no Sentry SDK <script> tag found').toBeTruthy();
  expect(match[1]).toMatch(/^https:\/\/browser\.sentry-cdn\.com\/\d+\.\d+\.\d+\/bundle\.feedback\.min\.js$/);
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

test('the feedback widget is configured with no PII fields, no auto-inject, and no screenshot capture', async ({ page }) => {
  await page.goto('/');
  const opts = await page.evaluate(() => window.__sentryFeedbackOpts);
  expect(opts).toBeTruthy();
  expect(opts.autoInject).toBe(false);
  expect(opts.showName).toBe(false);
  expect(opts.showEmail).toBe(false);
  expect(opts.isNameRequired).toBe(false);
  expect(opts.isEmailRequired).toBe(false);
  expect(opts.useSentryUser).toBe(false);
  expect(opts.enableScreenshot).toBe(false);
});

test('the "Report a bug" button opens the Sentry feedback form, not a mailto: link', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  await page.locator('#reportBugBtn').click();
  await expect.poll(() => page.evaluate(() => window.__sentryFeedbackFormCalls)).toEqual(['appendToDom', 'open']);
});

test('no hardcoded mailto: link or email address remains in the source', async ({ page }) => {
  await page.goto('/');
  const source = await page.content();
  expect(source).not.toContain('mailto:');
  expect(source).not.toContain('tokim25@gmail.com');
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

test('beforeSend redacts a child name containing JSON-special characters (" and \\)', async ({ page }) => {
  // Regression test for a real bug: an earlier version of beforeSend ran its
  // find-and-replace against JSON.stringify(event) instead of the parsed values.
  // JSON.stringify escapes " as \" and \ as \\ inside strings, so a raw name
  // containing either character never appears as a literal substring in the
  // escaped text -- the redaction silently no-oped and the name leaked through.
  await page.goto('/');
  await setupSampleFamily(page);

  const trickyName = 'D"an\\special';
  await page.evaluate((name) => {
    addChild(name, '6');
  }, trickyName);

  const result = await page.evaluate((name) => {
    const fakeEvent = {
      message: `Something went wrong for ${name} during sync`,
      extra: { note: `${name} was selected` },
    };
    return window.__sentryInitConfig.beforeSend(fakeEvent);
  }, trickyName);

  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain(trickyName);
  expect(serialized).toContain('[redacted]');
});
