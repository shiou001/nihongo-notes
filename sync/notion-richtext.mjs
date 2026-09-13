// notion-richtext.mjs — Notion rich_text 陣列 → 我們的簡易 Markdown
// 支援：粗體 **x**、連結 [x](url)
// 抽成獨立檔案是為了能在沒有 Notion 權杖的情況下測試（sync-notion.mjs 一載入就會檢查權杖）。

const NOTION_ORIGIN = 'https://www.notion.so';

// Notion 的連結有兩種：完整網址，或頁面內部連結的相對路徑（/36fd7785...）。
// 相對路徑補成完整網址；其他看不懂的格式丟掉，只留文字。
export function absoluteHref(href) {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return NOTION_ORIGIN + href;
  return '';
}

export function richText(rt = []) {
  return rt.map(t => {
    let s = t.plain_text ?? '';
    if (!s) return '';
    if (t.annotations?.bold) s = `**${s}**`;
    const href = absoluteHref(t.href);
    if (href) s = `[${s}](${href})`;
    return s;
  }).join('');
}
