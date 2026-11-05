import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const engine=await readFile(new URL('../public/legacy/engine.js',import.meta.url),'utf8');
const app=await readFile(new URL('../public/legacy/app.js',import.meta.url),'utf8');

function client(mode='speed'){
  const nodes=new Map(),timers=new Map(),listeners=new Map(),events=[];
  let now=0,timerId=0;
  function element(id=''){
    return {id,hidden:false,disabled:false,textContent:'',value:id==='count'?'5':'',dataset:{},style:{},children:[],
      classList:{add(){},remove(){},toggle(){}},setAttribute(){},
      append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},
      click(){if(!this.disabled)return this.onclick?.()}};
  }
  function node(id){if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id)}
  const modes=['speed','calm'].map(value=>{const b=element();b.dataset.mode=value;return b});
  const submits=[0,1].map(player=>{const b=element();b.dataset.submit=String(player);return b});
  const context={document:{getElementById:node,createElement:()=>element(),addEventListener(){},
      querySelectorAll(selector){
        if(selector==='[data-row]')return node('rows').children;
        if(selector==='[data-mode]')return modes;
        if(selector==='[data-submit]')return submits;
        if(selector==='.answer')return [node('answer0'),node('answer1')];
        const keys=selector.match(/^\[data-keyplayer="([01])"\]/);
        if(keys)return [...node('keys'+keys[1]).children,submits[Number(keys[1])]];
        throw new Error('Unexpected selector: '+selector);
      }},
    Date:class extends Date{static now(){return now}},console,confirm:()=>true,
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},
    setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,due:now+delay});return id},
    clearTimeout(id){timers.delete(id)},
    scrollTo(){},
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn)},
    dispatchEvent(event){events.push(event);for(const fn of listeners.get(event.type)||[])fn(event)}
  };
  context.window=context;
  context.KukuUI={show(id){
    for(const screen of ['hub','setup','play','result'])node(screen).hidden=screen!==id;
    context.dispatchEvent(new context.CustomEvent('kuku-screen',{detail:{id}}));
  }};
  vm.createContext(context);
  vm.runInContext(engine,context);
  vm.runInContext(app,context);
  modes.find(b=>b.dataset.mode===mode).click();
  node('start').click();
  function advance(ms){
    const target=now+ms;
    while(true){
      const next=[...timers.entries()].filter(([,timer])=>timer.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];
      if(!next)break;
      timers.delete(next[0]);now=next[1].due;next[1].fn();
    }
    now=target;
  }
  function answer(player,value){
    if(value===undefined){const match=node('equation').textContent.match(/(\d+) × (\d+)/);value=Number(match[1])*Number(match[2])}
    for(const digit of String(value))node('keys'+player).children.find(b=>b.textContent===digit).click();
    submits[player].click();
  }
  return {node,answer,advance,timers,events,show:context.KukuUI.show};
}

{
  const c=client();
  c.answer(0);c.answer(1);
  assert.equal(c.node('score0').textContent,'★ 1');
  assert.equal(c.node('score1').textContent,'★ 0');
  assert.match(c.node('equation').textContent,/＝ \d+$/);
  c.advance(999);assert.equal(c.node('progress').textContent,'1 / 5 もん');
  c.advance(1);assert.equal(c.node('progress').textContent,'2 / 5 もん');
  assert.equal(c.node('next').hidden,true);
}

{
  const c=client('calm');
  c.answer(0);c.advance(2000);
  assert.equal(c.node('progress').textContent,'1 / 5 もん');
  assert.equal(c.node('next').hidden,true);
  c.answer(0);assert.equal(c.node('score0').textContent,'★ 1');
  c.answer(1);c.advance(999);
  assert.equal(c.node('progress').textContent,'1 / 5 もん');
  c.advance(1);assert.equal(c.node('progress').textContent,'2 / 5 もん');
  assert.equal(c.node('score1').textContent,'★ 1');
}

for(const mode of ['speed','calm']){
  const c=client(mode);
  if(mode==='calm')c.answer(0);
  c.node('skip').click();c.advance(5000);
  assert.equal(c.node('progress').textContent,'1 / 5 もん');
  assert.equal(c.node('next').hidden,false);
  c.node('next').click();
  assert.equal(c.node('progress').textContent,'2 / 5 もん');
}

{
  const c=client();
  c.answer(0,0);c.advance(2000);
  assert.equal(c.node('progress').textContent,'1 / 5 もん');
  assert.equal(c.node('score0').textContent,'★ 0');
  c.answer(0);c.advance(1000);
  assert.equal(c.node('progress').textContent,'2 / 5 もん');
}

{
  const c=client();
  c.answer(0);
  const stale=[...c.timers.values()][0].fn;
  c.advance(100);c.node('next').click();c.answer(1);
  stale();
  c.advance(999);assert.equal(c.node('progress').textContent,'2 / 5 もん');
  c.advance(1);assert.equal(c.node('progress').textContent,'3 / 5 もん');
  c.advance(1000);assert.equal(c.node('progress').textContent,'3 / 5 もん');
}

{
  const c=client();
  c.answer(0);
  const stale=[...c.timers.values()][0].fn;
  c.node('exit').click();c.advance(2000);stale();
  assert.equal(c.node('setup').hidden,false);
  c.node('start').click();stale();c.advance(2000);
  assert.equal(c.node('play').hidden,false);
  assert.equal(c.node('progress').textContent,'1 / 5 もん');
  assert.equal(c.node('score0').textContent,'★ 0');
  c.answer(0);c.show('hub');c.advance(2000);
  assert.equal(c.node('hub').hidden,false);
  assert.equal(c.node('play').hidden,true);
}

for(const mode of ['speed','calm']){
  const c=client(mode);
  for(let round=1;round<=5;round++){
    assert.equal(c.node('progress').textContent,round+' / 5 もん');
    c.answer(0);if(mode==='calm')c.answer(1);
    c.advance(1000);
  }
  assert.equal(c.node('result').hidden,false);
  assert.equal(c.node('play').hidden,true);
  assert.equal(c.events.filter(e=>e.type==='kuku-feedback'&&e.detail.type==='finish').length,1);
  c.node('next').click();c.advance(2000);
  assert.equal(c.events.filter(e=>e.type==='kuku-feedback'&&e.detail.type==='finish').length,1);
  c.node('again').click();c.advance(2000);
  assert.equal(c.node('progress').textContent,'1 / 5 もん');
  assert.equal(c.node('score0').textContent,'★ 0');
}

console.log('PASS: shared-device speed/calm auto-advance, correct-answer delay, scoring, manual skip, wrong-answer retry, stale timers, exit/restart, hidden screen, and final results exactly once.');
