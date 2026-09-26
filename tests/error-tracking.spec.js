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
    },
    getClient(){
      return {
        on(hookName, callback){
          if(hookName === 'beforeSendFeedback') window.__sentryBeforeSendFeedback = callback;
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

// Issue #139: Sentry's SDK defaults `environment` to "production" whenever it isn't
// explicitly set, and this app's test server runs at 127.0.0.1 -- neither of these
// tests would mean anything if the app still shipped that default. Confirms both that
// isProductionHost() itself draws the line in the right place, and that the real
// Sentry.init() call this app makes actually uses it for both `environment` and
// `enabled` rather than only one of the two.
test('isProductionHost() matches only the real production hostnames, not every *.vercel.app deploy', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(() => ({
    customDomain: isProductionHost('movies.tonykim.io'),
    vercelProduction: isProductionHost('family-movie-watchlist-kim-family-projects.vercel.app'),
    vercelPreview: isProductionHost('family-movie-watchlist-git-some-branch-kim-family-projects.vercel.app'),
    localhost: isProductionHost('127.0.0.1'),
    unrelatedHost: isProductionHost('evil.example.com')
  }));

  expect(results.customDomain).toBe(true);
  expect(results.vercelProduction).toBe(true);
  // A PR preview deployment shares the '.vercel.app' suffix with production but is a
  // distinct subdomain -- exactly the case a wildcard suffix match would wrongly catch.
  expect(results.vercelPreview).toBe(false);
  expect(results.localhost).toBe(false);
  expect(results.unrelatedHost).toBe(false);
});

// Regression test for a real gap Reviewer found: isProductionHost() originally omitted
// the `-git-master-` legacy alias that LEGACY_HOSTS_TO_REDIRECT (index.html, near
// maybeRedirectToCanonicalHost()) already treats as real-user-reachable -- vercel.json's
// own server-side redirect only covers the bare production URL, so a real visitor
// landing on that alias before the client-side JS redirect fires would have had their
// errors silently dropped (enabled:false) instead of just mislabeled. Checks against the
// actual LEGACY_HOSTS_TO_REDIRECT set rather than hardcoding the hostnames a second time
// here, so this fails loud if the two lists (which can't share a JS binding -- see the
// comment on isProductionHost() for why) ever drift apart again.
test('isProductionHost() treats every LEGACY_HOSTS_TO_REDIRECT entry as production', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(() => {
    const legacyHosts = Array.from(LEGACY_HOSTS_TO_REDIRECT);
    return {
      legacyHosts,
      matches: legacyHosts.map(host => isProductionHost(host)),
      canonicalHostMatches: isProductionHost(CANONICAL_HOST)
    };
  });

  expect(results.legacyHosts.length).toBeGreaterThan(0);
  expect(results.matches.every(Boolean)).toBe(true);
  expect(results.canonicalHostMatches).toBe(true);
});

test('Sentry.init() reports environment:development and enabled:false when not on a production host', async ({ page }) => {
  await page.goto('/');
  // The test server serves the app at 127.0.0.1, which isProductionHost() correctly
  // rejects -- so this is exercising the real non-production path, not a mock of it.
  const config = await page.evaluate(() => ({
    environment: window.__sentryInitConfig && window.__sentryInitConfig.environment,
    enabled: window.__sentryInitConfig && window.__sentryInitConfig.enabled
  }));

  expect(config.environment).toBe('development');
  expect(config.enabled).toBe(false);
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
  expect(opts.messagePlaceholder).toMatch(/name/i);
});

test('a feedback submission has a current child name redacted before it would be sent', async ({ page }) => {
  // Regression test for a real gap: beforeSend (tested above for error events) never
  // runs for feedback submissions -- confirmed against the Sentry SDK's own source,
  // which gates beforeSend to error-type events only. The feedback widget needs its
  // own hook (client.on('beforeSendFeedback', ...)) wired up separately.
  await page.goto('/');
  await setupSampleFamily(page);

  const hasHook = await page.evaluate(() => typeof window.__sentryBeforeSendFeedback === 'function');
  expect(hasHook, 'beforeSendFeedback hook was never registered').toBe(true);

  const result = await page.evaluate(() => {
    const fakeFeedbackEvent = {
      type: 'feedback',
      contexts: { feedback: { message: 'It broke when I tapped on Simon and Nora together' } }
    };
    window.__sentryBeforeSendFeedback(fakeFeedbackEvent);
    // beforeSendFeedback mutates its argument in place (no return value used) --
    // assert on the same object reference, not a return value.
    return fakeFeedbackEvent;
  });

  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain('Simon');
  expect(serialized).not.toContain('Nora');
  expect(serialized).toContain('[redacted]');
});

test('the "Report a bug" button opens the Sentry feedback form, not a mailto: link', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();
  await page.locator('#reportBugBtn').click();
  await expect.poll(() => page.evaluate(() => window.__sentryFeedbackFormCalls)).toEqual(['appendToDom', 'open']);
});

