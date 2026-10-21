// Checks data-guidance.js (MOVIE_GUIDANCE): the per-movie "Check a worry"
// concerns and the Pre-Show card program shown on Tonight's pick.
//
// Rules (see the header of data-guidance.js):
//   - every movie in the catalog has an entry, and no entry points at a
//     movie that doesn't exist
//   - each entry has exactly the 5 concern keys, each with a valid level
//   - a "yes"/"mild" quote is an exact substring of that movie's `full`
//     text, and a "no" has an empty quote, so nothing shown to a parent
//     can say more than the Common Sense Media notes already say
//   - preShow parses with zero errors as OpenUI Lang 1.0 against the
//     built-in openuiChatLibrary of @openuidev/browser-bundle@0.2.1
//
// The parser is @openuidev/lang-core@1.0.1, the version baked into
// browser-bundle@0.2.1 (with react-lang 1.0.1 and react-ui 0.18.1).
// scripts/openui-chat-library-schema.json is
// `window.__OpenUI.openuiChatLibrary.toJSONSchema()` taken from that exact
// bundle file, so the check runs against what the app will actually render
// with. If the app moves to a different bundle version, regenerate that
// file from the new bundle and bump lang-core to match.
//
// Usage:
//   node scripts/validate-guidance.mjs   -- also runs inside validate-data.mjs

import fs from 'node:fs';
import vm from 'node:vm';
import { createParser } from '@openuidev/lang-core';

export const CONCERN_KEYS = ['parentInDanger', 'scaryVillain', 'sadOrLoss', 'rudeHumor', 'animalPeril'];
export const CONCERN_LEVELS = ['yes', 'mild', 'no'];

const schema = JSON.parse(fs.readFileSync(new URL('./openui-chat-library-schema.json', import.meta.url), 'utf8'));
const componentNames = new Set(Object.keys(schema.$defs || {}));
const parser = createParser(schema, 'Card');

function collectComponentNames(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) collectComponentNames(item, out);
  } else if (node && typeof node === 'object') {
    if (typeof node.typeName === 'string') out.push(node.typeName);
    for (const value of Object.values(node.props || {})) collectComponentNames(value, out);
  }
}

// Returns a list of problems with one preShow program (empty when it's clean).
export function checkPreShow(program) {
  if (typeof program !== 'string' || !program.trim()) return ['preShow must be a non-empty string'];
  const result = parser.parse(program);
  const problems = [];
  if (result.meta.incomplete) problems.push('preShow is incomplete');
  if (result.meta.unresolved.length) problems.push(`preShow has undefined references: ${result.meta.unresolved.join(', ')}`);
  if (result.meta.orphaned.length) problems.push(`preShow has unused statements: ${result.meta.orphaned.join(', ')}`);
  for (const error of result.meta.errors) problems.push(`preShow: ${error.message}`);
  if (!result.root || result.root.typeName !== 'Card') {
    problems.push('preShow root must be a Card');
  } else {
    const names = [];
    collectComponentNames(result.root, names);
    for (const name of names) {
      if (!componentNames.has(name)) problems.push(`preShow uses unknown component ${name}`);
    }
  }
  return problems;
}

// Returns { errors, covered, total } for the whole catalog.
export function validateGuidance(movies, guidance) {
  const errors = [];
  const byNum = new Map(movies.map(movie => [String(movie.num), movie]));
  let covered = 0;

  if (!guidance || typeof guidance !== 'object') {
    return { errors: ['MOVIE_GUIDANCE is missing'], covered, total: movies.length };
  }

  for (const key of Object.keys(guidance)) {
    if (!byNum.has(key)) errors.push(`guidance ${key}: no matching movie`);
  }

  for (const movie of movies) {
    const label = `guidance ${movie.num} ${movie.t}`;
    const entry = guidance[String(movie.num)];
    if (!entry) {
      errors.push(`${label}: missing entry`);
      continue;
    }
    covered += 1;

    const concerns = entry.concerns;
    if (!concerns || typeof concerns !== 'object') {
      errors.push(`${label}: missing concerns`);
    } else {
      for (const key of Object.keys(concerns)) {
        if (!CONCERN_KEYS.includes(key)) errors.push(`${label}: unexpected concern ${key}`);
      }
      for (const key of CONCERN_KEYS) {
        const concern = concerns[key];
        if (!concern || typeof concern !== 'object') {
          errors.push(`${label}: missing concern ${key}`);
          continue;
        }
        if (!CONCERN_LEVELS.includes(concern.level)) {
          errors.push(`${label}: ${key}.level must be one of ${CONCERN_LEVELS.join('/')}`);
        }
        if (typeof concern.quote !== 'string') {
          errors.push(`${label}: ${key}.quote must be a string`);
        } else if (concern.level === 'no') {
          if (concern.quote !== '') errors.push(`${label}: ${key} is "no" but has a quote`);
        } else if (!concern.quote.trim()) {
          errors.push(`${label}: ${key} is "${concern.level}" but has no quote`);
        } else if (!String(movie.full || '').includes(concern.quote)) {
          errors.push(`${label}: ${key}.quote is not verbatim from full: "${concern.quote}"`);
        }
      }
    }

    for (const problem of checkPreShow(entry.preShow)) errors.push(`${label}: ${problem}`);
  }

  return { errors, covered, total: movies.length };
}

// Loads the catalog and MOVIE_GUIDANCE the same way validate-data.mjs does.
export function loadCatalogAndGuidance(files) {
  const context = {};
  vm.createContext(context);
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  vm.runInContext(`
    this.__MOVIES__ = [
      ...MOVIES_BASE, ...MOVIES_RT, ...MOVIES_DCOM, ...MOVIES_DISNEY, ...MOVIES_PIXAR,
      ...MOVIES_DREAMWORKS, ...MOVIES_NICK, ...MOVIES_EXTRA, ...MOVIES_CSM,
      ...MOVIES_MCUDC, ...MOVIES_GHIBLI
    ];
    this.__GUIDANCE__ = typeof MOVIE_GUIDANCE !== 'undefined' ? MOVIE_GUIDANCE : undefined;
  `, context);
  return { movies: context.__MOVIES__, guidance: context.__GUIDANCE__ };
}

async function main() {
  const { dataFiles } = await import('./data-version.mjs');
  const { movies, guidance } = loadCatalogAndGuidance(dataFiles);
  const { errors, covered, total } = validateGuidance(movies, guidance);
  console.log(`guidance coverage: ${covered} of ${total} movies have an entry (${total - covered} missing).`);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`Validated guidance for ${covered} movies.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
