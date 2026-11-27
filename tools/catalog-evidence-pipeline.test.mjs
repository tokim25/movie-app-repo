import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readEvidence, readJson, repoRoot, writeJson } from './catalog-evidence.mjs';
import { extractWikipediaFilm, hasVerifiedImageHeaders } from './enrich-catalog-candidates.mjs';

const slug = 'tiny-sky-catalog-fixture';
const title = 'A Tiny Sky Catalog Fixture';
const review = `https://www.commonsensemedia.org/movie-reviews/${slug}`;
const poster = 'https://upload.wikimedia.org/example.jpg';
const wiki = `<h1 id="firstHeading">${title}</h1><div id="mw-content-text"><table class="infobox vevent">
<caption>${title}</caption><tr><td class="infobox-image"><img src="${poster}" width="220" height="330"></td></tr>
<tr><th>Release date</th><td>January 5, 2026</td></tr><tr><th>Running time</th><td>97 minutes<sup>[1]</sup></td></tr>
<tr><th>Production company</th><td>Netflix</td></tr></table></div>`;
const nomination = { slug, title, wikipediaTitle: title, year: 2026 };
const imageHeaders = 'HTTP/2 200\r\nContent-Type: image/jpeg\r\n\r\n';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'movie-catalog-tests-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function tool(script, args, env = process.env) {
  return spawnSync(process.execPath, [path.join('tools', script), ...args], { cwd: repoRoot, env, encoding: 'utf8' });
}

