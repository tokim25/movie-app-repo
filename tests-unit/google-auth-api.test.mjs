import test from 'node:test';
import assert from 'node:assert/strict';
import { setRefreshCookie, clearRefreshCookie, getCookie, getRefreshCookie } from '../api/_google.js';
import googleRefreshHandler from '../api/google-refresh.js';
import googleLogoutHandler from '../api/google-logout.js';

// Node-native unit tests for the api/*.js serverless functions -- these run
// as real Node server-side code (setHeader on a plain response mock), not
// through Playwright, since Playwright only drives the browser and this
// repo's static test server never executes the api/ handlers (see
// tests/static-server.mjs). Run via `npm run test:unit`, kept in a separate
// tests-unit/ directory so Playwright's testDir:'./tests' never tries to
// collect these as spec files.

function mockRes(){
  const headers = {};
  return {
    statusCode: 200,
    body: undefined,
    headers,
    setHeader(name, value){ headers[name] = value; },
    status(code){ this.statusCode = code; return this; },
    json(payload){ this.body = payload; return this; },
  };
}

function mockReq({ method = 'POST', cookie } = {}){
  return { method, headers: cookie ? { cookie } : {} };
}

test('setRefreshCookie sets HttpOnly, Secure, SameSite=Lax, Path=/api, and a 180-day Max-Age', () => {
  const res = mockRes();
  setRefreshCookie(res, 'the-token');
  const cookie = res.headers['Set-Cookie'];
  assert.match(cookie, /^gsync_rt=the-token;/);
  assert.match(cookie, /\bPath=\/api\b/);
  assert.match(cookie, /\bHttpOnly\b/);
  assert.match(cookie, /\bSecure\b/);
  assert.match(cookie, /\bSameSite=Lax\b/);
  assert.match(cookie, /\bMax-Age=15552000\b/); // 60*60*24*180
});

test('clearRefreshCookie zeroes Max-Age and keeps the same scope/flags', () => {
  const res = mockRes();
  clearRefreshCookie(res);
  const cookie = res.headers['Set-Cookie'];
  assert.match(cookie, /^gsync_rt=;/);
  assert.match(cookie, /\bPath=\/api\b/);
  assert.match(cookie, /\bHttpOnly\b/);
  assert.match(cookie, /\bSecure\b/);
  assert.match(cookie, /\bSameSite=Lax\b/);
  assert.match(cookie, /\bMax-Age=0\b/);
});

test('getRefreshCookie round-trips a URL-encoded token value set by setRefreshCookie', () => {
  const res = mockRes();
  setRefreshCookie(res, 'token with spaces/slashes');
  // Simulate the browser sending that Set-Cookie value back as a request cookie.
  const setCookieValue = res.headers['Set-Cookie'].split(';')[0]; // "gsync_rt=<encoded>"
  const req = mockReq({ cookie: setCookieValue });
  assert.equal(getRefreshCookie(req), 'token with spaces/slashes');
});

test('getCookie returns null when no cookie header or no matching cookie is present', () => {
  assert.equal(getCookie(mockReq({}), 'gsync_rt'), null);
  assert.equal(getCookie(mockReq({ cookie: 'other=1' }), 'gsync_rt'), null);
});

test('google-refresh: a successful refresh with a rotated token re-sets the cookie (pushing Max-Age back out)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 3600 }),
  });
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  try {
    const req = mockReq({ cookie: 'gsync_rt=old-refresh' });
    const res = mockRes();
    await googleRefreshHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Set-Cookie'], /^gsync_rt=rotated-refresh;/);
    assert.match(res.headers['Set-Cookie'], /\bMax-Age=15552000\b/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_CLIENT_SECRET;
  }
});

test('google-refresh: an invalid/expired refresh token clears the cookie and returns 401 rather than retrying forever', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    json: async () => ({ error: 'invalid_grant' }),
  });
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  try {
    const req = mockReq({ cookie: 'gsync_rt=stale-refresh' });
    const res = mockRes();
    await googleRefreshHandler(req, res);
    assert.equal(res.statusCode, 401);
    assert.match(res.headers['Set-Cookie'], /^gsync_rt=;/);
    assert.match(res.headers['Set-Cookie'], /\bMax-Age=0\b/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_CLIENT_SECRET;
  }
});

test('google-logout: clears the cookie even when no refresh token cookie was present', async () => {
  const req = mockReq({});
  const res = mockRes();
  await googleLogoutHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.match(res.headers['Set-Cookie'], /^gsync_rt=;/);
  assert.match(res.headers['Set-Cookie'], /\bMax-Age=0\b/);
});

test('google-logout: clears the cookie and reports ok even when Google\'s revoke call fails -- disconnect always succeeds locally', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network down'); };
  try {
    const req = mockReq({ cookie: 'gsync_rt=some-refresh' });
    const res = mockRes();
    await googleLogoutHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.match(res.headers['Set-Cookie'], /^gsync_rt=;/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('google-logout: attempts to revoke the token at Google when one was present', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => ({}) };
  };
  try {
    const req = mockReq({ cookie: 'gsync_rt=some-refresh' });
    const res = mockRes();
    await googleLogoutHandler(req, res);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://oauth2.googleapis.com/revoke');
    assert.match(String(calls[0].opts.body), /token=some-refresh/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
