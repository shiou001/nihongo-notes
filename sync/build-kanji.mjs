// build-kanji.mjs — JLPT 漢字資料 → data/kanji.js
//
// 輸入：
//   sync/external/kanjidic/jlpt-kanji.json      由 extract-kanjidic.mjs 產生（KANJIDIC 衍生，CC BY-SA 4.0）
//   sync/external/opencc/JPShinjitaiCharacters.txt  日本新字體 → 繁體字對照（OpenCC，Apache-2.0）
// 輸出：data/kanji.js（window.NIHONGO_KANJI），同樣依 CC BY-SA 4.0 授權
//
// 用法：node sync/build-kanji.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hashId } from './parse-notion-md.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export const KANJI_SOURCES = [
  { name: 'KANJIDIC（EDRDG）', url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project', license: 'CC BY-SA 4.0' },
  { name: 'kanji-data（David Gouveia）', url: 'https://github.com/davidluzgouveia/kanji-data', license: 'MIT，資料依原始來源授權' },
  { name: 'JLPT Resources（Jonathan Waller）', url: 'http://www.tanos.co.uk/jlpt/', license: 'CC BY' },
  { name: 'OpenCC 日本新字體對照', url: 'https://github.com/BYVoid/OpenCC', license: 'Apache-2.0' },
];

// OpenCC 格式：日本字形<TAB>繁體字（可能有好幾個，用空白分隔）
export function parseOpenCC(text) {
  const m = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [k, v] = line.split('\t');
    if (k && v) m.set(k.trim(), v.trim().split(/\s+/));
  }
  return m;
}

// 訓讀：「い.きる」→ ['い', 'きる']（詞幹、送假名）；「-」只是接頭／接尾記號，拿掉
// 完整唸法相同只留第一個（う.まれる 和 うま.れる 都是「うまれる」）
export function normalizeKun(list) {
  const seen = new Set(), out = [];
  for (const raw of list || []) {
    const [stem, okuri = ''] = String(raw).replace(/-/g, '').split('.');
    if (!stem) continue;
    const key = stem + okuri;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(okuri ? [stem, okuri] : [stem]);
  }
  return out;
}

export function buildKanji(jlpt, opencc) {
  const order = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4, 其他: 5 };
  const kanji = Object.entries(jlpt).map(([k, v]) => ({
    id: 'kj_' + hashId(k),
    k,
    trad: (opencc.get(k) || []).filter(t => t !== k),   // 空陣列＝和繁體寫法相同
    level: v.jlpt_new ? 'N' + v.jlpt_new : '其他',   // 其他＝不在 tanos JLPT 表的常用漢字
    strokes: v.strokes ?? null,
    grade: v.grade ?? null,
    freq: v.freq ?? null,
    on: [...new Set((v.readings_on || []).map(r => r.replace(/-/g, '')).filter(Boolean))].slice(0, 5),
    kun: normalizeKun(v.readings_kun).slice(0, 10),
    meanings: (v.meanings || []).slice(0, 4),
  }));
  // 先依等級（N5 → N1），同級依常用度
  kanji.sort((a, b) => order[a.level] - order[b.level] || (a.freq ?? 9999) - (b.freq ?? 9999));
  return kanji;
}

async function main() {
  const jlpt = JSON.parse(await readFile(path.join(here, 'external', 'kanjidic', 'jlpt-kanji.json'), 'utf8'));
  const opencc = parseOpenCC(await readFile(path.join(here, 'external', 'opencc', 'JPShinjitaiCharacters.txt'), 'utf8'));
  const all = buildKanji(jlpt, opencc);
  // kanji：JLPT 漢字，顯示在漢字頁；extra：其他常用漢字，只用在讀音對齊，出現在單字裡才顯示
  const kanji = all.filter(k => k.level !== '其他');
  const extra = all.filter(k => k.level === '其他');
  const out = { builtAt: new Date().toISOString(), sources: KANJI_SOURCES, kanji, extra };
  await writeFile(path.join(root, 'data', 'kanji.js'),
    '// 由 sync/build-kanji.mjs 產生，請勿手動編輯。\n' +
    '// 本檔含 KANJIDIC 衍生資料（EDRDG），依 CC BY-SA 4.0 授權：https://www.edrdg.org/wiki/index.php/KANJIDIC_Project\n' +
    `window.NIHONGO_KANJI = ${JSON.stringify(out)};\n`, 'utf8');
  const by = Object.groupBy(kanji, k => k.level);
  console.log(`✅ data/kanji.js：${['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `${l} ${by[l]?.length || 0}`).join('、')}；其他常用漢字 ${extra.length} 個；和繁體寫法不同的字 ${all.filter(k => k.trad.length).length} 個`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
