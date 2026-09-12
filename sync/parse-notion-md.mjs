// parse-notion-md.mjs
// 把 Notion 頁面的 Markdown 快取（sync/cache/*.md）解析成網站用的結構化資料。
// 純函式、無相依套件，可離線測試。
//
// 快取檔格式：
//   ---
//   id: <notion page id>
//   title: <標題>
//   icon: <emoji>
//   edited: <ISO 時間>
//   ---
//   ## 段落標題
//   > 引言
//   <table header-row="true"><tr><td>..</td></tr>...</table>
//   一般段落
//   - 清單項目

const SKIP_HEADINGS = ['🧭 快速導航', '📑 本頁索引'];

// ---------- 第一層：Markdown → page { sections[] } ----------

export function parseFrontMatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: md.slice(m[0].length) };
}

function stripInline(s) {
  // 移除 **粗體** 標記，保留文字（前端另外處理粗體顯示）
  return s.replace(/\*\*(.+?)\*\*/g, '$1').trim();
}

function parseTable(html) {
  const rows = [];
  const trRe = /<tr>([\s\S]*?)<\/tr>/g;
  let tr;
  while ((tr = trRe.exec(html))) {
    const cells = [];
    const tdRe = /<td>([\s\S]*?)<\/td>/g;
    let td;
    while ((td = tdRe.exec(tr[1]))) cells.push(td[1].trim());
    rows.push(cells);
  }
  if (!rows.length) return null;
  const headerRow = /header-row="true"/.test(html);
  return {
    type: 'table',
    headers: headerRow ? rows[0].map(stripInline) : [],
    rows: headerRow ? rows.slice(1) : rows,
  };
}

export function parsePageMarkdown(md) {
  const { meta, body } = parseFrontMatter(md);
  const lines = body.split(/\r?\n/);
  const sections = [];
  let cur = { heading: '', level: 0, blocks: [] };
  const push = () => { if (cur.heading || cur.blocks.length) sections.push(cur); };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      push();
      cur = { heading: h[2].trim(), level: h[1].length, blocks: [] };
      i++; continue;
    }
    if (line.startsWith('<table')) {
      let buf = line;
      while (!/<\/table>/.test(buf) && ++i < lines.length) buf += '\n' + lines[i];
      const t = parseTable(buf);
      if (t) cur.blocks.push(t);
      i++; continue;
    }
    if (line.startsWith('> ')) { cur.blocks.push({ type: 'quote', text: line.slice(2).trim() }); i++; continue; }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i].slice(2).trim()), i++;
      cur.blocks.push({ type: 'list', items });
      continue;
    }
    if (line.trim() === '---' || line.trim() === '' || /^<page /.test(line)) { i++; continue; }
    cur.blocks.push({ type: 'para', text: line.trim() });
    i++;
  }
  push();

  // 移除導航/索引段落
  const kept = sections.filter(s => !SKIP_HEADINGS.some(k => s.heading.startsWith(k)));
  return { id: meta.id || '', title: meta.title || '', icon: meta.icon || '', edited: meta.edited || '', sections: kept };
}

// ---------- 第二層：pages → vocab / grammar / phrases / kana ----------

function hashId(str) {
  // 穩定短 id（FNV-1a），給 localStorage 進度用
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

const LEVEL_RE = /\bN([1-5])\b/;
const CN_LEVEL = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 };
const POS_SET = ['名詞', '動詞', '形容詞', '副詞', '助詞'];

// 從標題判斷 JLPT 等級：「N2」或「日檢二級」都算
function levelOf(heading) {
  const m = heading.match(LEVEL_RE);
  if (m) return 'N' + m[1];
  const c = heading.match(/([一二三四五])級/);
  return c ? 'N' + CN_LEVEL[c[1]] : null;
}

function col(headers, ...names) {
  for (const n of names) { const i = headers.findIndex(h => h === n); if (i >= 0) return i; }
  return -1;
}

