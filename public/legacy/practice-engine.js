(function(root){
function shuffled(items,random){const out=items.map(x=>({...x}));for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
class PracticeRun{
 constructor({rows,order='up',total=9},now=()=>performance.now(),random=Math.random){if(!Array.isArray(rows)||!rows.length||rows.some(x=>!Number.isInteger(x)||x<1||x>9))throw new Error('Invalid rows');if(!['up','down','random','mix'].includes(order))throw new Error('Invalid order');this.rows=[...new Set(rows)].sort((a,b)=>a-b);if(order!=='mix'&&this.rows.length!==1)throw new Error('Choose one row');this.order=order;this.total=order==='mix'?[10,20,30].includes(total)?total:10:9;this.now=now;this.startAt=now();this.roundAt=this.startAt;this.elapsedMs=0;this.index=0;this.errors=0;this.mistakes=[];this.done=false;this.resolved=false;this.id=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+String(random());let pool=[];for(const a of this.rows)for(let b=1;b<=9;b++)pool.push({a,b});if(order==='down')pool.reverse();this.deck=[];while(this.deck.length<this.total)this.deck.push(...(['random','mix'].includes(order)?shuffled(pool,random):pool));this.deck=this.deck.slice(0,this.total);this.key=this.rows.join('-')+':'+order+':'+this.total;}
 get q(){return this.deck[this.index]}
 get seconds(){return this.done?this.finishedSeconds:Math.max(0,(this.elapsedMs+(!this.resolved?this.now()-this.roundAt:0))/1000)}
 miss(){this.errors++;if(!this.mistakes.some(x=>x.a===this.q.a&&x.b===this.q.b))this.mistakes.push({...this.q});}
 answer(n){if(this.done||this.resolved)return 'ignored';if(n!==this.q.a*this.q.b){this.miss();return 'wrong'}this.elapsedMs+=this.now()-this.roundAt;this.resolved=true;return 'correct'}
 reveal(){if(this.done||this.resolved)return false;this.miss();this.elapsedMs+=this.now()-this.roundAt;this.resolved=true;return true}
 next(){if(this.done||!this.resolved)return false;if(this.index+1>=this.total){this.finishedSeconds=this.seconds;this.done=true;return false}this.index++;this.resolved=false;this.roundAt=this.now();return true}
}
if(typeof module!=='undefined')module.exports=PracticeRun;else root.KukuPracticeRun=PracticeRun;
})(typeof window==='undefined'?globalThis:window);
