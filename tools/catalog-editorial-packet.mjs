import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { catalogCacheDirectory, git, pendingQueue, readEvidence, readJson, slugPattern, writeAtomic, writeEvidence, writeJson } from './catalog-evidence.mjs';
import { hasVerifiedImageHeaders } from './enrich-catalog-candidates.mjs';

const candidateStatuses = new Set(['editorial-candidate', 'review-metadata']);
const aliases = new Map(Object.entries({ 'Walt Disney Pictures': 'Disney', 'Pixar Animation Studios': 'Pixar',
  'DreamWorks Animation': 'DreamWorks', 'Netflix Animation': 'Netflix' }).map(([name, canonical]) => [name.toLowerCase(), canonical]));
const sourceURL = 'https://www.commonsensemedia.org/lists/new-kids-movies';
const today = day => /^\d{4}-\d{2}-\d{2}$/.test(day ?? '') && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
const requiredText = value => typeof value === 'string' && value.trim().length > 0;
const canonicalStudio = name => typeof name === 'string' ? aliases.get(name.trim().toLowerCase()) ?? name.trim() : '';
const fingerprint = data => createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 24);

function knownStudio(review, wiki) {
  const csm = canonicalStudio(review.studio);
  const credits = (wiki?.studios ?? []).map(canonicalStudio);
  return csm && credits.some(credit => credit.toLowerCase() === csm.toLowerCase()) ? csm : null;
}

