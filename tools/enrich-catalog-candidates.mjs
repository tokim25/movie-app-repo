import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { catalogCacheDirectory, readEvidence, readJson, slugPattern, writeEvidence } from './catalog-evidence.mjs';
import { catalogSourceRequests } from './catalog-source-requests.mjs';

const wikiOrigin = 'https://en.wikipedia.org';
const imageOrigin = 'https://upload.wikimedia.org';
const entities = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', ndash: '–', mdash: '—', eacute: 'é' };
const decode = text => text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (match, entity) => {
  const value = entity[0] === '#' ? Number(entity[1].toLowerCase() === 'x' ? `0${entity.slice(1)}` : entity.slice(1)) : NaN;
  if (Number.isInteger(value) && value > 0 && value <= 0x10ffff) return String.fromCodePoint(value);
  return entities[entity] ?? match;
});
const clean = text => decode(text.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const normalize = name => name.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replaceAll('&', 'and').replace(/[^\p{L}\p{N}]/gu, '');

function attribute(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return decode(match?.[1] ?? match?.[2] ?? '');
}

function infobox(html) {
  const opening = [...html.matchAll(/<table\b[^>]*>/gi)].find(match => attribute(match[0], 'class').split(/\s+/).includes('infobox'));
  if (!opening) return '';
  let depth = 0;
  for (const tag of html.slice(opening.index).matchAll(/<\/?table\b[^>]*>/gi)) {
    depth += tag[0][1] === '/' ? -1 : 1;
    if (!depth) return html.slice(opening.index, opening.index + tag.index + tag[0].length);
  }
  return '';
}

function articleUrl(title) {
  return `${wikiOrigin}/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
}

function pageTitle(url) {
  const parsed = new URL(url);
  if (parsed.origin !== wikiOrigin || parsed.username || parsed.password || !parsed.pathname.startsWith('/wiki/') || parsed.search || parsed.hash) return null;
  return decodeURIComponent(parsed.pathname.slice('/wiki/'.length)).replaceAll('_', ' ');
}

export function extractWikipediaFilm(html, url, nomination) {
  if (!/<(?:div|main)\b[^>]*\bid=["'](?:mw-content-text|content)["']/i.test(html) || !/\bid=["']firstHeading["']/i.test(html)) return null;
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].find(match => attribute(match[0], 'rel') === 'canonical');
  const canonicalUrl = new URL(canonicalTag ? attribute(canonicalTag[0], 'href') : url, wikiOrigin).href;
  const page = pageTitle(canonicalUrl);
  if (!page) return null;
  const box = infobox(html);
  const heading = clean(html.match(/<h1\b[^>]*\bid=["']firstHeading["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const caption = clean(box.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1] ?? box.match(/<th\b[^>]*class=["'][^"']*\binfobox-above\b[^"']*["'][^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? '');
  const rows = [...box.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) => ({
    label: clean(row.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? '').toLowerCase(),
    html: row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? '',
  }));
  const field = pattern => rows.find(row => pattern.test(row.label))?.html ?? '';
  const release = clean(field(/^(?:original )?(?:release dates?|air dates?|released|original release)$/));
  const years = [...new Set(release.match(/\b(?:19|20)\d{2}\b/g) ?? [])];
  const title = caption || heading.replace(/\s+\([^()]+\)$/, '');
  const results = { pageTitle: page, url: canonicalUrl, title, release, year: years[0] ?? null, runtimeMinutes: null, studios: [], poster: null };
  if (!box || !title || normalize(title) !== normalize(nomination.title) || years[0] !== String(nomination.year)) {
    return { ...results, status: 'needs-review', reason: 'Wikipedia infobox could not confirm the nominated film title and first release year.' };
  }
  const runtime = clean(field(/^running time$|^runtime$/));
  const runtimeMatch = /^(\d{1,3})\s*(?:minutes?|mins?\.?)(?:\s.*)?$/i.exec(runtime);
  results.runtimeMinutes = runtimeMatch && !/\d/.test(runtime.slice(runtimeMatch[1].length)) ? Number(runtimeMatch[1]) || null : null;
  const credits = field(/^production compan(?:y|ies)$/) || field(/^distributed by$/);
  results.studios = [...new Set(credits.split(/<\/li\s*>|<br\b[^>]*>/i).map(clean).filter(Boolean))];
  const imageRow = [...box.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].find(match => attribute(match[0].slice(0, match[0].indexOf('>') + 1), 'class').split(/\s+/).includes('infobox-image'));
  const image = imageRow?.[1].match(/<img\b[^>]*>/i)?.[0];
  if (image) {
    const src = attribute(image, 'src');
    const candidate = src ? new URL(src, wikiOrigin) : null;
    const w = Number(attribute(image, 'width'));
    const h = Number(attribute(image, 'height'));
    if (candidate?.origin === imageOrigin && !candidate.search && !candidate.hash && !candidate.username && !candidate.password &&
        Number.isSafeInteger(w) && Number.isSafeInteger(h) && w > 0 && h > 0) {
      results.poster = { u: candidate.href, w, h, p: page };
    }
  }
  return { ...results, status: 'complete', posterFinding: results.poster ? 'Infobox image found' : 'No usable infobox image found' };
}

export function hasVerifiedImageHeaders(headers) {
  const response = headers.trim().split(/\r?\n\r?\n/).at(-1);
  return /^HTTP\/(?:1\.1|2) 200\b/i.test(response) && /^content-type:\s*image\//im.test(response);
}

async function main() {
  const { values: options } = parseArgs({ options: { input: { type: 'string' }, cache: { type: 'string' }, offline: { type: 'boolean' }, help: { type: 'boolean' } } });
  if (options.help || !options.input) {
    console.log('Usage: node tools/enrich-catalog-candidates.mjs --input nominations.json [--cache DIR] [--offline]');
    process.exitCode = options.help ? 0 : 1;
    return;
  }
  const input = readJson(options.input);
  if (!Array.isArray(input) || !input.length || input.length > 15) throw new Error('Nominate between 1 and 15 films.');
  const cache = catalogCacheDirectory(options.cache);
  const seen = new Set();
  const nominations = input.map(item => {
    if (!item || !slugPattern.test(item.slug ?? '') || seen.has(item.slug) ||
        typeof item.wikipediaTitle !== 'string' || !item.wikipediaTitle.trim()) throw new Error('Each nomination needs a unique slug and Wikipedia article title.');
    const row = readEvidence(cache, item.slug)?.screen?.row;
    if (!row || !['editorial-candidate', 'review-metadata'].includes(row.status) || !row.title || (item.title && normalize(row.title) !== normalize(item.title))) {
      throw new Error(`Screen an eligible CSM review for ${item.slug} before nominating a Wikipedia page.`);
    }
    const csmYears = [...new Set([row.release?.theatrical, row.release?.streaming].flatMap(date => date?.match(/\b(?:19|20)\d{2}\b/g) ?? []))];
    const year = item.year ?? (csmYears.length === 1 ? csmYears[0] : null);
    if (!/^(?:19|20)\d{2}$/.test(String(year))) throw new Error(`Supply the expected release year for ${item.slug}.`);
    seen.add(item.slug);
    return { ...item, title: row.title, year };
  });
  const requests = catalogSourceRequests();
  const results = [];
  let fetched = 0;
  let interrupted = false;
  const output = { fetched: 0, results, stopped: null };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { interrupted = true; });
  try {
    if (!options.offline) requests.enter();
    for (const item of nominations) {
      const { slug, title, year, wikipediaTitle } = item;
      const cacheKey = JSON.stringify([title, String(year), wikipediaTitle]);
      const directory = path.join(cache, 'wikipedia', slug);
      const rawPath = path.join(directory, 'article.html');
      const headers = path.join(directory, 'poster.headers');
      let stage = readEvidence(cache, slug)?.wikipedia;
      if (stage?.cacheKey !== cacheKey) stage = null;
      if (stage?.status === 'complete' && stage.poster && (!fs.existsSync(stage.posterHeaders) || !hasVerifiedImageHeaders(fs.readFileSync(stage.posterHeaders, 'utf8')))) {
        stage = { ...stage, status: 'poster-pending', posterCandidate: stage.poster, poster: null };
      }
      if (options.offline || ['complete', 'needs-review'].includes(stage?.status)) {
        results.push({ slug, status: stage?.status ?? 'needs-fetch', ...(stage?.reason ? { reason: stage.reason } : {}) });
        continue;
      }
      requests.checkpoint(`catalog Wikipedia: ${slug}`);
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const started = () => { fetched++; };
      if (!stage) {
        let url = articleUrl(wikipediaTitle);
        const temporary = `${rawPath}.${process.pid}.download`;
        try {
          for (let redirects = 0; ; redirects++) {
            const response = await requests.request(url, { kind: 'wikipedia', body: temporary, interrupted: () => interrupted, started });
            if (/^30[1278]$/.test(response.status) && response.redirect && pageTitle(response.redirect) && redirects < 2) {
              url = response.redirect;
              continue;
            }
            if (response.status !== '200') requests.block(`Wikipedia HTTP ${response.status} for ${slug}`);
            break;
          }
          const evidence = extractWikipediaFilm(fs.readFileSync(temporary, 'utf8'), url, item);
          if (!evidence) requests.block(`Wikipedia returned an unrecognized article for ${slug}`);
          fs.renameSync(temporary, rawPath);
          const { poster, ...verified } = evidence;
          stage = { ...verified, cacheKey, rawPath, checkedAt: new Date().toISOString(), poster: null, posterCandidate: poster,
            status: poster ? 'poster-pending' : evidence.status };
          writeEvidence(cache, slug, 'wikipedia', stage);
        } finally {
          fs.rmSync(temporary, { force: true });
        }
      }
      if (stage.status === 'poster-pending') {
        const temporary = `${headers}.${process.pid}.download`;
        const poster = stage.posterCandidate;
        try {
          const response = await requests.request(poster.u, { kind: 'poster', body: '/dev/null', headers: temporary, head: true, interrupted: () => interrupted, started });
          if (response.status !== '200' || !hasVerifiedImageHeaders(fs.readFileSync(temporary, 'utf8'))) requests.block(`Wikimedia did not return HTTP 200 image headers for ${slug} (${response.status})`);
          fs.renameSync(temporary, headers);
          stage = { ...stage, status: 'complete', poster, posterHeaders: headers, posterCheckedAt: new Date().toISOString() };
          writeEvidence(cache, slug, 'wikipedia', stage);
        } finally {
          fs.rmSync(temporary, { force: true });
        }
      }
      results.push({ slug, status: stage.status, ...(stage.reason ? { reason: stage.reason } : {}) });
    }
  } catch (error) {
    output.stopped = error.message;
    process.exitCode = 2;
  } finally {
    requests.close();
  }
  console.log(JSON.stringify({ ...output, fetched }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(error => { console.error(error.message); process.exitCode = 2; });
}
