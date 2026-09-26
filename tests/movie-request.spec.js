import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

async function submitRequest(page, selector, title = 'The Test Movie') {
  const input = page.locator(selector);
  const form = input.locator('xpath=ancestor::form');
  await input.fill(title);
  await form.getByRole('button', { name: 'Send' }).click();
}

test('request forms disclose Google Forms and constrain title input (#106)', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  await expect(page.locator('#requestMoviePanel')).toContainText('Google Forms');
  await expect(page.locator('#requestMoviePanel')).toContainText('Please enter only the title');
  await expect(page.locator('#requestMovieInput')).toHaveAttribute('maxlength', '120');

  await page.locator('#tabFamily').click();
  await expect(page.locator('#requestMoviePanelFamily')).toContainText('Google Forms');
  await expect(page.locator('#requestMoviePanelFamily')).toContainText('Please enter only the title');
  await expect(page.locator('#requestMovieInputFamily')).toHaveAttribute('maxlength', '120');
});

test('request form clears the title only after confirmed success (#107)', async ({ page }) => {
  await page.route('/api/movie-request', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  await submitRequest(page, '#requestMovieInput');

  await expect(page.locator('#requestMovieInput')).toHaveValue('');
  await expect(page.locator('#requestMovieStatus')).toHaveText('Request received.');
  await expect(page.locator('#toast')).toHaveText("Thanks — we'll take a look!");
});

test('request form preserves the title after upstream failure (#107)', async ({ page }) => {
  await page.route('/api/movie-request', async route => {
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'request_failed' }) });
  });
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  await submitRequest(page, '#requestMovieInput', 'Please Keep Me');

  await expect(page.locator('#requestMovieInput')).toHaveValue('Please Keep Me');
  await expect(page.locator('#requestMovieInput')).toBeFocused();
  await expect(page.locator('#requestMovieStatus')).toContainText('could not be confirmed');
});

test('Family request form preserves the title after timeout (#107)', async ({ page }) => {
  await page.addInitScript(() => { window.MOVIE_REQUEST_TIMEOUT_MS = 50; });
  await page.route('/api/movie-request', async () => {});
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabFamily').click();

  await submitRequest(page, '#requestMovieInputFamily', 'Slow Movie');

  await expect(page.locator('#requestMovieFormFamily button[type="submit"]')).toHaveText('Sending');
  await expect(page.locator('#requestMovieStatusFamily')).toHaveText('Sending request...');
  await expect(page.locator('#requestMovieInputFamily')).toHaveValue('Slow Movie', { timeout: 12000 });
  await expect(page.locator('#requestMovieStatusFamily')).toContainText('could not be confirmed', { timeout: 12000 });
});
