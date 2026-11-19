import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupSampleFamily } from './helpers.js';
import { expectNoA11yViolations } from './a11y.js';

// Pre-show and Check a worry read MOVIE_GUIDANCE (data-guidance.js, shipped
// by a separate data PR). These tests never depend on the real file: they
// swap movieGuidanceFor() for a small fixture, same stubbing pattern
// tonight-picks.spec.js uses for tonightSourceTiers().
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureSource = fs.readFileSync(path.join(ROOT, 'tests/fixtures/data-guidance.js'), 'utf8');
const FIXTURE = JSON.parse(fixtureSource.slice(fixtureSource.indexOf('const MOVIE_GUIDANCE =') + 'const MOVIE_GUIDANCE ='.length).trim().replace(/;$/, ''));

const TITLES = ['Finding Nemo', 'My Neighbor Totoro', 'Paddington', "Kiki's Delivery Service", 'Coco'];

async function prepare(page, guidance = FIXTURE){
  await page.goto('/');
  await setupSampleFamily(page);
  await page.evaluate(([fixture, titles]) => {
    state.children.forEach(child => {
      child.age = 12;
      CONTENT_FLAG_IDS.forEach(flagId => setChildFlagLimit(child.id, flagId, 4));
    });
    tonightSelection.time = 999;
    movieGuidanceFor = num => (fixture && fixture[String(num)]) || null;
    // Coco has no fixture entry on purpose ("Not checked").
    const indices = titles.map(t => MOVIES.findIndex(m => m.t === t));
    if(indices.some(i => i < 0)) throw new Error('fixture movie missing from catalog');
    tonightSourceTiers = () => [{ source: 'Shelf', indices }];
  }, [guidance, TITLES]);
}

async function showPick(page, title){
  await page.evaluate(t => showTonightPick({ idx: MOVIES.findIndex(m => m.t === t), source: 'Shelf' }), title);
  await expect(page.locator('#tonightPickTitle')).toContainText(title);
}

// The full Pre-show opens from the warning line's "More" button.
async function openPreShow(page){
  await page.locator('#tonightHeadsUpBtn').click();
  await expect(page.locator('#tonightPreShow')).toBeVisible();
}

test('the warning line shows as plain text with the pick; the renderer loads only when Pre-show opens', async ({ page }) => {
  const bundleRequests = [];
  page.on('request', req => { if(req.url().includes('/assets/openui-0.2.1/')) bundleRequests.push(req.url()); });
  await prepare(page);
  expect(await page.evaluate(() => typeof window.__OpenUI)).toBe('undefined');

  await showPick(page, 'Finding Nemo');
  // The warning is on screen before anything heavy loads.
  await expect(page.locator('#tonightHeadsUp')).toContainText('Be ready early on');
  await expect(page.locator('#tonightPreShow')).toBeHidden();
  expect(bundleRequests).toEqual([]);

  await openPreShow(page);
  const band = page.locator('#tonightPreShow');
  await expect(band.getByRole('heading', { name: 'Pre-show' })).toBeVisible();
  await expect(band).toContainText("Nemo's mother and siblings-to-be killed by a predator");
  await expect(band).toContainText('why was Marlin so scared');
  await expect(page.locator('#tonightHeadsUpBtn')).toHaveAttribute('aria-expanded', 'true');
  expect(bundleRequests.some(u => u.endsWith('openui-bundle.min.js'))).toBe(true);
  expect(bundleRequests.some(u => u.endsWith('openui-styles.css'))).toBe(true);
  await expectNoA11yViolations(page, '#tonightPickCard');

  // A pick without a Pre-show says so instead of showing nothing, which
  // would read as "safe".
  await showPick(page, 'Paddington');
  await expect(band).toBeHidden();
  await expect(page.locator('#tonightHeadsUp')).toContainText('No Pre-Show notes');
  await expect(page.locator('#tonightHeadsUpBtn')).toBeHidden();
  // A gentle film is a one-liner.
  await showPick(page, "Kiki's Delivery Service");
  await expect(page.locator('#tonightHeadsUp')).toContainText('Gentle. Nothing to prep for.');
});

