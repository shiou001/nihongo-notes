// 執行：node --test sync/jlpt-player.test.mjs
// 測 js/jlpt-player.js：聽解錄音依序播放（假的 Audio、假的計時器）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function load() {
  const ctx = vm.createContext({ console, Promise });
  ctx.window = ctx;
  vm.runInContext(await readFile(new URL('../js/jlpt-player.js', import.meta.url), 'utf8'), ctx);
  return ctx.JLPTPlayer;
}
// 假的 Audio：記錄播了哪些檔；end() 模擬播完；reject=true 模擬手機擋自動播放
function fakeAudio({ reject = false } = {}) {
  const played = [], list = [];
  class A { constructor(src) { this.src = src; list.push(this); } play() { played.push(this.src); if (reject) { const e = new Error('blocked'); e.name = 'NotAllowedError'; return Promise.reject(e); } return Promise.resolve(); } pause() { this.paused = true; } end() { this.onended?.(); } }
  return { A, played, list };
}
// 假的計時器：記錄等待時間，flush() 執行
function fakeTimer() {
  const q = [];
  return { set: (fn, ms) => { q.push({ fn, ms }); return q.length; }, flush: () => { const x = q.shift(); x?.fn(); return x?.ms; }, q };
}
const tick = () => new Promise(r => setImmediate(r));

test('player：依序播放、句間停頓、最後留作答時間才 onEnd', async () => {
  const P = await load(), au = fakeAudio(), t = fakeTimer(), idx = [];
  let ended = false;
  P.play(['a.mp3', 'b.mp3'], { gapMs: 700, tailMs: 8000, onIndex: i => idx.push(i), onEnd: () => { ended = true; }, Audio: au.A, setTimeout: t.set });
  assert.deepEqual(au.played, ['a.mp3']);
  au.list[0].end();
  assert.equal(t.flush(), 700, '句間停頓');
  assert.deepEqual(au.played, ['a.mp3', 'b.mp3']);
  au.list[1].end();
  assert.equal(ended, false);
  assert.equal(t.flush(), 8000, '作答時間');
  assert.equal(ended, true);
  assert.deepEqual([...idx], [0, 1]);
});

test('player：play() 被拒（手機自動播放限制）→ onBlocked，不跳過；resume() 從同一句再播', async () => {
  const P = await load(), au = fakeAudio({ reject: true }), t = fakeTimer();
  let blocked = null;
  const h = P.play(['a.mp3', 'b.mp3'], { onBlocked: i => { blocked = i; }, Audio: au.A, setTimeout: t.set });
  await tick();
  assert.equal(blocked, 0);
  assert.equal(t.q.length, 0, '沒有偷偷跳到下一句');
  h.resume();
  assert.deepEqual(au.played, ['a.mp3', 'a.mp3']);
});

test('player：stop() 之後不再播下一句；檔案讀不到就跳過那一句（不卡住考試）', async () => {
  const P = await load(), au = fakeAudio(), t = fakeTimer();
  const h = P.play(['a.mp3', 'b.mp3', 'c.mp3'], { Audio: au.A, setTimeout: t.set });
  au.list[0].onerror?.();
  t.flush();
  assert.deepEqual(au.played, ['a.mp3', 'b.mp3']);
  h.stop();
  au.list[1].end();
  assert.equal(t.q.length, 0);
  assert.equal(au.list[1].paused, true);
});

test('player：檔案錯誤造成的 play() 失敗不算被擋（只跳過那一句）', async () => {
  const P = await load(), t = fakeTimer(), played = [];
  let blocked = false;
  class A { constructor(s) { this.src = s; } play() { played.push(this.src); const e = new Error('x'); e.name = 'NotSupportedError'; setImmediate(() => this.onerror?.()); return Promise.reject(e); } pause() {} }
  P.play(['a.mp3', 'b.mp3'], { Audio: A, setTimeout: t.set, onBlocked: () => { blocked = true; } });
  await tick();
  assert.equal(blocked, false);
  t.flush();
  assert.deepEqual(played, ['a.mp3', 'b.mp3']);
});
