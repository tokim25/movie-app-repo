import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 4319;
const VERCEL_CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

// CSP violations during a local test run (axe-core's internal fetches, test fixtures'
// inline scripts) would otherwise report-uri straight to the real production Sentry
// ingest endpoint copied out of vercel.json, filing real-looking issues from test noise
// (confirmed cause of Sentry JAVASCRIPT-E/F). Point report-uri at this server instead;
// it 404s harmlessly, and the directive still contains '/csp-report/' for
// tests/security-headers.spec.js's existing assertion.
function localizeReportUri(value) {
  // Target only the report-uri directive: the same ingest host also appears in
  // connect-src, which must stay untouched.
  return value.replace(
    /report-uri https:\/\/o\d+\.ingest\.us\.sentry\.io/,
    `report-uri http://127.0.0.1:${PORT}`
  );
}

const SECURITY_HEADERS = Object.fromEntries(
  (VERCEL_CONFIG.headers?.find(rule => rule.source === '/(.*)')?.headers || [])
    .map(({ key, value }) => [
      key,
      key.startsWith('Content-Security-Policy') ? localizeReportUri(value) : value,
    ])
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, SECURITY_HEADERS);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ...SECURITY_HEADERS,
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Static server listening on http://127.0.0.1:${PORT}`);
});
