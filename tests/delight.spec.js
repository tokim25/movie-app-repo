import { test, expect } from '@playwright/test';
import { setupSampleFamily } from './helpers.js';

test('marking tonight\'s pick watched stamps a ticket stub instead of striking it through', async ({ page }) => {
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabHome').click();

  await expect(page.locator('#tonightMemoriesFirst')).toBeVisible();
  await expect(page.locator('#tonightMemoriesFirst')).toHaveText('Your first movie night is one tap away.');

  await page.locator('#findTonightPickBtn').click();
  await page.locator('#tonightWatchBtn').click();

  const card = page.locator('#tonightPickCard');
  await expect(card).toHaveClass(/watched/);
  await expect(card).toHaveAttribute('data-admit', /^Admit one · /);
  const look = await card.evaluate(el => ({
    stub: getComputedStyle(el, '::after').content,
    titleDecoration: getComputedStyle(el.querySelector('.pickTitle')).textDecorationLine,
    opacity: getComputedStyle(el).opacity,
  }));
  expect(look.stub).toContain('Admit one');
  expect(look.titleDecoration).toBe('none');
  expect(look.opacity).toBe('1');

  await expect(page.locator('#toast')).toHaveText('Your first movie night, logged.');
  await expect(page.locator('#tonightMemoriesCounts')).toBeVisible();
  await expect(page.locator('#statChecked')).toHaveText('1');
});

test('starring a movie pops the star, and the stub animation is off under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await setupSampleFamily(page);
  await page.locator('#tabBrowse').click();

  await page.locator('#list .star').first().click();
  const star = page.locator('#list .star').first();
  await expect(star).toHaveClass(/pop/);
  expect(await star.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('the Tonight subtitle follows the evening without changing any behavior', async ({ page }) => {
  await page.goto('/');
  const lines = await page.evaluate(() => ({
    lateTuesday: tonightSubtitleFor(new Date(2026, 10, 10, 21, 0)),
    friday: tonightSubtitleFor(new Date(2026, 10, 13, 18, 0)),
    saturday: tonightSubtitleFor(new Date(2026, 10, 14, 18, 0)),
    cozyWednesday: tonightSubtitleFor(new Date(2026, 10, 25, 18, 0)),
    plainWednesday: tonightSubtitleFor(new Date(2026, 10, 11, 18, 0)),
  }));
  expect(lines.lateTuesday).toBe('Late start? Set a shorter time under Change.');
  expect(lines.friday).toBe('Friday night. Big-screen energy.');
  expect(lines.saturday).toBe('Saturday night at the movies.');
  expect(lines.cozyWednesday).toBe('Cozy season. Blankets optional, popcorn encouraged.');
  expect(lines.plainWednesday).toBe('One good pick for the people, time, and mood you have tonight.');
});
