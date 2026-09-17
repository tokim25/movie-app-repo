import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

// Resolved once: the path to axe-core's bundled build. addScriptTag reads
// this file straight off disk and injects it into the page, so it doesn't
// need to be served by static-server.mjs.
const AXE_PATH = fileURLToPath(new URL('../node_modules/axe-core/axe.min.js', import.meta.url));

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
  await page.addScriptTag({ path: AXE_PATH });
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
