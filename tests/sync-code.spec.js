import { test, expect } from '@playwright/test';
import { switchToFlatView, openSyncSettings, firstRow, rows } from './helpers.js';

test('manual sync code export/import round-trips watched and priority state', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  const watchedRow = firstRow(page);
  const priorityRow = rows(page).nth(1);
  const watchedTitle = await watchedRow.locator('.title').textContent();
  const priorityTitle = await priorityRow.locator('.title').textContent();
  await watchedRow.locator('.check').click();
  await priorityRow.locator('.star').click();
  await expect(page.locator('#statChecked')).toHaveText('1');
  await expect(page.locator('#statPriority')).toHaveText('1');

  await openSyncSettings(page);
  const code = await page.locator('#syncCodeOut').inputValue();
  expect(code.length).toBeGreaterThan(20);

  // Simulate loading the code on a fresh device.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await switchToFlatView(page);
  await expect(page.locator('#statChecked')).toHaveText('0');

  await openSyncSettings(page);
  await page.locator('#syncCodeIn').fill(code);
  await page.locator('#syncLoadBtn').click();

  await expect(page.locator('#statChecked')).toHaveText('1');
  await expect(page.locator('#statPriority')).toHaveText('1');

  const reloadedWatchedRow = rows(page).filter({ hasText: watchedTitle });
  const reloadedPriorityRow = rows(page).filter({ hasText: priorityTitle });
  await expect(reloadedWatchedRow.locator('.check')).toHaveClass(/on/);
  await expect(reloadedWatchedRow.locator('.star')).not.toHaveClass(/on/);
  await expect(reloadedPriorityRow.locator('.check')).not.toHaveClass(/on/);
  await expect(reloadedPriorityRow.locator('.star')).toHaveClass(/on/);
});

test('an invalid sync code is rejected without clearing existing state', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);

  await firstRow(page).locator('.check').click();
  await expect(page.locator('#statChecked')).toHaveText('1');

  await openSyncSettings(page);
  await page.locator('#syncCodeIn').fill('not-a-valid-code');
  await page.locator('#syncLoadBtn').click();

  await expect(page.locator('#toast')).toHaveText("That code doesn't look right");
  await expect(page.locator('#statChecked')).toHaveText('1');
});

test('loading a manual sync code merges with local changes instead of overwriting them (two-device simulation)', async ({ browser }) => {
  // Two full browser contexts (each running its own setup flow) run slower
  // than this suite's other single-page tests, especially under sandboxed
  // parallel load -- give it more headroom than the default 30s.
  test.setTimeout(60000);
  // Two independent browser contexts = two independent devices: separate
  // localStorage, so each gets its own random DEVICE_ID (see getDeviceId())
  // and starts from a clean slate, same as two real phones.
  const deviceA = await browser.newContext();
  const deviceB = await browser.newContext();
  const pageA = await deviceA.newPage();
  const pageB = await deviceB.newPage();

  try {
    // Device A: mark the first movie watched, then export its sync code.
    await pageA.goto('/');
    await switchToFlatView(pageA);
    const titleA = await firstRow(pageA).locator('.title').textContent();
    await firstRow(pageA).locator('.check').click();
    await expect(pageA.locator('#statChecked')).toHaveText('1');
    await openSyncSettings(pageA);
    const codeFromA = await pageA.locator('#syncCodeOut').inputValue();

    // Device B: independently marks a DIFFERENT movie as priority, before
    // ever seeing device A's code. This is the change a raw
    // `state = decodeState(...)` overwrite would silently discard.
    await pageB.goto('/');
    await switchToFlatView(pageB);
    const rowB = rows(pageB).nth(1);
    const titleB = await rowB.locator('.title').textContent();
    expect(titleB).not.toBe(titleA);
    await rowB.locator('.star').click();
    await expect(pageB.locator('#statPriority')).toHaveText('1');
    await expect(pageB.locator('#statChecked')).toHaveText('0');

    // Device B loads device A's code.
    await openSyncSettings(pageB);
    await pageB.locator('#syncCodeIn').fill(codeFromA);
    await pageB.locator('#syncLoadBtn').click();

    // Merge, not overwrite: device B keeps its own priority mark AND gains
    // device A's checked mark.
    await expect(pageB.locator('#statChecked')).toHaveText('1');
    await expect(pageB.locator('#statPriority')).toHaveText('1');
    await expect(pageB.locator('#toast')).toHaveText('Synced — merged in changes from the other code');

    await switchToFlatView(pageB);
    const checkedRow = rows(pageB).filter({ hasText: titleA });
    const starredRow = rows(pageB).filter({ hasText: titleB });
    await expect(checkedRow.locator('.check')).toHaveClass(/on/);
    await expect(starredRow.locator('.star')).toHaveClass(/on/);
  } finally {
    await deviceA.close();
    await deviceB.close();
  }
});

test('loading a sync code that offers nothing new reports "already up to date" instead of "merged"', async ({ page }) => {
  await page.goto('/');
  await switchToFlatView(page);
  await firstRow(page).locator('.check').click();
  await expect(page.locator('#statChecked')).toHaveText('1');

  await openSyncSettings(page);
  const code = await page.locator('#syncCodeOut').inputValue();
  await page.locator('#syncCodeIn').fill(code);
  await page.locator('#syncLoadBtn').click();

  await expect(page.locator('#toast')).toHaveText('Synced — already up to date');
  await expect(page.locator('#statChecked')).toHaveText('1');
});
