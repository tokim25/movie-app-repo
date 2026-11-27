import { test, expect } from '@playwright/test';
import { blockOptionalGoogleAssets } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.beforeEach(blockOptionalGoogleAssets);

test('mobile touch gestures scroll and tap without zooming the page', async ({ page, context }) => {
  await page.goto('/');
  const familyTab = page.getByRole('button', { name: 'Family', exact: true });
  await familyTab.tap();
  await expect(familyTab).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#familyScreen')).toBeVisible();

  const heading = page.locator('#familyScreen h1');
  const { x, y, width, height } = await heading.boundingBox();
  await page.touchscreen.tap(x + width / 2, y + height / 2);
  await page.touchscreen.tap(x + width / 2, y + height / 2);

  const client = await context.newCDPSession(page);
  const touch = (type, touchPoints) => client.send('Input.dispatchTouchEvent', { type, touchPoints });
  await touch('touchStart', [{ x: 150, y: 310, id: 0 }, { x: 240, y: 310, id: 1 }]);
  for (const distance of [15, 30, 45, 60, 75]) {
    await touch('touchMove', [{ x: 150 - distance, y: 310, id: 0 }, { x: 240 + distance, y: 310, id: 1 }]);
  }
  await touch('touchEnd', []);
  expect(await page.evaluate(() => window.visualViewport.scale)).toBeCloseTo(1, 2);
  await expect(page.locator('html')).toHaveCSS('touch-action', 'pan-x pan-y');

  await touch('touchStart', [{ x: 45, y: 580 }]);
  for (const y of [550, 515, 480, 445, 410, 380]) {
    await touch('touchMove', [{ x: 45, y }]);
  }
  await touch('touchEnd', []);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('cancelable Safari gesture events are blocked without locking the viewport', async ({ page }) => {
  await page.goto('/');
  const canceled = await page.locator('#quickBar').evaluate(element =>
    ['gesturestart', 'gesturechange'].map(type => !element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })))
  );
  expect(canceled).toEqual([true, true]);
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/);
});
