// 執行：node --test sync/merge-progress.test.mjs
// 測 js/progress.js 的 merge()（跨裝置合併規則）
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('../js/progress.js');
const { merge } = window.Progress;

test('同一題取看過次數多的', () => {
  const a = { items: { x: { seen: 3, correct: 3, wrong: 0, streak: 3, last: 100 } } };
  const b = { items: { x: { seen: 5, correct: 3, wrong: 2, streak: 0, last: 50 } } };
  assert.deepEqual(merge(a, b).items.x, b.items.x);
  assert.deepEqual(merge(b, a).items.x, b.items.x);
});

test('看過次數相同時取最後作答時間晚的', () => {
  const a = { items: { x: { seen: 2, correct: 2, wrong: 0, streak: 2, last: 200 } } };
  const b = { items: { x: { seen: 2, correct: 1, wrong: 1, streak: 0, last: 100 } } };
  assert.equal(merge(a, b).items.x.last, 200);
  assert.equal(merge(b, a).items.x.last, 200);
});

test('兩邊各自的題目都保留', () => {
  const m = merge({ items: { a: { seen: 1 } } }, { items: { b: { seen: 1 } } });
  assert.deepEqual(Object.keys(m.items).sort(), ['a', 'b']);
});

test('days 聯集排序，sessions 以 at 去重', () => {
  const a = { days: ['2026-09-12', '2026-09-10'], sessions: [{ at: 1, score: 1, total: 10 }, { at: 2, score: 2, total: 10 }] };
  const b = { days: ['2026-09-11', '2026-09-10'], sessions: [{ at: 2, score: 2, total: 10 }, { at: 3, score: 3, total: 10 }] };
  const m = merge(a, b);
  assert.deepEqual(m.days, ['2026-09-10', '2026-09-11', '2026-09-12']);
  assert.deepEqual(m.sessions.map(s => s.at), [1, 2, 3]);
});

test('空值與缺欄位不會爆', () => {
  assert.deepEqual(merge(null, undefined), { items: {}, days: [], sessions: [] });
  assert.deepEqual(merge({}, { items: { z: { seen: 1 } } }).items.z, { seen: 1 });
});
