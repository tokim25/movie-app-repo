// Builds the nightly CSM candidate queue from CSM's curated movie lists.
// Runs INSIDE a throwaway Vercel Sandbox (CSM is unreachable from the agent session).
// Paced 7.2 s per request, hard budget cap, resumable. State files go in STATE_DIR (default /vercel/).
//   BUDGET   total CSM requests this script may make tonight (default 60; keep the whole night <= 220)
//   NSTART   requests already used tonight by other work (default 0)
// Lessons (11/6-11/7): (1) CSM list pages carry titles as JSON-LD ("name":"...","url":".../movie-reviews/<slug>"),
// not as <a> anchors; an anchor-only regex silently found ~79 slugs from 198 pages. After the FIRST list page,
// check that the slug count is plausible (about 20) before spending more budget. (2) Never leave results only in
// the sandbox: after each batch, read the new state out (plain text, not base64) and commit it to
// tools/csm-sweep-queue.json before the sandbox's 45-minute life runs out.
import fs from 'node:fs';
const UA = 'movie-catalog-research/1.0';
const D = process.env.STATE_DIR || '/vercel/';
const BUDGET = Number(process.env.BUDGET || 60), GAP = 7200;
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(D + f, 'utf8')); } catch { return d; } };
const wr = (f, v) => fs.writeFileSync(D + f, JSON.stringify(v));
let used = Number(process.env.NSTART || 0), last = 0;
const done = rd('done.json', []), score = rd('score.json', {}), titles = rd('titles.json', {}), more = rd('more.json', []);
async function get(url) {
  if (used >= BUDGET + Number(process.env.NSTART || 0)) { console.log('budget reached'); process.exit(0); }
  const w = last + GAP - Date.now(); if (w > 0) await new Promise(r => setTimeout(r, w));
  used++; last = Date.now();
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  const b = await r.text();
  if (r.status === 404) return null;
  if (r.status !== 200 || /captcha|are you a robot|access denied/i.test(b.slice(0, 3000))) {
    fs.writeFileSync(D + 'stop.txt', r.status + ' ' + url); console.log('STOP', r.status, url); process.exit(2);
  }
  return b;
}
let lists = rd('lists_all.json', null);
if (!lists) {
  const b = await get('https://www.commonsensemedia.org/lists/sitemap.xml');   // page 1 repeats page 0; one fetch is enough
  const urls = [...b.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
  const IN = /(movie|film|kid|family|animat|holiday|halloween|christmas|best-)/;
  const OUT = /(\bapp|game|book|\btv\b|show|podcast|youtube|music|website|series|toys\b|robot|coding|stem|social|video)/;
  lists = urls.filter(u => /commonsensemedia\.org\/lists\//.test(u) && !/\/es\//.test(u)).map(u => u.replace(/^https?:\/\/[^/]+/, ''))
    .filter(p => { const s = p.replace('/lists/', ''); return IN.test(s) && !OUT.test(s) && !s.includes('/'); });
  wr('lists_all.json', lists); console.log('lists', urls.length, 'kept', lists.length);
}
for (const p of lists) {
  if (done.includes(p)) continue;
  const b = await get('https://www.commonsensemedia.org' + p);
  const seen = new Set();
  if (b) {
    for (const m of b.matchAll(/"name":"((?:[^"\\]|\\.)*)","url":"https:\/\/www\.commonsensemedia\.org\/movie-reviews\/([a-z0-9-]+)"/g)) {
      if (seen.has(m[2])) continue; seen.add(m[2]); score[m[2]] = (score[m[2]] || 0) + 1; titles[m[2]] = JSON.parse('"' + m[1] + '"');
    }
    for (const m of b.matchAll(/\/movie-reviews\/([a-z0-9-]+)/g)) {
      if (seen.has(m[1])) continue; seen.add(m[1]); score[m[1]] = (score[m[1]] || 0) + 1;
    }
    if (/[?&]page=1\b/.test(b)) more.push(p);
  }
  done.push(p); wr('done.json', done); wr('score.json', score); wr('titles.json', titles); wr('more.json', more);
  console.log(p, seen.size);
}
console.log('built', done.length, 'of', lists.length, 'used', used);
