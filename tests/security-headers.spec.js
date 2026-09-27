import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function inlineScriptHashes(source) {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter(match => !/\bsrc=/.test(match[0].slice(0, match[0].indexOf('>'))))
    .map(match => `'sha256-${crypto.createHash('sha256').update(match[1]).digest('base64')}'`);
}

test('every response carries an enforced and report-only CSP (#109)', async ({ request }) => {
  for (const pathname of ['/', '/privacy.html', '/terms.html', '/api/google-refresh']) {
    const response = await request.get(pathname);
    const headers = response.headers();
    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['content-security-policy-report-only']).toBeTruthy();
  }
});

test('CSP blocks unapproved scripts and includes required least-privilege directives (#109)', async ({ request }) => {
  const response = await request.get('/');
  const policy = response.headers()['content-security-policy'];
  const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).toContain("form-action 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain('https://browser.sentry-cdn.com');
  expect(policy).toContain('https://accounts.google.com');
  expect(policy).toContain('https://www.googleapis.com');
  expect(policy).toContain('https://upload.wikimedia.org');
  expect(policy).toContain('/csp-report/');

  const scriptDirective = policy.split(';').find(part => part.trim().startsWith('script-src'));
  expect(scriptDirective).not.toContain("'unsafe-inline'");
  expect(scriptDirective).not.toContain('*');
  for (const hash of inlineScriptHashes(indexSource)) expect(scriptDirective).toContain(hash);
});

test('the pinned Sentry bundle has verified Subresource Integrity metadata (#109)', async ({ page }) => {
  await page.goto('/');
  const sentryScript = page.locator('script[src^="https://browser.sentry-cdn.com/"]');
  await expect(sentryScript).toHaveAttribute('src', 'https://browser.sentry-cdn.com/8.55.2/bundle.feedback.min.js');
  await expect(sentryScript).toHaveAttribute(
    'integrity',
    'sha384-wa2uVF08d2XPmWQI4tctBG2RPN+1/9jqwSlsJyzqvSd7G9HXOZJn7xhC1eOGaP4L'
  );
  await expect(sentryScript).toHaveAttribute('crossorigin', 'anonymous');
});
