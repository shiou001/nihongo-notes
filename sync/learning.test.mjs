import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, readdir } from 'node:fs/promises';
import { buildContent } from './parse-notion-md.mjs';

const root = new URL('../', import.meta.url);
async function engine() {
  const stored = new Map();
  const ctx = vm.createContext({ console, Date, localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) } });
  ctx.window = ctx;
  for (const file of ['data/content.js', 'data/external.js', 'js/data-merge.js', 'js/progress.js', 'js/study.js', 'js/quiz.js']) vm.runInContext(await readFile(new URL(file, root), 'utf8'), ctx);
  return ctx;
}
const day = 864e5, start = Date.UTC(2026, 8, 16, 12);

test('同日重做、有提示答對和舊 streak 不會變成跨日熟練', async () => {
  const { Progress: P, Quiz: Q } = await engine();
  assert.equal(Q.isMastered({ streak: 30 }), false);
  P.record('x', true, { now: start });
  P.record('x', true, { now: start + 1000 });
  P.record('x', true, { now: start + 2000 });
  assert.equal(P.stat('x').retained, 1);
  assert.equal(Q.isMastered(P.stat('x')), false);
  P.record('x', true, { now: start + day, assisted: true });
  assert.equal(P.stat('x').retained, 0);
  assert.equal(P.stat('x').assisted, 1);
  assert.equal(P.stat('x').due, start + day + 600e3);
});

test('到期後跨日答對才熟練，提前複習不延後原排程', async () => {
  const { Progress: P, Quiz: Q } = await engine();
  P.record('x', true, { now: start });
  P.record('x', true, { now: start + day });
  assert.equal(P.stat('x').due, start + 4 * day);
  P.record('x', true, { now: start + 2 * day });
  assert.equal(P.stat('x').retained, 2);
  assert.equal(P.stat('x').due, start + 4 * day);
  P.record('x', true, { now: start + 4 * day });
  assert.equal(Q.isMastered(P.stat('x')), true);
  P.record('x', false, { now: start + 5 * day });
  assert.equal(Q.isMastered(P.stat('x')), false);
});

test('複習排程與提示紀錄可透過既有合併規則保存', async () => {
  const { Progress: P } = await engine();
  P.record('x', true, { now: start, assisted: true });
  const merged = P.merge({ items: { x: { seen: 0 } } }, JSON.parse(JSON.stringify(P.load())));
  assert.equal(merged.items.x.due, start + 600e3);
  assert.equal(merged.items.x.firstSeen, start);
  P.replace(merged);
  assert.equal(P.stat('x').assisted, 1);
});

test('每日題目只出選定程度且到期項目在新題之前，每輪不重複單字', async () => {
  const c = await engine(), { Progress: P, Quiz: Q, Study: S } = c;
  S.set({ level: 'N4', weekly: 15, goal: '考試複習' });
  const due = c.NIHONGO_DATA.vocab.find(v => v.level === 'N4');
  P.record(due.id, false, { now: start - day });
  const qs = Q.buildQuestions(S.dailyOptions(start));
  assert.equal(qs[0].id, due.id);
  assert.ok(qs.every(q => q.item.level === 'N4'));
  assert.equal(new Set(qs.map(q => q.id)).size, qs.length);
  assert.ok(qs.filter(q => q.learnFirst).length <= 3);
});

test('每日新學上限跨輪次保留；未到期項目不被強塞入每日題目', async () => {
  const c = await engine(), { Progress: P, Quiz: Q, Study: S } = c;
  const opts = S.dailyOptions(start);
  const first = Q.buildQuestions(opts);
  assert.equal(first.length, 5);
  for (const q of first) P.record(q.id, true, { now: start });
  assert.equal(Q.buildQuestions(opts).length, 0);
  assert.ok(Q.buildQuestions(S.dailyOptions(start + day)).length > 0);
});

test('每週上限不因每日向上取整而超量', async () => {
  const c = await engine(), { Progress: P, Quiz: Q, Study: S } = c;
  const monday = new Date(start); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7); monday.setHours(12, 0, 0, 0);
  for (const v of c.NIHONGO_DATA.vocab.filter(v => v.level === 'N5').slice(0, 29)) P.record(v.id, true, { now: +monday });
  const questions = Q.buildQuestions({ ...S.dailyOptions(start), count: 100 });
  assert.equal(questions.filter(q => q.learnFirst).length, 1);
});

