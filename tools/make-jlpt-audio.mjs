// make-jlpt-audio.mjs — JLPT 聽解題的錄音（VOICEVOX）
//
// 用法：先啟動 VOICEVOX 引擎（D:\VOICEVOX\engine\windows-cpu\run.exe，預設 http://127.0.0.1:50021），再執行
//   node tools/make-jlpt-audio.mjs
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

async function synth(text, id, file) {
  const q = await (await fetch(`${ENGINE}/audio_query?speaker=${id}&text=${encodeURIComponent(JLPT.speechText(text))}`, { method: 'POST' })).json();
  q.speedScale = 0.95; q.prePhonemeLength = 0.05; q.postPhonemeLength = 0.15;
  const r = await fetch(`${ENGINE}/synthesis?speaker=${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  if (!r.ok) throw new Error(`synthesis ${r.status}`);
  const wav = file.replace(/\.mp3$/, '.wav');
  await writeFile(wav, Buffer.from(await r.arrayBuffer()));
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '48k', file]);
  await unlink(wav);
}

async function main() {
  const lines = await collectLines();
  await mkdir(path.join(root, 'audio', 'jlpt'), { recursive: true });
  let made = 0, skipped = 0;
  for (const [rel, [role, text]] of lines) {
    const file = path.join(root, rel);
    if (await exists(file)) { skipped++; continue; }
    await synth(text, VOICES[role], file);
    made++;
    if (made % 25 === 0) console.log(`${made} 段…`);
  }
  console.log(`完成：新錄 ${made}、已存在 ${skipped}，共 ${lines.size} 段`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(1); });