test("Pre-show stays light when the OS is dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await prepare(page);
  await showPick(page, 'Finding Nemo');
  await openPreShow(page);
  await page.waitForFunction(() => window.__OpenUI);
  const openuiTheme = () => page.evaluate(() => document.documentElement.getAttribute('data-openui-theme'));
  await expect.poll(openuiTheme).toBe('light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
});

test('Pre-show stays hidden, and nothing loads, when there is no guidance data', async ({ page }) => {
  const bundleRequests = [];
  page.on('request', req => { if(req.url().includes('/assets/openui-0.2.1/')) bundleRequests.push(req.url()); });
  await prepare(page, null);
  await showPick(page, 'Finding Nemo');
  await expect(page.locator('#tonightPreShow')).toBeHidden();
  expect(bundleRequests).toEqual([]);

  // Check a worry hides with it.
  await page.locator('#tonightSkipBtn').click();
  await page.locator('[data-skip-reason="Content concern"]').click();
  await expect(page.locator('#tonightWorryCheck')).toBeHidden();
});

test.describe('without the service worker', () => {
  // A controlling service worker would fetch the bundle itself, past
  // page.route(), so this one test runs uncontrolled.
  test.use({ serviceWorkers: 'block' });

  test('Pre-show falls back to plain text when the renderer fails to load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.route('**/assets/openui-0.2.1/openui-bundle.min.js', route => route.abort());
    await prepare(page);
    await showPick(page, 'Finding Nemo');
    await openPreShow(page);
    await page.waitForTimeout(500);
    await expect(page.locator('#tonightPreShowFallback')).toBeVisible();
    await expect(page.locator('#tonightPreShowFallback')).toContainText('Be ready early on');
    await expect(page.locator('#tonightPreShowBody')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test('Pre-show falls back to plain text when its program has errors', async ({ page }) => {
  await prepare(page, { '2': { preShow: 'root = Card([w, a])\nw = Callout("warning", "Shark", "A shark chases them.")\na = NotAComponent("x")' } });
  await showPick(page, 'Finding Nemo');
  await openPreShow(page);
  await page.waitForFunction(() => window.__OpenUI);
  await page.waitForTimeout(300);
  await expect(page.locator('#tonightPreShowBody')).toBeHidden();
  await expect(page.locator('#tonightPreShowFallback')).toContainText('A shark chases them.');
});

test('Pre-show renderer is cached by the service worker and works offline', async ({ page, context }) => {
  await prepare(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  await showPick(page, 'Finding Nemo');
  await openPreShow(page);
  await expect(page.locator('#tonightPreShowBody')).toContainText('Be ready early on');
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open('openui-browser-bundle-0.2.1');
    return (await cache.keys()).map(r => new URL(r.url).pathname).sort();
  })).toEqual(['/assets/openui-0.2.1/openui-bundle.min.js', '/assets/openui-0.2.1/openui-styles.css']);

  await context.setOffline(true);
  try{
    await page.reload();
    await page.locator('#bootSyncLoading').waitFor({ state: 'hidden' });
    await page.locator('#tabHome').click();
    await page.evaluate(([fixture, titles]) => {
      state.children.forEach(child => { child.age = 12; CONTENT_FLAG_IDS.forEach(f => setChildFlagLimit(child.id, f, 4)); });
      movieGuidanceFor = num => fixture[String(num)] || null;
      showTonightPick({ idx: MOVIES.findIndex(m => m.t === titles[0]), source: 'Shelf' });
    }, [FIXTURE, TITLES]);
    await openPreShow(page);
    await expect(page.locator('#tonightPreShowBody')).toContainText('Be ready early on');
  }finally{
    await context.setOffline(false);
  }
});

test('Check a worry shows a captioned table for the pick and its two alternatives, offline', async ({ page, context }) => {
  await prepare(page);
  await page.locator('#findTonightPickBtn').click();
  await page.locator('#tonightSkipBtn').click();
  await expect(page.locator('#tonightWorryCheck')).toBeHidden();

  await context.setOffline(true);
  try{
    await page.locator('[data-skip-reason="Content concern"]').click();
    await expect(page.locator('#tonightWorryCheck')).toBeVisible();
    await expect(page.locator('#tonightWorryResult')).toBeHidden();

    const expected = await page.evaluate(() => [tonightSelection.currentPickIdx, ...findTonightAlternatives().map(c => c.idx)]
      .map(idx => `${MOVIES[idx].t} (${MOVIES[idx].y})`));
    expect(expected).toHaveLength(3);

    await page.locator('[data-worry="parentInDanger"]').click();
    await expect(page.locator('[data-worry="parentInDanger"]')).toHaveAttribute('aria-pressed', 'true');
    const table = page.locator('#tonightWorryResult table');
    await expect(table.locator('caption')).toHaveText('Parent in danger: checked against Common Sense Media notes');
    await expect(table.locator('tbody th[scope="row"]')).toHaveText(expected);
    await expect(page.locator('#tonightWorryResult')).toContainText('Not a guarantee.');

    // Tag text (not just color) and the verbatim quote, per movie.
    const levelText = { yes: 'Yes', mild: 'Yes, mild', no: 'Not mentioned' };
    let mentioned = 0;
    for(let i = 0; i < expected.length; i++){
      const title = expected[i].replace(/ \(\d{4}\)$/, '');
      const num = await page.evaluate(t => String(MOVIES.find(m => m.t === t).num), title);
      const concern = FIXTURE[num] && FIXTURE[num].concerns.parentInDanger;
      const row = table.locator('tbody tr').nth(i);
      await expect(row.locator('.worryTag')).toHaveText(concern ? levelText[concern.level] : 'Not checked');
      if(concern && concern.level !== 'no'){
        mentioned++;
        await expect(row.locator('q')).toHaveText(concern.quote);
      }else{
        await expect(row.locator('q')).toHaveCount(0);
      }
    }
    await expect(page.locator('#tonightPickStatus')).toHaveText(
      `Checked 3 movies for parent in danger: ${mentioned} ${mentioned === 1 ? 'mentions' : 'mention'} it.`);

    // axe itself is fetched from the test server, so only this step is online.
    await context.setOffline(false);
    await expectNoA11yViolations(page, '#tonightWorryCheck');
    await context.setOffline(true);

    await page.locator('#tonightWorryExcludeBtn').click();
    // Only titles checked and marked "no" for this worry are left.
    await expect(page.locator('#tonightPickTitle')).toHaveText(/^(Paddington|Kiki's Delivery Service) \(/);
    await expect(page.locator('#tonightPickReasons')).toContainText('Leaving out titles whose notes mention parent in danger');
    await expect(page.locator('#tonightPickStatus')).toContainText('Showing picks without parent in danger.');
    for(let i = 0; i < 4; i++){
      await page.locator('#tonightSkipBtn').click();
      await expect(page.locator('#tonightPickTitle')).toHaveText(/^(Paddington|Kiki's Delivery Service) \(/);
    }
  }finally{
    await context.setOffline(false);
  }
});

test('changing who is watching clears the worry filter', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => { tonightWorryExclude = 'parentInDanger'; resetTonightSkips(); });
  expect(await page.evaluate(() => tonightWorryExclude)).toBeNull();
});

test('Loading the Pre-show renderer triggers no CSP violation (Sentry JAVASCRIPT-K)', async ({ page }) => {
  // zod, bundled inside OpenUI, probes for eval support with a caught
  // `new Function("")`. The catch keeps rendering working, but the browser
  // still files a CSP report for the blocked call, which Sentry logged as
  // JAVASCRIPT-K. Running zod in jitless mode skips the probe.
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => {
      window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await prepare(page);
  await showPick(page, 'Finding Nemo');
  await openPreShow(page);
  await expect(page.locator('#tonightPreShowBody')).toContainText('Be ready early on');
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});
