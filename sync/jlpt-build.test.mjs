// 執行：node --test sync/jlpt-build.test.mjs
// 測 tools/build-jlpt.mjs：干擾選項產生、批次審查過濾、錯誤回報
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genChoices, buildLevel } from '../tools/build-jlpt.mjs';

const vocab = [
  { word: '下', reading: 'した', level: 'N5' }, { word: '車', reading: 'くるま', level: 'N5' },
  { word: '学校', reading: 'がっこう', level: 'N5' }, { word: '雨', reading: 'あめ', level: 'N5' },
];
const kanji = [
  { k: '下', level: 'N5', strokes: 3, on: ['か', 'げ'], kun: [['した'], ['しも'], ['もと'], ['さ', 'げる'], ['くだ', 'る'], ['お', 'ろす']] },
  { k: '車', level: 'N5', strokes: 7, on: ['しゃ'], kun: [['くるま']] },
  { k: '里', level: 'N4', strokes: 7, on: ['り'], kun: [['さと']] },
  { k: '見', level: 'N5', strokes: 7, on: ['けん'], kun: [['み', 'る']] },
  { k: '言', level: 'N5', strokes: 7, on: ['げん', 'ごん'], kun: [['い', 'う']] },
  { k: '東', level: 'N5', strokes: 8, on: ['とう'], kun: [['ひがし']] },
  { k: '学', level: 'N5', strokes: 8, on: ['がく'], kun: [['まな', 'ぶ']] },
  { k: '校', level: 'N5', strokes: 10, on: ['こう'], kun: [] },
  { k: '雨', level: 'N5', strokes: 8, on: ['う'], kun: [['あめ'], ['あま']] },
];
const ctx = () => ({ kanjiLevel: new Map(kanji.map(k => [k.k, k.level])), ids: new Set(), vocab, kanji });

test('genChoices：漢字讀音的干擾選項是清濁／長短音／促音變化，且不是該字的合法讀音', () => {
  const r = genChoices('下', 'した', 'kanji_reading', vocab, kanji);
  assert.equal(r.choices.length, 4); assert.equal(r.choices[r.answer - 1], 'した');
  assert.equal(new Set(r.choices).size, 4);
  for (const c of r.choices) if (c !== 'した') assert.ok(!['した', 'しも', 'もと', 'さ', 'さげる', 'くだ', 'くだる', 'お', 'おろす', 'か', 'げ'].includes(c), c);
});

test('genChoices：表記的干擾選項是形近字，且讀音不同於答案', () => {
  const r = genChoices('車', 'くるま', 'orthography', vocab, kanji);
  assert.equal(r.choices[r.answer - 1], '車'); assert.equal(new Set(r.choices).size, 4);
  assert.ok(r.choices.every(c => [...c].length === 1));
});

test('genChoices：同一個種子結果相同（建置可重現），答案位置會分散', () => {
  assert.deepEqual(genChoices('学校', 'がっこう', 'kanji_reading', vocab, kanji, 'a'), genChoices('学校', 'がっこう', 'kanji_reading', vocab, kanji, 'a'));
  const pos = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(s => genChoices('学校', 'がっこう', 'kanji_reading', vocab, kanji, s).answer));
  assert.ok(pos.size >= 2);
});

const q = (id, extra = {}) => ({ id, type: 'context', stem: 'きょうは　（　　）です。', choices: ['あめ', 'はれ', 'くもり', 'ゆき'], answer: 1, explain: '…', pool: 'practice', ...extra });
const unreviewedBatch = { batch: 'u', level: 'N5', reviewed: null, questions: [q('unrev-1')] };
const reviewedBatchWithOneBadQuestion = { batch: 'r', level: 'N5', reviewed: { by: 'x', at: '2026-10-30' }, questions: [q('ok-1'), q('bad-1', { answer: 9 }), { id: 'gen-1', type: 'kanji_reading', stem: 'あしたは　[[雨]]ですか。', gen: { word: '雨', reading: 'あめ' }, explain: '…', pool: 'practice' }] };
const listeningBatch = { batch: 'l', level: 'N5', reviewed: { by: 'x', at: '2026-10-30' }, questions: [{ id: 'l-1', type: 'response', script: [['F', 'お{国|くに}は？']], choices: ['a', 'b', 'c'], answer: 1, explain: '…', pool: 'practice' }] };

test('buildLevel：沒審查的批次不輸出；有錯的題目回報錯誤；聽解缺錄音就不輸出', () => {
  const out = buildLevel([unreviewedBatch, reviewedBatchWithOneBadQuestion, listeningBatch], ctx(), { audioExists: () => false });
  assert.ok(out.errors.some(e => e.includes('bad-1')));
  assert.ok(out.questions.every(x => x.section !== 'listening'));
  assert.ok(!out.questions.some(x => x.id.startsWith('unrev')));
  assert.ok(!out.questions.some(x => x.id === 'bad-1'));
  const g = out.questions.find(x => x.id === 'gen-1');
  assert.equal(g.choices[g.answer - 1], 'あめ'); assert.equal(g.section, 'vocab'); assert.equal(g.rev, 1); assert.equal(g.level, 'N5');
});

test('buildLevel：聽解有錄音就輸出；文章題帶上 passage 並檢查文章的振假名', () => {
  const out = buildLevel([listeningBatch], ctx(), { audioExists: () => true });
  assert.equal(out.questions.length, 1);
  const rb = { batch: 'p', level: 'N5', reviewed: { by: 'x', at: 'd' }, passages: { p1: { stem: '雨が　ふります。' } }, questions: [{ id: 'p-1', type: 'reading_short', passage: 'p1', stem: 'どうですか。', choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice' }] };
  const o2 = buildLevel([rb], ctx(), {});
  assert.ok(o2.errors.some(e => /p1/.test(e) && /振假名/.test(e)), '讀解文章的漢字要有振假名');
  const missing = { ...rb, passages: {} };
  assert.ok(buildLevel([missing], ctx(), {}).errors.some(e => /p1/.test(e)), '引用不存在的文章');
});

test('genChoices：長音只加在自然的位置（不在ん、っ、小字、母音之前）', () => {
  const v = [{ word: '先生', reading: 'せんせい' }, { word: '電車', reading: 'でんしゃ' }, { word: '白い', reading: 'しろい' }];
  const all = ['先生/せんせい', '電車/でんしゃ', '白い/しろい'].flatMap(s => { const [w, r] = s.split('/'); return genChoices(w, r, 'kanji_reading', v, [], 'x').choices; });
  for (const bad of ['せいんせい', 'でいんしゃ', 'しろうい']) assert.ok(!all.includes(bad), bad);
});

test('buildLevel：文章文法題要有 blank，而且文章裡要有對應的方框', () => {
  const b = { batch: 't', level: 'N5', reviewed: { by: 'x', at: 'd' }, passages: { p: { stem: 'あした　{{#1}}　いきます。' } }, questions: [
    { id: 't-1', type: 'text_grammar', passage: 'p', blank: 1, choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice' },
    { id: 't-2', type: 'text_grammar', passage: 'p', blank: 2, choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice' },
    { id: 't-3', type: 'text_grammar', passage: 'p', choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice' }] };
  const out = buildLevel([b], ctx(), {});
  assert.deepEqual(out.questions.map(q => q.id), ['t-1']);
  assert.ok(out.errors.some(e => e.includes('t-2') && /方框/.test(e)));
  assert.ok(out.errors.some(e => e.includes('t-3') && /blank/.test(e)));
});
