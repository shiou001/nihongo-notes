// make-audio.mjs — 用 VOICEVOX 把網站會唸的單字、句子做成錄音檔（東北きりたん）
//
// 用法：先啟動 VOICEVOX 引擎（D:\VOICEVOX\...\run.exe，預設 http://127.0.0.1:50021），再執行
//   node tools/make-audio.mjs            只做還沒有的錄音（新增 Notion 單字後跑這個）
//   node tools/make-audio.mjs --sample   只做 12 個樣本，給試聽頁用
// 產出：audio/kiritan/<hash>.mp3 與 data/audio.js（瀏覽器用的清單）
// 授權：VOICEVOX:東北きりたん（網站頁尾需註明）
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
const SPEAKER_NAME = '東北きりたん', STYLE_NAME = process.env.VOICEVOX_STYLE || 'ノーマル';
const OUT = path.join(root, 'audio', 'kiritan');
const SAMPLE = process.argv.includes('--sample');

// 跟 js/voice.js 的 audioKey 一樣：同一段文字算出同一個檔名
export const audioKey = t => {
  const s = String(t ?? '').normalize('NFKC').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};
// 唸給 VOICEVOX 的版本：「いい; よい」→「いい、よい」，「けっこん (する)」→「けっこんする」
const speakable = t => String(t).replace(/[〜～~]/g, '').replace(/[()（）]/g, ' ')
  .replace(/\s*[;；/／・]\s*/g, '、').replace(/\s+/g, '').replace(/^、+|、+$/g, '');

// 介面上的試聽句子（聲音設定頁）。不在學習內容裡，所以要另外列，不然會被當成多餘的錄音
export const UI_TEXTS = ['ありがとうございます', 'こんにちは！きょうも いっしょに がんばろうね。'];
// 網站上所有會唸出來的文字（單一漢字讀音不只一種，留給瀏覽器朗讀）
export async function collectTexts() {
  const w = globalThis;
  w.window = w;
  for (const f of ['data/content.js', 'data/external.js', 'data/life.js', 'js/data-merge.js']) new Function('window', await readFile(path.join(root, f), 'utf8'))(w);
  const D = w.NIHONGO_DATA, out = new Set();
  const add = t => { t = String(t || '').trim(); if (t && [...t].length > 1 || /^[\u3040-\u30ff]$/.test(t)) out.add(t); };
  D.vocab.forEach(v => add(v.reading || v.word));
  D.kana.forEach(k => add(k.hira));
  D.phrases.forEach(p => add(p.jp));
  (D.drills || []).forEach(d => add(d.prompt));
  D.grammar.forEach(g => add(g.pattern.replace(/[〜～]/g, '')));
  w.NIHONGO_LIFE.topics.forEach(t => t.dialogue?.lines.forEach(([, jp]) => add(jp)));
  UI_TEXTS.forEach(add);
  return [...out];
}

async function speakerId() {
  const speakers = await (await fetch(`${ENGINE}/speakers`)).json();
  const sp = speakers.find(s => s.name === SPEAKER_NAME);
  if (!sp) throw new Error(`引擎裡找不到 ${SPEAKER_NAME}`);
  const st = sp.styles.find(s => s.name === STYLE_NAME) || sp.styles[0];
  return { id: st.id, styles: sp.styles.map(s => `${s.name}=${s.id}`).join(', ') };
}

async function synth(text, id) {
  const q = await (await fetch(`${ENGINE}/audio_query?speaker=${id}&text=${encodeURIComponent(speakable(text))}`, { method: 'POST' })).json();
  q.speedScale = 0.95;        // 稍微放慢，學習用比較清楚
  q.prePhonemeLength = 0.05; q.postPhonemeLength = 0.12;
  const r = await fetch(`${ENGINE}/synthesis?speaker=${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  if (!r.ok) throw new Error(`synthesis ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const exists = f => access(f).then(() => true, () => false);

async function main() {
  const { id, styles } = await speakerId();
  console.log(`${SPEAKER_NAME}：使用 ${STYLE_NAME}（id ${id}），可用樣式：${styles}`);
  let texts = await collectTexts();
  if (SAMPLE) texts = ['こんにちは', 'ありがとうございます', 'おはようございます', 'いただきます', 'ラーメンをひとつください。', 'すみません、新宿へ行きたいです。', 'でんしゃ', 'べんとう', 'ともだち', 'あ', 'お疲れ様でした', '食べた とき'];
  await mkdir(OUT, { recursive: true });
  let made = 0, skipped = 0, t0 = Date.now();
  for (const [i, text] of texts.entries()) {
    const file = path.join(OUT, audioKey(text) + '.mp3');
    if (await exists(file)) { skipped++; continue; }
    const wav = await synth(text, id);
    const tmp = file.replace(/\.mp3$/, '.wav');
    await writeFile(tmp, wav);
    // 單聲道 48kbps MP3：每段約 6–12KB，所有瀏覽器（含 iPhone）都能播
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', '24000', '-b:a', '48k', file]);
    await import('node:fs/promises').then(fs => fs.unlink(tmp));
    made++;
    if (made % 50 === 0) console.log(`${i + 1}/${texts.length}，${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
  }
  // 清單：只列出真的有錄音的文字
  const keys = [];
  for (const t of await collectTexts()) if (await exists(path.join(OUT, audioKey(t) + '.mp3'))) keys.push(audioKey(t));
  if (SAMPLE) for (const t of texts) if (await exists(path.join(OUT, audioKey(t) + '.mp3'))) keys.push(audioKey(t));
  const js = `// 由 tools/make-audio.mjs 產生，請勿手動編輯。\n// 錄音：VOICEVOX:${SPEAKER_NAME}（${STYLE_NAME}）\nwindow.NIHONGO_AUDIO = ${JSON.stringify({ voice: SPEAKER_NAME, credit: `VOICEVOX:${SPEAKER_NAME}`, dir: 'audio/kiritan/', keys: [...new Set(keys)].sort().join(',') })};\n`;
  await writeFile(path.join(root, 'data', 'audio.js'), js, 'utf8');
  console.log(`完成：新錄 ${made}、已存在 ${skipped}、清單 ${new Set(keys).size} 筆，${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(1); });
