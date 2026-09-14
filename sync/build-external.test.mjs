// 執行：node --test sync/build-external.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseGlossTsv, buildExternal, loadAndBuild } from './build-external.mjs';

test('CSV：引號、欄位內逗號、跳脫引號、CRLF', () => {
  const rows = parseCsv('a,b,c\r\n会う,あう,"to meet, to see"\r\n"x ""y""",z,\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['会う', 'あう', 'to meet, to see'], ['x "y"', 'z', '']]);
});

test('翻譯表：略過註解和空行，讀音留空代表跟單字一樣', () => {
  const m = parseGlossTsv('# 註解\n\n会う\tあう\t見面\nああ\t\t啊\n壞掉\tx\t\n');
  assert.equal(m.get('会う\tあう'), '見面');
  assert.equal(m.get('ああ\tああ'), '啊');
  assert.equal(m.size, 2);
});

test('套上中文，缺的退回英文，同級重複只留一個', () => {
  const csv = 'expression,reading,meaning,tags,guid\n会う,あう,"to meet, to see",x,1\n会う,あう,to meet,x,2\n青,あお,blue,x,3\n';
  const { vocab, missing } = buildExternal([['N5', csv]], new Map([['会う\tあう', '見面、遇到']]));
  assert.equal(vocab.length, 2);
  assert.equal(vocab[0].meaning, '見面、遇到');
  assert.equal(vocab[0].meaningEn, 'to meet, to see');
  assert.equal(vocab[0].ai, true);
  assert.equal(vocab[1].meaning, 'blue');
  assert.equal(vocab[1].ai, false);
  assert.deepEqual(missing.map(m => m.word), ['青']);
  assert.ok(vocab.every(v => v.origin === 'external' && v.level === 'N5' && v.id.startsWith('x_')));
});

test('實際資料：N5、N4 每個字都有中文，id 不重複', async () => {
  const { vocab, missing } = await loadAndBuild();
  assert.ok(vocab.filter(v => v.level === 'N5').length > 600, 'N5 字數');
  assert.ok(vocab.filter(v => v.level === 'N4').length > 500, 'N4 字數');
  assert.deepEqual(missing.map(m => `${m.level} ${m.word} ${m.reading}`), []);
  assert.equal(new Set(vocab.map(v => v.id)).size, vocab.length);
});

test('網站合併：同字同級以 Notion 為準，其餘加進來並產生公開單字頁', async () => {
  globalThis.window = {
    NIHONGO_DATA: { vocab: [{ id: 'v_1', word: '本', reading: 'ほん', meaning: '書', level: 'N5' }], pages: [] },
    NIHONGO_EXTERNAL: { builtAt: 't', vocab: [
      { id: 'x_1', word: '本', reading: 'ほん', meaning: '書本', meaningEn: 'book', level: 'N5', origin: 'external' },
      { id: 'x_2', word: '青', reading: 'あお', meaning: '藍色', meaningEn: 'blue', level: 'N5', origin: 'external' },
    ] },
  };
  await import('../js/data-merge.js');
  const D = window.NIHONGO_DATA;
  assert.deepEqual(D.vocab.map(v => v.id), ['v_1', 'x_2']);
  assert.equal(D.vocab[0].origin, 'notion');
  const page = D.pages.at(-1);
  assert.equal(page.title, 'JLPT 公開單字');
  assert.deepEqual(page.sections.at(-1).blocks[0].rows, [['青', 'あお', '藍色', 'blue']]);
});
