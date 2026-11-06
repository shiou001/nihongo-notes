// sync-notion.mjs — 從 Notion API 抓取「日文學習筆記」根頁面下所有子頁面（子頁面裡的子頁面接在原位，見 notion-blocks.mjs） → Markdown 快取 → data/content.js
//
// 需要環境變數：
//   NOTION_TOKEN         Notion 個人存取權杖（https://www.notion.so/developers/tokens，ntn_ 開頭）
//                        舊式 Internal Integration 的 secret 也可以，但要另外把頁面 Add connections 給它
//   NOTION_ROOT_PAGE_ID  根頁面 id（預設：36dd7785-7287-819e-a17a-d9a1045dbdc3）
//
// 用法：node sync/sync-notion.mjs
// 失敗時不會覆蓋既有的 data/content.js。

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildFromCache } from './build-data.mjs';
import { blocksToMarkdown } from './notion-blocks.mjs';

const TOKEN = process.env.NOTION_TOKEN;
const ROOT = (process.env.NOTION_ROOT_PAGE_ID || '36dd7785-7287-819e-a17a-d9a1045dbdc3').replace(/-/g, '');
const API = 'https://api.notion.com/v1';
const here = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(here, 'cache');

if (!TOKEN) {
  console.error('❌ 缺少 NOTION_TOKEN 環境變數。請到 https://www.notion.so/developers/tokens 建立個人存取權杖（ntn_ 開頭）後設定。');
  process.exit(1);
}

async function notion(pathname, params = {}) {
  const url = new URL(API + pathname);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28' } });
  if (!res.ok) throw new Error(`Notion API ${res.status} ${pathname}: ${await res.text()}`);
  return res.json();
}

async function children(blockId) {
  const out = [];
  let cursor;
  do {
    const page = await notion(`/blocks/${blockId}/children`, { page_size: 100, start_cursor: cursor });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return out;
}


async function main() {
  console.log('🔄 讀取 Notion 根頁面…');
  const rootBlocks = await children(ROOT);
  const childPages = rootBlocks.filter(b => b.type === 'child_page');
  if (!childPages.length) throw new Error('根頁面下找不到子頁面。請確認 NOTION_ROOT_PAGE_ID 正確；若用的是舊式 Internal Integration 權杖，還要在頁面 ••• → Add connections 把它加進去。');
  await mkdir(cacheDir, { recursive: true });

  for (const cp of childPages) {
    const page = await notion(`/pages/${cp.id}`);
    const title = cp.child_page.title.replace(/^[^\w一-鿿]+/, '').trim(); // 去掉開頭 emoji
    const icon = page.icon?.emoji || '';
    console.log(`  📄 ${icon} ${title}`);
    const body = await blocksToMarkdown(await children(cp.id), children);
    const md = ['---', `id: ${cp.id}`, `title: ${title}`, `icon: ${icon}`, `edited: ${page.last_edited_time}`, '---', ...body, ''].join('\n');
    await writeFile(path.join(cacheDir, `${cp.id}.md`), md, 'utf8');
  }

  const c = await buildFromCache(new Date().toISOString());
  console.log(`✅ 同步完成：${c.pages.length} 頁、單字 ${c.vocab.length}、文法 ${c.grammar.length}、會話 ${c.phrases.length}、假名 ${c.kana.length}`);
}

main().catch(e => { console.error('❌ 同步失敗（既有資料未變動）：', e.message); process.exit(1); });
