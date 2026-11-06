// notion-blocks.mjs — Notion blocks → 我們的簡易 Markdown（與 parse-notion-md.mjs 對應）
// children(blockId) 由呼叫端提供（sync-notion.mjs 用 Notion API；測試用假資料）
import { richText } from './notion-richtext.mjs';

// 頁面裡的子頁面（例如 文法筆記 → 助詞、連體修飾…）直接接在原位，讓段落和以前一樣都在同一頁。
// 子頁面開頭的「快速導航」「本頁索引」等，到第一個 ## 標題之前都略過；沒有 ## 標題的子頁面用頁名當標題。
async function inlineChildPage(b, children, depth) {
  const lines = await blocksToMarkdown(await children(b.id), children, depth);
  const first = lines.findIndex(l => l.startsWith('## '));
  if (first >= 0) return lines.slice(first);
  return lines.length ? [`## ${b.child_page.title.replace(/^[^\w一-鿿]+/, '').trim()}`, ...lines] : [];
}

export async function blocksToMarkdown(blocks, children, depth = 0) {
  const lines = [];
  for (const b of blocks) {
    const t = b.type, d = b[t];
    switch (t) {
      case 'heading_1': lines.push(`# ${richText(d.rich_text)}`); break;
      case 'heading_2': lines.push(`## ${richText(d.rich_text)}`); break;
      case 'heading_3': lines.push(`### ${richText(d.rich_text)}`); break;
      case 'paragraph': { const s = richText(d.rich_text); if (s) lines.push(s); break; }
      case 'quote':
      case 'callout': lines.push(`> ${(d.icon?.emoji ? d.icon.emoji + ' ' : '')}${richText(d.rich_text)}`); break;
      case 'bulleted_list_item':
      case 'numbered_list_item': lines.push(`- ${richText(d.rich_text)}`); break;
      case 'divider': lines.push('---'); break;
      case 'table': {
        const rows = await children(b.id);
        lines.push(`<table header-row="${d.has_column_header ? 'true' : 'false'}">`);
        for (const r of rows) lines.push('<tr>' + r.table_row.cells.map(c => `<td>${richText(c)}</td>`).join('') + '</tr>');
        lines.push('</table>');
        break;
      }
      case 'child_page': lines.push(...await inlineChildPage(b, children, depth + 1)); break;
      case 'toggle': {
        lines.push(richText(d.rich_text));
        if (b.has_children) lines.push(...await blocksToMarkdown(await children(b.id), children, depth + 1));
        break;
      }
      default: break;
    }
    if (b.has_children && !['table', 'toggle', 'child_page'].includes(t)) {
      lines.push(...await blocksToMarkdown(await children(b.id), children, depth + 1));
    }
  }
  return lines;
}
