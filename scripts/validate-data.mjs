import fs from 'node:fs';
import vm from 'node:vm';
import { computeDataHash, currentSwDataVersion } from './data-version.mjs';
import { getAuditCandidateNums } from './audit-content-flags.mjs';
import {
  CONTENT_STATUSES,
  hasVerifiedRuntime,
  computeContentStatus,
  isInVerifiedForFamilyFitSubset
} from './catalog-schema.mjs';

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
  'data-ghibli.js',
  'data-posters.js'
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

const contentFlagIds = ['violence', 'language', 'romance', 'drinking'];

const allowedGenres = new Set([
  'Action',
  'Adventure',
  'Animation',
  'Biography',
  'Comedy',
  'Coming-of-Age',
  'Documentary',
  'Drama',
  'Fantasy',
  'Holiday',
  'Horror',
  'Live-Action',
  'Musical',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Sports',
  'Superhero',
  'War',
  'Western'
]);

const errors = [];
// WARN-only findings: worth printing, but not worth failing the build over.
const warnings = [];
const context = {};
vm.createContext(context);

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

for (const file of dataFiles) {
  try {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
  }
}

vm.runInContext(`
  this.__MOVIES__ = [
    ${movieArrays.map(name => `...(typeof ${name} !== 'undefined' ? ${name} : [])`).join(',\n    ')}
  ];
  this.__POSTERS__ = typeof MOVIE_POSTERS !== 'undefined' ? MOVIE_POSTERS : {};
`, context);

const movies = context.__MOVIES__;
const seenNums = new Map();
const seenTitleYears = new Map();

