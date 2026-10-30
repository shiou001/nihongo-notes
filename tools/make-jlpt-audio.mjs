// make-jlpt-audio.mjs — JLPT 聽解題的錄音（VOICEVOX）
//
// 用法：先啟動 VOICEVOX 引擎（D:\VOICEVOX\engine\windows-cpu\run.exe，預設 http://127.0.0.1:50021），再執行
//   node tools/make-jlpt-audio.mjs           錄還沒有的檔
//   node tools/make-jlpt-audio.mjs --check   只檢查每一句的讀音，不錄
// 會收集 jlpt-src/ 所有聽解題的台詞（含發話表現、即時應答唸出的選項）和各大題的作答說明，只錄還沒有的檔。
// 角色：N 旁白 No.7（アナウンス）、M 男 剣崎雌雄、F 女 東北きりたん（tools/build-jlpt.mjs 的 VOICES）
// 授權：VOICEVOX:No.7（非商業）、VOICEVOX:剣崎雌雄、VOICEVOX:東北きりたん（網站頁尾需註明）
import { readFile, readdir, writeFile, mkdir, access, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICES } from './build-jlpt.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
const W = {};
new Function('window', readFileSync(path.join(root, 'js/jlpt-core.js'), 'utf8'))(W);
const { JLPT } = W;
const exists = f => access(f).then(() => true, () => false);

// 所有要錄的〔角色, 台詞〕
export async function collectLines() {
  const out = new Map();
  const add = ([role, text]) => out.set(JLPT.audioFile(role, text), [role, text]);
  for (const t of Object.keys(JLPT.TYPES)) if (JLPT.TYPES[t].section === 'listening') add(JLPT.instructionLine(t));
  const src = path.join(root, 'jlpt-src');
  for (const dir of await readdir(src, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of (await readdir(path.join(src, dir.name))).filter(x => x.endsWith('.json'))) {
      const b = JSON.parse(await readFile(path.join(src, dir.name, f), 'utf8'));
      for (const q of b.questions || []) if (JLPT.TYPES[q.type]?.section === 'listening') JLPT.listeningLines(q).forEach(add);
    }
  }
  return out;
}

// ── 讀音檢查 ──
// 送給 VOICEVOX：振假名的地方用漢字（斷詞比較準），詞語間保留空格（讓它知道詞的邊界），依標點分段。
// 空格造成的停頓再拿掉，只在標點的地方停頓；唸出來的假名必須和腳本的讀音一致，不一致就不錄。
const RUBY = /\{([^{}|]+)\|([^{}|]+)\}/g;
const PUNCT = /[、。？！?!]/;
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
export function segments(text) {
  const base = String(text).replace(RUBY, '$1').replace(/[「」『』…]/g, '').replace(/[　 ]+/g, ' ');
  const out = [];
  let buf = '';
  for (const ch of base) {
    if (PUNCT.test(ch)) { if (buf.trim()) out.push({ text: buf.trim(), end: ch }); buf = ''; }
    else buf += ch;
  }
  if (buf.trim()) out.push({ text: buf.trim(), end: '' });
  return out;
}
// 腳本應該唸成的片假名：詞尾的は／へ是助詞（ワ／エ），を一律唸オ
export function expectedReading(text) {
  const chunks = String(text).replace(RUBY, '$2').split(/[　 、。？！?!「」『』…]+/).filter(Boolean);
  return toKata(chunks.map(c => c.replace(/を/g, 'お').replace(/(.)は$/, '$1わ').replace(/(.)へ$/, '$1え')).join('')).replace(/[^ァ-ー]/g, '');
}
// 長音的寫法（ー、コウ／コオ、セイ／セエ）統一後比較
const VOWEL = {};
for (const [v, row] of Object.entries({ ア: 'アカガサザタダナハバパマヤャラワ', イ: 'イキギシジチヂニヒビピミリ', ウ: 'ウクグスズツヅヌフブプムユュル', エ: 'エケゲセゼテデネヘベペメレ', オ: 'オコゴソゾトドノホボポモヨョロヲ' })) for (const c of row) VOWEL[c] = v;
function normLong(s) {
  const a = [...s];
  for (let i = 1; i < a.length; i++) {
    const pv = VOWEL[a[i - 1]];
    if (a[i] === 'ー' && pv) a[i] = pv;
    else if (a[i] === 'ウ' && (pv === 'オ' || pv === 'ウ')) a[i] = pv;
    else if (a[i] === 'イ' && pv === 'エ') a[i] = 'エ';
  }
  return a.join('');
}
export const sameReading = (expected, actual) => normLong(expected) === normLong(actual);
// 每一段的 audio_query 接起來：段內停頓拿掉，標點處停頓
export function joinQueries(parts) {
  const out = { ...parts[0].q, accent_phrases: [] };
  for (const { q, end } of parts) {
    const ps = q.accent_phrases.map(p => ({ ...p, pause_mora: null }));
    if (end && ps.length) ps[ps.length - 1].pause_mora = { text: '、', consonant: null, consonant_length: null, vowel: 'pau', vowel_length: end === '、' ? 0.3 : 0.45, pitch: 0 };
    out.accent_phrases.push(...ps);
  }
  return out;
}
const moraText = q => q.accent_phrases.map(p => p.moras.map(m => m.text).join('')).join('');
async function query(text, id) {
  const parts = [];
  for (const seg of segments(text)) parts.push({ q: await (await fetch(`${ENGINE}/audio_query?speaker=${id}&text=${encodeURIComponent(seg.text)}`, { method: 'POST' })).json(), end: seg.end });
  return joinQueries(parts);
}

