import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import vm from 'node:vm';
import { dataFiles } from '../scripts/data-version.mjs';
import { deriveFlags, holdReason } from '../scripts/flag-rule.mjs';

const {values:options}=parseArgs({options:{
  manifest:{type:'string'}, output:{type:'string'}, apply:{type:'boolean'}, help:{type:'boolean'},
}});
if (options.help || !options.manifest || !options.output) {
  console.log('Usage from the target titles worktree: node /path/to/tools/prepare-catalog-batch.mjs --manifest reviewed.json --output DIR [--apply]');
  process.exit(options.help ? 0 : 1);
}
const read=file=>fs.readFileSync(file,'utf8');
const str=JSON.stringify;
const manifest=JSON.parse(read(options.manifest));
const {date,entries,skipped=[],held=[],possibleLists=[]}=manifest;
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const slugPattern=/^[a-z0-9-]+$/;
const queueFile='tools/csm-sweep-queue.json';
const queue=JSON.parse(read(queueFile));
const order=new Map();
for (const {slug} of [...queue.read,...queue.candidates]) if (!order.has(slug)) order.set(slug,order.size);
const resolved=new Set([...queue.done,...queue.skipped.map(item=>item.slug)]);
const context=vm.createContext({});
for (const file of dataFiles) vm.runInContext(read(file),context,{filename:file});
const evaluate=expression=>JSON.parse(str(vm.runInContext(expression,context)));
const movieArrays=dataFiles.map(read).flatMap(text=>/\bconst (MOVIES_[A-Z_]+)\s*=\s*\[/.exec(text)?.[1]??[]);
const catalog=evaluate(`[${movieArrays.join(',')}].flat()`);
const lists=evaluate('MOVIE_LISTS');
const listNames=new Map(lists.map(list=>[list.id,list.name]));
const normalized=title=>title.normalize('NFKD').replace(/\p{M}|[’']/gu,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const titleKey=movie=>`${normalized(movie.t)} (${movie.y})`;
const titleKeys=new Set(catalog.map(titleKey));
const sourceSlugs=new Set(catalog.map(movie=>/\/movie-reviews\/([a-z0-9-]+)\/?(?:[?#]|$)/.exec(movie.srcUrl??'')?.[1]).filter(Boolean));
const prerequisiteMovies=new Map(catalog.map(movie=>[movie.num,movie]));
const firstNum=Math.max(...catalog.map(movie=>movie.num))+1;
assert(catalog.length && datePattern.test(date) && Array.isArray(entries) && entries.length>0 && entries.length<=15);

function reserve(slug) {
  assert(slugPattern.test(slug)&&!resolved.has(slug),`Already resolved or invalid slug ${slug}`);
  resolved.add(slug);
}
let lastPosition=-1;
let inBacklog=false;
const batch=entries.map((entry,index)=>{
  const {slug,t,genre,studio,runtimeMinutes,runtimeSourceId,srcUrl,rating,csm,reviewDate,pins=[],poster,predecessor,bumps={}}=entry;
  const y=String(entry.y);
  reserve(slug);
  const source=new URL(srcUrl);
  const sourceSlug=/^\/movie-reviews\/([a-z0-9-]+)\/?$/.exec(source.pathname)?.[1];
  assert(source.origin==='https://www.commonsensemedia.org'&&sourceSlug,`Missing exact CSM review for ${t}`);
  assert(!sourceSlugs.has(slug)&&!sourceSlugs.has(sourceSlug)&&!titleKeys.has(titleKey({t,y})),`Already cataloged: ${t}`);
  assert(typeof t==='string'&&t.trim()&&/^\d{4}$/.test(y)&&Array.isArray(genre)&&typeof studio==='string'&&studio.trim());
  assert(Number.isInteger(runtimeMinutes)&&runtimeMinutes>0&&/^(?:wikipedia|commonsensemedia):.+$/.test(runtimeSourceId));
  assert(Number.isInteger(csm.age)&&csm.age>=1&&csm.age<=12&&datePattern.test(reviewDate));
  assert(typeof rating==='string'&&!/^(R|NC[-– ]?17)$/i.test(rating.trim()),`Ineligible rating for ${t}`);
  for (const key of ['v','s','l','d']) assert(Number.isInteger(csm[key])&&csm[key]>=0&&csm[key]<=5);
  assert(entry.full.trim()&&!entry.full.includes('—')&&!entry.full.includes('Common Sense Media recommends it for ages'));
  if (entry.newRelease) assert(!inBacklog,'New releases must come first.');
  else {
    inBacklog=true;
    const position=order.get(slug);
    assert(Number.isInteger(position)&&position>lastPosition,`Backlog order for ${slug}`);
    lastPosition=position;
  }
  const num=firstNum+index;
  const age=`${csm.age}+`;
  const full=`${entry.full.trim()} Common Sense Media recommends it for ages ${csm.age} and up.`;
  const movie={num,t,y,la:age,ca:age,full,srcUrl,addedAt:date,addedVia:'discovery',source:'EXTRA',genre,studio,runtimeMinutes,runtimeSourceId,runtimeVerifiedAt:date};
  titleKeys.add(titleKey(movie));
  sourceSlugs.add(slug);
  sourceSlugs.add(sourceSlug);
  const concerns=Object.fromEntries(['parentInDanger','scaryVillain','sadOrLoss','rudeHumor','animalPeril'].map(key=>{
    const [level,quote]=entry.concerns?.[key]??['no',''];
    assert(['yes','mild','no'].includes(level)&&(level==='no'?quote==='':quote&&full.includes(quote)),`Invalid guidance quote for ${t} / ${key}`);
    return [key,{level,quote}];
  }));
  if (entry.watch) assert(entry.watch.length===2&&entry.watch.every(text=>typeof text==='string'&&text.trim())&&entry.ask?.trim());
  const preShow=entry.watch ? [
    'root = Card([hdr, watch, after])',
    `hdr = CardHeader(${str(`${t} · ${y}`)}, ${str(`${studio} · ${runtimeMinutes} min · CSM ${age}`)})`,
    `watch = Callout("warning", ${entry.watch.map(text=>str(text)).join(', ')})`,
    `after = TextContent(${str(`Ask after: ${entry.ask}`)}, "small")`,
  ].join('\n') : 'root = Card([note])\nnote = TextContent("Gentle. Nothing to prep for.", "small")';
  assert(pins.every(id=>listNames.has(id))&&new Set(pins).size===pins.length,`Invalid list pins for ${t}`);
  const prior=predecessor===undefined ? undefined : prerequisiteMovies.get(predecessor);
  assert(predecessor===undefined || prior,`Unknown prior film for ${t}`);
  prerequisiteMovies.set(num,movie);
  if (poster) {
    const url=new URL(poster.u);
    assert(url.origin==='https://upload.wikimedia.org'&&!url.search&&poster.p&&Number.isInteger(poster.w)&&poster.w>0&&Number.isInteger(poster.h)&&poster.h>0);
    const headers=read(path.resolve(path.dirname(options.manifest),entry.posterHeaders));
    assert(/^HTTP\/(?:2|1\.1) 200\b/m.test(headers)&&/^content-type: image\//im.test(headers),`Unverified poster headers for ${t}`);
  }
  const hold=holdReason(csm);
  for (const [category,bump] of Object.entries(bumps)) {
    assert(!hold&&['violence','language','romance','drinking'].includes(category)&&bump.quote.length>=20&&full.includes(bump.quote)&&bump.why.trim().length>=10,`Invalid flag adjustment for ${t}`);
  }
  return {movie,slug,pins,poster,prior,guidance:{concerns,preShow},flag:{num,on:reviewDate,csm,bumps},hold};
});
for (const item of skipped) { reserve(item.slug); assert(order.has(item.slug)&&item.reason?.trim()); }
queue.done.push(...batch.map(row=>row.slug));
queue.skipped.push(...skipped.map(({slug,reason})=>({slug,reason})));
const remaining=Array.from(order.keys()).filter(slug=>!resolved.has(slug)).length;
const edits=new Map();
const extra=read('data-extra.js');
const [,prefix,raw]=/^(const MOVIES_EXTRA = )(\[[\s\S]*\]);\n$/.exec(extra);
const existing=JSON.parse(raw);
assert.equal(str(existing),raw);
edits.set('data-extra.js',`${prefix}${str([...existing,...batch.map(row=>row.movie)])};\n`);

function appendObject(file,ending,rows,trailingComma) {
  if (!rows.length) return;
  const old=read(file);
  assert(old.endsWith(ending));
  const start=old.slice(0,-ending.length);
  edits.set(file,`${start}${start.endsWith(',')?'':','}\n${rows.join(',\n')}${trailingComma?',':''}${ending}`);
}
appendObject('data-guidance.js','\n};\n',batch.map(({movie,guidance})=>`  "${movie.num}": ${str(guidance)}`),false);
appendObject('data-posters.js','\n});\n',batch.filter(row=>row.poster).map(({movie,poster})=>`  ${movie.num}: ${str(poster)}`),true);
const series=batch.filter(row=>row.prior).map(({movie,prior})=>`  ${movie.num}: ${prior.num}, // ${movie.t} (${movie.y}) <- ${prior.t} (${prior.y})`);
if (series.length) {
  const old=read('data-series.js');
  assert(old.endsWith('\n});\n'));
  edits.set('data-series.js',old.replace(/\n\}\);\n$/,`\n${series.join('\n')}\n});\n`));
}
let listText=read('data-lists.js');
for (const {movie,pins} of batch) for (const id of pins) {
  const pinList=new RegExp(`(id: '${id}',(?:(?!\\bid:).)*?\\bpins: \\[)([^\\]]*)(\\])`,'s');
  assert(pinList.test(listText),`Cannot find pins for ${id}`);
  listText=listText.replace(pinList,(_all,before,current,after)=>`${before}${current.trim()?`${current}, `:''}${movie.num}${after}`);
}
if (batch.some(row=>row.pins.length)) edits.set('data-lists.js',listText);
edits.set(queueFile,`${str(queue,null,1)}\n`);
for (const [file,contents] of edits) if (file.endsWith('.js')) new vm.Script(contents,{filename:file});

const output=path.resolve(options.output);
fs.mkdirSync(output,{recursive:true});
const write=(file,lines)=>fs.writeFileSync(path.join(output,file),`${lines.join('\n')}\n`);
write('flags.json',[str(batch.map(row=>row.flag),null,2)]);
write('titles-table.md',[
  '| Num | Title | Year | CSM age | Runtime | Studio | Curated lists | Poster |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...batch.map(({movie,pins,poster})=>`| ${movie.num} | ${movie.t} | ${movie.y} | ${movie.ca} | ${movie.runtimeMinutes} min | ${movie.studio} | ${pins.map(id=>listNames.get(id)).join(', ')||'—'} | ${poster?'Yes':'No'} |`),
  '', '## Held and skipped', '', ...[...held,...skipped].map(item=>`- **${item.title||item.slug}.** ${item.reason}`),
  '', '## Possible list fits', '', ...possibleLists.map(item=>`- **${item.title}** could fit **${listNames.get(item.list)||item.list}**. ${item.reason}`),
]);
write('flags-table.md',[
  '| Num | Title | CSM age | CSM V / S / L / D | App violence / language / romance / drinking |',
  '| --- | --- | --- | --- | --- |',
  ...batch.map(({movie,flag,hold})=>`| ${movie.num} | ${movie.t} | ${movie.ca} | ${['v','s','l','d'].map(key=>flag.csm[key]).join(' / ')} | ${hold?'Held':Object.values(deriveFlags(flag.csm,flag.bumps)).join(' / ')} |`),
  '', ...batch.flatMap(({movie,flag,hold})=>hold?[`- **${movie.t}** is held due to ${hold}.`]:Object.entries(flag.bumps).map(([name,bump])=>`- **${movie.t}** (${name}). “${bump.quote}” ${bump.why}`)),
]);
write('batch-log.md',[
  `${date} (Codex catalog batch) — Added ${batch.length} titles, nums ${firstNum}–${firstNum+batch.length-1}.`, '',
  ...batch.map(({movie,poster})=>`- ${movie.num} ${movie.t} (${movie.y}), CSM ${movie.ca}, ${movie.runtimeMinutes} min, ${movie.studio}. Poster ${poster?'verified':'unavailable'}.`),
  '', ...[...held,...skipped].map(item=>`- **${item.title||item.slug}.** ${item.reason}`),
  '', `The backlog has ${remaining.toLocaleString('en-US')} unchecked candidates.`, '',
  'Add the release scan, request count, check results, and both PR links before appending this entry to PENDING_REQUESTS.md.', '',
  'Co-authored with ChatGPT.',
]);
if (options.apply) for (const [file,contents] of edits) fs.writeFileSync(file,contents);
console.log(JSON.stringify({mode:options.apply?'applied':'preview',firstNum,lastNum:firstNum+batch.length-1,remaining,files:[...edits.keys()],output},null,2));
