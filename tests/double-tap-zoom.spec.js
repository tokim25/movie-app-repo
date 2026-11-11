import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('double-tap zoom is off everywhere while pinch zoom stays allowed', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  const touchAction = selector => page.locator(selector).first().evaluate(el => getComputedStyle(el).touchAction);
  expect(await touchAction('html')).toBe('manipulation');

  // touch-action does not inherit as a computed value, but the browser applies
  // the intersection of an element's and its ancestors' values, so the root
  // setting covers non-button targets such as a movie title.
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/);
  await expect(page.locator('#list li.row .title').first()).toBeVisible();
});
