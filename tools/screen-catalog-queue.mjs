import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import vm from 'node:vm';
import { dataFiles } from '../scripts/data-version.mjs';

import { catalogCacheDirectory, git, pendingQueue, readEvidence, slugPattern, writeAtomic, writeEvidence } from './catalog-evidence.mjs';
import { catalogSourceRequests } from './catalog-source-requests.mjs';
const site = 'https://www.commonsensemedia.org';
const reviewPath = /^\/(movie|tv)-reviews\/([a-z0-9-]+)\/?$/;
const categories = ['violence','sex','language','drugs'];
const excerptCategories = new Set([...categories,'message','role_model','diversity','education']);
const mediaTypes = ['Movie','TVSeries','TVEpisode','TVSeason','VideoObject'];
const { values: options } = parseArgs({ options: {
  ref: { type:'string', default:'origin/master' },
  limit: { type:'string', default:'100' },
  offset: { type:'string', default:'0' },
  cache: { type:'string' },
  'import-cache': { type:'string', multiple:true, default:[] },
  held: { type:'string', multiple:true, default:[] },
  'hold-reason': { type:'string' },
  'clear-hold': { type:'string', multiple:true, default:[] },
  'release-slug': { type:'string', multiple:true, default:[] },
  'request-budget': { type:'string', default:'1000' },
  offline: { type:'boolean' },
  help: { type:'boolean' },
}});
if (options.help) {
  console.log('Usage: node tools/screen-catalog-queue.mjs [--ref origin/master] [--limit 100] [--offset 0] [--cache DIR] [--import-cache DIR] [--held SLUG --hold-reason REASON] [--clear-hold SLUG] [--release-slug SLUG --request-budget N] [--offline]');
  process.exit(0);
}
const limit = Number(options.limit);
const offset = Number(options.offset);
if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('Use a positive integer limit and a nonnegative integer offset.');

const revision = git('rev-parse','--verify','--end-of-options',`${options.ref}^{commit}`);
const cache = catalogCacheDirectory(options.cache);
const sources = [...new Set(options['import-cache'].map(directory => path.resolve(directory)))];
const requests = catalogSourceRequests();
const held = new Set(options.held);
const releases = [...new Set(options['release-slug'])];
const budget = Number(options['request-budget']);
const reviewParserVersion = 1;
if (!Number.isSafeInteger(budget) || budget < 0 || releases.length > 15 || (releases.length && budget > 15)) {
  throw new Error('Use a nonnegative request budget. Release mode allows at most 15 nominations and requires a budget of 15 or less.');
}
for (const slug of [...held, ...options['clear-hold'], ...releases]) {
  if (!slugPattern.test(slug)) throw new Error(`Invalid catalog slug: ${slug}`);
}
const atRevision = file => git('show', `${revision}:${file}`);
const { resolved, unchecked } = pendingQueue(JSON.parse(atRevision('tools/csm-sweep-queue.json')));
const window = releases.length
  ? releases.filter(slug => !resolved.has(slug)).map(slug => ({ slug }))
  : [...unchecked.values()].slice(offset,offset+limit);
