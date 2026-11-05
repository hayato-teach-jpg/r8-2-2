import {Miniflare} from 'miniflare';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../lib/room.mjs',import.meta.url),'utf8')).replace("import {sanitizeAvatar} from './avatar.mjs';",'')+'\n'+await readFile(new URL('../lib/avatar.mjs',import.meta.url),'utf8');
const mf=new Miniflare({modules:true,script:source+'\nexport default {fetch(request,env){return handleRoom(request,env.DB)}}',d1Databases:['DB'],compatibilityDate:'2026-01-01'});
try{
const db=await mf.getD1Database('DB');await db.exec('CREATE TABLE rooms(code TEXT PRIMARY KEY,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL)');await db.exec('CREATE TABLE request_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL)');
async function call(action,session={},extra={}){const r=await mf.dispatchFetch('https://kuku.test/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,action,...extra})});return {status:r.status,body:await r.json()};}
async function getState(code){const r=await db.prepare('SELECT state FROM rooms WHERE code=?').bind(code).first();return JSON.parse(r.state)}
async function adjust(code,fn){const s=await getState(code);fn(s);await db.prepare('UPDATE rooms SET state=? WHERE code=?').bind(JSON.stringify(s),code).run()}
const made=await call('create',{}, {rows:[2,5],total:5,mode:'speed',avatar:{body:'rabbit',hat:'cap',color:'mint',privateName:'ignore'}});assert.equal(made.status,200);assert.equal(made.body.avatars[0].body,'rabbit');assert.equal(made.body.avatars[0].hat,'cap');assert(!('privateName' in made.body.avatars[0]));const host={code:made.body.code,token:made.body.token};assert(!('deck' in made.body));assert(!('tokens' in made.body));
assert.equal((await call('start',host)).status,400);
const joins=await Promise.all([call('join',{code:host.code},{avatar:{body:'robot',color:'orange',hat:'<script>'}}),call('join',{code:host.code},{avatar:{body:'robot',color:'orange',hat:'<script>'}})]);assert.deepEqual(joins.map(x=>x.status).sort(),[200,409]);const guest={code:host.code,token:joins.find(x=>x.status===200).body.token};assert.equal((await call('poll',{code:host.code,token:'fake'})).status,403);
assert.equal((await call('start',guest)).status,400);let res=await call('start',host);assert.equal(res.body.status,'playing');const answer=res.body.q.a*res.body.q.b;assert.equal(res.body.avatars[0].body,'rabbit');assert.equal(res.body.avatars[1].body,'robot');assert.equal(res.body.avatars[1].hat,'none');const guestView=(await call('poll',guest)).body;assert.deepEqual(guestView.avatars,res.body.avatars);
assert.equal((await call('answer',host,{round:0,answer})).status,409);
await adjust(host.code,s=>s.startAt=Date.now()-1000);
const race=await Promise.all([call('answer',host,{round:0,answer}),call('answer',guest,{round:0,answer})]);assert(race.every(x=>x.status===200));let current=(await call('poll',host)).body;assert.equal(current.scores[0]+current.scores[1],1);assert(current.closed);assert.equal(current.answer,answer);
const before=await call('next',host,{round:0});assert.equal(before.body.round,0);assert(before.body.ready[0]);const next=await call('next',guest,{round:0});assert.equal(next.body.round,1);assert.equal((await call('next',host,{round:0})).body.round,1);
await adjust(host.code,s=>s.startAt=0);const wrong=await call('answer',host,{round:1,answer:0});assert.equal(wrong.body.feedback,'wrong');const q=wrong.body.q;const blocked=await call('answer',host,{round:1,answer:q.a*q.b});assert.equal(blocked.body.correct[0],false);assert(blocked.body.cooldown>0);
await call('skip',host,{round:1});assert.equal((await call('poll',guest)).body.closed,false);const skipped=await call('skip',guest,{round:1});assert(skipped.body.closed);
await call('leave',guest);assert.equal((await call('poll',host)).body.status,'ended');
const c=await call('create',{}, {rows:[9],total:5,mode:'calm'});const h={code:c.body.code,token:c.body.token};const j=await call('join',{code:h.code});const g={code:h.code,token:j.body.token};await call('start',h);
for(let round=0;round<5;round++){
 await adjust(h.code,s=>s.startAt=0);const s=(await call('poll',h)).body;const a=s.q.a*s.q.b;const a1=await call('answer',h,{round,answer:a});assert(!a1.body.closed);assert.equal(a1.body.scores[0],round+1);const dup=await call('answer',h,{round,answer:a});assert.equal(dup.body.scores[0],round+1);const a2=await call('answer',g,{round,answer:a});assert(a2.body.closed);await Promise.all([call('next',h,{round}),call('next',g,{round})]);
}
const final=(await call('poll',h)).body;assert.equal(final.status,'finished');assert.deepEqual(final.scores,[5,5]);assert.equal(final.mistakes.length,0);assert.equal((await call('poll',h)).body.status,'finished');
await db.prepare('UPDATE rooms SET expires=0 WHERE code=?').bind(h.code).run();assert.equal((await call('poll',h)).status,404);
console.log('PASS: real D1 integration — create/join, full room, authentication, concurrent scoring, countdown, cooldown, stale requests, both ready, shared skip, leave, calm mode, finish, resume, expiry.');
}finally{await mf.dispose()}
