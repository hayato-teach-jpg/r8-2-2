import {sanitizeAvatar} from './avatar.mjs';
const LIFE=2*60*60*1000;
function reply(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(status===429?{'Retry-After':'60'}:{})}})}
function fail(message,status=400){return reply({error:message},status)}
const token=()=>crypto.randomUUID()+crypto.randomUUID();
function deck(rows,total){let all=[],out=[];for(const a of rows)for(let b=1;b<=9;b++)all.push({a,b});while(out.length<total){const part=all.map(q=>({...q}));for(let i=part.length-1;i;i--){const r=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[part[i],part[r]]=[part[r],part[i]];}out.push(...part)}return out.slice(0,total)}
function view(s,p,code,now){const q=s.deck[s.round];return{code,player:p,status:s.status,rows:s.rows,total:s.total,mode:s.mode,scores:s.scores,round:s.round,q:s.status==='playing'?q:null,closed:s.closed,answer:s.closed&&q?q.a*q.b:null,correct:s.correct,ready:s.ready,skip:s.skip,feedback:s.feedback[p],cooldown:Math.max(0,s.locks[p]-now),startAt:s.startAt,serverNow:now,opponentConnected:s.tokens[1-p]!==null&&now-s.seen[1-p]<15000,opponentJoined:s.tokens[1-p]!==null,winner:s.winner,mistakes:s.status==='finished'?s.mistakes:[],revision:s.revision,avatars:(s.avatars||[{},{}]).map(sanitizeAvatar)};}
function remember(s){const q=s.deck[s.round];if(!s.mistakes.some(x=>x.a===q.a&&x.b===q.b))s.mistakes.push(q)}
function resetRound(s,now){s.correct=[false,false];s.ready=[false,false];s.skip=[false,false];s.locks=[0,0];s.feedback=['',''];s.closed=false;s.winner=null;s.startAt=now+3000;}
async function processRoom(req,db,client){
 try{
 if(req.method!=='POST')return fail('この操作は つかえません。',405);
 if(req.headers.get('origin')&&new URL(req.url).origin!==req.headers.get('origin'))return fail('同じサイトから 開いてね。',403);
 const raw=await req.text();if(raw.length>2048)return fail('送る内容が 大きすぎます。');let b;try{b=JSON.parse(raw)}catch{return fail('送る内容を たしかめてね。')}
 if(!b||typeof b!=='object'||Array.isArray(b))return fail('送る内容を たしかめてね。');
 const now=Date.now();if(!db)return fail('通信の準備中です。先生に知らせてね。',503);
 if(b.action==='create'){
 if(!await limited(db,client,'create',12,120,now))return fail('へやを たくさんつくっています。1分ほど まってね。',429);
 if(!Array.isArray(b.rows))return fail('段を えらんでね。');
 const rows=[...new Set(b.rows||[])];if(!rows.length||rows.some(x=>!Number.isInteger(x)||x<1||x>9)||![5,10,20].includes(b.total)||!['speed','calm'].includes(b.mode))return fail('段や問題数を えらびなおしてね。');
 await db.batch([db.prepare('DELETE FROM rooms WHERE expires < ?').bind(now),db.prepare('DELETE FROM request_limits WHERE expires < ?').bind(now)]);
 for(let i=0;i<8;i++){const code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000),t=token();const s={tokens:[t,null],status:'lobby',rows,total:b.total,mode:b.mode,deck:deck(rows,b.total),avatars:[sanitizeAvatar(b.avatar),sanitizeAvatar({color:'orange'})],scores:[0,0],round:0,seen:[now,0],mistakes:[],revision:0};resetRound(s,now);const r=await db.prepare('INSERT OR IGNORE INTO rooms(code,state,revision,expires) VALUES(?,?,0,?)').bind(code,JSON.stringify(s),now+LIFE).run();if(r.meta.changes)return reply({...view(s,0,code,now),token:t});}return fail('もういちど へやを つくってね。',503);
 }
 if(b.action==='join'&&!await limited(db,client,'join',15,300,now))return fail('番号を たくさんためしています。1分ほど まってから 入りなおしてね。',429);
 if(b.action!=='join'&&!validToken(b.token))return fail('この端末では へやに入れません。入りなおしてね。',403);
 const code=String(b.code||'');if(!/^\d{6}$/.test(code))return fail('6けたの へや番号を 入れてね。');
 for(let tries=0;tries<10;tries++){
 const record=await db.prepare('SELECT state,revision,expires FROM rooms WHERE code=?').bind(code).first();if(!record||record.expires<now){if(b.action!=='join'&&!await limited(db,client,'invalid',20,300,now))return fail('通信を たくさんためしています。1分ほど まってね。',429);return fail('へやが 見つかりません。番号をたしかめるか、新しくつくってね。',404);}
 const s=JSON.parse(record.state);let p=validToken(b.token)?s.tokens.findIndex(t=>typeof t==='string'&&t===b.token):-1,changed=false,newToken;
 if(b.action==='join'&&p<0){if(s.tokens[1]!==null)return fail('このへやは 2人で つかっています。',409);if(s.status!=='lobby')return fail('このたいせんは おわりました。',410);p=1;newToken=token();s.tokens[1]=newToken;s.avatars=s.avatars||[sanitizeAvatar({}),sanitizeAvatar({color:'orange'})];s.avatars[1]=sanitizeAvatar(b.avatar);s.seen[1]=now;changed=true;}
 if(p<0){if(!await limited(db,client,'invalid',20,300,now))return fail('通信を たくさんためしています。1分ほど まってね。',429);return fail('この端末では へやに入れません。入りなおしてね。',403);}
 if(now-s.seen[p]>4000){s.seen[p]=now;changed=true;}
 if(b.action==='leave'){s.status='ended';changed=true;}
 else if(b.action==='start'){
 if(p!==0||s.status!=='lobby')return fail('へやをつくった人が スタートしてね。');if(!s.tokens[1]||now-s.seen[1]>15000)return fail('友だちが 入るのを まってね。');s.status='playing';resetRound(s,now);changed=true;
 }else if(['answer','skip','next'].includes(b.action)){
 if(s.status!=='playing'||b.round!==s.round)return reply(view(s,p,code,now));
 if(now-s.seen[1-p]>15000)return fail('友だちの通信を たしかめてね。',409);
 if(b.action==='answer'&&!s.closed&&!s.correct[p]){
 if(now<s.startAt)return fail('スタートまで まってね。',409);
 if(now<s.locks[p])return reply(view(s,p,code,now));
 if(!Number.isInteger(b.answer)||b.answer<0||b.answer>99)return fail('数字で こたえてね。');
 const q=s.deck[s.round];if(b.answer===q.a*q.b){s.correct[p]=true;s.scores[p]++;s.feedback[p]='correct';if(s.mode==='speed'||s.correct.every(Boolean)){s.closed=true;s.winner=p;}}else{s.feedback[p]='wrong';s.locks[p]=now+1000;remember(s);}changed=true;
 }else if(b.action==='skip'&&!s.closed){s.skip[p]=true;changed=true;if(s.skip.every(Boolean)){remember(s);s.closed=true;s.winner=null;}}
 else if(b.action==='next'&&s.closed){s.ready[p]=true;changed=true;if(s.ready.every(Boolean)){if(s.round+1>=s.total)s.status='finished';else{s.round++;resetRound(s,now)}}}
 }else if(!['poll','join','start','leave'].includes(b.action))return fail('操作を たしかめてね。');
 if(!changed)return reply(view(s,p,code,now));
 s.revision=record.revision+1;
 const r=await db.prepare('UPDATE rooms SET state=?,revision=? WHERE code=? AND revision=?').bind(JSON.stringify(s),s.revision,code,record.revision).run();if(r.meta.changes)return reply({...view(s,p,code,now),...(newToken?{token:newToken}:{})});
 }
 return fail('通信が こんでいます。もういちど おしてね。',409);
 }catch(e){console.error('Room service failure',e?.message);return fail('通信できませんでした。少し待って ためしてね。',503)}
}

