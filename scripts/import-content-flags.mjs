#!/usr/bin/env node
// One-off import: backfills real Common Sense Media content-flag data (collected
// across the research/backfill-audit-20260907-codex branch) into the production
// data-*.js catalog files. Run once; not a permanent pipeline -- see
// docs/content-flags-import-notes-2026-09-08.md for the human-facing summary this
// script generates, and the plan this was built from for full context.
//
// Usage: node scripts/import-content-flags.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const RESEARCH_BRANCH = 'origin/research/backfill-audit-20260907-codex';
const CONTENT_MODEL_VERSION = 2; // bumped from 1: this import adopts PR #30's merge of scary into violence and drops sad as a scored flag
const FLAG_IDS = ['violence', 'language', 'romance', 'drinking'];

const DATA_FILES = [
  'data.js', 'data-csm.js', 'data-dcom.js', 'data-disney.js', 'data-dreamworks.js',
  'data-extra.js', 'data-ghibli.js', 'data-mcudc.js', 'data-nickelodeon.js',
  'data-pixar.js', 'data-rt.js'
];

// Known upgrade cases, verified during planning (research found a real CSM age
// for a title the catalog had marked "(approximate)" or "Not on CSM"). Hardcoded
// as an assertion checklist so a script bug or upstream data drift can't silently
// apply the wrong set. First 15 are from the original 10-file import
// (2026-09-08); the next 8 are from Codex's base-list (data.js) research,
// added the same day once that coverage landed.
const EXPECTED_UPGRADES = new Set([
  137, 141, 143, 144, 145, 146, 147, 148, 149, 151, 153, 154, 155, 546, 276,
  42, 43, 46, 59, 61, 66, 79, 97
]);

function listResearchFiles() {
  const out = execSync(`git -C "${REPO_ROOT}" show ${RESEARCH_BRANCH}:research`, { encoding: 'utf8' });
  return out.split('\n')
    .map(line => line.trim())
    .filter(name => /^csm-content-flags.*\.json$/.test(name));
}

function readResearchFile(name) {
  const raw = execSync(`git -C "${REPO_ROOT}" show ${RESEARCH_BRANCH}:research/${name}`, { encoding: 'utf8' });
  return JSON.parse(raw);
}

function loadDataFile(file) {
  const full = path.join(REPO_ROOT, file);
  const content = fs.readFileSync(full, 'utf8').trim();
  const eq = content.indexOf('=');
  const prefix = content.slice(0, eq + 1);
  let arrText = content.slice(eq + 1).trim();
  if (arrText.endsWith(';')) arrText = arrText.slice(0, -1);
  return { full, prefix, movies: JSON.parse(arrText) };
}

function writeDataFile(full, prefix, movies) {
  fs.writeFileSync(full, `${prefix} ${JSON.stringify(movies)};\n`, 'utf8');
}

