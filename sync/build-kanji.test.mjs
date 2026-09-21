// 執行：node --test sync/build-kanji.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseOpenCC, normalizeKun, buildKanji } from './build-kanji.mjs';
import { extractJlpt } from './extract-kanjidic.mjs';

globalThis.window = {};
await import('../js/kanji-align.js');
const A = window.KanjiAlign;

test('OpenCC 對照：日本字形 → 繁體，可有多個', () => {
  const m = parseOpenCC('# 註解\n気\t氣\n弁\t辨 辯 瓣\n');
  assert.deepEqual(m.get('気'), ['氣']);
  assert.deepEqual(m.get('弁'), ['辨', '辯', '瓣']);
});

test('訓讀整理：分出送假名、拿掉 - 記號、去重', () => {
  assert.deepEqual(normalizeKun(['い.きる', 'う.まれる', '-う', 'なま', 'なま-', 'い.きる']), [['い', 'きる'], ['う', 'まれる'], ['う'], ['なま']]);
});

test('抽取：留 JLPT 字和不在表裡的常用漢字，排除 WaniKani 欄位', () => {
  const out = extractJlpt({
    生: { jlpt_new: 5, strokes: 5, readings_on: ['せい'], wk_level: 1, wk_meanings: ['x'] },
    分: { jlpt_new: null, grade: 2, readings_on: ['ぶん'] },
    鬱: { jlpt_new: null, grade: null },
    蘂: { jlpt_new: null, grade: 9 },
  });
  assert.deepEqual(Object.keys(out), ['生', '分']);
  assert.ok(!Object.keys(out['生']).some(f => f.startsWith('wk_')));
});

test('轉檔：繁體對照、和繁體相同時為空、依等級排序', () => {
  const kanji = buildKanji({ 気: { jlpt_new: 5, freq: 113, readings_on: ['き'], readings_kun: ['いき'], meanings: ['Spirit'] }, 駅: { jlpt_new: 4, freq: 724, readings_on: ['えき'], readings_kun: [] }, 日: { jlpt_new: 5, freq: 1, readings_on: ['にち'], readings_kun: ['ひ'] } },
    new Map([['気', ['氣']], ['駅', ['驛']]]));
  assert.deepEqual(kanji.map(k => k.k), ['日', '気', '駅']);
  assert.deepEqual(kanji[1].trad, ['氣']);
  assert.deepEqual(kanji[0].trad, []);
  assert.ok(kanji.every(k => k.id.startsWith('kj_')));
});

// 對齊：用一份小小的讀音表，結果才穩定
const K = {
  学: { on: ['がく'], kun: [['まな', 'ぶ']] }, 生: { on: ['せい', 'しょう'], kun: [['い', 'きる'], ['う', 'まれる'], ['なま']] },
  一: { on: ['いち', 'いつ'], kun: [['ひと']] }, 本: { on: ['ほん'], kun: [['もと']] }, 人: { on: ['じん', 'にん'], kun: [['ひと']] },
  今: { on: ['こん', 'きん'], kun: [['いま']] }, 日: { on: ['にち', 'じつ'], kun: [['ひ'], ['か']] }, 終: { on: ['しゅう'], kun: [['お', 'わる']] },
  棚: { on: ['ほう'], kun: [['たな']] }, 運: { on: ['うん'], kun: [['はこ', 'ぶ']] }, 動: { on: ['どう'], kun: [['うご', 'く']] },
  消: { on: ['しょう'], kun: [['け', 'す'], ['き', 'える']] },
  入: { on: ['にゅう'], kun: [['い', 'る'], ['い', 'り'], ['い', 'れる'], ['はい', 'る']] }, 口: { on: ['こう', 'く'], kun: [['くち']] },
  汚: { on: ['お'], kun: [['きたな', 'い'], ['けが', 'す'], ['よご', 'れる']] }, 家: { on: ['か', 'け'], kun: [['いえ'], ['うち'], ['や']] },
};
const look = c => K[c];
const segs = (w, r) => A.align(w, r, look)?.filter(p => p.kanji).map(p => `${p.ch}=${p.reading}`).join(' ') ?? null;

