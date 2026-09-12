// build-data.mjs — 只用 sync/cache/*.md 重建 data/content.js（離線、不需要 Notion token）
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildContent, toContentJs } from './parse-notion-md.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cacheDir = path.join(here, 'cache');

export async function buildFromCache(syncedAt) {
  const files = (await readdir(cacheDir)).filter(f => f.endsWith('.md')).sort();
  const mds = await Promise.all(files.map(f => readFile(path.join(cacheDir, f), 'utf8')));
  const content = buildContent(mds, syncedAt);
  // 依 Notion 索引順序排列頁面（五十音 → 發音 → 會話 → 文法 → 詞彙 → 閱讀 → 分級 → 敬語）
  const order = ['五十音圖表', '發音與假名', '常用會話', '文法筆記', '詞彙整理', '閱讀練習', '單字分級 N1~N5', '敬語表現'];
  content.pages.sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title));
  await mkdir(path.join(root, 'data'), { recursive: true });
  await writeFile(path.join(root, 'data', 'content.js'), toContentJs(content), 'utf8');
  await writeFile(path.join(root, 'data', 'content.json'), JSON.stringify(content, null, 1), 'utf8');
  return content;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const c = await buildFromCache();
  console.log(`✅ data/content.js 已更新：${c.pages.length} 頁、單字 ${c.vocab.length}、文法 ${c.grammar.length}、會話 ${c.phrases.length}、假名 ${c.kana.length}`);
}
