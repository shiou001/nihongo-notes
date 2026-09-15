// extract-kanjidic.mjs — 從 kanji-data 的 kanji.json 抽出 JLPT 漢字的字典欄位
//
// 來源：https://github.com/davidluzgouveia/kanji-data
//   程式碼 MIT；字典資料源自 KANJIDIC（EDRDG，CC BY-SA 4.0）；JLPT 新制分級源自 tanos.co.uk（CC BY）
// 只保留 KANJIDIC 欄位與 jlpt_new。刻意排除 wk_ 開頭的 WaniKani 欄位，WaniKani 的內容不可再散布。
// 產出的 sync/external/kanjidic/jlpt-kanji.json 屬於 KANJIDIC 衍生資料，依 CC BY-SA 4.0 授權。
//
// 用法：node sync/extract-kanjidic.mjs <下載的 kanji.json 路徑>

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const KEEP = ['strokes', 'grade', 'freq', 'jlpt_new', 'meanings', 'readings_on', 'readings_kun'];

export function extractJlpt(all) {
  const out = {};
  for (const [k, v] of Object.entries(all || {})) {
    // JLPT 漢字，外加 tanos JLPT 表沒收、但屬於日本常用漢字（grade 1–8）的字，例如「分」。
    // 後者只拿來讓單字的讀音對齊得起來，不會被當成某個 JLPT 等級。
    if (!v || (v.jlpt_new == null && !(v.grade >= 1 && v.grade <= 8))) continue;
    out[k] = Object.fromEntries(KEEP.map(f => [f, v[f] ?? null]));
  }
  return out;
}

async function main() {
  const src = process.argv[2];
  if (!src) { console.error('用法：node sync/extract-kanjidic.mjs <kanji.json 路徑>'); process.exit(1); }
  const out = extractJlpt(JSON.parse(await readFile(src, 'utf8')));
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = path.join(here, 'external', 'kanjidic');
  await mkdir(dir, { recursive: true });
  // 一個字一行，之後更新資料時 git diff 比較好讀
  const body = '{\n' + Object.entries(out).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n') + '\n}\n';
  await writeFile(path.join(dir, 'jlpt-kanji.json'), body, 'utf8');
  const by = Object.groupBy(Object.values(out), v => 'N' + v.jlpt_new);
  console.log(`✅ 抽出 ${Object.keys(out).length} 個漢字：` + ['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `${l} ${by[l]?.length || 0}`).join('、') + `、不在 JLPT 表的常用漢字 ${by.Nnull?.length || 0}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