function main() {
  console.log('Loading research entries from', RESEARCH_BRANCH, '...');
  const files = listResearchFiles();
  const researchByNum = new Map();
  let totalEntries = 0;
  for (const name of files) {
    const doc = readResearchFile(name);
    if (!Array.isArray(doc.entries)) continue;
    // researchedAt lives on the file/batch, not per-entry -- stamp it onto each
    // entry here so downstream code has one consistent place to read it from.
    for (const entry of doc.entries) {
      if (researchByNum.has(entry.num)) {
        throw new Error(`Duplicate research num ${entry.num} (also in a prior file) -- aborting, this should never happen (verified 0 dupes during planning)`);
      }
      researchByNum.set(entry.num, { ...entry, researchedAt: doc.researchedAt });
      totalEntries++;
    }
  }
  console.log(`Loaded ${totalEntries} research entries from ${files.length} files.`);

  let flagsApplied = 0;
  let upgradesApplied = 0;
  let unavailableCount = 0;
  let noResearch = 0;
  const appliedUpgradeNums = new Set();
  const notableFindings = { upgrades: [], labelConflicts: [], sensitiveContent: [], noReview: [] };

  for (const file of DATA_FILES) {
    const { full, prefix, movies } = loadDataFile(file);
    let changedInFile = 0;

    for (const movie of movies) {
      const entry = researchByNum.get(movie.num);
      if (!entry) { noResearch++; continue; }

      if (entry.csmStatus === 'unavailable') {
        unavailableCount++;
        continue; // no real data to add; heuristic fallback keeps covering this movie
      }

      if (entry.csmStatus !== 'found') {
        throw new Error(`Unexpected csmStatus "${entry.csmStatus}" for num ${entry.num} -- aborting`);
      }

      const flags = {};
      for (const flagId of FLAG_IDS) {
        const level = entry.flags && entry.flags[flagId] && entry.flags[flagId].proposedLevel;
        if (!Number.isInteger(level) || level < 1 || level > 4) {
          throw new Error(`Bad proposedLevel for num ${entry.num} flag ${flagId}: ${level} -- aborting`);
        }
        flags[flagId] = level;
      }
      movie.flags = flags;
      movie.csmRecheckedAt = entry.researchedAt;
      movie.csmRecheckVersion = CONTENT_MODEL_VERSION;
      flagsApplied++;
      changedInFile++;

      const currentCa = entry.currentCatalogCa || entry.currentCa || '';
      const isFallbackMarked = currentCa.includes('Not on CSM') || currentCa.includes('approximate');
      if (isFallbackMarked && entry.csmAge) {
        const oldCa = movie.ca;
        movie.ca = entry.csmAge;
        upgradesApplied++;
        appliedUpgradeNums.add(entry.num);
        notableFindings.upgrades.push({ num: entry.num, title: movie.t, oldCa, newCa: entry.csmAge });
      }
    }

    if (changedInFile > 0) {
      writeDataFile(full, prefix, movies);
      console.log(`  ${file}: updated ${changedInFile} movies`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Movies with real flags applied: ${flagsApplied}`);
  console.log(`Catalog age (ca) upgrades applied: ${upgradesApplied}`);
  console.log(`Movies left on heuristic fallback (csmStatus unavailable): ${unavailableCount}`);
  console.log(`Catalog movies with no research entry at all (within the ${DATA_FILES.length} files this script covers): ${noResearch}`);

  // Assertions against expected known-good counts from planning.
  const missing = [...EXPECTED_UPGRADES].filter(n => !appliedUpgradeNums.has(n));
  const extra = [...appliedUpgradeNums].filter(n => !EXPECTED_UPGRADES.has(n));
  if (missing.length || extra.length) {
    throw new Error(`Upgrade set mismatch vs expected checklist. Missing: ${missing}. Extra: ${extra}.`);
  }
  if (noResearch > 0) {
    throw new Error(`${noResearch} catalog movies have no research entry -- expected 0. Aborting before writing notes.`);
  }
  console.log('\nAll counts match the expected checklist from planning.');

  // Collect a few known notable findings for human review (hand-curated from
  // Codex's base-list handoff doc and a scan of this batch's handoffNotes text,
  // not re-derived programmatically at import time, since that text isn't
  // structured enough to parse reliably).
  const newUpgradeNums = new Set([42, 43, 46, 59, 61, 66, 79, 97]);
  const newUpgrades = notableFindings.upgrades.filter(u => newUpgradeNums.has(u.num));

  const labelConflicts = [
    { num: 8, title: 'The Good Dinosaur', note: 'CSM labels language "not present," but its detail text lists mild substitute words.' },
    { num: 20, title: 'Mary Poppins Returns', note: 'CSM labels drinking "not present," but its detail text mentions a brief drunkenness joke.' },
    { num: 58, title: 'The Biggest Little Farm', note: 'CSM labels Sex, Romance & Nudity "not present," but its detail text mentions animal births.' }
  ];
  const sensitiveContent = [
    { num: 92, title: 'Holes', note: 'Racist violence, a lynching, and a suicide reference require explicit context, per the research notes.' },
    { num: 88, title: 'Back to the Future', note: 'Implied sexual assault and racial language need careful prose context.' },
    { num: 82, title: 'Girl Rising', note: 'Covers sexual violence and child exploitation; needs careful downstream prose.' },
    { num: 99, title: "The Personal History of David Copperfield", note: 'Suicidal talk, an implied child-abuse thread, and alcohol misuse need prose context.' }
  ];
  const ageMismatchesNotAutoApplied = [
    { num: 8, title: 'The Good Dinosaur', catalogCa: '8+', researchedCa: '7+' },
    { num: 70, title: 'The Princess Bride', catalogCa: '8+', researchedCa: '9+' },
    { num: 82, title: 'Girl Rising', catalogCa: '11+', researchedCa: '12+' }
  ];

  const notesPath = path.join(REPO_ROOT, 'docs', 'content-flags-import-notes-2026-09-08-base.md');
  const notesLines = [];
  notesLines.push('# Content-flags import notes: base list (2026-09-08)');
  notesLines.push('');
  notesLines.push('Generated by `scripts/import-content-flags.mjs`. Second run of this script, after Codex');
  notesLines.push('closed the scope gap the first run flagged: `data.js` (`MOVIES_BASE`, 99 movies, nums');
  notesLines.push('1-100) was never covered by any research pass in the original backfill. Codex researched');
  notesLines.push('all 99 the same day; this run imports that data the same way the first run imported the');
  notesLines.push('other 10 files. Counts below cover this whole run (`data.js` plus a no-op re-apply to the');
  notesLines.push('already-imported files, which is why the totals look like the full catalog again).');
  notesLines.push('');
  notesLines.push(`- Movies with real content-flag data applied: ${flagsApplied}`);
  notesLines.push(`- Catalog age (ca) upgrades applied in total: ${upgradesApplied} (8 new from this batch,`);
  notesLines.push('  15 re-applied unchanged from the first run)');
  notesLines.push(`- Movies left on the keyword-heuristic fallback (no CSM review exists): ${unavailableCount}`);
  notesLines.push('- Catalog is now fully researched: 1037 of 1037 movies have either real CSM data or a');
  notesLines.push('  documented fallback. See docs/content-flags-import-notes-2026-09-08.md for the first');
  notesLines.push('  run\'s notes (the original 10-file import and its own findings).');
  notesLines.push('');
  notesLines.push('## New catalog age upgrades from this batch');
  notesLines.push('');
  for (const u of newUpgrades) {
    notesLines.push(`- #${u.num} ${u.title}: \`${u.oldCa}\` -> \`${u.newCa}\``);
  }
  notesLines.push('');
  notesLines.push('## CSM label/detail conflicts worth a second look');
  notesLines.push('');
  for (const c of labelConflicts) {
    notesLines.push(`- #${c.num} ${c.title}: ${c.note}`);
  }
  notesLines.push('');
  notesLines.push('## Sensitive content worth reviewer attention');
  notesLines.push('');
  for (const s of sensitiveContent) {
    notesLines.push(`- #${s.num} ${s.title}: ${s.note}`);
  }
  notesLines.push('');
  notesLines.push('## Age mismatches noted but not auto-applied');
  notesLines.push('');
  notesLines.push('These weren\'t marked as fallback/approximate in the catalog, so the import script left');
  notesLines.push('`ca` untouched (only the 8 fallback-marked upgrades above were auto-applied) -- a reviewer');
  notesLines.push('should decide whether to update these manually.');
  notesLines.push('');
  for (const m of ageMismatchesNotAutoApplied) {
    notesLines.push(`- #${m.num} ${m.title}: catalog says \`${m.catalogCa}\`, CSM says \`${m.researchedCa}\``);
  }
  notesLines.push('');
  notesLines.push('## Known limitation: `full` description text is not updated by this script');
  notesLines.push('');
  notesLines.push('Confirmed on both this batch\'s upgrades (e.g. #42 Peter Pan) and the first run\'s (e.g.');
  notesLines.push('#546 Snow Day): for every fallback/approximate-to-real `ca` upgrade, the movie\'s `full`');
  notesLines.push('description text still reads like the old fallback -- e.g. "Common Sense Media has not');
  notesLines.push('reviewed this..." -- even though `ca` and `flags` now reflect the real CSM data. This');
  notesLines.push('script only ever touches `ca`, `flags`, `csmRecheckedAt`, and `csmRecheckVersion`; it');
  notesLines.push('never rewrites prose. The content filtering itself is correct either way (it reads `ca`');
  notesLines.push('and `flags`, not `full`), but a parent reading the description for one of these 23 movies');
  notesLines.push('will see stale, self-contradicting text. Rewriting `full` for these 23 titles from each');
  notesLines.push('entry\'s CSM summary text is a reasonable follow-up, but is a separate, judgment-carrying');
  notesLines.push('editorial pass this script deliberately did not attempt.');
  notesLines.push('');
  fs.writeFileSync(notesPath, notesLines.join('\n'), 'utf8');
  console.log(`\nReviewer notes written to ${path.relative(REPO_ROOT, notesPath)}`);
}

main();