function dateFromSource(value) {
  const match = String(value ?? '').match(/\b(?:\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/);
  if (!match || Number.isNaN(Date.parse(match[0]))) return null;
  return new Date(Date.parse(match[0])).toISOString().slice(0, 10);
}

function prepareFacts(review, wiki, date, newRelease) {
  const releaseDates = [review.release?.theatrical, review.release?.streaming, wiki?.release].map(dateFromSource).filter(Boolean);
  const confirmedDates = [...new Set(releaseDates)].filter(day => day <= date).sort();
  const releasedOn = (newRelease ? confirmedDates.at(-1) : confirmedDates[0]) ?? null;
  const scores = review.scores;
  const csm = Number.isInteger(review.age) && [scores?.violence, scores?.sex, scores?.language, scores?.drugs].every(value => Number.isInteger(value) && value >= 0 && value <= 5)
    ? { age: review.age, v: scores.violence, s: scores.sex, l: scores.language, d: scores.drugs }
    : null;
  const hasWikiRuntime = wiki?.status === 'complete' && Number.isInteger(wiki.runtimeMinutes) && wiki.runtimeMinutes > 0;
  const runtime = hasWikiRuntime ? wiki.runtimeMinutes : review.runtimeMinutes;
  const reviewDate = review.fetchedAt?.slice(0, 10) ?? null;
  return {
    t: review.title,
    y: wiki?.status === 'complete' ? wiki.year : null,
    srcUrl: review.url,
    rating: review.rating,
    csm,
    reviewDate,
    runtimeMinutes: Number.isInteger(runtime) && runtime > 0 ? runtime : null,
    runtimeSourceId: hasWikiRuntime ? `wikipedia:${wiki.pageTitle}` : `commonsensemedia:${new URL(review.url).pathname.split('/').filter(Boolean).at(-1)}`,
    releasedOn,
    studio: knownStudio(review, wiki),
  };
}

function issuesFor(row, wiki, facts) {
  const issues = [];
  if (!row.parents || !Object.keys(row.content ?? {}).length) issues.push('Open the full cached review. The editorial excerpts are incomplete.');
  if (!facts.csm) issues.push('Confirm missing CSM scores directly from the review.');
  if (row.type !== 'Movie') issues.push('Confirm that this is a standalone film or special.');
  if (row.possible?.length) issues.push('Resolve possible catalog matches.');
  if (!wiki || wiki.status !== 'complete') issues.push(wiki?.reason ?? 'Complete the Wikipedia and poster evidence pass.');
  if (!facts.releasedOn) issues.push('Confirm an actual release date.');
  if (!facts.runtimeMinutes) issues.push('No verified runtime found.');
  if (!facts.studio) issues.push('Choose the canonical studio from the source credits.');
  if (!facts.rating) issues.push('Check the film rating on the source.');
  return issues;
}

function loadSelection(file, cache, revision) {
  const input = readJson(file);
  const { date, releaseScan, entries, skips = [] } = input;
  if (!today(date) || releaseScan?.checkedAt !== date || !requiredText(releaseScan.note) ||
      !Number.isInteger(releaseScan.requestsUsed) || releaseScan.requestsUsed < 0 || releaseScan.requestsUsed > 15 ||
      !Array.isArray(entries) || !entries.length || entries.length > 15 || !Array.isArray(skips)) {
    throw new Error('Selection needs a date, a same-day new-release check with its note and request count, and 1–15 entries.');
  }
  const { resolved, unchecked } = pendingQueue(JSON.parse(git('show', `${revision}:tools/csm-sweep-queue.json`)));
  const queueOrder = new Map([...unchecked.keys()].map((slug, index) => [slug, index]));
  const seen = new Set();
  let last = -1;
  const records = entries.map(entry => {
    const { slug, newRelease = false } = entry ?? {};
    if (!slugPattern.test(slug ?? '') || typeof newRelease !== 'boolean' || seen.has(slug) || resolved.has(slug)) throw new Error(`Invalid, duplicated or resolved selection: ${slug}`);
    seen.add(slug);
    if (newRelease && last >= 0) throw new Error('Put new releases before backlog entries.');
    if (!newRelease) {
      const position = queueOrder.get(slug);
      if (position === undefined || position <= last) throw new Error(`Backlog entry is absent or out of queue order: ${slug}`);
      last = position;
    }
    const evidence = readEvidence(cache, slug);
    const row = evidence?.screen?.row;
    if (evidence?.screen?.revision !== revision || !candidateStatuses.has(row?.status) || evidence?.decision?.action === 'held') {
      throw new Error(`This selection needs current candidate screening for ${slug}.`);
    }
    const wiki = evidence.wikipedia;
    const facts = prepareFacts(row, wiki, date, newRelease);
    return { slug, newRelease, evidenceId: fingerprint({ revision, newRelease, date, row, wiki }), facts, wiki, row, rawReview: evidence.review?.rawPath,
      issues: issuesFor(row, wiki, facts) };
  });
  const skipped = skips.map(slug => {
    if (!slugPattern.test(slug ?? '') || !unchecked.has(slug) || seen.has(slug)) throw new Error(`Invalid or already selected skip: ${slug}`);
    seen.add(slug);
    const screen = readEvidence(cache, slug)?.screen;
    if (screen?.revision !== revision || !['duplicate', 'ineligible'].includes(screen.row?.status)) throw new Error(`Confirm screening evidence before skipping ${slug}.`);
    const row = screen.row;
    const reason = row.status === 'duplicate' ? `Already cataloged as ${row.title} (#${row.num}) with the same CSM review.` : `${row.reason} Source: ${row.url}`;
    return { slug, reason };
  });
  return { date, releaseScan: { checkedAt: date, url: sourceURL, note: releaseScan.note.trim(), requestsUsed: releaseScan.requestsUsed }, records, skipped };
}

function pack(selection, revision) {
  return {
    revision, date: selection.date, releaseScan: selection.releaseScan, csmOrder: ['age', 'violence', 'romance', 'language', 'drinking'],
    entries: selection.records.map(({ slug, newRelease, evidenceId, facts, row, wiki, rawReview, issues }) => ({
      slug, evidenceId, ...(newRelease ? { newRelease } : {}), title: facts.t, ...(facts.y ? { year: facts.y } : {}),
      ...(facts.csm ? { csm: Object.values(facts.csm) } : {}),
      ...(facts.studio ? {} : { studios: [row.studio, ...(wiki?.studios ?? [])].filter(Boolean) }),
      source: { review: facts.srcUrl, ...(rawReview ? { cachedReview: rawReview } : {}) },
      evidence: { story: row.story?.length > 450 ? `${row.story.slice(0, 450).trimEnd()}…` : row.story, parents: row.parents, ...row.content },
      ...(row.possible?.length ? { matches: row.possible } : {}), ...(issues.length ? { issues } : {}),
    })),
  };
}

function approve(record, decision, date) {
  const { slug, facts, wiki, row, newRelease } = record;
  const metadata = decision.confirmed ?? {};
  if (decision.reviewed !== true || !requiredText(decision.full) || !Array.isArray(decision.genre) || !decision.genre.length) {
    throw new Error(`Confirm editorial review and supply parent notes and genres for ${slug}.`);
  }
  if (!wiki || wiki.status !== 'complete' || !facts.y || !facts.runtimeMinutes) throw new Error(`Complete verified metadata and runtime for ${slug}.`);
  if (row.type !== 'Movie' && metadata.standalone !== true) throw new Error(`Confirm standalone film eligibility for ${slug}.`);
  if (row.possible?.length && !requiredText(metadata.distinctBecause)) throw new Error(`Resolve possible catalog matches for ${slug}.`);
  const releasedOn = metadata.releasedOn ?? facts.releasedOn;
  if (!today(releasedOn) || releasedOn > date || (releasedOn !== facts.releasedOn && !requiredText(metadata.releaseSource))) throw new Error(`Confirm a sourced release date for ${slug}.`);
  if (newRelease && Date.parse(date) - Date.parse(releasedOn) > 14 * 86400000) throw new Error(`${slug} is outside the 14-day new-release window.`);
  const rating = facts.rating || metadata.rating;
  const csm = facts.csm ?? metadata.csm;
  const studio = canonicalStudio(decision.studio) || facts.studio;
  if (!requiredText(rating) || /^(R|NC[-– ]?17)$/i.test(rating.trim()) || !studio || !today(facts.reviewDate) ||
      !Number.isInteger(csm?.age) || csm.age < 1 || csm.age > 12 || (row.age && csm.age !== row.age) ||
      !['v', 's', 'l', 'd'].every(key => Number.isInteger(csm[key]) && csm[key] >= 0 && csm[key] <= 5)) throw new Error(`Confirm the CSM age, scores, rating and studio for ${slug}.`);
  const entry = { slug, ...(newRelease ? { newRelease } : {}), t: facts.t, y: facts.y, rating, genre: decision.genre, studio,
    runtimeMinutes: facts.runtimeMinutes, runtimeSourceId: facts.runtimeSourceId, srcUrl: facts.srcUrl,
    reviewDate: facts.reviewDate, csm, full: decision.full };
  for (const field of ['concerns', 'watch', 'ask', 'pins', 'predecessor', 'bumps']) {
    if (Object.hasOwn(decision, field)) entry[field] = decision[field];
  }
  if (wiki.poster) {
    if (!wiki.posterHeaders || !hasVerifiedImageHeaders(fs.readFileSync(wiki.posterHeaders, 'utf8'))) throw new Error(`Poster receipt is absent or invalid for ${slug}.`);
    entry.poster = wiki.poster;
    entry.posterHeaders = path.resolve(wiki.posterHeaders);
  }
  return entry;
}

function join(selection, decisions, cache, revision, output) {
  if (!Array.isArray(decisions) || decisions.length !== selection.records.length) throw new Error('Provide one editorial decision per selected title.');
  const bySlug = new Map(decisions.map(row => [row.slug, row]));
  const entries = [], held = [], possibleLists = [];
  for (const record of selection.records) {
    const { slug, evidenceId, facts } = record;
    const decision = bySlug.get(slug);
    if (decision?.evidenceId !== evidenceId) throw new Error(`Review the current evidence before deciding ${slug}.`);
    if (decision.action === 'held' && requiredText(decision.reason)) {
      held.push({ slug, title: facts.t, reason: decision.reason });
      continue;
    }
    if (decision.action !== 'approve') throw new Error(`Choose approval or a documented hold for ${slug}.`);
    const entry = approve(record, decision, selection.date);
    for (const list of decision.possibleLists ?? []) {
      if (!requiredText(list.list) || !requiredText(list.reason)) throw new Error(`Supply a list ID and reason for a possible pin on ${slug}.`);
      possibleLists.push({ ...list, title: entry.t });
    }
    entries.push(entry);
  }
  writeJson(output, { date: selection.date, screenedRevision: revision, releaseScan: selection.releaseScan, entries, skipped: selection.skipped, held, possibleLists });
  for (const decision of decisions) {
    writeEvidence(cache, decision.slug, 'decision', { ...decision, revision, at: new Date().toISOString() });
  }
  console.log(JSON.stringify({ output, approved: entries.length, held: held.length, skipped: selection.skipped.length }));
}

const { positionals: [mode], values: options } = parseArgs({ allowPositionals: true,
  options: { selection: { type: 'string' }, decisions: { type: 'string' }, output: { type: 'string' }, cache: { type: 'string' }, ref: { type: 'string', default: 'origin/master' }, help: { type: 'boolean' } } });
if (options.help || !['pack', 'manifest'].includes(mode) || !options.selection || !options.output || (mode === 'manifest' && !options.decisions)) {
  console.log('Usage: node tools/catalog-editorial-packet.mjs pack|manifest --selection selection.json --output FILE [--decisions FILE] [--cache DIR] [--ref origin/master]');
  process.exitCode = options.help ? 0 : 1;
} else {
  try {
    const revision = git('rev-parse', '--verify', '--end-of-options', `${options.ref}^{commit}`);
    const cache = catalogCacheDirectory(options.cache);
    const selection = loadSelection(options.selection, cache, revision);
    const output = path.resolve(options.output);
    if (mode === 'pack') {
      fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
      writeAtomic(output, `${JSON.stringify(pack(selection, revision))}\n`);
      console.log(JSON.stringify({ output, count: selection.records.length, bytes: fs.statSync(output).size }));
    } else join(selection, readJson(options.decisions), cache, revision, output);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
