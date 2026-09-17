// Issue #63: sw.js's fetch handler serves every same-origin GET
// stale-while-revalidate, and CACHE_VERSION (the only thing that forces a
// real service-worker reinstall) was a hand-maintained constant only bumped
// by editing sw.js itself -- a content-only commit (adding a movie) never
// touched it, so browsers with an existing SW registration never detected
// an update (they detect one by byte-diffing sw.js) and kept serving the
// previously-cached catalog for a full extra page load, with no indication
// anything was stale.
//
// Fix: fold a content hash of the data files into sw.js's CACHE_VERSION
// (via the DATA_VERSION constant) so sw.js's own bytes change whenever the
// catalog changes, independent of whether anyone remembered to touch this
// file by hand. That's a real, detectable service-worker update, which
// reinstalls the app shell (including a fresh fetch of every data-*.js
// file) the next time the browser checks -- typically on the next
// navigation.
//
// Usage:
//   node scripts/data-version.mjs          -- update sw.js in place
//   node scripts/data-version.mjs --check  -- exit 1 if sw.js is stale
//     (wired into validate-data.mjs so every normal validation run catches
//     a forgotten re-stamp; see that script)

import fs from 'node:fs';
import crypto from 'node:crypto';

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

const DATA_VERSION_PATTERN = /const DATA_VERSION = '([0-9a-f]*)';/;

export function computeDataHash() {
  const hash = crypto.createHash('sha256');
  for (const file of dataFiles) {
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex').slice(0, 10);
}

export function currentSwDataVersion(swSource) {
  const match = swSource.match(DATA_VERSION_PATTERN);
  return match ? match[1] : null;
}

function main() {
  const check = process.argv.includes('--check');
  const hash = computeDataHash();
  const sw = fs.readFileSync('sw.js', 'utf8');
  const current = currentSwDataVersion(sw);

  if (current === null) {
    console.error(`data-version: sw.js has no \`const DATA_VERSION = '...';\` to update.`);
    process.exit(1);
  }

  if (check) {
    if (current !== hash) {
      console.error(`data-version: sw.js's DATA_VERSION (${current}) is stale, data files hash to ${hash}. Run \`node scripts/data-version.mjs\` and commit the result.`);
      process.exit(1);
    }
    console.log(`data-version: sw.js is in sync with data files (${hash}).`);
    return;
  }

  if (current === hash) {
    console.log(`data-version: already in sync (${hash}).`);
    return;
  }

  const updated = sw.replace(DATA_VERSION_PATTERN, `const DATA_VERSION = '${hash}';`);
  fs.writeFileSync('sw.js', updated);
  console.log(`data-version: updated sw.js's DATA_VERSION ${current} -> ${hash}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
