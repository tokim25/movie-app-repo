import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import vm from 'node:vm';
import { dataFiles } from '../scripts/data-version.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://www.commonsensemedia.org';
const slugPattern = /^[a-z0-9-]+$/;
const reviewPath = /^\/(movie|tv)-reviews\/([a-z0-9-]+)\/?$/;
const interval = 7100;
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
  offline: { type:'boolean' },
  help: { type:'boolean' },
}});
if (options.help) {
  console.log('Usage: node tools/screen-catalog-queue.mjs [--ref origin/master] [--limit 100] [--offset 0] [--cache DIR] [--import-cache DIR] [--held SLUG] [--offline]');
  process.exit(0);
}
const limit = Number(options.limit);
const offset = Number(options.offset);
if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('Use a positive integer limit and a nonnegative integer offset.');

const git = (...args) => execFileSync('git', args, { cwd:repo, encoding:'utf8', maxBuffer:16*1024*1024 }).trimEnd();
const revision = git('rev-parse','--verify','--end-of-options',`${options.ref}^{commit}`);
const mainWorktree = path.dirname(git('rev-parse','--path-format=absolute','--git-common-dir'));
const cache = path.resolve(options.cache ?? path.join(mainWorktree,'.scratch-csm-cache'));
const sources = [...new Set(options['import-cache'].map(directory => path.resolve(directory)))];
const rateState = path.resolve(process.env.CSM_RATE_STATE_FILE || path.join(mainWorktree,'.csm-rate-state.json'));
const guardEnv = {...process.env, CSM_RATE_STATE_FILE:rateState};
const held = new Set(options.held);
const atRevision = file => git('show', `${revision}:${file}`);
const queue = JSON.parse(atRevision('tools/csm-sweep-queue.json'));
const resolved = new Set([...queue.done,...queue.skipped.map(row=>row.slug)]);
const unchecked = new Map();
for (const row of [...queue.read,...queue.candidates]) {
  if (!resolved.has(row.slug) && !unchecked.has(row.slug)) unchecked.set(row.slug,row);
}
const window = [...unchecked.values()].slice(offset,offset+limit);
const catalog = dataFiles.flatMap(file => {
  const source = atRevision(file);
  const array = /\bconst (MOVIES_[A-Z_]+)\s*=\s*\[/.exec(source)?.[1];
  return array ? vm.runInNewContext(`${source}\n${array}`, {}, { filename:file, timeout:1000 }) : [];
});
if (!catalog.length) throw new Error(`No catalog entries found on ${revision}`);

function reviewSlug(address) {
  if (!address) return null;
  try {
    const url = new URL(address,site);
    return url.origin === site ? reviewPath.exec(url.pathname)?.[2] ?? null : null;
  } catch { return null; }
}
const bySlug = new Map(catalog.filter(movie => reviewSlug(movie.srcUrl)).map(movie=>[reviewSlug(movie.srcUrl),movie]));
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
  if (!title || !reviewSlug(canonical) || (!media && !/\bcsm_review_target_title\b|Parents Need to Know/i.test(html))) return null;
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

function writeAtomic(file,data) {
  const temporary=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary,data);
  fs.renameSync(temporary,file);
}
function guard(verb,...args) {
  const result=spawnSync(process.execPath,['scripts/csm-rate-guard.mjs',verb,...args],{cwd:repo,env:guardEnv,encoding:'utf8'});
  if (result.status!==0) throw new Error((result.stderr||result.error?.message||`Cannot ${verb} rate guard`).trim());
}
let fetched=0;
let reused=0;
let stopped='';
let interrupted=false;
const results=[];
const reportFile=path.join(cache,`screen-${revision.slice(0,10)}-${offset}-${limit}${options.offline?'-offline':''}.json`);
const lastRequest=path.join(path.dirname(rateState),`.scratch-${path.basename(rateState)}-last-request`);
const lock=`${rateState}.screen.lock`;
function enterLock() {
  try { fs.writeFileSync(lock,String(process.pid),{flag:'wx'}); }
  catch (error) {
    if (error.code!=='EEXIST') throw error;
    const owner=Number(fs.readFileSync(lock,'utf8'));
    if (!Number.isInteger(owner) || owner<=0) throw error;
    try { process.kill(owner,0); }
    catch (probe) {
      if (probe.code!=='ESRCH') throw probe;
      fs.unlinkSync(lock);
      fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
      return;
    }
    throw new Error(`A catalog screen is already running (PID ${owner}).`);
  }
}
function block(message) {
  guard('signal-block',message);
  throw new Error(message);
}
const fetchUrl = slug => `${site}/movie-reviews/${slug}`;
async function fetchReview(slug, index) {
  guard('checkpoint',`catalog screen ${index+1}/${window.length}: ${slug}`);
  let url=fetchUrl(slug);
  const htmlFile=path.join(cache,`${slug}.html`);
  const temporary=`${htmlFile}.${process.pid}.download`;
  try {
    for (let redirects=0; redirects<=2; redirects++) {
      const last=fs.existsSync(lastRequest) ? Number(fs.readFileSync(lastRequest,'utf8')) : 0;
      await setTimeout(Math.max(0,interval+last-Date.now()));
      if (interrupted) throw new Error('Interrupted before the next source request.');
      guard('acquire');
      writeAtomic(lastRequest,String(Date.now()));
      fetched++;
      saveReport();
      const response=spawnSync('curl',['--silent','--show-error','--compressed','--connect-timeout','12','--max-time','28',
        '--user-agent','movie-catalog-research/1.0','--output',temporary,'--write-out','%{http_code}\n%{redirect_url}',url],{encoding:'utf8'});
      if (response.status!==0) throw new Error(`Transport error for ${slug}: ${response.stderr || response.error?.message}`);
      const [status,redirect]=response.stdout.trim().split('\n');
      if (/^30[1278]$/.test(status)&&reviewSlug(redirect)&&redirects<2) { url=new URL(redirect,site).href; continue; }
      if (status!=='200') block(`CSM HTTP ${status} for ${slug}`);
      const review=parseReview(fs.readFileSync(temporary,'utf8'),url);
      if (!review) block(`CSM returned an unrecognized review page for ${slug}`);
      fs.renameSync(temporary,htmlFile);
      return review;
    }
  } finally { fs.rmSync(temporary,{force:true}); }
}
function cachedReview(slug) {
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
    return {review,fetchedAt};
  }
  return null;
}
async function screen(row,index) {
  const {slug}=row;
  if (!slugPattern.test(slug)) throw new Error(`Invalid queue slug ${slug}`);
  const existing=bySlug.get(slug);
  if (existing) return {status:'duplicate',num:existing.num,title:existing.t};
  if (held.has(slug)) return {status:'held',reason:'Previously held for editorial review.'};
  const possible=titleMatches(row.title || slug);
  const saved=cachedReview(slug);
  if (!saved && options.offline) return {status:'needs-fetch',...(possible.length ? {possible} : {})};
  if (saved) reused++;
  const review=saved?.review ?? await fetchReview(slug,index);
  const fetchedAt=saved?.fetchedAt ?? new Date().toISOString();
  const duplicate=bySlug.get(reviewSlug(review.url));
  if (duplicate) return {status:'duplicate',num:duplicate.num,title:duplicate.t};
  const source={title:review.title,url:review.url,fetchedAt,age:review.age,rating:review.rating,type:review.type};
  if (/^(R|NC[-– ]?17)$/i.test(review.rating.trim())) return {status:'ineligible',reason:'R or NC-17 rating.',...source};
  if (review.age>12) return {status:'ineligible',reason:'CSM age above 12.',...source};
  if (['TVSeries','TVSeason'].includes(review.type)) return {status:'ineligible',reason:'Series or season.',...source};
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
function saveReport() {
  const counts={};
  for (const row of results) counts[row.status]=(counts[row.status]??0)+1;
  const report={revision,offset,limit,unchecked:unchecked.size,window:window.length,processed:results.length,fetched,reused,counts,stopped:stopped||null,results};
  writeAtomic(reportFile,`${JSON.stringify(report,null,2)}\n`);
  return report;
}

fs.mkdirSync(cache,{recursive:true,mode:0o700});
let locked=false;
try {
  if (!options.offline) { enterLock(); locked=true; }
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{interrupted=true;});
  for (const [index,row] of window.entries()) {
    if (interrupted) throw new Error('Interrupted before the next candidate.');
    const result=await screen(row,index);
    results.push({slug:row.slug,...result});
    saveReport();
    if (!options.offline) console.log(`${index+1}/${window.length} ${row.slug} ${result.status}`);
  }
} catch (error) {
  stopped=error.message;
  console.error(stopped);
  process.exitCode=2;
} finally {
  if (locked) fs.rmSync(lock,{force:true});
}
const {results:_rows,...summary}=saveReport();
console.log(JSON.stringify({...summary,reportFile},null,2));