for (const movie of movies) {
  const label = `${movie.num ?? 'missing-num'} ${movie.t ?? 'missing-title'}`;
  for (const field of ['num', 't', 'y', 'la', 'ca', 'full', 'srcUrl', 'genre', 'studio']) {
    if (!(field in movie)) errors.push(`${label}: missing ${field}`);
  }

  if (!Number.isInteger(movie.num)) errors.push(`${label}: num must be an integer`);
  if (seenNums.has(movie.num)) errors.push(`${label}: duplicate num also used by ${seenNums.get(movie.num)}`);
  else seenNums.set(movie.num, movie.t);

  const titleYearKey = `${normalizeTitle(movie.t)}|${movie.y}`;
  if (seenTitleYears.has(titleYearKey)) {
    errors.push(`${label}: duplicate title/year also used by ${seenTitleYears.get(titleYearKey)}`);
  } else {
    seenTitleYears.set(titleYearKey, `${movie.num} ${movie.t}`);
  }

  if (!Array.isArray(movie.genre) || movie.genre.length === 0) {
    errors.push(`${label}: genre must be a non-empty array`);
  } else {
    for (const genre of movie.genre) {
      if (!allowedGenres.has(genre)) errors.push(`${label}: invalid genre ${genre}`);
    }
  }

  if (movie.srcUrl) {
    try {
      const url = new URL(movie.srcUrl);
      if (url.protocol !== 'https:') errors.push(`${label}: srcUrl must use https`);
    } catch {
      errors.push(`${label}: invalid srcUrl`);
    }
  }

  if (movie.addedAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(movie.addedAt)) {
    errors.push(`${label}: addedAt must be YYYY-MM-DD`);
  }
  if (movie.addedVia !== undefined && movie.addedVia !== 'request' && movie.addedVia !== 'discovery') {
    errors.push(`${label}: addedVia must be "request" or "discovery"`);
  }

  if (movie.flags !== undefined) {
    if (typeof movie.flags !== 'object' || movie.flags === null || Array.isArray(movie.flags)) {
      errors.push(`${label}: flags must be an object`);
    } else {
      const keys = Object.keys(movie.flags);
      for (const flagId of contentFlagIds) {
        if (!(flagId in movie.flags)) errors.push(`${label}: flags missing ${flagId}`);
      }
      for (const key of keys) {
        if (!contentFlagIds.includes(key)) errors.push(`${label}: flags has unexpected key ${key}`);
      }
      for (const flagId of contentFlagIds) {
        const level = movie.flags[flagId];
        if (level !== undefined && (!Number.isInteger(level) || level < 1 || level > 4)) {
          errors.push(`${label}: flags.${flagId} must be an integer 1-4`);
        }
      }
    }
  }

  const hasRecheckedAt = movie.csmRecheckedAt !== undefined;
  const hasRecheckVersion = movie.csmRecheckVersion !== undefined;
  if (hasRecheckedAt !== hasRecheckVersion) {
    errors.push(`${label}: csmRecheckedAt and csmRecheckVersion must be set together`);
  }
  if (hasRecheckedAt && !/^\d{4}-\d{2}-\d{2}$/.test(movie.csmRecheckedAt)) {
    errors.push(`${label}: csmRecheckedAt must be YYYY-MM-DD`);
  }
  if (hasRecheckVersion && !Number.isInteger(movie.csmRecheckVersion)) {
    errors.push(`${label}: csmRecheckVersion must be an integer`);
  }

  // TRD "Versioned catalog contract > Runtime" (docs/trd-trusted-contextual-recommendations.md):
  // runtimeMinutes/runtimeSourceId/runtimeVerifiedAt travel together, same
  // shape as the csmRecheckedAt/csmRecheckVersion pairing above -- all three
  // present or none, so a title can't claim a verified runtime with no
  // record of where it came from or when.
  const hasRuntimeMinutes = movie.runtimeMinutes !== undefined;
  const hasRuntimeSourceId = movie.runtimeSourceId !== undefined;
  const hasRuntimeVerifiedAt = movie.runtimeVerifiedAt !== undefined;
  if (hasRuntimeMinutes || hasRuntimeSourceId || hasRuntimeVerifiedAt) {
    if (!(hasRuntimeMinutes && hasRuntimeSourceId && hasRuntimeVerifiedAt)) {
      errors.push(`${label}: runtimeMinutes, runtimeSourceId, and runtimeVerifiedAt must all be set together`);
    }
    if (hasRuntimeMinutes && !(Number.isInteger(movie.runtimeMinutes) && movie.runtimeMinutes > 0)) {
      errors.push(`${label}: runtimeMinutes must be a positive integer`);
    }
    if (hasRuntimeSourceId && (typeof movie.runtimeSourceId !== 'string' || !movie.runtimeSourceId.trim())) {
      errors.push(`${label}: runtimeSourceId must be a non-empty string`);
    }
    if (hasRuntimeVerifiedAt && !/^\d{4}-\d{2}-\d{2}$/.test(movie.runtimeVerifiedAt)) {
      errors.push(`${label}: runtimeVerifiedAt must be YYYY-MM-DD`);
    }
  }
}

const posterKeys = Object.keys(context.__POSTERS__ || {});
for (const key of posterKeys) {
  if (!seenNums.has(Number(key))) errors.push(`poster ${key}: no matching movie`);
}

for (const movie of movies) {
  const poster = context.__POSTERS__ && context.__POSTERS__[movie.num];
  if (poster) {
    try {
      const url = new URL(poster.u);
      if (url.protocol !== 'https:') errors.push(`${movie.num} ${movie.t}: poster URL must use https`);
    } catch {
      errors.push(`${movie.num} ${movie.t}: invalid poster URL`);
    }
  }
}

// Issue #63: sw.js's DATA_VERSION must match the data files' current
// content, or a browser with an existing service-worker registration can
// keep serving a stale catalog after a content-only commit (sw.js's own
// bytes wouldn't have changed, so the browser never detects an update).
// Catch a forgotten `node scripts/data-version.mjs` re-stamp here, since
// this script already runs on every batch.
{
  const expectedHash = computeDataHash();
  const swSource = fs.readFileSync('sw.js', 'utf8');
  const currentHash = currentSwDataVersion(swSource);
  if (currentHash !== expectedHash) {
    errors.push(`sw.js's DATA_VERSION (${currentHash}) is stale, data files hash to ${expectedHash}. Run \`node scripts/data-version.mjs\` and commit the result.`);
  }
}

