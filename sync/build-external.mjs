// build-external.mjs — 外部公開單字 → data/external.js
//
// 來源資料（放在 repo 裡，方便追蹤變動）：
//   sync/external/jamsinclair/n5.csv、n4.csv …
//     出自 https://github.com/jamsinclair/open-anki-jlpt-decks （MIT）
//     原始單字表出自 Jonathan Waller 的 http://www.tanos.co.uk/jlpt/ （CC BY，需註明出處）
//   sync/external/zh-tw.*.tsv（每級一個檔，例如 zh-tw.n5.tsv）
//     中文解釋，由 AI 依日文與英文解釋翻成繁體中文。格式：單字<TAB>讀音<TAB>中文
//
// 用法：node sync/build-external.mjs          產生 data/external.js
//       node sync/build-external.mjs --check  只檢查有沒有缺翻譯（缺就 exit 1）
// 之後要加 N3：把 n3.csv 放進 sync/external/jamsinclair/，新增 zh-tw.n3.tsv，再跑一次。

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hashId } from './parse-notion-md.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const extDir = path.join(here, 'external');

export const SOURCES = [
  { name: 'JLPT Resources（Jonathan Waller）', url: 'http://www.tanos.co.uk/jlpt/', license: 'CC BY' },
  { name: 'open-anki-jlpt-decks（jamsinclair）', url: 'https://github.com/jamsinclair/open-anki-jlpt-decks', license: 'MIT' },
];

// 最小的 CSV 解析：支援引號、欄位內逗號、"" 跳脫、CRLF
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x !== ''));
}

// 比對用的鍵：統一波浪號（來源資料 〜 U+301C 和 ～ U+FF5E 混用），讀音留空就用單字本身
export function glossKey(word, reading) {
  const n = s => String(s ?? '').replace(/〜/g, '～').trim();
  return `${n(word)}\t${n(reading) || n(word)}`;
}

// 翻譯表：單字<TAB>讀音<TAB>中文；# 開頭是註解；讀音留空代表跟單字一樣
export function parseGlossTsv(text) {
  const map = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [word, reading, zh] = line.split('\t');
    if (word && zh && zh.trim()) map.set(glossKey(word, reading), zh.trim());
  }
  return map;
}

// csvByLevel: [['N5', csv文字], ['N4', csv文字], ...]；glosses: parseGlossTsv 的結果
export function buildExternal(csvByLevel, glosses) {
  const vocab = [], missing = [], seen = new Set();
  for (const [level, text] of csvByLevel) {
    const [header = [], ...rows] = parseCsv(text);
    const iw = header.indexOf('expression'), ir = header.indexOf('reading'), im = header.indexOf('meaning');
    if (iw < 0 || im < 0) throw new Error(`${level} 的 CSV 缺少 expression 或 meaning 欄位`);
    for (const r of rows) {
      const word = (r[iw] || '').trim();
      if (!word) continue;
      const reading = ((ir >= 0 ? r[ir] : '') || '').trim() || word;
      const en = (r[im] || '').trim();
      const key = `${word}\t${reading}`;
      if (seen.has(`${key}\t${level}`)) continue;
      seen.add(`${key}\t${level}`);
      const zh = glosses.get(glossKey(word, reading));
      if (!zh) missing.push({ level, word, reading, en });
      vocab.push({
        id: 'x_' + hashId(`${word}|${reading}|${level}`),
        word, reading, meaning: zh || en, meaningEn: en, level, pos: '',
        origin: 'external', ai: !!zh, source: `JLPT 公開單字 ${level}`,
      });
    }
  }
  return { vocab, missing };
}

export async function loadAndBuild() {
  const dir = path.join(extDir, 'jamsinclair');
  // n5.csv 先、n1.csv 最後
  const files = (await readdir(dir)).filter(f => /^n[1-5]\.csv$/.test(f)).sort().reverse();
  const csvByLevel = await Promise.all(files.map(async f => ['N' + f[1], await readFile(path.join(dir, f), 'utf8')]));
  const glossFiles = (await readdir(extDir)).filter(f => /^zh-tw.*\.tsv$/.test(f)).sort();
  const glosses = parseGlossTsv((await Promise.all(glossFiles.map(f => readFile(path.join(extDir, f), 'utf8')))).join('\n'));
  return buildExternal(csvByLevel, glosses);
}

async function main() {
  const check = process.argv.includes('--check');
  const { vocab, missing } = await loadAndBuild();
  const byLevel = Object.entries(Object.groupBy(vocab, v => v.level)).map(([k, v]) => `${k} ${v.length}`).join('、');
  console.log(`外部單字：${byLevel}；缺中文翻譯 ${missing.length} 個`);
  if (missing.length) console.log(missing.slice(0, 30).map(m => `  ${m.level}  ${m.word}\t${m.reading}\t${m.en}`).join('\n'));
  if (check) process.exit(missing.length ? 1 : 0);
  const out = { builtAt: new Date().toISOString(), sources: SOURCES, aiTranslated: true, vocab };
  await writeFile(path.join(root, 'data', 'external.js'),
    `// 由 sync/build-external.mjs 產生，請勿手動編輯。\nwindow.NIHONGO_EXTERNAL = ${JSON.stringify(out)};\n`, 'utf8');
  console.log('✅ data/external.js 已更新');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
