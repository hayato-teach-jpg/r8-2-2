(()=>{
const KEY='kuku-adventure-v1',A=window.KukuAvatar;let saved=true;
function fresh(){return{version:1,medals:0,earned:0,clears:0,avatar:{...A.defaults},owned:[],bests:{},claims:[]}}
let data;try{data=JSON.parse(localStorage.getItem(KEY))}catch{}if(!data||data.version!==1)data=fresh();data={...fresh(),...data};data.medals=Number.isSafeInteger(data.medals)&&data.medals>=0?data.medals:0;data.earned=Number.isSafeInteger(data.earned)&&data.earned>=0?data.earned:0;data.clears=Number.isSafeInteger(data.clears)&&data.clears>=0?data.clears:0;data.owned=Array.isArray(data.owned)?data.owned.filter(x=>typeof x==='string'):[];data.bests=data.bests&&typeof data.bests==='object'&&!Array.isArray(data.bests)?data.bests:{};data.bests=Object.fromEntries(Object.entries(data.bests).filter(([k,v])=>k.length<100&&typeof v==='number'&&Number.isFinite(v)&&v>=0));data.claims=Array.isArray(data.claims)?data.claims.filter(x=>typeof x==='string').slice(-50):[];data.avatar=A.clean(data.avatar);
if(data.owned.includes('color:gold'))data.medals+=12;data.owned=data.owned.filter(x=>!x.startsWith('color:'));
function owns(k,id){const item=A.catalog[k]?.find(x=>x[0]===id);return !!item&&(item[2]===0||data.owned.includes(k+':'+id))}
for(const k in data.avatar)if(!owns(k,data.avatar[k]))data.avatar[k]=A.defaults[k];
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));saved=true}catch{saved=false}window.dispatchEvent(new CustomEvent('kuku-profile'));return saved}
function equip(k,id){if(!owns(k,id))return false;data.avatar[k]=id;persist();return true}
function buy(k,id){const item=A.catalog[k]?.find(x=>x[0]===id);if(!item||owns(k,id)||data.medals<item[2])return false;data.medals-=item[2];data.owned.push(k+':'+id);data.avatar[k]=id;persist();return true}
function reward(run){if(data.claims.includes(run.id))return{reward:0,newRecord:false,base:0,perfect:0,speed:0};const base=3+Math.floor(run.total/9),perfect=run.errors===0?2:0,ratio=run.total/9,speed=run.seconds<=Math.round(20*ratio)?3:run.seconds<=Math.round(30*ratio)?2:run.seconds<=Math.round(60*ratio)?1:0;const reward=base+perfect+speed;const best=data.bests[run.key];const newRecord=run.errors===0&&(!best||run.seconds<best);if(newRecord)data.bests[run.key]=run.seconds;data.medals+=reward;data.earned+=reward;data.clears++;data.claims.push(run.id);data.claims=data.claims.slice(-50);persist();return{reward,newRecord,base,perfect,speed};}
window.KukuProfile={get data(){return data},get saved(){return saved},owns,equip,buy,reward,persist};
window.KukuUI={show(id){const target=document.getElementById(id);if(!target)return;const entering=target.hidden;document.querySelectorAll('main>section').forEach(x=>x.hidden=x.id!==id);if(entering){window.scrollTo(0,0);window.dispatchEvent(new CustomEvent('kuku-screen',{detail:{id}}))}}};
persist();
})();