async function synth(text, id, file) {
  const q = await query(text, id);
  q.speedScale = 0.95; q.prePhonemeLength = 0.05; q.postPhonemeLength = 0.15;
  const r = await fetch(`${ENGINE}/synthesis?speaker=${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  if (!r.ok) throw new Error(`synthesis ${r.status}`);
  const wav = file.replace(/\.mp3$/, '.wav');
  await writeFile(wav, Buffer.from(await r.arrayBuffer()));
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '48k', file]);
  await unlink(wav);
}

async function main() {
  const lines = await collectLines(), checkOnly = process.argv.includes('--check');
  await mkdir(path.join(root, 'audio', 'jlpt'), { recursive: true });
  let made = 0, skipped = 0;
  const wrong = [];
  for (const [rel, [role, text]] of lines) {
    const file = path.join(root, rel);
    if (!checkOnly && await exists(file)) { skipped++; continue; }
    const actual = moraText(await query(text, VOICES[role])), expected = expectedReading(text);
    if (!sameReading(expected, actual)) { wrong.push(`${text}\n    應該：${expected}\n    唸成：${actual}`); continue; }
    if (checkOnly) continue;
    await synth(text, VOICES[role], file);
    made++;
    if (made % 25 === 0) console.log(`${made} 段…`);
  }
  // 腳本改過之後，舊台詞的錄音沒人用了：刪掉，避免部署多餘的檔
  let removed = 0;
  if (!checkOnly && !wrong.length) {
    const keep = new Set([...lines.keys()].map(rel => path.basename(rel)));
    for (const f of await readdir(path.join(root, 'audio', 'jlpt'))) if (f.endsWith('.mp3') && !keep.has(f)) { await unlink(path.join(root, 'audio', 'jlpt', f)); removed++; }
  }
  console.log(`${checkOnly ? '檢查' : '完成'}：新錄 ${made}、已存在 ${skipped}、刪除不用的 ${removed}，共 ${lines.size} 段，讀音不對 ${wrong.length} 段`);
  if (wrong.length) { console.error(`\n讀音不對、沒有錄的台詞（改寫腳本：用漢字加振假名，或換說法）：\n${wrong.join('\n')}`); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(1); });