function passed(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

test('Wikipedia extraction confirms film identity and checks final image response headers', () => {
  const url = `https://en.wikipedia.org/wiki/${title.replaceAll(' ', '_')}`;
  const result = extractWikipediaFilm(wiki, url, nomination);
  assert.equal(result.status, 'complete');
  assert.equal(result.runtimeMinutes, 97);
  assert.deepEqual(result.studios, ['Netflix']);
  assert.deepEqual(result.poster, { u: poster, w: 220, h: 330, p: title });
  assert.equal(extractWikipediaFilm(wiki, url, { ...nomination, year: 2025 }).status, 'needs-review');
  assert.equal(extractWikipediaFilm(wiki.replace(/<img[^>]+>/, ''), url, nomination).poster, null);
  assert.equal(extractWikipediaFilm('<h1>Try again later</h1>', url, nomination), null);
  assert.equal(hasVerifiedImageHeaders(imageHeaders), true);
  assert.equal(hasVerifiedImageHeaders(`${imageHeaders}HTTP/2 403\r\nContent-Type: text/html\r\n`), false);
});

test('an isolated offline fixture screens, resumes a blocked poster, and prepares a reviewed batch', t => {
  const directory = fixture(t);
  const cache = path.join(directory, 'cache');
  fs.mkdirSync(cache);
  const rawReview = path.join(cache, `${slug}.html`);
  fs.writeFileSync(rawReview, `<link rel="canonical" href="${review}">
<script type="application/ld+json">${JSON.stringify({ '@type': 'Movie', name: title, audience: { suggestedMinAge: 7 },
    contentRating: 'PG', productionCompany: { name: 'Netflix' }, duration: 'PT1H25M' })}</script>
<script>const fixtureScores = {"csm_review_rating_details_violence":1,"csm_review_rating_details_sex":0,
"csm_review_rating_details_language":0,"csm_review_rating_details_drugs":0};</script>
<span class="detail--release-dates-theaters">January 5, 2026</span>
<h2>What's the Story?</h2><p>Two sisters invent a star map.</p><h2>Parents Need to Know</h2><p>A brief storm scares the characters.</p>
<div class="content-grid-content" data-text="A storm grows loud."><button id="content-grid-item-violence"></button></div>`);
  fs.utimesSync(rawReview, new Date('2026-01-11'), new Date('2026-01-11'));
  const screenArgs = ['--ref', 'HEAD', '--cache', cache, '--release-slug', slug, '--request-budget', '0', '--offline'];
  const stats = passed(tool('screen-catalog-queue.mjs', screenArgs));
  assert.equal(stats.fetched, 0);
  assert.equal(stats.counts['editorial-candidate'], 1);
  assert.equal(readEvidence(cache, slug).review.fetchedAt, '2026-01-11T00:00:00.000Z');

  const fakeBinary = path.join(directory, 'curl');
  fs.writeFileSync(fakeBinary, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const url = args.at(-1);
fs.appendFileSync(process.env.FIXTURE_CALLS, url + '\\n');
if (url.startsWith('https://en.wikipedia.org/wiki/')) {
  fs.writeFileSync(args[args.indexOf('--output') + 1], fs.readFileSync(process.env.FIXTURE_ARTICLE));
  console.log('200');
} else if (url === ${JSON.stringify(poster)}) {
  if (process.env.FIXTURE_BLOCK === 'yes') console.log('403');
  else {
    fs.writeFileSync(args[args.indexOf('--dump-header') + 1], ${JSON.stringify(imageHeaders)});
    console.log('200');
  }
} else process.exit(90);
`, { mode: 0o700 });
  const article = path.join(directory, 'wiki.html');
  const state = path.join(directory, 'test-only-rate-state.json');
  const nominations = path.join(directory, 'nominations.json');
  const callLog = path.join(directory, 'calls.log');
  fs.writeFileSync(article, wiki);
  writeJson(nominations, [{ slug, wikipediaTitle: title }]);
  const env = { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}`, FIXTURE_ARTICLE: article,
    FIXTURE_CALLS: callLog, CSM_RATE_STATE_FILE: state };
  const enrich = ['--input', nominations, '--cache', cache];
  const blocked = tool('enrich-catalog-candidates.mjs', enrich, { ...env, FIXTURE_BLOCK: 'yes' });
  assert.equal(blocked.status, 2, blocked.stderr);
  assert.match(JSON.parse(blocked.stdout).stopped, /HTTP 200 image headers/);
  assert.equal(readEvidence(cache, slug).wikipedia.status, 'poster-pending');
  const retry = tool('enrich-catalog-candidates.mjs', enrich, env);
  assert.equal(retry.status, 2);
  assert.equal(JSON.parse(retry.stdout).fetched, 0);
  writeJson(state, { ...readJson(state), date: '2000-01-01' }); // Advance only the isolated fixture state to the next day.
  assert.equal(passed(tool('enrich-catalog-candidates.mjs', enrich, env)).fetched, 1);
  assert.equal(passed(tool('enrich-catalog-candidates.mjs', enrich, env)).fetched, 0);
  assert.deepEqual(fs.readFileSync(callLog, 'utf8').trim().split('\n').slice(1), [poster, poster]);
  assert.equal(readEvidence(cache, slug).wikipedia.poster.u, poster);
  assert.equal(passed(tool('screen-catalog-queue.mjs', screenArgs)).reused, 1);
  assert.equal(readEvidence(cache, slug).wikipedia.poster.u, poster);

  const selection = path.join(directory, 'selection.json');
  const pack = path.join(directory, 'packet.json');
  const decisions = path.join(directory, 'decisions.json');
  const manifest = path.join(directory, 'manifest.json');
  writeJson(selection, { date: '2026-01-12', releaseScan: { checkedAt: '2026-01-12', requestsUsed: 0, note: 'Fixture only.' },
    entries: [{ slug, newRelease: true }] });
  const editorial = ['--ref', 'HEAD', '--cache', cache, '--selection', selection];
  passed(tool('catalog-editorial-packet.mjs', ['pack', ...editorial, '--output', pack]));
  const { evidenceId } = readJson(pack).entries[0];
  const editorialDecision = { slug, evidenceId, action: 'approve', reviewed: true, full: 'Two sisters use a star map through a brief storm. They learn to trust one another.',
    genre: ['Animation'], pins: ['sibling-teams'] };
  const join = ['manifest', ...editorial, '--output', manifest, '--decisions', decisions];
  writeJson(decisions, [{ ...editorialDecision, evidenceId: 'outdated' }]);
  assert.equal(tool('catalog-editorial-packet.mjs', join).status, 2);
  assert.equal(fs.existsSync(manifest), false);
  writeJson(decisions, [editorialDecision]);
  passed(tool('catalog-editorial-packet.mjs', join));
  const [entry] = readJson(manifest).entries;
  assert.equal(entry.runtimeMinutes, 97);
  assert.equal(entry.runtimeSourceId, `wikipedia:${title}`);
  assert.equal(entry.studio, 'Netflix');
  assert.equal(entry.reviewDate, '2026-01-11');
  assert.deepEqual(entry.pins, ['sibling-teams']);
  assert.equal(readEvidence(cache, slug).decision.evidenceId, evidenceId);

  const reports = path.join(directory, 'reports');
  const prep = tool('run-catalog-batch.mjs', ['titles', '--manifest', manifest, '--output', reports]);
  assert.equal(prep.status, 0, `${prep.stdout}\n${prep.stderr}`);
  assert.match(fs.readFileSync(path.join(reports, 'titles-pr.md'), 'utf8'), /Full build and validation are pending/);
  assert.equal(readJson(path.join(reports, 'batch-identities.json')).titles[0].srcUrl, review);
  const flags = tool('run-catalog-batch.mjs', ['flags', '--output', reports, '--titles-pr', 'https://github.com/example/fixture/pull/1']);
  assert.equal(flags.status, 1);
  assert.match(fs.readFileSync(path.join(reports, 'flags-pr.md'), 'utf8'), /Titles and flags disagree/);
});
