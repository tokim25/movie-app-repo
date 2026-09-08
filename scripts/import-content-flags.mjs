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
  'data-csm.js', 'data-dcom.js', 'data-disney.js', 'data-dreamworks.js',
  'data-extra.js', 'data-ghibli.js', 'data-mcudc.js', 'data-nickelodeon.js',
  'data-pixar.js', 'data-rt.js'
];

// Known upgrade cases, verified during planning (research found a real CSM age
// for a title the catalog had marked "(approximate)" or "Not on CSM"). Hardcoded
// as an assertion checklist so a script bug or upstream data drift can't silently
// apply the wrong set.
const EXPECTED_UPGRADES = new Set([137, 141, 143, 144, 145, 146, 147, 148, 149, 151, 153, 154, 155, 546, 276]);

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
  console.log(`Catalog movies with no research entry at all (within the 10 files this script covers): ${noResearch}`);
  console.log('NOTE: data.js (MOVIES_BASE, 99 movies, nums 1-100) is a separate, live production file this');
  console.log('script deliberately does not touch -- discovered during this import that it was never in scope');
  console.log('for any research pass this session. Those 99 movies still run on the keyword heuristic.');

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

  // Collect a few known notable findings for human review (hand-curated from this
  // session's handoff docs, not re-derived from freeform handoffNotes text, since
  // that text isn't structured enough to parse reliably).
  notableFindings.labelConflicts = [
    { num: 967, title: 'Curious George', note: 'CSM labels violence and romance "Not present," but its own descriptive text mentions slapstick and a kiss.' },
    { num: 971, title: 'Corpse Bride', note: 'CSM labels language and drinking "None," but its own descriptive text touches a death/decay theme.' }
  ];
  notableFindings.sensitiveContent = [
    { num: 953, title: 'Blank Check', note: 'A scene involves an adult woman kissing an 11-year-old boy.' },
    { num: 957, title: 'First Kid', note: 'Includes an online-stalker and near-abduction subplot.' }
  ];
  notableFindings.noReview = [
    { num: 963, title: 'North', note: 'No real CSM review exists despite a normal-looking catalog age; fell back to Wikipedia.' },
    { num: 946, title: 'The Land Before Time IV: Journey Through the Mists', note: 'No real CSM review, same as V and VI (nums 949, 950) -- all three are direct-to-video sequels CSM never reviewed, unlike II and III, which do have real reviews.' }
  ];

  const notesPath = path.join(REPO_ROOT, 'docs', 'content-flags-import-notes-2026-09-08.md');
  const notesLines = [];
  notesLines.push('# Content-flags import notes (2026-09-08)');
  notesLines.push('');
  notesLines.push('Generated by `scripts/import-content-flags.mjs`. Summarizes what the import script');
  notesLines.push('changed automatically, plus judgment calls worth a human look before this ships.');
  notesLines.push('');
  notesLines.push(`- Movies with real content-flag data applied: ${flagsApplied}`);
  notesLines.push(`- Catalog age (ca) upgrades applied: ${upgradesApplied}`);
  notesLines.push(`- Movies left on the keyword-heuristic fallback (no CSM review exists): ${unavailableCount}`);
  notesLines.push('');
  notesLines.push('## Scope gap discovered during this import: `data.js` was never researched');
  notesLines.push('');
  notesLines.push('`data.js` (`MOVIES_BASE`, loaded first into the app\'s global `MOVIES` list) holds 99');
  notesLines.push('live production movies, nums 1-100. This entire session\'s research effort -- both');
  notesLines.push('Codex\'s and Claude\'s passes across the other 10 data files -- never once counted or');
  notesLines.push('covered this file. Every "catalog total" figure quoted in prior handoff docs on the');
  notesLines.push('research branch (938) excluded it. The real catalog size is 1037 movies, and 99 of');
  notesLines.push('them (roughly 10%) have no research behind them at all. This import script does not');
  notesLines.push('touch `data.js`; those 99 movies keep running on the keyword/age heuristic in');
  notesLines.push('`movieContentProfile()` until a research pass covers them, same as the 26');
  notesLines.push('`csmStatus: "unavailable"` titles already handled above.');
  notesLines.push('');
  notesLines.push('## Catalog age upgrades applied');
  notesLines.push('');
  for (const u of notableFindings.upgrades) {
    notesLines.push(`- #${u.num} ${u.title}: \`${u.oldCa}\` -> \`${u.newCa}\``);
  }
  notesLines.push('');
  notesLines.push('## CSM label/detail conflicts worth a second look');
  notesLines.push('');
  for (const c of notableFindings.labelConflicts) {
    notesLines.push(`- #${c.num} ${c.title}: ${c.note}`);
  }
  notesLines.push('');
  notesLines.push('## Sensitive content worth reviewer attention');
  notesLines.push('');
  for (const s of notableFindings.sensitiveContent) {
    notesLines.push(`- #${s.num} ${s.title}: ${s.note}`);
  }
  notesLines.push('');
  notesLines.push('## Titles with no real CSM review despite a normal-looking catalog age');
  notesLines.push('');
  for (const n of notableFindings.noReview) {
    notesLines.push(`- #${n.num} ${n.title}: ${n.note}`);
  }
  notesLines.push('');
  fs.writeFileSync(notesPath, notesLines.join('\n'), 'utf8');
  console.log(`\nReviewer notes written to ${path.relative(REPO_ROOT, notesPath)}`);
}

main();
