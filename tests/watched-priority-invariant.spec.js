import { test, expect } from '@playwright/test';
import { switchToFlatView, firstRow } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);
});

test('marking a Want-to-watch movie watched clears priority atomically and persists (#117)', async ({ page }) => {
  const row = firstRow(page);
  const title = await row.locator('.title').textContent();

  await row.locator('.star').click();
  await expect(page.locator('#statPriority')).toHaveText('1');

  const writesBefore = await page.evaluate(() => {
    window.__invariantWriteCount = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(...args){
      if(args[0] === STORAGE_KEY) window.__invariantWriteCount++;
      return original.apply(this, args);
    };
    return window.__invariantWriteCount;
  });
  expect(writesBefore).toBe(0);

  await row.locator('.check').click();
  const updatedRow = page.locator('#list > li.row').filter({ hasText: title }).first();
  await expect(updatedRow.locator('.check')).toHaveAttribute('aria-pressed', 'true');
  await expect(updatedRow.locator('.star')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#statChecked')).toHaveText('1');
  await expect(page.locator('#statPriority')).toHaveText('0');
  await expect.poll(() => page.evaluate(() => window.__invariantWriteCount)).toBe(1);

  const idx = await updatedRow.locator('.check').getAttribute('data-idx');
  const isStillPriorityTier = await page.evaluate((movieIdx) =>
    tonightSourceTiers()[0].indices.includes(Number(movieIdx)), idx);
  expect(isStillPriorityTier).toBe(false);

  await page.reload();
  await switchToFlatView(page);
  const reloadedRow = page.locator('#list > li.row').filter({ hasText: title }).first();
  await expect(reloadedRow.locator('.check')).toHaveAttribute('aria-pressed', 'true');
  await expect(reloadedRow.locator('.star')).toHaveAttribute('aria-pressed', 'false');
});

test('adding a watched movie to Want to watch moves it back to the unwatched shortlist (#117)', async ({ page }) => {
  const row = firstRow(page);
  const title = await row.locator('.title').textContent();

  await row.locator('.check').click();
  await expect(page.locator('#statChecked')).toHaveText('1');

  const watchedRow = page.locator('#list > li.row').filter({ hasText: title }).first();
  await watchedRow.locator('.star').click();
  const updatedRow = page.locator('#list > li.row').filter({ hasText: title }).first();
  await expect(updatedRow.locator('.check')).toHaveAttribute('aria-pressed', 'false');
  await expect(updatedRow.locator('.star')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#statChecked')).toHaveText('0');
  await expect(page.locator('#statPriority')).toHaveText('1');
});

test('sync merges resolve contradictory watched and priority marks by newest action (#117)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const base = {
      order: defaultOrder(), orderUpdatedAt: 0, orderDevice: '',
      checked: { '1': { value: true, updatedAt: 1000, device: 'device-a' } },
      priority: {}, children: [], childrenUpdatedAt: 0, childrenDevice: '', events: []
    };
    const newerPriority = {
      v: 3, order: { movieNums: [], updatedAt: 0, device: '' },
      checked: {},
      priority: { '1': { value: true, updatedAt: 2000, device: 'device-b' } },
      children: { list: [], updatedAt: 0, device: '' }, events: []
    };
    const priorityResult = mergeState(base, newerPriority);

    const watchedResult = mergeState({
      ...base,
      checked: {},
      priority: { '1': { value: true, updatedAt: 1000, device: 'device-a' } }
    }, {
      ...newerPriority,
      checked: { '1': { value: true, updatedAt: 2000, device: 'device-b' } },
      priority: {}
    });

    return {
      newerPriority: [priorityResult.checked['1'].value, priorityResult.priority['1'].value],
      newerWatched: [watchedResult.checked['1'].value, watchedResult.priority['1'].value]
    };
  });

  expect(result.newerPriority).toEqual([false, true]);
  expect(result.newerWatched).toEqual([true, false]);
});