test('讀音題不直接帶中文答案，填空不顯示待填字，輸入接受片假名', async () => {
  const { Quiz: Q } = await engine();
  const qs = Q.buildQuestions({ types: ['vocab_reading'], levels: ['N5'], count: 100 });
  assert.ok(qs.length > 0);
  assert.ok(qs.every(q => q.sub === '' && q.prompt !== q.answer));
  const fill = Q.buildQuestions({ types: ['grammar_cloze'], count: 50 });
  assert.ok(fill.length > 0);
  assert.ok(fill.every(q => q.input && [...q.prompt].filter(ch => ch === '＿').length === 1 && !q.prompt.includes(q.answer)));
  assert.equal(Q.checkAnswer({ answer: 'がくせい' }, ' ガクセイ '), true);
  assert.equal(Q.checkAnswer({ answer: 'きょう' }, 'きよう'), false);
});

test('填空只挑答案出現一次的例句，而且只有一個空格', async () => {
  const c = await engine(), Q = c.Quiz;
  c.NIHONGO_DATA.grammar = [
    { id: 'g_once', pattern: 'の', meaning: '所屬、修飾', example: '私の本', source: '文法筆記 › 助詞' },
    { id: 'g_twice', pattern: 'は', meaning: '主題標記', example: '私は学生です。彼は先生です。', source: '文法筆記 › 助詞' },
  ];
  const qs = Q.buildQuestions({ types: ['grammar_cloze'], count: 20 });
  assert.equal(qs.length, 1);                                // 出現兩次的例句不出題
  assert.equal(qs[0].id, 'g_once');
  assert.equal(qs[0].prompt, '私＿本');                      // 一個空格，不是兩個底線
  assert.ok(qs[0].promptHtml.includes('cloze-blank') && !qs[0].promptHtml.includes('の'));
});

test('單元與頁面篩選確實限制題庫，小題庫使用輸入題而非唯一選項', async () => {
  const c = await engine(), Q = c.Quiz;
  const source = c.NIHONGO_DATA.grammar.find(g => g.pattern === 'どこ').source;
  const qs = Q.buildQuestions({ types: ['grammar', 'grammar_cloze'], source, count: 50 });
  assert.ok(qs.length);
  assert.ok(qs.every(q => q.item.source === source));
  const page = Q.buildQuestions({ types: ['grammar', 'phrase'], page: '文法筆記', count: 100 });
  assert.ok(page.every(q => q.item.source.startsWith('文法筆記 › ')));
  c.NIHONGO_DATA.vocab = [{ id: 'single', word: '春', reading: 'はる', meaning: '春天', level: 'N5' }];
  const lone = Q.buildQuestions({ types: ['vocab_reading'], levels: ['N5'] });
  assert.equal(lone.length, 1);
  assert.equal(lone[0].input, true);
});

test('校訂可從原始快取重建，保留中文學生並修正日文学生', async () => {
  const dir = new URL('cache/', import.meta.url);
  const mds = await Promise.all((await readdir(dir)).filter(f => f.endsWith('.md')).map(f => readFile(new URL(f, dir), 'utf8')));
  const data = buildContent(mds, '2026-09-16');
  const notes = JSON.stringify(data.pages);
  assert.ok(!notes.includes('前面一定是受詞'));
  assert.ok(!notes.includes('只作受詞助詞'));
  assert.ok(!notes.includes('學生では'));
  assert.ok(notes.includes('我是學生'));
  assert.ok(notes.includes('橋を渡ります'));
  assert.ok(notes.includes('o（輸入法打 wo）'));
  assert.equal(data.grammar.find(g => g.pattern === 'どこ').category, '疑問詞');
  assert.ok(data.grammar.every(g => !g.example.includes('**')));
});

test('所有生成選擇題答案唯一且至少有兩個選項', async () => {
  const c = await engine();
  for (const type of ['vocab_meaning', 'vocab_reading', 'vocab_word', 'grammar', 'phrase', 'kana']) {
    const qs = c.Quiz.buildQuestions({ types: [type], count: 2000 });
    for (const q of qs) {
      if (q.input) continue;
      assert.ok(q.choices.length >= 2);
      assert.equal(q.choices.filter(x => x === q.answer).length, 1);
      assert.equal(new Set(q.choices).size, q.choices.length);
    }
  }
});

test('學習設定可重讀且錯誤設定退回預設；週數與80%目標一致', async () => {
  const { Study: S } = await engine();
  S.set({ level: 'N3', goal: '日常會話', weekly: '30' });
  assert.equal(S.profile().level, 'N3');
  assert.equal(S.estimate(722, 0).target, 578);
  assert.equal(S.estimate(722, 0).weeks, 20);
  assert.equal(S.estimate(722, 580).weeks, 0);
  S.set({ level: 'bad', weekly: -1 });
  assert.equal(S.profile().level, 'N5');
  assert.equal(S.profile().weekly, 30);
});
