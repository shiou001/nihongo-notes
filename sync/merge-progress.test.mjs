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
  assert.deepEqual(merge(null, undefined), { items: {}, days: [], sessions: [], jlpt: { settings: null, mocks: [], reports: {}, graduated: {} } });
  assert.deepEqual(merge({}, { items: { z: { seen: 1 } } }).items.z, { seen: 1 });
});

test('jlpt：模擬考以 at 聯集、不受 sessions 200 筆限制；設定取 updatedAt 新的；回報與畢業聯集', () => {
  const a = { items: {}, days: [], sessions: [], jlpt: { settings: { level: 'N5', examDate: '2027-07-04', updatedAt: 5 }, mocks: [{ at: 1 }, { at: 2 }], reports: { q1: { at: 10, rev: 1 } }, graduated: {} } };
  const b = { items: {}, days: [], sessions: [], jlpt: { settings: { level: 'N4', examDate: '2027-12-05', updatedAt: 9 }, mocks: [{ at: 2 }, { at: 3 }], reports: { q2: { at: 11, rev: 2 } }, graduated: { N5: 7 } } };
  const m = merge(a, b);
  assert.deepEqual(m.jlpt.mocks.map(x => x.at), [1, 2, 3]);
  assert.equal(m.jlpt.settings.level, 'N4');
  assert.deepEqual(Object.keys(m.jlpt.reports).sort(), ['q1', 'q2']);
  assert.equal(m.jlpt.graduated.N5, 7);
  assert.deepEqual(merge(b, a).jlpt, m.jlpt);
});

test('jlpt：同一題回報取較晚的；同級畢業取較早的', () => {
  const a = { jlpt: { reports: { q: { at: 5, rev: 1 } }, graduated: { N5: 30 } } };
  const b = { jlpt: { reports: { q: { at: 9, rev: 2 } }, graduated: { N5: 20 } } };
  const m = merge(a, b);
  assert.deepEqual(m.jlpt.reports.q, { at: 9, rev: 2 });
  assert.equal(m.jlpt.graduated.N5, 20);
});

test('jlpt：舊資料沒有 jlpt 也能合併，得到預設空結構', () => {
  const m = merge({ items: {} }, { items: {} });
  assert.deepEqual(m.jlpt, { settings: null, mocks: [], reports: {}, graduated: {} });
});

test('jlpt：replace 保留 jlpt；load 補上預設；saveJlpt 會寫入', () => {
  window.Progress.replace({ items: {}, days: [], sessions: [], jlpt: { settings: { level: 'N5', updatedAt: 1 }, mocks: [{ at: 1 }], reports: {}, graduated: {} } });
  assert.equal(window.Progress.jlpt().mocks.length, 1);
  window.Progress.saveJlpt(j => { j.mocks.push({ at: 2 }); });
  assert.equal(window.Progress.jlpt().mocks.length, 2);
  window.Progress.replace({ items: {}, days: [], sessions: [] });
  assert.deepEqual(window.Progress.jlpt(), { settings: null, mocks: [], reports: {}, graduated: {} });
});