function validToken(value){return typeof value==='string'&&/^[0-9a-f-]{72}$/.test(value)}
async function fingerprint(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('')}
async function hit(db,key,max,now){const r=await db.prepare(`INSERT INTO request_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.expires<=? THEN 1 ELSE request_limits.count+1 END, expires=CASE WHEN request_limits.expires<=? THEN excluded.expires ELSE request_limits.expires END RETURNING count`).bind(key,now+60000,now,now).first();return r.count<=max}
async function limited(db,client,kind,deviceMax,networkMax,now){const [device,network]=await Promise.all([hit(db,kind+':d:'+client.device,deviceMax,now),hit(db,kind+':n:'+client.network,networkMax,now)]);return device&&network}
export async function handleRoom(req,db){
 const cookie=req.headers.get('cookie')||'';const found=cookie.match(/(?:^|;\s*)kuku_device=([0-9a-f-]{36})(?:;|$)/);const device=found?.[1]||crypto.randomUUID();
 const ip=req.headers.get('CF-Connecting-IP')||'unavailable';const day=new Date().toISOString().slice(0,10);
 const client={device:await fingerprint(day+':device:'+device+':'+ip),network:await fingerprint(day+':network:'+ip)};
 const result=await processRoom(req,db,client);if(!found)result.headers.append('Set-Cookie',`kuku_device=${device}; Path=/api/room; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);return result;
}