const catalog = dataFiles.flatMap(file => {
  const source = atRevision(file);
  const array = /\bconst (MOVIES_[A-Z_]+)\s*=\s*\[/.exec(source)?.[1];
  return array ? vm.runInNewContext(`${source}\n${array}`, {}, { filename:file, timeout:1000 }) : [];
});
if (!catalog.length) throw new Error(`No catalog entries found on ${revision}`);

function reviewIdentity(address) {
  if (!address) return null;
  try {
    const url = new URL(address,site);
    return url.origin === site && !url.username && !url.password && reviewPath.test(url.pathname) ? url.pathname.replace(/\/$/, '') : null;
  } catch { return null; }
}
const byReview = new Map(catalog.filter(movie => reviewIdentity(movie.srcUrl)).map(movie=>[reviewIdentity(movie.srcUrl),movie]));
const normalize = text => text.normalize('NFKD').replace(/\p{M}|[’']/gu,'').toLowerCase().replace(/&/g,' and ')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/^(a|an|the)\s+/,'');
const omit = new Set(['and','of','in','on','for','to','a','the']);
const words = text => new Set(normalize(text).split(' ').filter(word => word && !omit.has(word)));
const catalogWords = catalog.map(movie => ({movie,title:normalize(movie.t),keywords:words(movie.t)}));
function titleMatches(title) {
  const key = normalize(title);
  const target = words(title);
  return catalogWords.flatMap(({movie,title:source,keywords})=>{
    if (key && key===source) return [{num:movie.num,title:movie.t,year:movie.y,kind:'title'}];
    const common = [...target].filter(word=>keywords.has(word)).length;
    const similarity = common/(target.size+keywords.size-common);
    return common>=2 && similarity>=0.72 ? [{num:movie.num,title:movie.t,year:movie.y,kind:'keywords'}] : [];
  }).slice(0,5);
}

const entities = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',ndash:'–',mdash:'—'};
const clean = (text='') => text.replace(/&#(x[\da-f]+|\d+);|&([a-z]+);/gi,(match,number,name)=>{
  const code = number?.startsWith('x') ? parseInt(number.slice(1),16) : Number(number);
  if (Number.isInteger(code) && code>0 && code<=0x10ffff) return String.fromCodePoint(code);
  return entities[name?.toLowerCase()] ?? match;
}).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const snippet = (text,length) => text.length<=length ? text : `${text.slice(0,length).trimEnd()}…`;
function parseReview(html, fallbackUrl) {
  const nodes = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(match=>{
    try { const value=JSON.parse(match[1]); return value['@graph'] ?? (Array.isArray(value) ? value : [value]); }
    catch { return []; }
  });
  const media=nodes.find(node=>mediaTypes.includes(node?.['@type']));
  const canonical=html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1] ?? fallbackUrl;
  const title=clean(media?.name ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if (!title || !reviewIdentity(canonical) || (!media && !/\bcsm_review_target_title\b|Parents Need to Know/i.test(html))) return null;
  const age=Number(media?.audience?.suggestedMinAge ?? html.match(/"csm_review_rating_age"\s*:\s*"?(\d+)/)?.[1]);
  const scores=Object.fromEntries(categories.map(key=>[key,Number(html.match(new RegExp(`"csm_review_rating_details_${key}"\\s*:\\s*"?(\\d+)`))?.[1])]));
  const duration=/^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(media?.duration ?? '');
  const field=key=>clean(html.match(new RegExp(`<span class="detail--${key}">([\\s\\S]*?)<\\/span>`))?.[1]);
  const section=heading=>{
    const content=[...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].find(match=>heading.test(clean(match[1])));
    return content ? clean(html.slice(content.index+content[0].length).match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i)?.[1]) : '';
  };
  return {
    url:new URL(canonical,site).href, title, type:media?.['@type']??null,
    age:Number.isInteger(age)&&age>=1&&age<=18 ? age : null,
    rating:media?.contentRating??'', studio:media?.productionCompany?.name??'',
    runtimeMinutes:duration ? 60*Number(duration[1]??0)+Number(duration[2]??0) || null : null,
    release:{ theatrical:field('release-dates-theaters'), streaming:field('release-dates-dvd'), sourceDate:media?.dateCreated??'' },
    scores:Object.values(scores).every(value=>Number.isInteger(value)&&value>=0&&value<=5) ? scores : null,
    story:snippet(section(/^what.s the story\??$/i),900),
    parents:snippet(section(/^parents need to know$/i),1300),
    content:Object.fromEntries([...html.matchAll(/<div class="content-grid-content" data-text="([^"]*)">\s*<button id="content-grid-item-([a-z_]+)"/g)]
      .filter(([,text,key])=>text && excerptCategories.has(key)).map(([,text,key])=>[key,snippet(clean(text),650)])),
  };
}

let fetched=0;
let reused=0;
let stopped='';
let interrupted=false;
const results=[];
const reportKey = releases.length ? `releases-${createHash('sha256').update(releases.join('|')).digest('hex').slice(0, 12)}` : `${offset}-${limit}`;
const reportFile=path.join(cache,`screen-${revision.slice(0,10)}-${reportKey}${options.offline?'-offline':''}.json`);
const fetchUrl = slug => `${site}/movie-reviews/${slug}`;
async function fetchReview(slug, index) {
  requests.checkpoint(`catalog screen ${index+1}/${window.length}: ${slug}`);
  let url=fetchUrl(slug);
  const htmlFile=path.join(cache,`${slug}.html`);
  const temporary=`${htmlFile}.${process.pid}.download`;
  try {
    for (let redirects=0; redirects<=2; redirects++) {
      if (fetched >= budget) throw new Error(`Configured request budget reached (${fetched}/${budget}).`);
      const { status, redirect } = await requests.request(url, {
        kind: 'csm', body: temporary, interrupted: () => interrupted,
        started: () => { fetched++; },
      });
      if (/^30[1278]$/.test(status)&&reviewIdentity(redirect)&&redirects<2) { url=new URL(redirect,site).href; continue; }
      if (status!=='200') requests.block(`CSM HTTP ${status} for ${slug}`);
      const review=parseReview(fs.readFileSync(temporary,'utf8'),url);
      if (!review) requests.block(`CSM returned an unrecognized review page for ${slug}`);
      fs.renameSync(temporary,htmlFile);
      return review;
    }
  } finally { fs.rmSync(temporary,{force:true}); }
}
function cachedReview(slug, evidence) {
  if (evidence?.review?.parserVersion === reviewParserVersion && fs.existsSync(evidence.review.rawPath)) {
    const mtime = fs.statSync(evidence.review.rawPath).mtimeMs;
    if (mtime === evidence.review.mtime) return evidence.review;
  }
  const filename=`${slug}.html`;
  for (const directory of [cache,...sources]) {
    const file=path.join(directory,filename);
    if (!fs.existsSync(file)) continue;
    const html=fs.readFileSync(file,'utf8');
    const review=parseReview(html,fetchUrl(slug));
    if (!review) continue;
    const fetchedAt=fs.statSync(file).mtime.toISOString();
    if (directory!==cache) {
      const destination=path.join(cache,filename);
      writeAtomic(destination,html);
      fs.utimesSync(destination,new Date(fetchedAt),new Date(fetchedAt));
    }
    const rawPath=path.join(cache,filename);
    return {review,fetchedAt,rawPath,mtime:fs.statSync(rawPath).mtimeMs,parserVersion:reviewParserVersion};
  }
  return null;
}
async function screen(row,index) {
  const {slug}=row;
  if (!slugPattern.test(slug)) throw new Error(`Invalid queue slug ${slug}`);
  const existing=byReview.get(reviewIdentity(fetchUrl(slug)));
  if (existing) return {status:'duplicate',num:existing.num,title:existing.t};
  const evidence = readEvidence(cache, slug);
  if (evidence?.decision?.action === 'held') return {status:'held',reason:evidence.decision.reason};
  const possible=titleMatches(row.title || slug);
  const saved=cachedReview(slug,evidence);
  if (!saved && options.offline) return {status:'needs-fetch',...(possible.length ? {possible} : {})};
  if (saved) reused++;
  const review=saved?.review ?? await fetchReview(slug,index);
  const rawPath = path.join(cache, `${slug}.html`);
  const fetchedAt=saved?.fetchedAt ?? fs.statSync(rawPath).mtime.toISOString();
  if (saved !== evidence?.review || !saved) {
    writeEvidence(cache, slug, 'review', saved ?? { review, fetchedAt, rawPath, mtime: fs.statSync(rawPath).mtimeMs, parserVersion: reviewParserVersion });
  }
  const duplicate=byReview.get(reviewIdentity(review.url));
  if (duplicate) return {status:'duplicate',num:duplicate.num,title:duplicate.t};
  const source={title:review.title,url:review.url,fetchedAt,age:review.age,rating:review.rating,type:review.type};
  if (/^(R|NC[-– ]?17)$/i.test(review.rating.trim())) return {status:'ineligible',reason:'R or NC-17 rating.',...source};
  if (review.age>12) return {status:'ineligible',reason:'CSM age above 12.',...source};
  if (['TVSeries','TVSeason','TVEpisode'].includes(review.type)) return {status:'ineligible',reason:'Series, season, or episode.',...source};
  const matches=titleMatches(review.title);
  const dates=[review.release.theatrical,review.release.streaming].map(value=>Date.parse(value)).filter(Number.isFinite);
  const reasons=[];
  if (!review.age) reasons.push('No confirmed CSM age.');
  if (review.type!=='Movie') reasons.push('Film or standalone special needs verification.');
  if (!dates.length || dates.every(date=>date>Date.now())) reasons.push('Release date needs verification.');
  if (!review.scores) reasons.push('Structured CSM scores unavailable.');
  if (!review.parents || !Object.keys(review.content).length) reasons.push('Review excerpts need manual verification.');
  if (matches.length) reasons.push('Possible catalog match.');
  return {status:reasons.length?'review-metadata':'editorial-candidate',reasons,...review,fetchedAt,possible:matches};
}
function summarize() {
  const counts={};
  for (const row of results) counts[row.status]=(counts[row.status]??0)+1;
  const report={revision,offset,limit,unchecked:unchecked.size,window:window.length,processed:results.length,fetched,reused,counts,stopped:stopped||null,results};
  return report;
}

fs.mkdirSync(cache,{recursive:true,mode:0o700});
try {
  if (!options.offline) requests.enter();
  for (const slug of held) {
    if (readEvidence(cache, slug)?.decision?.action === 'held' && !options['hold-reason']) continue;
    writeEvidence(cache, slug, 'decision', { action: 'held', at: new Date().toISOString(), reason: options['hold-reason']?.trim() || 'Previously held for editorial review.' });
  }
  for (const slug of options['clear-hold']) {
    writeEvidence(cache, slug, 'decision', { action: 'cleared', at: new Date().toISOString() });
  }
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{interrupted=true;});
  for (const [index,row] of window.entries()) {
    if (interrupted) throw new Error('Interrupted before the next candidate.');
    const result=await screen(row,index);
    const screened = {slug:row.slug,...result};
    if (result.status !== 'needs-fetch' || readEvidence(cache, row.slug)?.screen) writeEvidence(cache, row.slug, 'screen', { revision, checkedAt: new Date().toISOString(), row: screened });
    results.push(screened);
    if (!options.offline) console.log(`${index+1}/${window.length} ${row.slug} ${result.status}`);
  }
} catch (error) {
  stopped=error.message;
  console.error(stopped);
  process.exitCode=2;
} finally {
  requests.close();
}
const report = summarize();
writeAtomic(reportFile,`${JSON.stringify(report,null,2)}\n`);
const {results:rows,...summary}=report;
const packetFile=reportFile.replace(/\.json$/,'-next-15.json');
const packet=rows.filter(row=>['editorial-candidate','review-metadata'].includes(row.status)).slice(0,15);
writeAtomic(packetFile,`${JSON.stringify({revision,offset,complete:rows.length===window.length&&!stopped,results:packet},null,2)}\n`);
console.log(JSON.stringify({...summary,reportFile,packetFile},null,2));
