import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

const roomSource = (await readFile('lib/room.mjs', 'utf8'))
  .replace("import {sanitizeAvatar} from './avatar.mjs';", '')
  + '\n' + await readFile('lib/avatar.mjs', 'utf8');
const mf = new Miniflare({ modules: true, script: roomSource
  + '\nexport default {fetch(r,e){return handleRoom(r,e.DB)}}',
  d1Databases: ['DB'], compatibilityDate: '2026-01-01' });

try {
  const db = await mf.getD1Database('DB');
  await db.exec('CREATE TABLE rooms(code TEXT PRIMARY KEY,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL)');
  await db.exec('CREATE TABLE request_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL)');
  const source = await readFile('public/legacy/network.js', 'utf8');

  function client(mode = 'speed') {
    const nodes = new Map(), intervals = [], storage = new Map(), requests = [];
    let now = Date.now(), failNext = '', heldPoll = null;
    function node(id) {
      if (!nodes.has(id)) nodes.set(id, {
        id, hidden: id === 'network', textContent: '', value: id === 'count' ? '5' : '',
        children: [], disabled: false, style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        parentElement: { classList: { toggle() {} } },
        append(x) { this.children.push(x); }, replaceChildren(...x) { this.children = x; },
        querySelectorAll() { return this.children; }, setAttribute() {},
        click() { if (!this.disabled) return this.onclick?.(); },
      });
      return nodes.get(id);
    }
    const document = {
      hidden: false, getElementById: node,
      createElement: () => node('created:' + nodes.size),
      querySelectorAll: () => [2, 3].map(n => ({ dataset: { row: n } })),
      querySelector: () => ({ dataset: { mode } }), addEventListener() {},
    };
    const context = {
      document, localStorage: { removeItem() {} },
      sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
      window: { scrollTo() {}, dispatchEvent() {}, addEventListener() {} },
      CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
      fetch(url, options) {
        const body = JSON.parse(options.body);
        requests.push({ action: body.action, round: body.round });
        if (body.action === 'poll' && heldPoll) {
          const gate = heldPoll; heldPoll = null;
          return gate.then(() => mf.dispatchFetch('https://kuku.test' + url, options));
        }
        if (body.action === 'next' && failNext) {
          const failure = failNext; failNext = '';
          return failure === 'limit'
            ? Promise.resolve(Response.json({ error: 'Please wait' }, { status: 429 }))
            : Promise.reject(new Error('Temporary test connection failure'));
        }
        return mf.dispatchFetch('https://kuku.test' + url, options);
      },
      setInterval: fn => intervals.push(fn), setTimeout, clearTimeout, AbortController,
      Date: class extends Date { static now() { return now; } }, console, confirm: () => true,
    };
    vm.runInNewContext(source, context);
    return {
      node, document, requests, storage, poll: () => intervals[0](),
      advance(ms) { now += ms; return intervals[1](); },
      elapse(ms) { now += ms; },
      holdOnePoll() { let release; heldPoll = new Promise(resolve => { release = resolve; }); return release; },
      failOneNext() { failNext = 'network'; },
      limitOneNext() { failNext = 'limit'; },
      nextCount() { return requests.filter(x => x.action === 'next').length; },
    };
  }

  async function room(code) {
    const record = await db.prepare('SELECT state FROM rooms WHERE code=?').bind(code).first();
    return JSON.parse(record.state);
  }
  async function adjust(code, change) {
    const state = await room(code); change(state);
    await db.prepare('UPDATE rooms SET state=? WHERE code=?').bind(JSON.stringify(state), code).run();
  }
  async function answer(player, n) {
    for (const ch of String(n)) player.node('netKeys').children.find(b => b.textContent === ch).onclick();
    await player.node('netSubmit').onclick();
  }
  async function pair(mode = 'speed') {
    const h = client(mode), g = client();
    await h.node('createRoom').onclick();
    const { code } = JSON.parse(h.storage.get('kuku-room-v1'));
    g.node('roomInput').value = code;
    await g.node('joinRoom').onclick(); await h.poll();
    await h.node('netStart').onclick(); await g.poll();
    await startRound({ h, g, code });
    return { h, g, code };
  }
  async function startRound({ h, g, code }) {
    await adjust(code, s => { s.startAt = 0; });
    await h.poll(); await g.poll();
    const state = await room(code), q = state.deck[state.round];
    return q.a * q.b;
  }

  const slow = await pair();
  await answer(slow.h, await startRound(slow)); await slow.g.poll();
  // 800ms responses to 900ms polling leave a 100ms idle gap. All 150ms UI
  // ticks fall inside the poll, so polling completion must also trigger readiness.
  for (let cycle = 0; cycle < 2; cycle++) {
    const release = slow.h.holdOnePoll(), pending = slow.h.poll();
    await slow.h.advance(0);
    for (let tick = 0; tick < 5; tick++) await slow.h.advance(150);
    slow.h.elapse(50); release(); await pending; slow.h.elapse(100);
  }
  assert.equal(slow.h.nextCount(), 1, 'slow polling must not starve automatic readiness');
  await slow.g.advance(1000); await slow.h.poll();
  assert.equal((await room(slow.code)).round, 1);
  console.log('PASS: slow polling cannot starve automatic readiness even when every UI tick is busy.');

  const leaving = await pair();
  await answer(leaving.h, await startRound(leaving)); await leaving.g.poll();
  leaving.h.elapse(900);
  const releaseLeaving = leaving.h.holdOnePoll(), pendingLeaving = leaving.h.poll();
  await leaving.h.advance(150);
  const exit = leaving.h.node('netExit').onclick();
  releaseLeaving(); await pendingLeaving; await exit; await leaving.h.advance(1000);
  assert.equal(leaving.h.nextCount(), 0, 'a queued exit takes priority over automatic readiness');
  assert.equal((await room(leaving.code)).status, 'ended');
  console.log('PASS: exiting during a slow poll prevents automatic next from being queued or sent.');

  const speed = await pair(), { h, g, code } = speed;
  await answer(h, await startRound(speed)); await g.poll();
  assert.equal(h.node('netNext').hidden, false, 'manual fallback remains available');
  assert(h.node('netFeedback').textContent.includes('つぎへ すすむよ'));
  await h.advance(999); assert.equal(h.nextCount(), 0);
  await h.poll(); await h.advance(1);
  assert.equal(h.nextCount(), 1, 'poll must not restart the one-second display delay');
  assert.equal((await room(code)).round, 0, 'one ready player cannot advance the room');
  await h.advance(1000); assert.equal(h.nextCount(), 1, 'ready player must not resubmit');
  await g.advance(1000); await h.poll();
  assert.equal(h.node('netProgress').textContent, '2 / 5 もん');
  console.log('PASS: online automatic next waits one second, survives polling, and still requires both ready.');

  await answer(h, await startRound(speed)); await g.poll();
  h.failOneNext(); await h.advance(1000);
  const failedCount = h.nextCount();
  await h.advance(1000); assert.equal(h.nextCount(), failedCount, 'wait for a successful poll after failure');
  await h.poll(); await h.advance(0);
  assert.equal(h.nextCount(), failedCount + 1);
  await g.advance(1000); await h.poll();
  assert.equal((await room(code)).round, 2);
  console.log('PASS: a failed ready request recovers after polling without a request loop.');

  await answer(h, await startRound(speed)); await g.poll();
  await adjust(code, s => { s.seen[1] = 0; }); await h.poll();
  const beforeDisconnect = h.nextCount();
  await h.advance(1000); assert.equal(h.nextCount(), beforeDisconnect);
  h.document.hidden = true; await g.poll(); await h.poll();
  await h.advance(0); assert.equal(h.nextCount(), beforeDisconnect);
  h.document.hidden = false; await h.advance(0); await g.advance(1000); await h.poll();
  assert.equal((await room(code)).round, 3);
  console.log('PASS: automatic next pauses while the opponent is disconnected or the page is hidden.');

  await startRound(speed);
  await h.node('netSkip').onclick(); await g.node('netSkip').onclick(); await h.poll();
  const beforeSkip = [h.nextCount(), g.nextCount()];
  await h.advance(1000); await g.advance(1000);
  assert.deepEqual([h.nextCount(), g.nextCount()], beforeSkip);
  assert.equal(h.node('netNext').hidden, false);
  await h.node('netNext').onclick(); await g.node('netNext').onclick(); await h.poll();
  await answer(h, await startRound(speed)); await g.poll();
  await h.advance(1000); await g.advance(1000); await h.poll();
  assert.equal((await room(code)).status, 'finished');
  assert.equal(h.node('netResult').hidden, false); assert.equal(g.node('netResult').hidden, false);
  console.log('PASS: answer reveal keeps manual next; the final correct round automatically shows results.');

  const calm = await pair('calm'), correct = await startRound(calm);
  await answer(calm.h, correct); await calm.g.poll();
  await calm.h.advance(1000); await calm.g.advance(1000);
  assert.equal(calm.h.nextCount() + calm.g.nextCount(), 0, 'calm mode waits for the second answer');
  await answer(calm.g, correct); await calm.h.poll();
  await calm.h.advance(1000); await calm.g.advance(1000); await calm.h.poll();
  assert.equal((await room(calm.code)).round, 1);
  await answer(calm.h, await startRound(calm));
  await calm.g.node('netSkip').onclick(); await calm.h.node('netSkip').onclick(); await calm.g.poll();
  const calmSkipCount = calm.h.nextCount() + calm.g.nextCount();
  await calm.h.advance(1000); await calm.g.advance(1000);
  assert.equal(calm.h.nextCount() + calm.g.nextCount(), calmSkipCount, 'partial correct + reveal is still manual');
  console.log('PASS: calm mode preserves both-answer completion and explicit answer-reveal consent.');

  const limited = await pair();
  await answer(limited.h, await startRound(limited)); await limited.g.poll();
  limited.h.limitOneNext(); await limited.h.advance(1000);
  const limitedCount = limited.h.nextCount(); await limited.h.poll();
  await limited.h.advance(1000); assert.equal(limited.h.nextCount(), limitedCount);
  await limited.h.advance(59000); assert.equal(limited.h.nextCount(), limitedCount, 'stale state cannot send ready');
  await limited.h.poll(); await limited.h.advance(0);
  assert.equal(limited.h.nextCount(), limitedCount + 1);
  assert.equal((await room(limited.code)).ready[0], true);
  console.log('PASS: rate-limit backoff and fresh polling are required before automatic next retries.');

  const exiting = await pair();
  await answer(exiting.h, await startRound(exiting)); await exiting.g.poll();
  await exiting.h.node('netExit').onclick(); await exiting.h.advance(1000);
  await exiting.h.node('createRoom').onclick(); await exiting.h.advance(1000);
  assert.equal(exiting.h.nextCount(), 0, 'an old round must not send next after leaving or creating another room');
  console.log('PASS: leaving and creating another room invalidates pending automatic progression.');
} finally {
  await mf.dispose();
}