test('the feedback widget host sets mobile-safe font size and centered success-message position', async ({ page }) => {
  // Regression test for issue #142: iOS Safari auto-zooms the whole page when a
  // focused input's computed font-size is under 16px. The app's own inputs are
  // already 16px, but the Sentry Feedback widget renders its form into a separate
  // #sentry-feedback shadow root this stylesheet can't reach directly -- Sentry's
  // widget reads CSS custom properties on that host element instead (they inherit
  // through the shadow boundary), so this checks the widget's own theming hook.
  // Issue #146: the widget's built-in "thanks for your report" success message
  // was visually off-center on iPhone Safari, so keep the host centered too.
  await page.goto('/');
  const styles = await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'sentry-feedback';
    document.body.appendChild(host);
    const computed = getComputedStyle(host);
    const value = {
      fontSize: computed.getPropertyValue('--font-size').trim(),
      left: computed.getPropertyValue('--left').trim(),
      right: computed.getPropertyValue('--right').trim(),
      transform: computed.transform
    };
    host.remove();
    return value;
  });
  expect(styles.fontSize).toBe('16px');
  expect(styles.left).toBe('50%');
  expect(styles.right).toBe('auto');
  expect(styles.transform).not.toBe('none');
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

test('beforeSend redacts case variants from nested errors, breadcrumbs, and exception strings (#101)', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  const result = await page.evaluate(() => window.__sentryInitConfig.beforeSend({
    message: 'SIMON could not load',
    exception: { values: [{ value: 'Failure while loading simon' }] },
    breadcrumbs: [{ message: 'Selected SiMoN from the family list' }],
    extra: { nested: { note: 'NORA was also selected' } }
  }));

  const serialized = JSON.stringify(result).toLocaleLowerCase();
  expect(serialized).not.toContain('simon');
  expect(serialized).not.toContain('nora');
  expect(serialized.match(/\[redacted\]/g)?.length).toBe(4);
});

test('beforeSend normalizes Unicode names before redacting diacritic variants (#101)', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.evaluate(() => addChild('Jos\u00e9', '6'));

  const result = await page.evaluate(() => window.__sentryInitConfig.beforeSend({
    message: 'JOSE\u0301 could not load'
  }));

  expect(result.message).toBe('[redacted] could not load');
});

test('one-character child names are redacted only as complete Unicode tokens (#101)', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.evaluate(() => addChild('Q', '6'));

  const result = await page.evaluate(() => window.__sentryInitConfig.beforeSend({
    message: "Q's selection failed, but the queue stayed available",
    extra: { unrelated: 'Quick queries remain unchanged' }
  }));

  expect(result.message).toBe("[redacted]'s selection failed, but the queue stayed available");
  expect(result.extra.unrelated).toBe('Quick queries remain unchanged');
});

test('feedback redaction covers case, Unicode normalization, and one-character names (#101)', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.evaluate(() => {
    addChild('Jos\u00e9', '6');
    addChild('Q', '7');
  });

  const result = await page.evaluate(() => {
    const feedback = {
      contexts: { feedback: { message: 'simon, JOSE\u0301, and Q all disappeared; Quick search still worked' } }
    };
    window.__sentryBeforeSendFeedback(feedback);
    return feedback;
  });

  const message = result.contexts.feedback.message;
  expect(message.toLocaleLowerCase()).not.toContain('simon');
  expect(message.normalize('NFC').toLocaleLowerCase()).not.toContain('jos\u00e9');
  expect(message).not.toMatch(/\bQ\b/);
  expect(message).toContain('Quick search still worked');
});

test('beforeSend drops an event when redaction cannot safely inspect it (#101)', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);

  const result = await page.evaluate(() => {
    const unsafeEvent = {};
    Object.defineProperty(unsafeEvent, 'message', {
      enumerable: true,
      get(){ throw new Error('unreadable telemetry field'); }
    });
    return window.__sentryInitConfig.beforeSend(unsafeEvent);
  });

  expect(result).toBeNull();
});
