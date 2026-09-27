import { expect } from '@playwright/test';

// Load axe from this app's own origin so the production CSP remains active
// during accessibility tests. The test server can serve node_modules, and
// script-src 'self' permits this test-only URL without weakening the policy.
const AXE_URL = '/node_modules/axe-core/axe.min.js';

/**
 * Injects axe-core into the current page and runs it, scoped to `context`
 * (an axe context selector/object, default: the whole document). Asserts
 * there are zero violations and throws a readable summary (rule id, impact,
 * help text, and matching selectors) if there are any.
 *
 * `options` is passed straight to axe.run's options argument (e.g. to
 * restrict `runOnly` tags or `rules`).
 */
export async function expectNoA11yViolations(page, context, options = {}) {
  await page.addScriptTag({ url: AXE_URL });
  const results = await page.evaluate(
    ([ctx, opts]) => window.axe.run(ctx || document, opts),
    [context ?? null, options]
  );

  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => {
        const targets = v.nodes.map((n) => n.target.join(' ')).join(', ');
        return `[${v.impact}] ${v.id}: ${v.help}\n  ${v.helpUrl}\n  targets: ${targets}`;
      })
      .join('\n\n');
    expect(results.violations, `axe-core found accessibility violations:\n\n${summary}`).toEqual([]);
  }
}
