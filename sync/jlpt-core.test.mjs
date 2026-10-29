// 執行：node --test sync/jlpt-core.test.mjs
// 測 js/jlpt-core.js（JLPT 專區的純邏輯：題型、題目標記、檢查、出題、計分）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);

// 每次給一個乾淨的環境：真的 progress.js（假的 localStorage）＋ jlpt-core.js，題庫用參數傳進來
async function load(bank = null) {
  const store = new Map();
  const ctx = vm.createContext({ console, Date, Math, JSON, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } });
  ctx.window = ctx;
  if (bank) ctx.NIHONGO_JLPT = bank;
  for (const f of ['js/progress.js', 'js/jlpt-core.js']) vm.runInContext(await readFile(new URL(f, root), 'utf8'), ctx, { filename: f });
  return ctx;
}
const ctx = () => ({ kanjiLevel: new Map([['雨', 'N5'], ['薬', 'N4']]), ids: new Set() });

test('renderStem：振假名、底線、★、方框號碼', async () => {
  const { JLPT } = await load();
  assert.equal(JLPT.renderStem('{雨|あめ}です'), '<ruby>雨<rt>あめ</rt></ruby>です');
  assert.match(JLPT.renderStem('あしたは　[[雨]]ですか。'), /<u>雨<\/u>/);
  assert.equal((JLPT.renderStem('つぎの　{{_}}　{{★}}　{{_}}　{{_}}　まがって').match(/ord-blank/g) || []).length, 4);
  assert.match(JLPT.renderStem('{{★}}'), /ord-blank star/);
  assert.match(JLPT.renderStem('{{#22}}'), /class="box-no">22</);
  assert.equal(JLPT.renderStem('<b>'), '&lt;b&gt;');
});

test('TYPES：N5 正式題數與小型模擬考題數', async () => {
  const { JLPT } = await load();
  const n5 = Object.entries(JLPT.TYPES).filter(([, t]) => t.full.N5);
  assert.equal(n5.reduce((s, [, t]) => s + t.full.N5, 0), 67);
  assert.equal(n5.reduce((s, [, t]) => s + t.mini, 0), 35);
  assert.equal(JLPT.TYPES.response.choices, 3);
  assert.equal(JLPT.TYPES.usage.full.N5, 0);
  assert.deepEqual([...JLPT.SECTIONS.grammarReading].sort(), ['grammar_form', 'info_search', 'reading_mid', 'reading_short', 'sentence_order', 'text_grammar']);
  for (const t of Object.values(JLPT.TYPES)) assert.ok(t.instruction && t.label, '每個題型都有作答說明與中文名稱');
});

test('validate：答案在選項內、選項不重複、選項數符合題型', async () => {
  const { JLPT } = await load();
  const ok = { id: 'n5-kr-1', level: 'N5', type: 'kanji_reading', section: 'vocab', stem: 'あしたは　[[雨]]ですか。', choices: ['ゆき', 'はれ', 'くもり', 'あめ'], answer: 4, explain: '…', pool: 'practice', rev: 1 };
  assert.deepEqual([...JLPT.validate(ok, ctx())], []);
  assert.ok(JLPT.validate({ ...ok, answer: 5 }, ctx()).length);
  assert.ok(JLPT.validate({ ...ok, choices: ['あめ', 'あめ', 'ゆき', 'はれ'] }, ctx()).length);
  assert.ok(JLPT.validate({ ...ok, type: 'response', section: 'listening', script: [['F', 'お{国|くに}は？']] }, ctx()).length, 'response 只能 3 個選項');
});