// Issue #71: CONTENT_FLAGS' four categories x four levels each carry a short
// `example` movie title. A reused example string (e.g. the same title copy-
// pasted into more than one category/level pair while authoring) quietly
// erodes what that tier communicates to a parent -- most visibly when it
// happens to the highest ("ceiling") level. This is a duplicate-authoring
// smell, not a data-integrity error, so it only warns; it never fails the
// build the way the `errors` checks above do.
{
  const indexSource = fs.readFileSync('index.html', 'utf8');
  const contentFlagsMatch = indexSource.match(/const CONTENT_FLAGS = (\[[\s\S]*?\n\]);/);
  if (!contentFlagsMatch) {
    warnings.push('index.html: could not locate CONTENT_FLAGS to check for duplicate examples');
  } else {
    const flagsContext = {};
    vm.createContext(flagsContext);
    vm.runInContext(`this.__CONTENT_FLAGS__ = ${contentFlagsMatch[1]};`, flagsContext, { filename: 'index.html (CONTENT_FLAGS)' });
    const contentFlags = flagsContext.__CONTENT_FLAGS__;
    const usagesByExample = new Map();
    for (const flag of contentFlags) {
      flag.levels.forEach((level, levelIndex) => {
        const usage = `${flag.id} level ${levelIndex + 1} (${level.name})`;
        if (!usagesByExample.has(level.example)) usagesByExample.set(level.example, []);
        usagesByExample.get(level.example).push(usage);
      });
    }
    for (const [example, usages] of usagesByExample) {
      if (usages.length > 1) {
        warnings.push(`CONTENT_FLAGS: example "${example}" is reused across ${usages.length} category/level pairs: ${usages.join('; ')}`);
      }
    }
  }
}

// Trusted Contextual Recommendations, Phase 1 (docs/roadmap.md's "Now" item):
// coverage report for the Gate 0 §3 contentStatus state machine, plus a
// re-verification of Gate 0 §6's initial "Verified for Family Fit" certified
// subset. Non-blocking (report only) -- most of the catalog is legitimately
// provisional/unknown/stale right now (e.g. zero titles have runtimeMinutes
// yet), that's the accurate current state per Gate 0, not a validation
// failure. Gate 0 §6 explicitly says to re-run its combined filter before
// cutover since the count drifts as backfill work lands, so a difference
// from the 989 recorded at Gate 0's close is expected and just gets
// reported, not treated as an error.
{
  const indexSource = fs.readFileSync('index.html', 'utf8');
  const versionMatch = indexSource.match(/const CONTENT_MODEL_VERSION = (\d+);/);
  if (!versionMatch) {
    warnings.push('index.html: could not locate CONTENT_MODEL_VERSION for contentStatus freshness check');
  } else {
    const contentModelVersion = parseInt(versionMatch[1], 10);
    const auditCandidateNums = getAuditCandidateNums(movies);
    const now = new Date();

    const statusCounts = Object.fromEntries(CONTENT_STATUSES.map(s => [s, 0]));
    for (const movie of movies) {
      const status = computeContentStatus(movie, { auditCandidateNums, contentModelVersion, now });
      statusCounts[status] += 1;
    }

    const familyFitSubset = movies.filter(m => isInVerifiedForFamilyFitSubset(m, auditCandidateNums));
    const withRuntime = familyFitSubset.filter(hasVerifiedRuntime).length;

    console.log(
      `\ncontentStatus coverage (policyVersion 1, ${movies.length} titles): ` +
      CONTENT_STATUSES.map(s => `${s}=${statusCounts[s]}`).join(', ')
    );
    console.log(
      `Gate 0 §6 "Verified for Family Fit" candidate subset (flags complete + not an open audit ` +
      `candidate + normalizable age): ${familyFitSubset.length} titles (${withRuntime} with verified ` +
      `runtimeMinutes so far, recorded 989 as of Gate 0's close 2026-09-21 -- re-verify against that ` +
      `each time this drifts materially).`
    );
  }
}

if (warnings.length) {
  console.warn(`Warnings:\n${warnings.join('\n')}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${movies.length} movies and ${posterKeys.length} poster entries.`);
