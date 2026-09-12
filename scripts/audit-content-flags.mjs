// Flags candidates for manual CSM re-research where a title's structured
// `flags` data (violence/language/romance/drinking, 1-4 each) may under-tag
// what its own `ca` rating or `full` text describes -- the same shape of gap
// that let Romeo and Juliet (num 131) through with flags.violence:3 despite
// a CSM 14+ rating and a `full` text describing two on-screen killings and a
// depicted double suicide (see PENDING_REQUESTS.md, 2026-09-12).
//
// This is a candidate generator, not a verdict: it does pure text/data
// analysis against what's already in the repo (no CSM access needed) to
// produce a small, reviewable list. Every candidate still needs an actual
// human/re-research judgment call -- the checks below are deliberately
// over-inclusive rather than trying to be precise.
//
// Usage: node scripts/audit-content-flags.mjs [--min-age=13]
//
// Check A: a title whose `ca` age rating is >= --min-age (default 13) but
// whose flags never reach the top of the scale (level 4) in any category --
// i.e. a mature-rated title where nothing in the structured flags reflects
// that maturity. 13 is the calibration that isolates this pattern without
// pulling in documentaries/dramas rated for thematic complexity a 4-category
// violence/language/romance/drinking scale was never meant to capture
// (age>=10 pulled in noise like "Wonder", "Hidden Figures").
//
// Check B: a title whose `full` text contains a severity-suggestive keyword
// for a category, while that category's own flag is <= 2. Keyword lists
// below are a heuristic starting point, not exhaustive -- extend them as
// real re-research turns up patterns they miss.

import fs from 'node:fs';
import vm from 'node:vm';

const dataFiles = [
  'data.js',
  'data-rt.js',
  'data-dcom.js',
  'data-disney.js',
  'data-pixar.js',
  'data-dreamworks.js',
  'data-nickelodeon.js',
  'data-extra.js',
  'data-csm.js',
  'data-mcudc.js',
  'data-ghibli.js'
];

const movieArrays = [
  'MOVIES_BASE',
  'MOVIES_RT',
  'MOVIES_DCOM',
  'MOVIES_DISNEY',
  'MOVIES_PIXAR',
  'MOVIES_DREAMWORKS',
  'MOVIES_NICK',
  'MOVIES_EXTRA',
  'MOVIES_CSM',
  'MOVIES_MCUDC',
  'MOVIES_GHIBLI'
];

const CONTENT_FLAG_IDS = ['violence', 'language', 'romance', 'drinking'];

// Keyword lists are intentionally simple substring checks against the
// lowercased `full` text -- a false positive just means one more title a
// human glances at and dismisses; a false negative is the actual risk this
// script exists to shrink.
//
// Deliberately NOT included: bare "death"/"dies"/"died", and bare
// "nudity"/"nude"/"naked". Both were tried first and produced near-total
// noise on this catalog's actual writing conventions rather than a "small,
// reviewable" list (96 hits, ~85% from just these two families) -- a
// natural/mild narrative death ("Charlotte's Web", "Up") is extremely
// common even at violence:2, and this catalog's research style almost
// always already qualifies real nudity mentions as "brief"/"non-sexual"/
// "played for laughs"/"partial"/"silhouette" in the same breath (verified
// by inspecting the actual `full` text of every hit -- not one read as a
// genuine miss). Keeping only phrases that name the severe act more
// specifically, not just its milder possibility, to keep this a candidate
// list a human can actually work through rather than a wall of noise.
const SEVERITY_KEYWORDS = {
  violence: [
    'killed', 'kills', 'killing', 'murder', 'murdered',
    'suicide', 'stabbed', 'stabbing', 'shot and', 'shooting', 'torture',
    'massacre', 'decapitat', 'mutilat', 'graphic violence'
  ],
  romance: [
    'explicit sex', 'graphic sex', 'sex scene'
  ],
  language: [
    'constant swearing', 'graphic language', 'explicit language', 'f-word used'
  ],
  drinking: [
    'drug use', 'graphic drug use', 'addiction', 'overdose', 'alcoholism', 'drug abuse'
  ]
};
const SEVERITY_FLAG_MAX = 2; // flag value at/below which a keyword hit counts as a mismatch

