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

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${movies.length} movies and ${posterKeys.length} poster entries.`);
