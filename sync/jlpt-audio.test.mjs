// 執行：node --test sync/jlpt-audio.test.mjs
// 測 tools/make-jlpt-audio.mjs 的讀音檢查：VOICEVOX 唸出來的假名要和腳本的讀音一樣
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedReading, sameReading, segments, joinQueries } from '../tools/make-jlpt-audio.mjs';

test('expectedReading：振假名用讀音；詞尾的は／へ／を是助詞，唸ワ／エ／オ；變成片假名', () => {
  assert.equal(expectedReading('{母|はは}と　あにです。'), 'ハハトアニデス');
  assert.equal(expectedReading('えいがは　みませんか。'), 'エイガワミマセンカ');
  assert.equal(expectedReading('くじに、えきへ　いきます！'), 'クジニエキエイキマス');
  assert.equal(expectedReading('ほんを　よみます'), 'ホンオヨミマス');
});

test('sameReading：只有長音的寫法不同不算錯；唸錯（包括把 は 唸成 ワ）才算錯', () => {
  assert.ok(sameReading('ノートワイリマセン', 'ノオトワイリマセン'));
  assert.ok(sameReading('ガッコウ', 'ガッコオ'));
  assert.ok(sameReading('センセイ', 'センセエ'));
  assert.ok(sameReading('エイガワミマセンカ', 'エイガワミマセンカ'));
  assert.ok(!sameReading('エイガワミマセンカ', 'エイガハミマセンカ'), '助詞は 唸成 ハ');
  assert.ok(!sameReading('クジ', 'キュウジ'), '九時唸成きゅうじ');
  assert.ok(!sameReading('トオカ', 'ジュウカ'));
  assert.ok(!sameReading('チチトハハト', 'チチトワハト'), 'ははと 唸成 わはと');
});

test('segments：依標點切段，送給 VOICEVOX 的文字保留空格、振假名用漢字', () => {
  assert.deepEqual(segments('えいがは　みませんか。{母|はは}と、いきます。').map(s => ({ ...s })), [
    { text: 'えいがは みませんか', end: '。' }, { text: '母と', end: '、' }, { text: 'いきます', end: '。' }]);
});

test('joinQueries：段內因空格產生的停頓拿掉，只在標點的地方停頓', () => {
  const q = (phrases) => ({ accent_phrases: phrases.map(([t, pause]) => ({ moras: [{ text: t }], pause_mora: pause ? { text: '、', vowel: 'pau', vowel_length: 0.3 } : null })), speedScale: 1 });
  const joined = joinQueries([{ q: q([['エイガワ', true], ['ミマセンカ', false]]), end: '。' }, { q: q([['ハハト', true]]), end: '、' }]);
  assert.deepEqual(joined.accent_phrases.map(p => !!p.pause_mora), [false, true, true]);
  assert.equal(joined.speedScale, 1);
});