export function extractLearningData(pages) {
  const vocab = [], grammar = [], phrases = [], kana = [];
  const seen = new Set();
  const add = (arr, type, key, obj) => {
    const id = type + '_' + hashId(key);
    if (seen.has(id)) return;
    seen.add(id);
    arr.push({ id, ...obj });
  };

  for (const page of pages) {
    let level = null;        // 最近 ## 標題裡的 N1~N5
    let h2 = '', h3 = '';
    for (const sec of page.sections) {
      if (sec.level <= 2) { h2 = sec.heading; h3 = ''; level = levelOf(sec.heading); }
      else { h3 = sec.heading; level = levelOf(sec.heading) || level; }
      const source = h3 ? `${h2} › ${h3}` : h2;

      for (const b of sec.blocks) {
        if (b.type !== 'table') continue;
        const H = b.headers;

        // ---- 單字 ----
        const iw = col(H, '單字'), ir = col(H, '讀音'), im = col(H, '意思');
        if (iw >= 0 && ir >= 0 && im >= 0) {
          const ip = col(H, '重音'), ie = col(H, '例句');
          const lv = level || '筆記';
          const pos = POS_SET.find(p => h3.startsWith(p)) || '';
          for (const r of b.rows) {
            const word = stripInline(r[iw] || ''), reading = stripInline(r[ir] || ''), meaning = stripInline(r[im] || '');
            if (!word || !meaning) continue;
            add(vocab, 'v', `${word}|${reading}|${lv}`, {
              word, reading, meaning, level: lv, pos, source: `${page.title} › ${source}`,
              pitch: ip >= 0 ? r[ip] : undefined, example: ie >= 0 ? stripInline(r[ie]) : undefined,
            });
          }
          continue;
        }

        // ---- 五十音 ----
        const iro = col(H, '羅馬拼音'), ihi = col(H, '平假名'), ika = col(H, '片假名');
        if (iro >= 0 && ihi >= 0 && ika >= 0) {
          for (const r of b.rows) {
            add(kana, 'k', `${r[ihi]}`, { romaji: r[iro], hira: r[ihi], kata: r[ika], group: h2.replace(/（.*?）/, '').trim(), row: h3.replace(/（.*?）/, '').trim() });
          }
          continue;
        }

        // ---- 句型 / 疑問詞 / 助詞 ----
        const ipat = col(H, '句型', '疑問詞', '助詞');
        if (ipat >= 0 && im >= 0 || (ipat >= 0 && col(H, '用途') >= 0)) {
          const imean = im >= 0 ? im : col(H, '用途');
          const iex = col(H, '例句', '例子');
          for (const r of b.rows) {
            const pattern = stripInline(r[ipat] || ''), meaning = stripInline(r[imean] || '');
            if (!pattern || !meaning) continue;
            add(grammar, 'g', `${pattern}|${meaning}`, { pattern, meaning, example: iex >= 0 ? r[iex] : '', source: `${page.title} › ${source}` });
          }
          continue;
        }

        // ---- 活用表（原形 / 〜形 / 意思）----
        const ibase = col(H, '原形');
        if (ibase >= 0 && im >= 0 && H.length >= 3) {
          const iform = H.findIndex((h, idx) => idx !== ibase && idx !== im);
          for (const r of b.rows) {
            const pattern = stripInline(r[iform] || ''), meaning = stripInline(r[im] || '');
            if (!pattern || !meaning) continue;
            add(grammar, 'g', `${pattern}|${meaning}`, { pattern, meaning, example: `原形：${r[ibase]}（${H[iform]}）`, source: `${page.title} › ${source}` });
          }
          continue;
        }

        // ---- 會話（日語 / 羅馬字 / 中文 or 使用場合）----
        const ijp = col(H, '日語'), izh = col(H, '中文', '使用場合'), irm = col(H, '羅馬字');
        if (ijp >= 0 && izh >= 0) {
          for (const r of b.rows) {
            const jp = stripInline(r[ijp] || ''), zh = stripInline(r[izh] || '');
            if (!jp || !zh) continue;
            add(phrases, 'p', `${jp}|${zh}`, { jp, zh, romaji: irm >= 0 ? r[irm] : '', category: h2.replace(/^[^\w一-鿿]+/, '').trim(), source: `${page.title} › ${source}` });
          }
          continue;
        }

        // ---- 敬語（項目 / 說明，一個 ### 標題一句）----
        const iitem = col(H, '項目'), idesc = col(H, '說明');
        if (iitem >= 0 && idesc >= 0 && h3) {
          const kv = Object.fromEntries(b.rows.map(r => [r[iitem], stripInline(r[idesc] || '')]));
          if (kv['意思']) {
            const jp = h3.replace(/^[^\w぀-ヿ一-鿿]+/, '').trim();
            add(phrases, 'p', `${jp}|${kv['意思']}`, { jp, zh: kv['意思'], romaji: '', category: '敬語', usage: kv['用法'] || kv['時機'] || kv['說明'] || '', example: kv['例句'] || '', source: `${page.title} › ${source}` });
          }
          continue;
        }
      }
    }
  }
  return { vocab, grammar, phrases, kana };
}

export function buildContent(pageMarkdowns, syncedAt = new Date().toISOString()) {
  const pages = pageMarkdowns.map(parsePageMarkdown);
  const data = extractLearningData(pages);
  return { syncedAt, pages, ...data };
}

export function toContentJs(content) {
  return `// 由 sync/ 腳本自動產生，請勿手動編輯。\n// 同步時間：${content.syncedAt}\nwindow.NIHONGO_DATA = ${JSON.stringify(content, null, 1)};\n`;
}
