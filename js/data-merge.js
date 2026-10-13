// data-merge.js — 把外部公開單字（data/external.js）併進 Notion 資料（data/content.js）
// 規則：同一個字、同讀音、同等級，以你 Notion 的版本為準；其他外部單字加進來，
//      並多一個「🌐 JLPT 公開單字」筆記頁，可以瀏覽和搜尋。
(() => {
  const D = window.NIHONGO_DATA, X = window.NIHONGO_EXTERNAL;
  if (!D) return;
  for (const v of D.vocab) v.origin ||= 'notion';
  if (!X || !Array.isArray(X.vocab) || !X.vocab.length) return;

  const key = v => `${v.word}\t${v.reading}\t${v.level}`;
  const have = new Set(D.vocab.map(key));
  const added = X.vocab.filter(v => !have.has(key(v)));
  D.vocab.push(...added);

  const levels = [...new Set(added.map(v => v.level))];
  D.pages.push({
    id: 'external-vocab', title: 'JLPT 公開單字', icon: '🌐', edited: X.builtAt, external: true,
    sections: [
      { heading: '關於這份資料', level: 2, blocks: [
        { type: 'para', text: '單字、讀音與英文解釋來自 [tanos.co.uk](http://www.tanos.co.uk/jlpt/) 的 JLPT 單字表（CC BY），經 [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) 整理。' },
        { type: 'quote', text: '中文解釋是 AI 翻譯的，可能有不精確的地方。測驗答完會同時顯示英文原文，可以對照。' },
      ] },
      ...levels.map(l => ({ heading: `🌟 ${l}`, level: 2, blocks: [
        { type: 'table', headers: ['單字', '讀音', '意思', '英文'],
          rows: added.filter(v => v.level === l).map(v => [v.word, v.reading, v.meaning, v.meaningEn || '']) },
      ] })),
    ],
  });
})();

// ── 生活日本（data/life.js）：主題的單字、實用句併進題庫，並加一個「生活日本」筆記頁 ──
// 已經有的單字（同字同讀音）直接共用，進度不會分成兩份。
(() => {
  const D = window.NIHONGO_DATA, L = window.NIHONGO_LIFE;
  if (!D || !L || !Array.isArray(L.topics)) return;
  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  D.drills ||= [];
  const PAGE = '生活日本';
  const byWord = new Map(D.vocab.map(v => [`${v.word}\t${v.reading}`, v]));
  const byJp = new Map(D.phrases.map(p => [p.jp, p]));
  for (const t of L.topics) {
    const source = `${PAGE} › ${t.title}`;
    t.items = { vocab: [], grammar: [], phrases: [], drills: [] };
    for (const [word, reading, meaning] of t.vocab || []) {
      let v = byWord.get(`${word}\t${reading}`);
      if (!v) {
        v = { id: 'l_' + hash(`${word}|${reading}|${t.level}`), word, reading, meaning, level: t.level, pos: '', origin: 'life', source };
        D.vocab.push(v); byWord.set(`${word}\t${reading}`, v);
      }
      if (!t.items.vocab.includes(v)) t.items.vocab.push(v);
    }
    for (const ph of t.phrases || []) {
      const jp = ph.parts.join('');
      let p = byJp.get(jp);
      if (!p) { p = { id: 'lp_' + hash(jp), jp, zh: ph.zh, romaji: '', category: t.title, source, parts: ph.parts, origin: 'life' }; D.phrases.push(p); byJp.set(jp, p); }
      else p.parts ||= ph.parts;
      if (!t.items.phrases.includes(p)) t.items.phrases.push(p);
    }
  }
  D.pages.push({
    id: 'life', title: PAGE, icon: '🗾', edited: '', life: true,
    sections: L.topics.flatMap(t => [
      { heading: t.title, level: 2, blocks: [
        ...(t.intro || []).map(text => ({ type: 'para', text })),
        { type: 'list', items: t.tips || [] },
        { type: 'table', headers: ['單字', '讀音', '意思'], rows: (t.vocab || []).map(r => [...r]) },
        { type: 'table', headers: ['日語', '中文'], rows: (t.phrases || []).map(p => [p.parts.join(''), p.zh]) },
      ] },
    ]),
  });
})();
