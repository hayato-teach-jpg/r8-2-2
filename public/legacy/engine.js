(function(root){
class Duel{
 constructor(rows,rounds,mode,random=Math.random){this.mode=mode;this.total=rounds;this.scores=[0,0];this.mistakes=[];this.index=0;this.pool=[];for(const a of rows)for(let b=1;b<=9;b++)this.pool.push({a,b});this.deck=[];while(this.deck.length<rounds){let part=this.pool.map(x=>({...x}));for(let i=part.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[part[i],part[j]]=[part[j],part[i]];}if(this.deck.length&&part.length>1&&part[0].a===this.deck.at(-1).a&&part[0].b===this.deck.at(-1).b)[part[0],part[1]]=[part[1],part[0]];this.deck.push(...part);}this.deck=this.deck.slice(0,rounds);this.next();}
 next(){if(this.index>=this.total){this.done=true;return false;}this.q=this.deck[this.index++];this.answered=[false,false];this.closed=false;return true;}
 answer(p,n){if(this.closed||this.done||this.answered[p])return 'ignored';if(n!==this.q.a*this.q.b){if(!this.mistakes.some(x=>x.a===this.q.a&&x.b===this.q.b))this.mistakes.push({...this.q});return 'wrong';}this.answered[p]=true;this.scores[p]++;if(this.mode==='speed'||this.answered.every(Boolean))this.closed=true;return 'correct';}
 skip(){if(this.closed)return; if(!this.mistakes.some(x=>x.a===this.q.a&&x.b===this.q.b))this.mistakes.push({...this.q});this.closed=true;}
}
if(typeof module!=='undefined')module.exports=Duel;else root.Duel=Duel;
})(typeof window==='undefined'?globalThis:window);
