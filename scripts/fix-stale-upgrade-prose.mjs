#!/usr/bin/env node
// One-off fix: 3 of the 23 catalog-age upgrades applied by
// scripts/import-content-flags.mjs had `full` description text that still
// read like the old "Not on CSM; substitute source used" fallback, even
// though `ca`/`flags` were correctly upgraded to real CSM data. The other 20
// upgrades (mostly "(approximate)" cases) already had accurate prose and are
// untouched. See docs/content-flags-import-notes-2026-09-08-base.md for the
// full background. Run once; not a permanent pipeline.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// Grounded strictly in each entry's real research data (flags.*.summary /
// handoffNotes) on research/backfill-audit-20260907-codex, written in this
// catalog's existing house style: a short frame, "Concerns:", "Positive:".
const FIXES = {
  42: {
    file: 'data.js',
    full: "This filmed 2000 stage production (the Cathy Rigby Broadway musical) has a full Common Sense Media review. Concerns: staged battles among pirates, Native Americans, and children; Peter being wounded; Captain Hook's self-sacrificial leap to the crocodile; and dated Native American stereotyping plus Wendy's gendered caregiving role, both worth a parent's conversation. Positive: imagination, bravery, friendship, and the bittersweet theme of growing up."
  },
  276: {
    file: 'data-disney.js',
    full: 'Dark Disney fantasy adventure with real peril: frightening creatures, skeleton imagery, repeated mortal danger, and a temporary self-sacrifice death drive much of the story. A brief witch-seduction gag adds some body-focused comedy, and minor drunken behavior appears among the villain\'s followers. No meaningful language concern. Positive: courage, self-sacrifice, and standing up to evil even when afraid.'
  },
  546: {
    file: 'data-nickelodeon.js',
    full: "A group of kids scheme to keep their snow day going by sabotaging the town's snowplow driver, while a teen tries to win over his high school crush. Concerns are mild: comic peril like pelting the principal with snowballs and confronting the plow driver, some playground language and potty humor, and a few teen kisses. No drinking, drugs, or smoking. Positive: a lighthearted, low-stakes family comedy about friendship and first crushes."
  }
};

const OLD_STALE_MARKERS = [
  'does not have a dedicated Common Sense Media movie review',
  'does not have a dedicated Common Sense Media review',
  'Common Sense Media has not reviewed this specific 2000 film'
];

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

const byFile = new Map();
for (const [num, fix] of Object.entries(FIXES)) {
  if (!byFile.has(fix.file)) byFile.set(fix.file, []);
  byFile.get(fix.file).push({ num: Number(num), full: fix.full });
}

let fixedCount = 0;
for (const [file, fixes] of byFile) {
  const { full, prefix, movies } = loadDataFile(file);
  for (const { num, full: newFull } of fixes) {
    const movie = movies.find(m => m.num === num);
    if (!movie) throw new Error(`num ${num} not found in ${file}`);
    const wasStale = OLD_STALE_MARKERS.some(marker => movie.full.includes(marker));
    if (!wasStale) {
      throw new Error(`num ${num} (${movie.t}) in ${file} doesn't contain an expected stale marker -- aborting, this fix may no longer apply cleanly`);
    }
    movie.full = newFull;
    fixedCount++;
    console.log(`Fixed #${num} ${movie.t} (${file})`);
  }
  writeDataFile(full, prefix, movies);
}

console.log(`\nDone. ${fixedCount} of ${Object.keys(FIXES).length} expected fixes applied.`);
if (fixedCount !== Object.keys(FIXES).length) {
  throw new Error('Fixed count does not match expected -- investigate before committing.');
}
