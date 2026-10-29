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

// ── Task 7：文章（表格、方框號碼對應題號）──
test('renderStem：| 開頭的行變成表格；方框號碼可以換成畫面上的題號', async () => {
  const { JLPT } = await load();
  assert.match(JLPT.renderStem('|じかん|ばしょ|\n|9じ|１かい|'), /<table[\s\S]*<td>9じ<\/td>/);
  assert.match(JLPT.renderStem('おしらせ\n|a|b|\n|c|d|\nおわり'), /^おしらせ<br><table[\s\S]*<\/table>おわり$/);
  assert.match(JLPT.renderStem('{{#1}}と{{#2}}', { boxNo: { 1: 22, 2: 23 } }), /box-no">22<[\s\S]*box-no">23</);
  assert.match(JLPT.renderStem('{{#1}}', { boxNo: { 1: 5 }, current: 1 }), /box-no current">5</);
});

// ── Task 8：組卷與考試狀態 ──
function makeMockBank({ paraphraseMock = 8 } = {}) {
  const qs = [], passages = {};
  const SEC = { kanji_reading: 'vocab', orthography: 'vocab', context: 'vocab', paraphrase: 'vocab', grammar_form: 'grammar', sentence_order: 'grammar', text_grammar: 'grammar', reading_short: 'reading', reading_mid: 'reading', info_search: 'reading', task: 'listening', point: 'listening', utterance: 'listening', response: 'listening' };
  const add = (type, id, extra = {}) => qs.push({ id, level: 'N5', type, section: SEC[type], pool: 'mock', rev: 1, stem: 'あ', choices: type === 'utterance' || type === 'response' ? ['a', 'b', 'c'] : ['a', 'b', 'c', 'd'], answer: 1, explain: '…', ...extra });
  for (const type of ['kanji_reading', 'orthography', 'context', 'grammar_form', 'sentence_order', 'info_search', 'task', 'point', 'utterance', 'response']) for (let i = 1; i <= 8; i++) add(type, `${type}-${i}`, type === 'info_search' ? { passage: `is${i}` } : {});
  for (let i = 1; i <= paraphraseMock; i++) add('paraphrase', `paraphrase-${i}`);
  for (let i = 1; i <= 8; i++) add('paraphrase', `paraphrase-p${i}`, { pool: 'practice' });
  for (let g = 1; g <= 3; g++) { passages[`tg${g}`] = { stem: '{{#1}}{{#2}}{{#3}}' }; for (let b = 1; b <= 3; b++) add('text_grammar', `tg${g}-${b}`, { passage: `tg${g}`, blank: b }); }
  for (let g = 1; g <= 3; g++) { passages[`rm${g}`] = { stem: 'ぶん' }; for (let b = 1; b <= 2; b++) add('reading_mid', `rm${g}-${b}`, { passage: `rm${g}` }); }
  for (let i = 1; i <= 8; i++) { passages[`rs${i}`] = { stem: 'ぶん' }; add('reading_short', `rs-${i}`, { passage: `rs${i}` }); }
  for (let i = 1; i <= 8; i++) passages[`is${i}`] = { stem: '|a|b|' };
  return { voices: { N: 30, M: 21, F: 108 }, levels: { N5: { questions: qs, passages } } };
}
const secCount = (c, p, key) => { const s = p.sections.find(x => x.key === key); const by = {}; for (const id of s.qids) { const q = c.JLPT.bank('N5').questions.find(x => x.id === id); by[q.type] = (by[q.type] || 0) + 1; } return by; };

test('assembleMock mini：三科順序、題數符合 §7.1、時間依比例、優先沒考過的模擬考題、文章題整組', async () => {
  const c = await load(makeMockBank());
  const p = c.JLPT.assembleMock({ level: 'N5', kind: 'mini', now: NOW });
  assert.deepEqual([...p.sections.map(s => s.key)], ['vocab', 'grammarReading', 'listening']);
  assert.deepEqual({ ...secCount(c, p, 'vocab') }, { kanji_reading: 3, orthography: 3, context: 3, paraphrase: 2 });
  assert.deepEqual({ ...secCount(c, p, 'grammarReading') }, { grammar_form: 4, sentence_order: 2, text_grammar: 3, reading_short: 1, reading_mid: 2, info_search: 1 });
  assert.deepEqual({ ...secCount(c, p, 'listening') }, { task: 3, point: 3, utterance: 2, response: 3 });
  assert.equal(p.sections[0].seconds, 660); assert.equal(p.sections[1].seconds, 1440); assert.equal(p.sections[2].seconds, null);
  assert.equal(p.fresh, true);
  const tg = p.sections[1].qids.filter(id => id.startsWith('tg'));
  assert.equal(new Set(tg.map(id => id.split('-')[0])).size, 1, '文章文法同一篇三題一起');
  assert.ok(!p.sections.flatMap(s => s.qids).some(id => id.includes('-p')), '不用練習題');
});

test('assembleMock：考過的題目不再出；某題型新題不夠 → 用最早考過的補、fresh=false', async () => {
  const c = await load(makeMockBank({ paraphraseMock: 3 }));
  const p1 = c.JLPT.assembleMock({ level: 'N5', kind: 'mini', now: NOW });
  c.Progress.saveJlpt(j => j.mocks.push({ at: NOW, level: 'N5', kind: 'mini', qids: p1.sections.flatMap(s => s.qids), answers: {} }));
  const p2 = c.JLPT.assembleMock({ level: 'N5', kind: 'mini', now: NOW + 1 });
  const used = new Set(p1.sections.flatMap(s => s.qids));
  assert.ok(!p2.sections.flatMap(s => s.qids).some(id => used.has(id) && !id.startsWith('paraphrase')), '其他題型都換新題');
  assert.equal(p2.fresh, false, 'paraphrase 模擬考題只剩 1 題，不夠');
  assert.equal(secCount(c, p2, 'vocab').paraphrase, 2);
});

test('assembleMock full：官方題數與時間', async () => {
  const c = await load(makeMockBank());
  const p = c.JLPT.assembleMock({ level: 'N5', kind: 'full', now: NOW });
  assert.equal(p.sections[0].seconds, 1200); assert.equal(p.sections[1].seconds, 2400);
  assert.equal(p.sections[0].qids.length, 21);
});

test('考試狀態：開始、剩餘時間、暫停（聽解不能）、下一科不能回頭、重新整理時恢復或中斷', async () => {
  const c = await load(makeMockBank()), J = c.JLPT;
  const p = J.assembleMock({ level: 'N5', kind: 'mini', now: NOW });
  let a = J.startAttempt(p, NOW);
  assert.equal(J.timeLeft(NOW + 60e3), 600e3);
  J.pauseAttempt(NOW + 60e3);
  assert.equal(J.timeLeft(NOW + 600e3), 600e3, '暫停時時間不走');
  J.resumeTimer(NOW + 600e3);
  assert.equal(J.timeLeft(NOW + 660e3), 540e3);
  assert.equal(J.attempt().everPaused, true);
  J.nextSection(NOW + 700e3);
  assert.equal(J.attempt().sectionIndex, 1);
  assert.equal(J.timeLeft(NOW + 700e3), 1440e3);
  a = J.resumeAttempt(NOW + 700e3 + 1441e3);
  assert.equal(a.sectionIndex, 2, '時間到：恢復時自動交出這一科');
  assert.equal(J.pauseAttempt(NOW + 2200e3), false, '聽解不能暫停');
  J.saveAttempt({ ...J.attempt(), listenIndex: 3 });
  assert.equal(J.resumeAttempt(NOW + 2300e3).interrupted, true, '聽解中途重新整理 → 中斷');
  J.clearAttempt(); assert.equal(J.attempt(), null);
});

// ── Task 9：計分、計入規則、畢業 ──
function bigMockBank() {
  const b = makeMockBank({ paraphraseMock: 30 }), qs = b.levels.N5.questions;
  // 每個題型補到 30 題、文章文法和中篇各補到 10 篇，讓每週都有新題
  const more = [];
  for (const q of qs.filter(x => !x.passage && x.pool === 'mock' && !x.id.startsWith('paraphrase'))) for (let k = 9; k <= 30; k++) if (q.id.endsWith('-1')) more.push({ ...q, id: q.id.replace(/-1$/, `-${k}`) });
  for (let g = 4; g <= 10; g++) {
    b.levels.N5.passages[`tg${g}`] = { stem: '{{#1}}{{#2}}{{#3}}' };
    for (let k = 1; k <= 3; k++) more.push({ ...qs.find(x => x.id === 'tg1-1'), id: `tg${g}-${k}`, passage: `tg${g}`, blank: k });
    b.levels.N5.passages[`rm${g}`] = { stem: 'ぶん' };
    for (let k = 1; k <= 2; k++) more.push({ ...qs.find(x => x.id === 'rm1-1'), id: `rm${g}-${k}`, passage: `rm${g}` });
  }
  for (let i = 9; i <= 30; i++) { b.levels.N5.passages[`rs${i}`] = { stem: 'ぶん' }; b.levels.N5.passages[`is${i}`] = { stem: '|a|b|' }; more.push({ ...qs.find(x => x.id === 'rs-1'), id: `rs-${i}`, passage: `rs${i}` }, { ...qs.find(x => x.id === 'info_search-1'), id: `info_search-${i}`, passage: `is${i}` }); }
  qs.push(...more);
  return b;
}
// 考一份：ratio 是答對的比例（依題目順序前面答對、後面答錯）
function takeMock(c, at, ratio) {
  const J = c.JLPT, p = J.assembleMock({ level: 'N5', kind: 'mini', now: at });
  const a = J.startAttempt(p, at), ids = p.sections.flatMap(s => s.qids);
  ids.forEach((id, i) => { a.answers[id] = i < Math.round(ids.length * ratio) ? 1 : 2; });
  J.saveAttempt(a);
  return J.finishAttempt(at);
}
const DAY = 864e5;

test('score：正確率、估計分數、各科最低分；聽解沒過最低分 → 不合格', async () => {
  const c = await load(makeMockBank()), J = c.JLPT, bank = J.bank('N5');
  const lkIds = bank.questions.filter(q => q.section !== 'listening').slice(0, 24).map(q => q.id);
  const lIds = bank.questions.filter(q => q.section === 'listening').slice(0, 10).map(q => q.id);
  const plan = { level: 'N5', kind: 'mini', fresh: true, sections: [{ key: 'vocab', qids: lkIds.slice(0, 12) }, { key: 'grammarReading', qids: lkIds.slice(12) }, { key: 'listening', qids: lIds }] };
  const answers = {};
  lkIds.forEach((id, i) => { answers[id] = i < 18 ? 1 : 2; });
  lIds.forEach((id, i) => { answers[id] = i < 3 ? 1 : 2; });
  const r = J.score(plan, answers);
  assert.equal(r.total.correct, 21); assert.equal(r.total.n, 34);
  assert.equal(r.lk.est, 90); assert.equal(r.lk.pass, true);
  assert.equal(r.listen.est, 18); assert.equal(r.listen.pass, false);
  assert.equal(r.estTotal, 108); assert.equal(r.estPass, false);
  assert.equal(r.byType.kanji_reading.n > 0, true);
  const noListen = J.score({ ...plan, sections: plan.sections.slice(0, 2) }, answers);
  assert.equal(noListen.listen, null); assert.equal(noListen.estPass, null);
});

test('finishAttempt：記錄模擬考、每題進 SRS；同一週第二份、不是新題的不計入', async () => {
  const c = await load(bigMockBank()), J = c.JLPT;
  const m1 = takeMock(c, NOW, 1);
  assert.equal(m1.counted, true); assert.equal(J.attempt(), null);
  assert.ok(c.Progress.stat('jlpt:' + m1.qids[0]).seen === 1, '每題都記錄作答');
  const m2 = takeMock(c, NOW + DAY, 1);
  assert.equal(m2.counted, false); assert.match(m2.reasons.join(), /這週/);
  assert.equal(J.weekKey(new Date(NOW)), '2026-11-02'); assert.equal(J.weekKey(new Date(NOW + 6 * DAY)), '2026-11-02'); assert.equal(J.weekKey(new Date(NOW + 7 * DAY)), '2026-11-09');
  const c2 = await load(makeMockBank({ paraphraseMock: 1 }));
  const m3 = takeMock(c2, NOW, 1);
  assert.equal(m3.counted, false); assert.match(m3.reasons.join(), /新題/);
});

test('graduation：連續兩份計入的模擬考 ≥ 80% 且各科過最低分才畢業；中間沒過就重來；沒有 N4 題庫時留在 N5', async () => {
  const c = await load(bigMockBank()), J = c.JLPT;
  takeMock(c, NOW, 1);
  takeMock(c, NOW + 7 * DAY, 0.5);
  takeMock(c, NOW + 14 * DAY, 1);
  assert.equal(J.graduation('N5').done, false, '中間那份沒過');
  takeMock(c, NOW + 21 * DAY, 0.9);
  const g = J.graduation('N5');
  assert.equal(g.done, true); assert.equal(g.last.length, 2);
  assert.ok(c.Progress.jlpt().graduated.N5 > 0);
  assert.equal(J.settings().level, 'N5', 'N4 題庫還沒有，留在 N5');
});

test('mockPoolLeft：各題型還沒考過的模擬考題數', async () => {
  const c = await load(makeMockBank()), J = c.JLPT;
  assert.equal(J.mockPoolLeft('N5').kanji_reading, 8);
  takeMock(c, NOW, 1);
  assert.equal(J.mockPoolLeft('N5').kanji_reading, 5);
  assert.equal(J.mockPoolLeft('N5').text_grammar, 6);
});