test('對齊：一般音讀', () => assert.equal(segs('学生', 'がくせい'), '学=がく 生=せい'));
test('對齊：訓讀加送假名', () => assert.equal(segs('生きる', 'いきる'), '生=い'));
test('對齊：促音與半濁音', () => assert.equal(segs('一本', 'いっぽん'), '一=いっ 本=ぽん'));
test('對齊：々 重複上一個字並連濁', () => assert.equal(segs('人々', 'ひとびと'), '人=ひと 々=びと'));
test('對齊：連濁', () => assert.equal(segs('本棚', 'ほんだな'), '本=ほん 棚=だな'));
test('對齊：送假名寫法較短（終る／おわる）', () => assert.equal(segs('終る', 'おわる'), '終=おわ'));
test('對齊：讀音多出「する」、有括號、有片假名', () => {
  assert.equal(segs('運動', 'うんどうする'), '運=うん 動=どう');
  assert.equal(segs('運動', 'うんどう (する)'), '運=うん 動=どう');
  assert.equal(segs('消しゴム', 'けしゴム'), '消=け');
});
test('特殊讀法對不齊就回傳 null', () => assert.equal(A.align('今日', 'きょう', look), null));
test('對齊：名詞形送假名（入口／いりぐち）', () => assert.equal(segs('入口', 'いりぐち'), '入=いり 口=ぐち'));
test('對齊：送假名寫得比字典長（汚ない／きたない），只在後面接假名時才用', () => {
  assert.equal(segs('汚ない', 'きたない'), '汚=きた');
  assert.equal(segs('汚口', 'きたぐち'), null);
});
test('清理：多種唸法用 / 分隔取第一個、單字裡的括號拿掉', () => {
  assert.equal(segs('家', 'いえ/うち'), '家=いえ');
  assert.equal(segs('入口（名詞）', 'いりぐち'), '入=いり 口=ぐち');
});
test('訓讀排序：單字裡剛好有的詞排最前', () => {
  const D = { vocab: [{ word: '入る', reading: 'はいる', meaning: '進入', level: 'N5' }, { word: '入れる', reading: 'いれる', meaning: '放入', level: 'N5' }] };
  const kanji = Object.entries(K).map(([k, v]) => ({ id: 'kj_' + k, k, trad: [], level: 'N5', ...v, meanings: [] }));
  A.prepare(D, { kanji });
  assert.deepEqual(D.kanji.find(k => k.k === '入').kunTop.slice(0, 2), [['い', 'れる'], ['はい', 'る']]);
});

test('prepare：不在 JLPT 表的常用字幫忙對齊，出現在單字裡才加進漢字頁', () => {
  const D = { vocab: [{ word: '自分', reading: 'じぶん', meaning: '自己', level: 'N5' }] };
  const kanji = [{ id: 'kj_自', k: '自', trad: [], level: 'N4', on: ['じ', 'し'], kun: [['みずか', 'ら']], meanings: [] }];
  const extra = [
    { id: 'kj_分', k: '分', trad: [], level: '其他', on: ['ぶん', 'ふん', 'ぶ'], kun: [['わ', 'ける']], meanings: [] },
    { id: 'kj_丈', k: '丈', trad: [], level: '其他', on: ['じょう'], kun: [['たけ']], meanings: [] },
  ];
  A.prepare(D, { kanji, extra });
  assert.deepEqual(D.kanjiWords.map(w => w.ch + w.seg + w.level), ['自じN4', '分ぶん其他']);
  assert.deepEqual(D.kanji.map(k => k.k), ['自', '分']);
});

test('prepare：產生詞裡的讀音題、特殊讀法、訓讀排序', () => {
  const D = { vocab: [
    { word: '学生', reading: 'がくせい', meaning: '學生', level: 'N5' },
    { word: '今日', reading: 'きょう', meaning: '今天', level: 'N5' },
    { word: '生まれる', reading: 'うまれる', meaning: '出生', level: 'N5' },
  ] };
  const kanji = Object.entries(K).map(([k, v]) => ({ id: 'kj_' + k, k, trad: [], level: 'N5', ...v, meanings: [] }));
  A.prepare(D, { kanji });
  assert.deepEqual(D.kanjiWords.map(w => w.ch + w.seg), ['学がく', '生せい', '生う']);
  assert.deepEqual(D.kanjiSpecial.get('今').map(v => v.word), ['今日']);
  assert.deepEqual(D.kanji.find(k => k.k === '生').kunTop[0], ['う', 'まれる']);
  assert.equal(new Set(D.kanjiWords.map(w => w.id)).size, D.kanjiWords.length);
});

test('prepare：單一漢字沒有語境，不產生詞裡的讀音題', () => {
  const D = { vocab: [
    { word: '中', reading: 'なか', meaning: '裡面', level: 'N5' },
    { word: '中国', reading: 'ちゅうごく', meaning: '中國', level: 'N5' },
  ] };
  const kanji = [
    { id: 'kj_中', k: '中', trad: [], level: 'N5', on: ['ちゅう'], kun: [['なか']], meanings: [] },
    { id: 'kj_国', k: '国', trad: ['國'], level: 'N5', on: ['こく'], kun: [['くに']], meanings: [] },
  ];
  A.prepare(D, { kanji });
  assert.deepEqual(D.kanjiWords.map(w => `${w.word}:${w.ch}=${w.seg}`), ['中国:中=ちゅう', '中国:国=ごく']);
  assert.ok(D.kanjiUses.get('中').some(w => w.word === '中'), '漢字頁的實際用例仍保留單漢字詞');
});

test('實際資料：各級字數、繁體對照、沒有 WaniKani 內容', async () => {
  const t = await readFile(new URL('../data/kanji.js', import.meta.url), 'utf8');
  const data = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  const by = Object.groupBy(data.kanji, k => k.level);
  assert.deepEqual(['N5', 'N4', 'N3', 'N2', 'N1'].map(l => by[l].length), [79, 166, 367, 367, 1232]);
  assert.deepEqual(data.kanji.find(k => k.k === '気').trad, ['氣']);
  assert.deepEqual(data.kanji.find(k => k.k === '日').trad, []);
  assert.equal(data.extra.find(k => k.k === '分')?.level, '其他');
  assert.ok(!data.kanji.some(k => k.level === '其他'));
  assert.ok(!t.includes('wk_'));
});
