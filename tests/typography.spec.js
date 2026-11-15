import { test, expect } from '@playwright/test';

const interFamily = /(^|,\s*)["']?Inter["']?(,|$)/;

test('the app uses Inter for body and display typography', async ({ page }) => {
  await page.goto('/');

  const families = await page.locator('body, h1:visible, .title:visible').evaluateAll(elements =>
    elements.slice(0, 4).map(element => getComputedStyle(element).fontFamily)
  );

  expect(families.length).toBeGreaterThan(1);
  for (const family of families) {
    expect(family).toMatch(interFamily);
    expect(family).not.toMatch(/Newsreader|Georgia|Times New Roman|(^|,\s*)serif(,|$)/i);
  }
});

for (const path of ['/privacy.html', '/terms.html', '/tools/certification-desk.html']) {
  test(`${path} uses Inter`, async ({ page }) => {
    await page.goto(path);
    const family = await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily);
    expect(family).toMatch(interFamily);
    expect(family).not.toMatch(/Newsreader|Georgia|Times New Roman|(^|,\s*)serif(,|$)/i);
  });
}