test('validate：文字語彙不能有振假名；文法讀解每個漢字都要有振假名；沒標振假名的漢字不能超過級數', async () => {
  const { JLPT } = await load();
  const base = { id: 'x', level: 'N5', choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice', rev: 1 };
  assert.ok(JLPT.validate({ ...base, type: 'context', section: 'vocab', stem: '{雨|あめ}' }, ctx()).some(e => /振假名/.test(e)));
  assert.ok(JLPT.validate({ ...base, type: 'grammar_form', section: 'grammar', stem: '雨です' }, ctx()).some(e => /振假名/.test(e)));
  assert.deepEqual([...JLPT.validate({ ...base, type: 'grammar_form', section: 'grammar', stem: '{薬|くすり}を　のみます' }, ctx())], []);
  assert.ok(JLPT.validate({ ...base, type: 'kanji_reading', section: 'vocab', stem: '[[薬]]' }, ctx()).some(e => /級/.test(e)), '薬 是 N4 漢字');
  assert.ok(JLPT.validate({ ...base, type: 'kanji_reading', section: 'vocab', stem: '[[鬱]]' }, ctx()).some(e => /級/.test(e)), '沒有級數資料的漢字算超出');
});

test('validate：id 重複、聽解沒有 script、rev／pool／explain／section／passage', async () => {
  const { JLPT } = await load();
  const c = ctx(); c.ids.add('dup');
  const base = { id: 'q', level: 'N5', type: 'context', section: 'vocab', stem: 'あ', choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice', rev: 1 };
  assert.ok(JLPT.validate({ ...base, id: 'dup' }, c).some(e => /重複/.test(e)));
  assert.ok(JLPT.validate({ ...base, type: 'point', section: 'listening' }, ctx()).some(e => /script/.test(e)));
  assert.ok(JLPT.validate({ ...base, rev: 0 }, ctx()).some(e => /rev/.test(e)));
  assert.ok(JLPT.validate({ ...base, pool: 'x' }, ctx()).some(e => /pool/.test(e)));
  assert.ok(JLPT.validate({ ...base, explain: '' }, ctx()).some(e => /詳解/.test(e)));
  assert.ok(JLPT.validate({ ...base, section: 'grammar' }, ctx()).some(e => /section/.test(e)));
  assert.ok(JLPT.validate({ ...base, type: 'reading_mid', section: 'reading' }, ctx()).some(e => /passage/.test(e)));
});

// ── Task 5：設定、每日 20 題、回報 ──
const NOW = new Date('2026-11-02T09:00:00').getTime();
function makeBank() {
  const qs = [];
  const mk = (type, i, extra = {}) => ({ id: `${type}-${i}`, level: 'N5', type, section: { context: 'vocab', kanji_reading: 'vocab', paraphrase: 'vocab', grammar_form: 'grammar', text_grammar: 'grammar', point: 'listening' }[type], pool: 'practice', rev: 1, stem: 'あ', choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', ...extra });
  for (const type of ['context', 'kanji_reading', 'paraphrase', 'grammar_form']) {
    for (let i = 1; i <= 10; i++) qs.push(mk(type, i));
    qs.push(mk(type, 'ex', { example: true }));
  }
  for (let i = 1; i <= 10; i++) qs.push(mk('context', `m${i}`, { pool: 'mock' }));
  qs.push(mk('text_grammar', 'p1a', { passage: 'p1' }), mk('text_grammar', 'p1b', { passage: 'p1' }));
  return { voices: { N: 30, M: 21, F: 108 }, levels: { N5: { questions: qs, passages: { p1: { id: 'p1', stem: 'ぶんしょう' } } } } };
}
async function withHistory() {
  const c = await load(makeBank());
  const { Progress, JLPT } = c;
  for (const i of [1, 2, 3]) Progress.record(`jlpt:grammar_form-${i}`, false, { now: NOW - 2 * 3600e3 });
  for (const i of [1, 2, 3]) Progress.record(`jlpt:context-${i}`, true, { now: NOW - 2 * 3600e3 });
  return c;
}

test('dailySet：20 題、不含模擬考專用題、例題、被回報的題；弱點題型優先', async () => {
  const { JLPT } = await withHistory();
  const reported = JLPT.bank('N5').questions.find(q => q.id === 'grammar_form-9');
  JLPT.report(reported);
  const set = JLPT.dailySet({ level: 'N5', now: NOW });
  assert.equal(set.length, 20);
  assert.ok(set.every(q => q.pool === 'practice' && !q.example));
  assert.ok(!set.some(q => q.id === 'grammar_form-9'));
  assert.ok(set.filter(q => q.type === 'grammar_form').length >= 4, '答錯最多的題型最多');
  assert.equal(new Set(set.map(q => q.id)).size, 20, '不重複');
  const p1 = set.filter(q => q.passage === 'p1').length;
  assert.ok(p1 === 0 || p1 === 2, '同一篇文章的題目一起出現');
});

test('dailySet：到期的錯題會出；沒有聽解題時由其他類別補滿', async () => {
  const { JLPT } = await withHistory();
  const set = JLPT.dailySet({ level: 'N5', now: NOW });
  assert.ok(['grammar_form-1', 'grammar_form-2', 'grammar_form-3'].every(id => set.some(q => q.id === id)));
  assert.equal(set.filter(q => q.section === 'listening').length, 0);
  assert.equal(set.length, 20);
});

test('typeStats：各題型正確率', async () => {
  const { JLPT } = await withHistory();
  const s = JLPT.typeStats('N5');
  assert.equal(s.grammar_form.pct, 0); assert.equal(s.context.pct, 1); assert.equal(s.paraphrase.seen, 0);
});

test('回報後不出；題目修正（rev 增加）後恢復出題', async () => {
  const { JLPT, Progress } = await load(makeBank());
  const q = JLPT.bank('N5').questions.find(x => x.id === 'context-3');
  JLPT.report(q);
  assert.ok(JLPT.isReported(q));
  assert.ok(!JLPT.isReported({ ...q, rev: q.rev + 1 }));
  assert.equal(Progress.jlpt().reports['context-3'].rev, 1);
});

test('設定：預設值；修改會寫入 updatedAt；倒數天數；沒有題庫時回傳空的', async () => {
  const { JLPT, Progress } = await load();
  assert.equal(JLPT.settings().examDate, '2027-07-04');
  assert.equal(JLPT.settings().level, 'N5'); assert.equal(JLPT.settings().target, 'N4');
  JLPT.setSettings({ passPct: 0.85 });
  assert.equal(JLPT.settings().passPct, 0.85); assert.ok(Progress.jlpt().settings.updatedAt > 0);
  assert.equal(JLPT.daysLeft(new Date('2027-07-01T09:00')), 3);
  assert.equal(JLPT.bank('N4').questions.length, 0);
  assert.equal(JLPT.qid({ id: 'a' }), 'jlpt:a');
});
