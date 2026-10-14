// 執行：node --test sync/voice.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = {};
globalThis.window = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
await import('../js/voice.js');
const V = window.Voice;
const mk = (name, lang = 'ja-JP', localService = true) => ({ name, lang, localService });

const NANAMI = 'Microsoft Nanami Online (Natural) - Japanese (Japan)';
const KEITA = 'Microsoft Keita Online (Natural) - Japanese (Japan)';
const HARUKA = 'Microsoft Haruka Desktop - Japanese';

test('只留日文聲音；自然的神經網路語音排最前，Windows 舊聲音排最後，女聲略優先', () => {
  const list = [mk(HARUKA), mk('Google 日本語', 'ja-JP', false), mk(NANAMI, 'ja-JP', false), mk(KEITA, 'ja-JP', false),
    mk('Samantha', 'en-US'), mk('Kyoko'), mk('O-ren (Enhanced)')];
  assert.deepEqual(V.rank(list).map(v => v.name), [NANAMI, KEITA, 'O-ren (Enhanced)', 'Google 日本語', 'Kyoko', HARUKA]);
  assert.deepEqual(V.rank(list).map(V.isRecommended), [true, true, true, true, false, false]);
});

test('不支援語音的環境：不報錯，speak 回傳 null', () => {
  assert.equal(V.supported(), false);
  assert.equal(V.speak('こんにちは'), null);
  assert.deepEqual(V.voices(), []);
});

test('設定：預設可愛語氣；換聲音和語氣會記住；亂填的語氣退回可愛', () => {
  assert.equal(V.settings().preset, 'cute');
  V.set({ name: 'Kyoko', preset: 'slow' });
  assert.deepEqual(V.settings(), { name: 'Kyoko', preset: 'slow', source: 'recorded' });
  V.set({ preset: '亂填' });
  assert.equal(V.settings().preset, 'cute');
  assert.equal(V.settings().name, 'Kyoko');
});

test('speak：沒選過就用最自然的聲音；選過就用選的；選的聲音不見了就退回最自然的', () => {
  const spoken = [];
  let voices = [mk(HARUKA), mk(NANAMI, 'ja-JP', false)];
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  window.speechSynthesis = { getVoices: () => voices, cancel() {}, speak: u => spoken.push(u) };

  V.set({ name: '', preset: 'cute' });
  const u1 = V.speak('ねこ');
  assert.equal(u1.voice.name, NANAMI);
  assert.equal(u1.lang, 'ja-JP');
  assert.equal(u1.pitch, V.PRESETS.cute.pitch);

  V.set({ name: HARUKA, preset: 'slow' });
  const u2 = V.speak('いぬ');
  assert.equal(u2.voice.name, HARUKA);
  assert.equal(u2.rate, V.PRESETS.slow.rate);

  voices = [mk(NANAMI, 'ja-JP', false)];          // 例如換到另一台裝置
  assert.equal(V.speak('とり').voice.name, NANAMI);

  const u4 = V.speak('うま', { voice: voices[0], preset: 'natural' });   // 試聽用的暫時設定
  assert.equal(u4.rate, V.PRESETS.natural.rate);
  assert.equal(spoken.length, 4);
});

test('錄音：有東北きりたん錄音的字播錄音檔；切到裝置朗讀或沒有錄音的字，改用裝置朗讀', () => {
  const played = [], spoken = [];
  window.Audio = function (src) { this.src = src; this.pause = () => {}; this.play = () => { played.push(this); return Promise.resolve(); }; };
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  window.speechSynthesis = { getVoices: () => [mk(NANAMI, 'ja-JP', false)], cancel() {}, speak: u => spoken.push(u) };
  window.NIHONGO_AUDIO = { dir: 'audio/kiritan/', keys: [V.audioKey('ねこ'), V.audioKey('ありがとうございます')].join(',') };
  V.set({ name: '', preset: 'cute', source: 'recorded' });

  const h = V.speak('ねこ');
  assert.equal(h.recorded, true);
  assert.equal(played.at(-1).src, `audio/kiritan/${V.audioKey('ねこ')}.mp3`);
  assert.equal(V.hasRecording(' ねこ '), true, '前後空白不影響');
  let ended = false; h.onend = () => { ended = true; }; played.at(-1).onended();
  assert.equal(ended, true, 'onend 可以接下一句');

  assert.equal(V.speak('いぬ').text, 'いぬ', '沒有錄音的字用裝置朗讀');
  V.set({ source: 'device' });
  assert.equal(V.speak('ねこ').text, 'ねこ', '選了裝置朗讀就不播錄音');
  assert.equal(spoken.length, 2);
  V.set({ source: 'recorded', preset: 'slow' });
  V.speak('ありがとうございます');
  assert.equal(played.at(-1).playbackRate, 0.8, '慢慢說也套用在錄音上');
  delete window.NIHONGO_AUDIO;
});

test('錄音清單：data/audio.js 列出的每一段錄音都真的有檔案', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const src = await readFile(new URL('../data/audio.js', import.meta.url), 'utf8').catch(() => null);
  if (!src) return;   // 還沒產生錄音時跳過
  const w = {}; new Function('window', src)(w);
  const A = w.NIHONGO_AUDIO, keys = A.keys.split(',');
  assert.ok(keys.length > 0 && A.credit.startsWith('VOICEVOX:'));
  const missing = [];
  for (const k of keys) await access(new URL(`../${A.dir}${k}.mp3`, import.meta.url)).catch(() => missing.push(k));
  assert.deepEqual(missing, [], '清單裡有錄音檔不存在');
});
