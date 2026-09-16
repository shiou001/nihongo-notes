// 執行：node --test sync/curriculum.test.mjs
// 課綱引擎：用真實資料檢查單元解析、穿插順序、進度與出題範圍
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function engine() {
  const store = {};
  const w = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } } };
  w.window = w;
  for (const f of ['data/content.js', 'data/external.js', 'js/data-merge.js', 'data/kanji.js', 'js/kanji-align.js', 'js/progress.js', 'js/quiz.js', 'data/curriculum.js', 'js/curriculum.js']) {
    new Function('window', 'localStorage', 'Progress', 'Quiz', await readFile(new URL('../' + f, import.meta.url), 'utf8'))(w, w.localStorage, w.Progress, w.Quiz);
    // 讓後面的檔案看得到前面定義的全域
    for (const k of ['Progress', 'Quiz', 'Curriculum', 'KanjiAlign', 'NIHONGO_DATA', 'NIHONGO_KANJI', 'NIHONGO_EXTERNAL', 'NIHONGO_CURRICULUM']) if (w[k]) globalThis[k] = w[k];
  }
  return w;
}

test('N5：大綱單元都對得到筆記段落與題目，單字課、漢字課穿插在後面', async () => {
  const w = await engine(), C = w.Curriculum;
  const list = C.all('N5');
  assert.ok(list.length > 20, 'N5 單元數 ' + list.length);
  const kinds = list.slice(0, 5).map(u => u.kind);
  assert.deepEqual(kinds, ['假名', '單字', '單字', '漢字', '假名']);   // 單元、2 單字課、1 漢字課、下一單元
  assert.equal(list[0].kana.length, 46);
  assert.ok(list[0].read.length && C.sections(list[0].read[0]).length >= 10, '清音的段落');
  for (const u of list.filter(u => !u.auto)) {
    assert.ok(u.read.every(ref => C.sections(ref).length > 0), `${u.key} 的 read 找不到段落`);
    assert.ok(u.readOnly || C.questionIds(u).length > 0, `${u.key} 沒有題目`);
  }
  const particles = C.get('N5-particles');
  assert.ok(particles.items.grammar.length >= 6, '助詞題目 ' + particles.items.grammar.length);
  assert.equal(C.get('N5-kana-rules').readOnly, true);
  assert.ok(list.every((u, i) => u.index === i + 1 && u.total === list.length));
  assert.equal(new Set(list.map(u => u.key)).size, list.length);
});

test('每一級的大綱單元都有效；N2、N1 只有單字課和漢字課', async () => {
  const w = await engine(), C = w.Curriculum;
  for (const level of C.LEVELS) {
    for (const u of C.all(level).filter(u => !u.auto)) {
      assert.ok(u.read.every(ref => C.sections(ref).length > 0), `${u.key} 的 read 找不到段落`);
      assert.ok(u.readOnly || C.questionIds(u).length > 0, `${u.key} 沒有題目`);
    }
  }
  assert.ok(C.all('N1').every(u => u.auto));
  assert.ok(C.all('N4').some(u => u.id === 'reading-kirei' && u.items.vocab.length >= 8 && u.items.grammar.length >= 5));
});

test('單元練習只出該單元的題目；答對 80% 就達標，目前單元往下移', async () => {
  const w = await engine(), C = w.Curriculum, Q = w.Quiz, P = w.Progress;
  const u = C.get('N5-greetings');
  const ids = new Set(C.questionIds(u));
  const qs = Q.buildQuestions(C.quizOpts(u, { count: 50 }));
  assert.ok(qs.length >= 10, '會話題數 ' + qs.length);
  assert.ok(qs.every(q => ids.has(q.id)), '出了單元外的題目');
  assert.ok(qs.every(q => q.type === 'phrase'));

  assert.equal(C.current('N5').key, 'N5-kana-seion');
  assert.equal(C.stats(u).status, 'todo');
  for (const id of [...ids].slice(0, Math.ceil(ids.size * .8))) P.record(id, true);
  assert.equal(C.stats(u).done, true);
  assert.equal(C.stats(C.get('N5-kana-seion')).status, 'todo');
  const first = C.get('N5-kana-seion');
  for (const id of C.questionIds(first)) P.record(id, true);
  assert.equal(C.stats(first).done, true);
  assert.equal(C.current('N5').key, 'N5-vocab-1');
  assert.equal(C.levelSummary('N5').done, 2);
});

test('純閱讀單元：按「我讀完了」才算完成；漢字課的題目含音讀、訓讀與詞裡讀音', async () => {
  const w = await engine(), C = w.Curriculum, Q = w.Quiz;
  const r = C.get('N5-kana-rules');
  assert.equal(C.stats(r).done, false);
  C.markRead(r);
  assert.equal(C.stats(r).done, true);
  assert.equal(C.stats(r).pct, 100);

  const k = C.all('N5').find(u => u.auto === 'kanji');
  const ids = C.questionIds(k);
  assert.ok(ids.some(id => id.endsWith(':on')) && ids.some(id => id.endsWith(':kun')));
  const qs = Q.buildQuestions(C.quizOpts(k, { count: 50 }));
  assert.ok(qs.length >= 12 && qs.every(q => q.type.startsWith('kanji')));
  assert.ok(qs.every(q => ids.includes(q.id)));
});