function parseArgs(argv) {
  const opts = { minAge: 13 };
  for (const arg of argv) {
    const m = /^--min-age=(\d+)$/.exec(arg);
    if (m) opts.minAge = parseInt(m[1], 10);
  }
  return opts;
}

// Mirrors index.html's parseAge() exactly (same regex) so this script's
// notion of "ca's leading number" matches what the app itself parses.
function parseAge(ca) {
  const m = /^~?(\d+)\+/.exec((ca || '').trim());
  return m ? parseInt(m[1], 10) : null;
}

function loadMovies() {
  const context = {};
  vm.createContext(context);
  for (const file of dataFiles) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  vm.runInContext(`
    this.__MOVIES__ = [
      ${movieArrays.map(name => `...(typeof ${name} !== 'undefined' ? ${name} : [])`).join(',\n      ')}
    ];
  `, context);
  return context.__MOVIES__;
}

function checkA(movies, minAge) {
  const candidates = [];
  for (const movie of movies) {
    if (!movie.flags) continue; // only the backfilled set has structured flags to check
    const age = parseAge(movie.ca);
    if (age === null || age < minAge) continue;
    const maxLevel = Math.max(...CONTENT_FLAG_IDS.map(id => movie.flags[id] || 1));
    if (maxLevel <= 3) {
      candidates.push({ movie, reason: `ca ${movie.ca}, max flag ${maxLevel}` });
    }
  }
  return candidates;
}

const NEGATION_WINDOW = 20; // chars to look back from a keyword match
const NEGATION_PHRASES = ['no ', 'not ', 'never ', 'without ', "n't "];

// Skips a hit like "...no language, drug use, or sexual content to worry
// about" (real example: The Lion, the Witch and the Wardrobe) where the
// keyword is actually being denied, not described. Only catches a negation
// word shortly before the match -- not a real parser, just cheap enough to
// remove an easy, demonstrated false-positive class.
function isNegated(text, matchIndex) {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex);
  return NEGATION_PHRASES.some(phrase => before.includes(phrase));
}

function checkB(movies) {
  const candidates = [];
  for (const movie of movies) {
    if (!movie.flags || !movie.full) continue;
    const text = movie.full.toLowerCase();
    const hits = [];
    for (const flagId of CONTENT_FLAG_IDS) {
      const level = movie.flags[flagId] || 1;
      if (level > SEVERITY_FLAG_MAX) continue;
      const matchedKeyword = SEVERITY_KEYWORDS[flagId].find(kw => {
        const idx = text.indexOf(kw);
        return idx !== -1 && !isNegated(text, idx);
      });
      if (matchedKeyword) hits.push(`${flagId}:${level} despite "${matchedKeyword}"`);
    }
    if (hits.length) candidates.push({ movie, reason: hits.join(', ') });
  }
  return candidates;
}

function formatFlags(flags) {
  return CONTENT_FLAG_IDS.map(id => `${id}:${flags[id] || 1}`).join(',');
}

function printCandidates(title, candidates) {
  console.log(`\n${title} (${candidates.length}):`);
  if (!candidates.length) {
    console.log('  (none)');
    return;
  }
  for (const { movie, reason } of candidates.sort((a, b) => a.movie.num - b.movie.num)) {
    console.log(`  ${movie.num} ${movie.t} (${movie.ca}) — ${formatFlags(movie.flags)} — ${reason}`);
  }
}

const opts = parseArgs(process.argv.slice(2));
const movies = loadMovies();

const aCandidates = checkA(movies, opts.minAge);
const bCandidates = checkB(movies);

const combined = new Map();
for (const c of aCandidates) combined.set(c.movie.num, c.movie);
for (const c of bCandidates) combined.set(c.movie.num, c.movie);

printCandidates(`Check A: ca >= ${opts.minAge}+ but no flag reaches level 4`, aCandidates);
printCandidates('Check B: a severity keyword in `full` despite a low flag for that category', bCandidates);

console.log(`\nCombined, deduped candidate list for manual re-research (${combined.size} titles):`);
if (!combined.size) {
  console.log('  (none)');
} else {
  for (const movie of [...combined.values()].sort((a, b) => a.num - b.num)) {
    console.log(`  ${movie.num} ${movie.t} (${movie.y}) — ${movie.ca} — ${formatFlags(movie.flags)}`);
  }
}
