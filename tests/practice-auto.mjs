import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const sources = await Promise.all(['avatar', 'profile', 'practice-engine', 'adventure']
  .map(name => readFile(`public/legacy/${name}.js`, 'utf8')));

function practice() {
  let now = 0, timerId = 0;
  const timers = new Map(), nodes = new Map(), storage = new Map(), listeners = new Map();
  const sections = ['hub', 'practiceSetup', 'practicePlay', 'practiceResult', 'wardrobe', 'setup', 'network'];
  function element(id = '', tag = 'div') {
    const classes = new Set();
    return {
      id, tagName: tag.toUpperCase(), hidden: sections.includes(id) && id !== 'hub',
      textContent: '', innerHTML: '', value: id === 'practiceCount' ? '10' : '', checked: false,
      disabled: false, dataset: {}, style: {}, children: [],
      classList: { add: (...xs) => xs.forEach(x => classes.add(x)),
        remove: (...xs) => xs.forEach(x => classes.delete(x)),
        toggle(x, force) { const add = force ?? !classes.has(x); add ? classes.add(x) : classes.delete(x); return add; } },
      append(...xs) { this.children.push(...xs); }, replaceChildren(...xs) { this.children = xs; },
      setAttribute() {}, click() { if (!this.disabled) this.onclick?.(); },
    };
  }
  function node(id) { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); }
  const orders = ['up', 'down', 'random', 'mix'].map(order => {
    const button = element('', 'button'); button.dataset.order = order; return button;
  });
  const intervals = [];
  const window = {
    scrollTo() {},
    addEventListener(type, fn) { const list = listeners.get(type) ?? []; list.push(fn); listeners.set(type, list); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event); },
  };
  const context = {
    window, crypto, performance: { now: () => now }, Date: class extends Date { static now() { return now; } },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    document: {
      getElementById: node, createElement: tag => element('', tag), addEventListener() {},
      querySelectorAll(selector) {
        if (selector === 'main>section') return sections.map(node);
        if (selector === '[data-order]') return orders;
        if (selector === '[data-practice-row]') return node('practiceRows').children;
        if (selector === '#practiceKeys button') return node('practiceKeys').children;
        return [];
      },
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    confirm: () => true,
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: fn => intervals.push(fn),
  };
  vm.createContext(context);
  sources.forEach(source => vm.runInContext(source, context));
  function tick(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = end; intervals.forEach(fn => fn());
  }
  function answer(value) {
    if (value === undefined) {
      const [a, b] = node('practiceEquation').textContent.match(/\d+/g).map(Number);
      value = a * b;
    }
    for (const digit of String(value)) node('practiceKeys').children.find(b => b.textContent === digit).click();
    node('practiceSubmit').click();
  }
  function start() { node('choosePractice').click(); node('practiceStart').click(); }
  return { node, tick, answer, start, profile: window.KukuProfile, window };
}

const complete = practice();
complete.start();
for (let index = 0; index < 9; index++) {
  complete.tick(100);
  complete.answer();
  complete.tick(999);
  assert.equal(complete.node('practiceProgress').textContent, `${index + 1} / 9 もん`);
  assert.equal(complete.node('practiceResult').hidden, true);
  complete.tick(1);
}
assert.equal(complete.node('practiceResult').hidden, false);
assert.equal(complete.node('clearTime').textContent, '0.9', 'nine seconds of correct-answer feedback must be excluded');
assert.equal(complete.profile.data.clears, 1);
const medals = complete.profile.data.medals;
complete.tick(5000);
assert.equal(complete.profile.data.medals, medals);
assert.equal(complete.profile.data.claims.length, 1);

const wrong = practice();
wrong.start(); wrong.answer(0); wrong.tick(5000);
assert.equal(wrong.node('practiceProgress').textContent, '1 / 9 もん');
wrong.node('practiceReveal').click(); wrong.tick(5000);
assert.equal(wrong.node('practiceProgress').textContent, '1 / 9 もん', 'revealed answers remain available to study');
wrong.node('practiceNext').click();
assert.equal(wrong.node('practiceProgress').textContent, '2 / 9 もん');

const manual = practice();
manual.start(); manual.tick(100); manual.answer(); manual.tick(100);
manual.node('practiceNext').click(); manual.tick(100); manual.answer(); manual.tick(800);
assert.equal(manual.node('practiceProgress').textContent, '2 / 9 もん', 'old timeout must not advance a newer resolved question');
manual.tick(199);
assert.equal(manual.node('practiceProgress').textContent, '2 / 9 もん');
manual.tick(1);
assert.equal(manual.node('practiceProgress').textContent, '3 / 9 もん');

for (const exit of ['homeButton', 'practiceQuit']) {
  const restart = practice();
  restart.start(); restart.tick(100); restart.answer(); restart.tick(100);
  restart.node(exit).click(); restart.start(); restart.tick(100); restart.answer(); restart.tick(800);
  assert.equal(restart.node('practiceProgress').textContent, '1 / 9 もん');
  restart.tick(200);
  assert.equal(restart.node('practiceProgress').textContent, '2 / 9 もん');
}

console.log('PASS: practice auto-advance, final results/reward once, active-answer timing, wrong/hint manual flow, early-next and exit/restart timer isolation.');
