// Applies scripts/flag-rule.mjs to titles whose CSM page you have read, and
// writes the flags, the csmRecheckedAt/csmRecheckVersion stamps and the audit
// record in data-flag-basis.json together, so nobody does the arithmetic by
// hand. The model supplies the CSM numbers and any text bumps; this script
// supplies the levels. Dry run by default.
//
// Usage:
//   node scripts/derive-flags.mjs batch.json            # show what would change
//   node scripts/derive-flags.mjs batch.json --apply    # write it
//
// batch.json is an array of:
//   { "num": 1103, "on": "2026-11-04",
//     "csm": { "v": 3, "s": 2, "l": 2, "d": 1, "age": 6 },
//     "bumps": { "violence": { "quote": "<20+ chars copied from the entry's full>", "why": "..." } } }
// "on" is the date the CSM page was read. Titles the rule holds out (a CSM
// score of 4+, or an age of 10+) are recorded as held and get no flags.
//
// Only titles in data-extra.js or data-sonyanim.js (plain JSON arrays) can be
// written. Legacy flags are never touched.
import fs from 'node:fs';
import vm from 'node:vm';
import { FLAG_RULE_VERSION, CATEGORY_SOURCES, deriveFlags, holdReason } from './flag-rule.mjs';

const WRITABLE = ['data-extra.js', 'data-sonyanim.js'];
const BASIS = 'data-flag-basis.json';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const batchPath = args.find(a => !a.startsWith('--'));
if (!batchPath) { console.error('usage: node scripts/derive-flags.mjs batch.json [--apply]'); process.exit(2); }
const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));

const modelVersion = Number(/const CONTENT_MODEL_VERSION = (\d+);/.exec(fs.readFileSync('index.html', 'utf8'))?.[1]);
if (!Number.isInteger(modelVersion)) { console.error('could not read CONTENT_MODEL_VERSION from index.html'); process.exit(2); }

// Load each writable file as { prefix, name, movies }, refusing any file that
// would not survive a JSON round trip unchanged.
const files = WRITABLE.map(file => {
  const text = fs.readFileSync(file, 'utf8');
  const m = /^([\s\S]*?const (MOVIES_[A-Z]+) = )(\[[\s\S]*\]);\s*$/.exec(text);
  if (!m) throw new Error(`${file}: not a "const MOVIES_X = [...];" file`);
  const movies = JSON.parse(m[3]);
  if (JSON.stringify(movies) !== m[3]) throw new Error(`${file}: does not round-trip through JSON, refusing to rewrite it`);
  return { file, prefix: m[1], movies };
});

const basis = fs.existsSync(BASIS) ? JSON.parse(fs.readFileSync(BASIS, 'utf8')) : {};
let problems = 0;

for (const item of batch) {
  const home = files.find(f => f.movies.some(mv => mv.num === item.num));
  const movie = home?.movies.find(mv => mv.num === item.num);
  if (!movie) { console.log(`#${item.num}: not in ${WRITABLE.join(' or ')}, skipped`); problems++; continue; }
  if (movie.flags && !basis[String(item.num)]) { console.log(`#${item.num} ${movie.t}: legacy flags, not touched`); problems++; continue; }
  const csm = { ...item.csm, src: 'page', on: item.on };
  const reason = holdReason(csm);
  if (reason) {
    console.log(`#${item.num} ${movie.t}: HELD (${reason}), left unflagged`);
    if (apply) {
      delete movie.flags; delete movie.csmRecheckedAt; delete movie.csmRecheckVersion;
      basis[String(item.num)] = { csm, rule: FLAG_RULE_VERSION, held: true };
    }
    continue;
  }
  const adj = {};
  for (const [cat, b] of Object.entries(item.bumps || {})) {
    if (!(cat in CATEGORY_SOURCES)) throw new Error(`#${item.num}: unknown category ${cat}`);
    if (!b.quote || b.quote.length < 20 || !String(movie.full).includes(b.quote)) {
      throw new Error(`#${item.num} ${movie.t}: the ${cat} bump quote must be 20+ characters copied verbatim from full`);
    }
    if (!b.why || b.why.trim().length < 10) throw new Error(`#${item.num} ${movie.t}: the ${cat} bump needs a why`);
    adj[cat] = { kind: 'depicted', quote: b.quote, why: b.why };
  }
  const flags = deriveFlags(csm, adj);
  const bumped = Object.keys(adj).map(c => `${c}+1`).join(' ');
  console.log(`#${item.num} ${movie.t}: V${flags.violence} L${flags.language} R${flags.romance} D${flags.drinking}${bumped ? '  (' + bumped + ')' : ''}`);
  if (apply) {
    movie.flags = flags;
    movie.csmRecheckedAt = item.on;
    movie.csmRecheckVersion = modelVersion;
    basis[String(item.num)] = { csm, rule: FLAG_RULE_VERSION, ...(Object.keys(adj).length ? { adj } : {}) };
  }
}

if (apply) {
  for (const f of files) fs.writeFileSync(f.file, f.prefix + JSON.stringify(f.movies) + ';\n');
  const sorted = Object.fromEntries(Object.entries(basis).sort((a, b) => Number(a[0]) - Number(b[0])));
  fs.writeFileSync(BASIS, JSON.stringify(sorted, null, 1) + '\n');
  console.log('\nWritten. Now run: node scripts/bundle-data.mjs && node scripts/data-version.mjs && node scripts/validate-data.mjs');
} else {
  console.log('\nDry run. Add --apply to write.');
}
if (problems) process.exitCode = 1;
